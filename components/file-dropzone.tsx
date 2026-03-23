'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, X, FileVideo, FileAudio, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface FileDropzoneProps {
  accept: 'video' | 'audio'
  file: File | null
  onFileSelect: (file: File | null) => void
  className?: string
  disabled?: boolean
}

const acceptConfig = {
  video: {
    accept: 'video/*',
    label: 'video file',
    icon: FileVideo,
    formats: 'MP4, MOV, AVI, WebM',
  },
  audio: {
    accept: 'audio/*',
    label: 'audio file',
    icon: FileAudio,
    formats: 'MP3, WAV, AAC, FLAC',
  },
}

export function FileDropzone({ accept, file, onFileSelect, className, disabled }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoMeta, setVideoMeta] = useState<{ durationSec: number; width: number; height: number } | null>(null)
  const [framePreviews, setFramePreviews] = useState<string[]>([])
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const config = acceptConfig[accept]
  const Icon = config.icon

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      simulateUpload(droppedFile)
    }
  }, [disabled])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      simulateUpload(selectedFile)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!file || accept !== 'video') {
      setPreviewUrl(null)
      setVideoMeta(null)
      setFramePreviews([])
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file, accept])

  useEffect(() => {
    if (!previewUrl || accept !== 'video') {
      setVideoMeta(null)
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = previewUrl

    const onLoaded = () => {
      setVideoMeta({
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      })
    }

    video.addEventListener('loadedmetadata', onLoaded)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.src = ''
    }
  }, [previewUrl, accept])

  useEffect(() => {
    if (!previewUrl || accept !== 'video') {
      setFramePreviews([])
      return
    }

    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.src = previewUrl

    const captureFrames = async () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || cancelled) return
      const points = [0.2, 0.5, 0.8]
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const shots: string[] = []
      for (const point of points) {
        if (cancelled) return
        const t = Math.max(0, Math.min(video.duration - 0.05, video.duration * point))
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve()
          }
          video.addEventListener('seeked', onSeeked)
          video.currentTime = t
        })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        shots.push(canvas.toDataURL('image/jpeg', 0.72))
      }
      if (!cancelled) setFramePreviews(shots)
    }

    const onLoaded = () => {
      void captureFrames()
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onLoaded)
      video.src = ''
    }
  }, [previewUrl, accept])

  const simulateUpload = (selectedFile: File) => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current)
    }
    setUploadProgress(0)
    let progress = 0
    uploadIntervalRef.current = setInterval(() => {
      progress += 10
      if (progress >= 100) {
        if (uploadIntervalRef.current) {
          clearInterval(uploadIntervalRef.current)
          uploadIntervalRef.current = null
        }
        setUploadProgress(null)
        onFileSelect(selectedFile)
        return
      }
      setUploadProgress(progress)
    }, 100)
  }

  const handleRemove = () => {
    onFileSelect(null)
    setUploadProgress(null)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '-'
    const total = Math.round(seconds)
    const mins = Math.floor(total / 60)
    const secs = total % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (file) {
    return (
      <div
        className={cn(
          'relative rounded-xl border border-success/30 bg-success/5 p-4',
          className
        )}
      >
        {accept === 'video' && previewUrl && (
          <div className="mb-4 overflow-hidden rounded-lg border border-border/60 bg-black">
            <video
              src={previewUrl}
              controls
              className="h-56 w-full object-contain md:h-72"
              preload="metadata"
            />
          </div>
        )}
        {accept === 'video' && videoMeta && (
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-surface-2 p-3 text-xs">
            <div>
              <p className="text-text-secondary">Duration</p>
              <p className="font-medium text-text-primary">{formatDuration(videoMeta.durationSec)}</p>
            </div>
            <div>
              <p className="text-text-secondary">Resolution</p>
              <p className="font-medium text-text-primary">
                {videoMeta.width > 0 ? `${videoMeta.width}x${videoMeta.height}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-text-secondary">Quality Hint</p>
              <p className="font-medium text-text-primary">
                {videoMeta.height >= 720 ? 'High' : videoMeta.height >= 480 ? 'Recommended' : 'Low'}
              </p>
            </div>
          </div>
        )}
        {accept === 'video' && framePreviews.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-text-secondary">Keyframes</p>
            <div className="grid grid-cols-3 gap-2">
              {framePreviews.map((src, idx) => (
                <div key={idx} className="overflow-hidden rounded-md border border-border/60 bg-black">
                  <img src={src} alt={`Video keyframe ${idx + 1}`} className="h-16 w-full object-cover md:h-20" />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
            <Icon className="h-6 w-6 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
            <p className="text-xs text-text-secondary">{formatFileSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-secondary hover:text-error"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (uploadProgress !== null) {
    return (
      <div
        className={cn(
          'relative rounded-xl border border-border bg-surface p-6',
          className
        )}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-cyan/10">
              <Icon className="h-5 w-5 text-accent-cyan" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Uploading...</p>
              <p className="text-xs text-text-secondary">{uploadProgress}%</p>
            </div>
          </div>
          <Progress value={uploadProgress} className="h-1.5" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-all',
        isDragging
          ? 'border-accent-cyan bg-accent-cyan/5'
          : 'border-border hover:border-text-secondary',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 p-8',
          disabled && 'cursor-not-allowed'
        )}
      >
        <input
          type="file"
          accept={config.accept}
          onChange={handleFileSelect}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl transition-colors',
            isDragging ? 'bg-accent-cyan/10' : 'bg-surface-2'
          )}
        >
          <Upload
            className={cn(
              'h-6 w-6 transition-colors',
              isDragging ? 'text-accent-cyan' : 'text-text-secondary'
            )}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">
            Drop your {config.label} here, or{' '}
            <span className="text-accent-cyan">browse</span>
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Supports: {config.formats}
          </p>
        </div>
      </label>
    </div>
  )
}
