// Types
export type JobStatus = 'queued' | 'processing' | 'analyzing' | 'completed' | 'failed'

export type DetectionResult = 'authentic' | 'manipulated' | 'inconclusive'

export interface DetectionMetrics {
  overallScore: number // 0-100, higher = more likely manipulated
  audioVisualSync: number // Sync accuracy score
  facialConsistency: number // Facial feature consistency
  temporalCoherence: number // Frame-to-frame consistency
  lipMovementNaturalness: number // Natural lip movement score
}

export interface Job {
  id: string
  videoFileName: string
  model: string
  sensitivity: 'low' | 'medium' | 'high'
  status: JobStatus
  progress: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  result?: DetectionResult
  metrics?: DetectionMetrics
  logs: LogEntry[]
  error?: string
  framesAnalyzed?: number
  duration?: string
  includeDebug?: boolean
  localVideoUrl?: string
  evidenceFrames?: Array<{ timeSec: number; imageDataUrl: string }>
  dominantWindows?: Array<{
    windowIndex: number
    timeStartSec: number
    timeEndSec: number
    fakeConfidence: number
    speakingActivity?: number
    imageDataUrl?: string
  }>
}

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
}

export interface CreateJobPayload {
  videoFile: File
  model: string
  sensitivity: 'low' | 'medium' | 'high'
  includeDebug?: boolean
}

export interface JobStats {
  total: number
  processing: number
  completed: number
  failed: number
}

export const analysisEngineInfo = {
  name: 'LipSync Detector',
  version: 'v2.1',
  calibration: 'none',
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
const JOBS_STORAGE_KEY = 'lip_sync_jobs_cache_v1'

type BackendCreateJobResponse = {
  job_id: string
  status: string
  created_at: string
}

type BackendResultResponse = {
  job_id: string
  status: string
  result?: {
    is_fake?: boolean
    is_real?: boolean
    manipulation_probability?: number
    confidence?: number
    window_results?: Array<{
      window_index: number
      time_start_sec: number
      time_end_sec: number
      confidence: number
      speaking_activity?: number
      is_fake?: boolean
    }>
  } | null
  error?: string | null
}

const jobsCache = new Map<string, Job>()
const jobsOrder: string[] = []
let isHydrated = false

function mapBackendStatus(status: string): JobStatus {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'completed'
    case 'FAILED':
      return 'failed'
    case 'PROCESSING':
      return 'processing'
    case 'ANALYZING':
      return 'analyzing'
    case 'QUEUED':
      return 'queued'
    default:
      return 'queued'
  }
}

function toDetectionResult(result?: BackendResultResponse['result']): DetectionResult | undefined {
  if (!result) return undefined
  if (result.is_fake === true) return 'manipulated'
  if (result.is_real === true) return 'authentic'
  return 'inconclusive'
}

function toDetectionMetrics(result?: BackendResultResponse['result']): DetectionMetrics | undefined {
  if (!result) return undefined
  const confidenceRaw = typeof result.confidence === 'number' ? result.confidence : 0
  const manipulationRaw =
    typeof result.manipulation_probability === 'number' ? result.manipulation_probability : 0

  const confidence = Math.round(normalizePercent(confidenceRaw))
  const overallScore = Math.round(normalizePercent(manipulationRaw))
  const authenticity = Math.max(0, 100 - overallScore)

  return {
    overallScore,
    audioVisualSync: authenticity,
    facialConsistency: confidence,
    temporalCoherence: confidence,
    lipMovementNaturalness: authenticity,
  }
}

function upsertJob(job: Job): Job {
  jobsCache.set(job.id, job)
  if (!jobsOrder.includes(job.id)) jobsOrder.unshift(job.id)
  persistCache()
  return job
}

function appendLogIfNew(job: Job, entry: LogEntry): Job {
  const last = job.logs[job.logs.length - 1]
  if (last && last.message === entry.message) return job
  return { ...job, logs: [...job.logs, entry] }
}

function normalizePercent(value: number): number {
  // Backend may return probabilities in [0..1] or percentages in [0..100].
  const scaled = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, scaled))
}

