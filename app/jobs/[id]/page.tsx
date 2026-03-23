'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getJob, retryJob, type Job, type JobStatus, type DetectionResult } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  Clock,
  Loader2,
  ScanSearch,
  CheckCircle,
  XCircle,
  FileVideo,
  Info,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Gauge,
} from 'lucide-react'

const statusSteps: { status: JobStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: 'queued', label: 'Queued', icon: Clock },
  { status: 'processing', label: 'Processing', icon: Loader2 },
  { status: 'analyzing', label: 'Analyzing', icon: ScanSearch },
  { status: 'completed', label: 'Completed', icon: CheckCircle },
]

function getStepIndex(status: JobStatus): number {
  if (status === 'failed') return -1
  return statusSteps.findIndex((s) => s.status === status)
}

function getResultDisplay(result: DetectionResult) {
  switch (result) {
    case 'authentic':
      return {
        icon: ShieldCheck,
        label: 'Authentic',
        description: 'No significant manipulation detected',
        color: 'text-success',
        bgColor: 'bg-success/10',
        borderColor: 'border-success/30',
      }
    case 'manipulated':
      return {
        icon: ShieldAlert,
        label: 'Manipulation Detected',
        description: 'Signs of lip-sync manipulation found',
        color: 'text-error',
        bgColor: 'bg-error/10',
        borderColor: 'border-error/30',
      }
    case 'inconclusive':
      return {
        icon: ShieldQuestion,
        label: 'Inconclusive',
        description: 'Unable to determine with high confidence',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
        borderColor: 'border-warning/30',
      }
  }
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const jobId = params.id as string

  useEffect(() => {
    async function loadJob() {
      try {
        const data = await getJob(jobId)
        if (data) {
          setJob(data)
        } else {
          toast.error('Job not found')
          router.push('/')
        }
      } catch (error) {
        toast.error('Failed to load job')
      } finally {
        setIsLoading(false)
      }
    }
    loadJob()
  }, [jobId, router])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return

    const interval = setInterval(async () => {
      try {
        const data = await getJob(jobId)
        if (data) {
          setJob(data)
        }
      } catch {
        // Keep silent during polling to avoid noisy toasts.
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [job, jobId])

  const handleRetry = async () => {
    if (!job) return
    setIsRetrying(true)
    try {
      const updatedJob = await retryJob(job.id)
      if (updatedJob) {
        setJob(updatedJob)
        toast.success('Job retry initiated')
      }
    } catch (error) {
      toast.error('Failed to retry job')
    } finally {
      setIsRetrying(false)
    }
  }

  if (isLoading) {
    return <JobDetailsSkeleton />
  }

  if (!job) {
    return null
  }

  const currentStepIndex = getStepIndex(job.status)
  const resultDisplay = job.result ? getResultDisplay(job.result) : null

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 gap-2 text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">Detection Results</h1>
                <StatusBadge status={job.status} />
              </div>
              <p className="mt-1 font-mono text-sm text-text-secondary">{job.id}</p>
            </div>
            <div className="flex items-center gap-2">
              {job.status === 'failed' && (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="gap-2 border-warning/30 text-warning hover:bg-warning/10"
                >
                  {isRetrying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Retry Job
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detection Result */}
            {job.status === 'completed' && resultDisplay && (
              <div className={cn('rounded-2xl border p-6', resultDisplay.borderColor, resultDisplay.bgColor)}>
                <div className="flex items-start gap-4">
                  <div className={cn('rounded-xl p-3', resultDisplay.bgColor)}>
                    <resultDisplay.icon className={cn('h-8 w-8', resultDisplay.color)} />
                  </div>
                  <div className="flex-1">
                    <h2 className={cn('text-xl font-semibold', resultDisplay.color)}>
                      {resultDisplay.label}
                    </h2>
                    <p className="mt-1 text-sm text-text-secondary">{resultDisplay.description}</p>
                    
                    {job.metrics && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-background/50 p-3">
                          <p className="text-xs text-text-secondary">Manipulation Score</p>
                          <p className={cn('text-lg font-semibold', 
                            job.metrics.overallScore > 70 ? 'text-error' : 
                            job.metrics.overallScore > 40 ? 'text-warning' : 'text-success'
                          )}>
                            {job.metrics.overallScore}%
                          </p>
                        </div>
                        <div className="rounded-lg bg-background/50 p-3">
                          <p className="text-xs text-text-secondary">Frames Analyzed</p>
                          <p className="text-lg font-semibold text-text-primary">
                            {job.framesAnalyzed?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Metrics */}
            {job.status === 'completed' && job.metrics && (
              <div className="rounded-2xl border border-border/50 bg-surface p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <Gauge className="h-5 w-5 text-accent-violet" />
                  Analysis Metrics
                </h2>
                <div className="space-y-4">
                  <MetricBar label="Audio-Visual Sync" value={job.metrics.audioVisualSync} />
                  <MetricBar label="Facial Consistency" value={job.metrics.facialConsistency} />
                  <MetricBar label="Temporal Coherence" value={job.metrics.temporalCoherence} />
                  <MetricBar label="Lip Movement Naturalness" value={job.metrics.lipMovementNaturalness} />
                </div>
                <p className="mt-4 text-xs text-text-secondary">
                  Higher scores indicate more natural/authentic characteristics. Lower scores may indicate manipulation.
                </p>
              </div>
            )}

            {/* Status Timeline */}
            <div className="rounded-2xl border border-border/50 bg-surface p-6">
              <h2 className="mb-6 text-lg font-semibold text-text-primary">Processing Status</h2>
              
              {job.status === 'failed' ? (
                <div className="rounded-xl border border-error/30 bg-error/5 p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-0.5 h-5 w-5 text-error" />
                    <div>
                      <p className="font-medium text-text-primary">Analysis Failed</p>
                      <p className="mt-1 text-sm text-text-secondary">{job.error || 'An unknown error occurred'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    {/* Progress Line */}
                    <div className="absolute left-5 top-5 h-[calc(100%-40px)] w-0.5 bg-border" />
                    <div
                      className="absolute left-5 top-5 w-0.5 bg-accent-cyan transition-all duration-500"
                      style={{
                        height: `${Math.max(0, (currentStepIndex / (statusSteps.length - 1)) * 100)}%`,
                        maxHeight: 'calc(100% - 40px)',
                      }}
                    />

                    {/* Steps */}
                    <div className="relative space-y-6">
                      {statusSteps.map((step, index) => {
                        const isActive = index === currentStepIndex
                        const isCompleted = index < currentStepIndex
                        const Icon = step.icon

                        return (
                          <div key={step.status} className="flex items-center gap-4">
                            <div
                              className={cn(
                                'relative z-10 flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                                isCompleted && 'bg-success/10 text-success',
                                isActive && 'bg-accent-cyan/10 text-accent-cyan',
                                !isCompleted && !isActive && 'bg-surface-2 text-text-secondary'
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-5 w-5',
                                  isActive && (step.status === 'processing' || step.status === 'analyzing') && 'animate-spin'
                                )}
                              />
                            </div>
                            <div>
                              <p
                                className={cn(
                                  'font-medium',
                                  isActive || isCompleted ? 'text-text-primary' : 'text-text-secondary'
                                )}
                              >
                                {step.label}
                              </p>
                              {isActive && job.progress > 0 && job.progress < 100 && (
                                <p className="text-sm text-text-secondary">{job.progress}% complete</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {(job.status === 'processing' || job.status === 'analyzing') && (
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">Overall Progress</span>
                        <span className="font-medium text-accent-cyan">{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Logs */}
            <Collapsible open={isLogsOpen} onOpenChange={setIsLogsOpen}>
              <div className="rounded-2xl border border-border/50 bg-surface">
                <CollapsibleTrigger className="flex w-full items-center justify-between p-6">
                  <h2 className="text-lg font-semibold text-text-primary">Processing Logs</h2>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 text-text-secondary transition-transform',
                      isLogsOpen && 'rotate-180'
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/50 p-4">
                    <div className="max-h-64 overflow-y-auto rounded-lg bg-background p-4 font-mono text-xs">
                      {job.logs.map((log, index) => {
                        const LogIcon =
                          log.level === 'error'
                            ? AlertCircle
                            : log.level === 'warning'
                              ? AlertTriangle
                              : Info

                        return (
                          <div
                            key={index}
                            className="flex items-start gap-2 py-1"
                          >
                            <LogIcon
                              className={cn(
                                'mt-0.5 h-3 w-3 shrink-0',
                                log.level === 'error' && 'text-error',
                                log.level === 'warning' && 'text-warning',
                                log.level === 'info' && 'text-text-secondary'
                              )}
                            />
                            <span className="text-text-secondary">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </span>
                            <span
                              className={cn(
                                log.level === 'error' && 'text-error',
                                log.level === 'warning' && 'text-warning',
                                log.level === 'info' && 'text-text-primary'
                              )}
                            >
                              {log.message}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>

          {/* Sidebar - Job Metadata */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/50 bg-surface p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Job Information</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase text-text-secondary">Job ID</dt>
                  <dd className="mt-1 font-mono text-sm text-text-primary">{job.id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-text-secondary">Model</dt>
                  <dd className="mt-1 text-sm text-text-primary">{job.model}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-text-secondary">Sensitivity</dt>
                  <dd className="mt-1 text-sm text-text-primary capitalize">{job.sensitivity}</dd>
                </div>
                {job.duration && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-secondary">Video Duration</dt>
                    <dd className="mt-1 text-sm text-text-primary">{job.duration}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-2xl border border-border/50 bg-surface p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">File</h2>
              {/* Video preview placeholder */}
              <div className="mb-3 relative overflow-hidden rounded-lg aspect-video bg-surface-2">
                <img 
                  src="/images/analysis-visual.jpg" 
                  alt="Video analysis preview" 
                  className="h-full w-full object-cover opacity-60"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
                    <FileVideo className="h-6 w-6 text-accent-cyan" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-2 p-3">
                <FileVideo className="h-5 w-5 text-accent-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{job.videoFileName}</p>
                  <p className="text-xs text-text-secondary">Video Source</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-surface p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">Timestamps</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase text-text-secondary">Created</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {format(new Date(job.createdAt), 'MMM d, yyyy HH:mm')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-text-secondary">Last Updated</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {format(new Date(job.updatedAt), 'MMM d, yyyy HH:mm')}
                  </dd>
                </div>
                {job.completedAt && (
                  <div>
                    <dt className="text-xs font-medium uppercase text-text-secondary">Completed</dt>
                    <dd className="mt-1 text-sm text-text-primary">
                      {format(new Date(job.completedAt), 'MMM d, yyyy HH:mm')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v >= 70) return 'bg-success'
    if (v >= 40) return 'bg-warning'
    return 'bg-error'
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className={cn('font-medium',
          value >= 70 ? 'text-success' :
          value >= 40 ? 'text-warning' : 'text-error'
        )}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-all', getColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function JobDetailsSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Skeleton className="mb-4 h-9 w-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
