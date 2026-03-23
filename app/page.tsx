'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getJobs, getJobStats, retryJob, deleteJob, type Job, type JobStats } from '@/lib/api'
import { StatsCard } from '@/components/stats-card'
import { JobsTable } from '@/components/jobs-table'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Layers, Loader2, CheckCircle, XCircle, Plus, ArrowRight, ScanSearch } from 'lucide-react'

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<JobStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [jobsData, statsData] = await Promise.all([
          getJobs(),
          getJobStats(),
        ])
        setJobs(jobsData)
        setStats(statsData)
      } catch (error) {
        toast.error('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleRetry = async (id: string) => {
    try {
      await retryJob(id)
      const [jobsData, statsData] = await Promise.all([
        getJobs(),
        getJobStats(),
      ])
      setJobs(jobsData)
      setStats(statsData)
      toast.success('Job retry initiated')
    } catch (error) {
      toast.error('Failed to retry job')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteJob(id)
      const [jobsData, statsData] = await Promise.all([
        getJobs(),
        getJobStats(),
      ])
      setJobs(jobsData)
      setStats(statsData)
      toast.success('Job deleted')
    } catch (error) {
      toast.error('Failed to delete job')
    }
  }

  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-border/50 bg-surface">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="/images/hero-detection.jpg" 
            alt="" 
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
        </div>
        
        {/* Ambient gradient glow */}
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-accent-cyan/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-accent-violet/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan animate-pulse" />
              <span className="text-xs font-medium text-accent-cyan">AI-Powered Detection</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Lip Sync Detection
            </h1>
            <p className="mt-2 text-text-secondary">
              Detect lip-sync manipulation and deepfake content in videos using advanced AI analysis. Get instant results with confidence scores.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="gap-2 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90 shadow-lg shadow-accent-cyan/20"
          >
            <Link href="/new">
              <ScanSearch className="h-5 w-5" />
              New Detection
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Jobs"
          value={stats?.total ?? '-'}
          icon={Layers}
          variant="cyan"
        />
        <StatsCard
          title="Processing"
          value={stats?.processing ?? '-'}
          icon={Loader2}
          variant="violet"
        />
        <StatsCard
          title="Completed"
          value={stats?.completed ?? '-'}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Failed"
          value={stats?.failed ?? '-'}
          icon={XCircle}
          variant="error"
        />
      </div>

      {/* Recent Jobs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Recent Detection Jobs</h2>
          <Button variant="ghost" asChild className="gap-1 text-text-secondary hover:text-accent-cyan">
            <Link href="/history">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <JobsTable
          jobs={recentJobs}
          isLoading={isLoading}
          onRetry={handleRetry}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}