function buildDominantWindows(
  result: BackendResultResponse['result'],
  evidenceFrames?: Job['evidenceFrames']
): Job['dominantWindows'] {
  const windows = result?.window_results
  if (!windows || windows.length === 0) return undefined

  const ranked = windows
    .map((w) => {
      const realPercent = normalizePercent(typeof w.confidence === 'number' ? w.confidence : 0)
      return {
        windowIndex: w.window_index,
        timeStartSec: w.time_start_sec,
        timeEndSec: w.time_end_sec,
        fakeConfidence: 100 - realPercent,
        speakingActivity: w.speaking_activity,
      }
    })
    .sort((a, b) => b.fakeConfidence - a.fakeConfidence)
    .slice(0, 3)

  return ranked.map((w) => {
    const midpoint = (w.timeStartSec + w.timeEndSec) / 2
    const nearestFrame =
      evidenceFrames && evidenceFrames.length > 0
        ? evidenceFrames.reduce((best, frame) =>
            Math.abs(frame.timeSec - midpoint) < Math.abs(best.timeSec - midpoint) ? frame : best
          )
        : undefined
    return {
      windowIndex: w.windowIndex,
      timeStartSec: w.timeStartSec,
      timeEndSec: w.timeEndSec,
      fakeConfidence: Math.round(w.fakeConfidence),
      speakingActivity: w.speakingActivity,
      imageDataUrl: nearestFrame?.imageDataUrl,
    }
  })
}

async function extractEvidenceFrames(videoFile: File): Promise<Array<{ timeSec: number; imageDataUrl: string }>> {
  if (typeof document === 'undefined') return []

  const objectUrl = URL.createObjectURL(videoFile)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.src = objectUrl

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('error', onError)
        resolve()
      }
      const onError = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('error', onError)
        reject(new Error('Failed to load video metadata'))
      }
      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onError)
    })

    if (!Number.isFinite(video.duration) || video.duration <= 0) return []

    const points = [0.2, 0.5, 0.8]
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    if (!ctx) return []

    const frames: Array<{ timeSec: number; imageDataUrl: string }> = []
    for (const point of points) {
      const timeSec = Math.max(0, Math.min(video.duration - 0.05, video.duration * point))
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)
          resolve()
        }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = timeSec
      })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({ timeSec, imageDataUrl: canvas.toDataURL('image/jpeg', 0.72) })
    }

    return frames
  } catch {
    return []
  } finally {
    video.src = ''
    URL.revokeObjectURL(objectUrl)
  }
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function hydrateCache(): void {
  if (isHydrated || !canUseStorage()) return
  isHydrated = true

  const raw = window.localStorage.getItem(JOBS_STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as Job[]
    for (const job of parsed) {
      jobsCache.set(job.id, job)
      if (!jobsOrder.includes(job.id)) jobsOrder.push(job.id)
    }
  } catch {
    window.localStorage.removeItem(JOBS_STORAGE_KEY)
  }
}

function persistCache(): void {
  if (!canUseStorage()) return
  const jobs = jobsOrder.map(id => jobsCache.get(id)).filter((job): job is Job => Boolean(job))
  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs))
}

// API functions
export async function getJobs(): Promise<Job[]> {
  hydrateCache()
  return jobsOrder.map(id => jobsCache.get(id)).filter((job): job is Job => Boolean(job))
}

export async function getJob(id: string): Promise<Job | null> {
  hydrateCache()
  const existing = jobsCache.get(id)
  const includeDebug = existing?.includeDebug ?? true

  const statusInfo = await getJobStatus(id, includeDebug)
  if (!statusInfo) return null

  const now = new Date().toISOString()
  let updated: Job = {
    id,
    videoFileName: existing?.videoFileName ?? 'Uploaded video',
    model: existing?.model ?? 'lipsync-detector-v2',
    sensitivity: existing?.sensitivity ?? 'medium',
    status: statusInfo.status,
    progress: statusInfo.progress,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    logs: existing?.logs ?? [{ timestamp: now, level: 'info', message: 'Loaded job from backend' }],
    framesAnalyzed: existing?.framesAnalyzed,
    duration: existing?.duration,
    completedAt: existing?.completedAt,
    includeDebug,
    localVideoUrl: existing?.localVideoUrl,
    evidenceFrames: existing?.evidenceFrames,
    dominantWindows: existing?.dominantWindows,
  }

  if (existing && existing.status !== statusInfo.status) {
    updated = appendLogIfNew(updated, {
      timestamp: now,
      level: 'info',
      message: `Status changed: ${existing.status} -> ${statusInfo.status}`,
    })
  }

  if (statusInfo.status === 'completed' || statusInfo.status === 'failed') {
    const res = await fetch(`${API_BASE}/result/${id}?include_debug=${includeDebug ? 'true' : 'false'}`)
    if (res.ok) {
      const data = (await res.json()) as BackendResultResponse
      updated = {
        ...updated,
        completedAt: statusInfo.status === 'completed' ? now : updated.completedAt,
        error: data.error ?? undefined,
        result: toDetectionResult(data.result),
        metrics: toDetectionMetrics(data.result),
        dominantWindows: buildDominantWindows(data.result, updated.evidenceFrames),
      }
      if (statusInfo.status === 'completed') {
        updated = appendLogIfNew(updated, {
          timestamp: now,
          level: 'info',
          message: 'Analysis complete. Result received from backend.',
        })
      }
      if (statusInfo.status === 'failed') {
        updated = appendLogIfNew(updated, {
          timestamp: now,
          level: 'error',
          message: data.error ?? 'Analysis failed on backend.',
        })
      }
    }
  }

  return upsertJob(updated)
}

