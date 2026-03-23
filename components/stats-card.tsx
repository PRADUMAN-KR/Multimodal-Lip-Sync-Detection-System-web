import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'cyan' | 'violet' | 'success' | 'error'
  className?: string
}

const variantStyles = {
  default: {
    iconBg: 'bg-surface-2',
    iconColor: 'text-text-secondary',
  },
  cyan: {
    iconBg: 'bg-accent-cyan/10',
    iconColor: 'text-accent-cyan',
  },
  violet: {
    iconBg: 'bg-accent-violet/10',
    iconColor: 'text-accent-violet',
  },
  success: {
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  error: {
    iconBg: 'bg-error/10',
    iconColor: 'text-error',
  },
}

export function StatsCard({ title, value, icon: Icon, trend, variant = 'default', className }: StatsCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/50 bg-surface p-5 transition-all hover:border-border hover:bg-surface/80',
        className
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/[0.02] to-accent-violet/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-text-primary">{value}</p>
          {trend && (
            <p
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                trend.isPositive ? 'text-success' : 'text-error'
              )}
            >
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              <span className="text-text-secondary">vs last week</span>
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5', styles.iconBg)}>
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
      </div>
    </div>
  )
}
