import { cn } from '@/lib/utils'
import type { JobStatus } from '@/lib/api'
import { Clock, Loader2, ScanSearch, CheckCircle, XCircle } from 'lucide-react'

interface StatusBadgeProps {
  status: JobStatus
  className?: string
  showIcon?: boolean
}

const statusConfig: Record<JobStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  queued: {
    label: 'Queued',
    className: 'bg-text-secondary/10 text-text-secondary border-text-secondary/20',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    className: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
    icon: Loader2,
  },
  analyzing: {
    label: 'Analyzing',
    className: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
    icon: ScanSearch,
  },
  completed: {
    label: 'Completed',
    className: 'bg-success/10 text-success border-success/20',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    className: 'bg-error/10 text-error border-error/20',
    icon: XCircle,
  },
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            'h-3 w-3',
            (status === 'processing' || status === 'analyzing') && 'animate-spin'
          )}
        />
      )}
      {config.label}
    </span>
  )
}
