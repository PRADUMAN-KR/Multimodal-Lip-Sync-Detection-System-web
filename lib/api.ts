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
}

export interface JobStats {
  total: number
  processing: number
  completed: number
  failed: number
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
  const confidence = typeof result.confidence === 'number' ? result.confidence : 0
  const manipulationProbability =
    typeof result.manipulation_probability === 'number' ? result.manipulation_probability : 0
  const overallScore = Math.round(manipulationProbability * 100)
  const authenticity = Math.round((1 - manipulationProbability) * 100)

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

  const statusInfo = await getJobStatus(id)
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
  }

  if (statusInfo.status === 'completed' || statusInfo.status === 'failed') {
    const res = await fetch(`${API_BASE}/result/${id}`)
    if (res.ok) {
      const data = (await res.json()) as BackendResultResponse
      updated = {
        ...updated,
        completedAt: statusInfo.status === 'completed' ? now : updated.completedAt,
        error: data.error ?? undefined,
        result: toDetectionResult(data.result),
        metrics: toDetectionMetrics(data.result),
      }
    }
  }

  return upsertJob(updated)
}

export async function getJobStatus(id: string): Promise<{ status: JobStatus; progress: number } | null> {
  const res = await fetch(`${API_BASE}/result/${id}`)
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
  // FastAPI backend currently has no retry endpoint, so this only updates local UI state.
  const job = jobsCache.get(id)
  if (!job) return null
  const retried: Job = {
    ...job,
    status: 'queued',
    progress: 0,
    error: undefined,
    result: undefined,
    metrics: undefined,
    updatedAt: new Date().toISOString(),
    logs: [...job.logs, { timestamp: new Date().toISOString(), level: 'warning', message: 'Retry is local only (no backend endpoint)' }],
  }
  return upsertJob(retried)
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
