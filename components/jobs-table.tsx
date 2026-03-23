'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Job, DetectionResult } from '@/lib/api'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, RotateCcw, Trash2, FileVideo, ShieldCheck, ShieldAlert, ShieldQuestion, ScanSearch } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface JobsTableProps {
  jobs: Job[]
  isLoading?: boolean
  onRetry?: (id: string) => void
  onDelete?: (id: string) => void
}

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

export function JobsTable({ jobs, isLoading, onRetry, onDelete }: JobsTableProps) {
  if (isLoading) {
    return <JobsTableSkeleton />
  }

  if (jobs.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface py-16">
        {/* Background decoration */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <img 
            src="/images/empty-state.jpg" 
            alt="" 
            className="h-64 w-64 object-cover blur-sm"
          />
        </div>
        <div className="relative flex flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-border/50">
            <ScanSearch className="h-7 w-7 text-text-secondary" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-text-primary">No detection jobs yet</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Upload a video to start detecting lip-sync manipulation
          </p>
          <Button asChild className="mt-6 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90 shadow-lg shadow-accent-cyan/20">
            <Link href="/new">New Detection</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-text-secondary">Job ID</TableHead>
            <TableHead className="text-text-secondary">Video</TableHead>
            <TableHead className="text-text-secondary">Model</TableHead>
            <TableHead className="text-text-secondary">Status</TableHead>
            <TableHead className="text-text-secondary">Result</TableHead>
            <TableHead className="text-text-secondary">Created</TableHead>
            <TableHead className="text-right text-text-secondary">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow
              key={job.id}
              className="border-border/50 transition-colors hover:bg-surface-2/50"
            >
              <TableCell className="font-mono text-sm text-text-primary">
                <Link
                  href={`/jobs/${job.id}`}
                  className="hover:text-accent-cyan transition-colors"
                >
                  {job.id}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <FileVideo className="h-4 w-4 text-accent-cyan" />
                  <span className="max-w-[150px] truncate">{job.videoFileName}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-text-primary">{job.model}</span>
              </TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                {job.status === 'completed' ? getResultBadge(job.result) : (
                  <span className="text-xs text-text-secondary">-</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm text-text-secondary">
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 text-text-secondary hover:text-accent-cyan"
                  >
                    <Link href={`/jobs/${job.id}`}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View job</span>
                    </Link>
                  </Button>
                  {job.status === 'failed' && onRetry && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRetry(job.id)}
                      className="h-8 w-8 text-text-secondary hover:text-warning"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="sr-only">Retry job</span>
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(job.id)}
                      className="h-8 w-8 text-text-secondary hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete job</span>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function JobsTableSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-text-secondary">Job ID</TableHead>
            <TableHead className="text-text-secondary">Video</TableHead>
            <TableHead className="text-text-secondary">Model</TableHead>
            <TableHead className="text-text-secondary">Status</TableHead>
            <TableHead className="text-text-secondary">Result</TableHead>
            <TableHead className="text-text-secondary">Created</TableHead>
            <TableHead className="text-right text-text-secondary">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i} className="border-border/50">
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