export async function getJobStatus(id: string, includeDebug: boolean = true): Promise<{ status: JobStatus; progress: number } | null> {
  const res = await fetch(`${API_BASE}/result/${id}?include_debug=${includeDebug ? 'true' : 'false'}`)
  if (res.status === 404) return null
  if (res.status === 202) return { status: 'processing', progress: 50 }
  if (!res.ok) {
    throw new Error(`Failed to fetch job status (${res.status})`)
  }

  const data = (await res.json()) as BackendResultResponse
  const status = mapBackendStatus(data.status)
  return {
    status,
    progress: status === 'completed' || status === 'failed' ? 100 : 50,
  }
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  hydrateCache()
  const evidenceFrames = await extractEvidenceFrames(payload.videoFile)
  const formData = new FormData()
  formData.append('video_file', payload.videoFile)

  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to create job (${res.status}): ${errorText}`)
  }

  const data = (await res.json()) as BackendCreateJobResponse
  const newJob: Job = {
    id: data.job_id,
    videoFileName: payload.videoFile.name,
    model: payload.model,
    sensitivity: payload.sensitivity,
    status: mapBackendStatus(data.status),
    progress: 0,
    createdAt: data.created_at,
    updatedAt: data.created_at,
    logs: [{ timestamp: new Date().toISOString(), level: 'info', message: 'Job submitted to backend' }],
    includeDebug: payload.includeDebug ?? true,
    localVideoUrl: URL.createObjectURL(payload.videoFile),
    evidenceFrames,
  }
  return upsertJob(newJob)
}

export async function deleteJob(id: string): Promise<boolean> {
  hydrateCache()
  if (!jobsCache.has(id)) return false
  jobsCache.delete(id)
  const index = jobsOrder.indexOf(id)
  if (index >= 0) jobsOrder.splice(index, 1)
  persistCache()
  return true
}

export async function retryJob(id: string): Promise<Job | null> {
  hydrateCache()
  const existing = jobsCache.get(id)
  if (!existing) return getJob(id)

  const retryRes = await fetch(`${API_BASE}/jobs/${id}/retry`, { method: 'POST' })
  if (!retryRes.ok) {
    const errorText = await retryRes.text()
    throw new Error(`Failed to retry job (${retryRes.status}): ${errorText}`)
  }

  // Pull latest truth from backend after re-queue.
  const refreshed = await getJob(id)
  if (refreshed) return refreshed

  // Keep previous local record if backend status endpoint is temporarily unavailable.
  return upsertJob({
    ...existing,
    status: 'queued',
    progress: 0,
    error: undefined,
    result: undefined,
    metrics: undefined,
    updatedAt: new Date().toISOString(),
    logs: [
      ...existing.logs,
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Job re-queued',
      },
    ],
  })
}

export async function getJobStats(): Promise<JobStats> {
  const jobs = await getJobs()
  return {
    total: jobs.length,
    processing: jobs.filter(j => j.status === 'processing' || j.status === 'analyzing' || j.status === 'queued').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  }
}

// Model options for detection
export const modelOptions = [
  { value: 'lipsync-detector-v2', label: 'LipSync Detector v2', description: 'Fast and accurate detection' },
  { value: 'lipsync-detector-pro', label: 'LipSync Detector Pro', description: 'Enhanced accuracy for complex cases' },
  { value: 'deepfake-analyzer', label: 'Deepfake Analyzer', description: 'Comprehensive deepfake detection' },
]

export const sensitivityOptions = [
  { value: 'low', label: 'Low', description: 'Fewer false positives, may miss subtle manipulations' },
  { value: 'medium', label: 'Medium', description: 'Balanced detection sensitivity' },
  { value: 'high', label: 'High', description: 'Maximum sensitivity, may have more false positives' },
]
