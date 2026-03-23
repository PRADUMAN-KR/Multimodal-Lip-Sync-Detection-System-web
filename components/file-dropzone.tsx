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

  if (file) {
    return (
      <div
        className={cn(
          'relative rounded-xl border border-success/30 bg-success/5 p-4',
          className
        )}
      >
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
