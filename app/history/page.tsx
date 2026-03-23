'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { getJobs, getJob, retryJob, deleteJob, modelOptions, type Job, type JobStatus, type DetectionResult } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Search,
  Filter,
  Eye,
  RotateCcw,
  Trash2,
  FileVideo,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react'

const ITEMS_PER_PAGE = 9

type ViewMode = 'grid' | 'list'

function getResultBadge(result?: DetectionResult) {
  if (!result) return null
  
  switch (result) {
    case 'authentic':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          <ShieldCheck className="h-3 w-3" />
          Authentic
        </span>
      )
    case 'manipulated':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
          <ShieldAlert className="h-3 w-3" />
          Manipulated
        </span>
      )
    case 'inconclusive':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
          <ShieldQuestion className="h-3 w-3" />
          Inconclusive
        </span>
      )
  }
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')

  useEffect(() => {
    async function loadJobs(showToastOnError: boolean) {
      try {
        const cached = await getJobs()
        await Promise.all(cached.map((job) => getJob(job.id).catch(() => null)))
        const refreshed = await getJobs()
        setJobs(refreshed)
        setLastRefreshedAt(new Date())
      } catch (error) {
        if (showToastOnError) {
          toast.error('Failed to load jobs')
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadJobs(true)
    const interval = setInterval(() => loadJobs(false), 3000)
    return () => clearInterval(interval)
  }, [])

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        searchQuery === '' ||
        job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.videoFileName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      const matchesModel = modelFilter === 'all' || job.model === modelFilter

      return matchesSearch && matchesStatus && matchesModel
    })
  }, [jobs, searchQuery, statusFilter, modelFilter])

  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE)
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, modelFilter])

  const handleRetry = async (id: string) => {
    try {
      await retryJob(id)
      const data = await getJobs()
      setJobs(data)
      toast.success('Job retry initiated')
    } catch (error) {
      toast.error('Failed to retry job')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteJob(id)
      const data = await getJobs()
      setJobs(data)
      toast.success('Job deleted')
    } catch (error) {
      toast.error('Failed to delete job')
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Detection History</h1>
          <p className="mt-1 text-text-secondary">
            View and manage all your detection jobs
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Live sync {lastRefreshedAt ? `• updated ${formatDistanceToNow(lastRefreshedAt, { addSuffix: true })}` : ''}
          </p>
        </div>
        <Button asChild className="gap-2 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90">
          <Link href="/new">
            <ScanSearch className="h-4 w-4" />
            New Detection
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border/50 bg-surface p-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search by ID or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface-2 border-border pl-9 text-text-primary placeholder:text-text-secondary"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as JobStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-40 bg-surface-2 border-border text-text-primary">
            <Filter className="mr-2 h-4 w-4 text-text-secondary" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-surface border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="analyzing">Analyzing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Model Filter */}
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-surface-2 border-border text-text-primary">
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent className="bg-surface border-border">
            <SelectItem value="all">All Models</SelectItem>
            {modelOptions.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-md p-2 transition-colors',
              viewMode === 'grid' ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-2 transition-colors',
              viewMode === 'list' ? 'bg-accent-cyan/10 text-accent-cyan' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-text-secondary">
        {isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <span>
            Showing {paginatedJobs.length} of {filteredJobs.length} jobs
          </span>
        )}
      </div>

      {/* Jobs Display */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )
      ) : paginatedJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/50 bg-surface py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-2">
            <ScanSearch className="h-7 w-7 text-text-secondary" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-text-primary">No jobs found</h3>
          <p className="mt-1 text-sm text-text-secondary">
            {searchQuery || statusFilter !== 'all' || modelFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload a video to start detecting manipulation'}
          </p>
          {!searchQuery && statusFilter === 'all' && modelFilter === 'all' && (
            <Button asChild className="mt-6 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90">
              <Link href="/new">New Detection</Link>
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedJobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-border text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                  page === currentPage
                    ? 'bg-accent-cyan text-primary-foreground'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                )}
              >
                {page}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-border text-text-secondary hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      )}
    </div>
  )
}

interface JobCardProps {
  job: Job
  onRetry: (id: string) => void
  onDelete: (id: string) => void
}

function JobCard({ job, onRetry, onDelete }: JobCardProps) {
  return (
    <div className="group rounded-xl border border-border/50 bg-surface p-5 transition-all hover:border-border hover:bg-surface/80">
      <div className="mb-4 flex items-start justify-between">
        <StatusBadge status={job.status} />
        <span className="text-xs text-text-secondary">
          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
        </span>
      </div>

      <Link href={`/jobs/${job.id}`} className="block">
        <p className="font-mono text-sm font-medium text-text-primary hover:text-accent-cyan transition-colors">
          {job.id}
        </p>
      </Link>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <FileVideo className="h-3 w-3 text-accent-cyan" />
          <span className="truncate">{job.videoFileName}</span>
        </div>
        {job.status === 'completed' && job.result && (
          <div className="pt-1">
            {getResultBadge(job.result)}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1 border-t border-border/50 pt-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="flex-1 text-text-secondary hover:text-accent-cyan"
        >
          <Link href={`/jobs/${job.id}`}>
            <Eye className="mr-1 h-4 w-4" />
            View
          </Link>
        </Button>
        {job.status === 'failed' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRetry(job.id)}
            className="text-text-secondary hover:text-warning"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Retry</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(job.id)}
          className="text-text-secondary hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  )
}

function JobListItem({ job, onRetry, onDelete }: JobCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-surface p-4 transition-all hover:border-border hover:bg-surface/80">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/jobs/${job.id}`}
            className="font-mono text-sm font-medium text-text-primary hover:text-accent-cyan transition-colors"
          >
            {job.id}
          </Link>
          <StatusBadge status={job.status} />
          {job.status === 'completed' && job.result && getResultBadge(job.result)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <FileVideo className="h-3 w-3 text-accent-cyan" />
            {job.videoFileName}
          </span>
          <span>{job.model}</span>
          <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 text-text-secondary hover:text-accent-cyan"
        >
          <Link href={`/jobs/${job.id}`}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Link>
        </Button>
        {job.status === 'failed' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRetry(job.id)}
            className="h-8 w-8 text-text-secondary hover:text-warning"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="sr-only">Retry</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(job.id)}
          className="h-8 w-8 text-text-secondary hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  )
}
