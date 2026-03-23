'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createJob, modelOptions, sensitivityOptions } from '@/lib/api'
import { FileDropzone } from '@/components/file-dropzone'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Check, FileVideo, Settings, ScanSearch, ArrowLeft, Loader2 } from 'lucide-react'

type Step = 1 | 2 | 3

interface StepConfig {
  number: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const steps: StepConfig[] = [
  { number: 1, title: 'Upload Video', description: 'Video to analyze', icon: FileVideo },
  { number: 2, title: 'Configure', description: 'Detection settings', icon: Settings },
  { number: 3, title: 'Analyze', description: 'Start detection', icon: ScanSearch },
]

export default function NewJobPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [model, setModel] = useState('lipsync-detector-v2')
  const [sensitivity, setSensitivity] = useState<'low' | 'medium' | 'high'>('medium')
  const [includeDebug, setIncludeDebug] = useState(true)

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 1:
        return !!videoFile
      case 2:
        return true
      case 3:
        return !!videoFile
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < 3 && canProceed(currentStep)) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleSubmit = async () => {
    if (!videoFile) return

    setIsSubmitting(true)
    try {
      const job = await createJob({
        videoFile,
        model,
        sensitivity,
        includeDebug,
      })
      toast.success('Detection job created successfully!')
      router.push(`/jobs/${job.id}`)
    } catch (error) {
      toast.error('Failed to create job')
      setIsSubmitting(false)
    }
  }

  const getStepStatus = (stepNumber: Step): 'completed' | 'current' | 'upcoming' => {
    if (stepNumber < currentStep) return 'completed'
    if (stepNumber === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
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
          <h1 className="text-2xl font-bold text-text-primary">New Detection Job</h1>
          <p className="mt-1 text-text-secondary">
            Upload a video to analyze for lip-sync manipulation
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const status = getStepStatus(step.number)
              const Icon = step.icon
              return (
                <div key={step.number} className="flex items-center">
                  <button
                    onClick={() => status !== 'upcoming' && setCurrentStep(step.number)}
                    disabled={status === 'upcoming'}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 transition-all',
                      status === 'current' && 'bg-surface-2',
                      status === 'completed' && 'hover:bg-surface',
                      status === 'upcoming' && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                        status === 'current' && 'bg-accent-cyan/10 text-accent-cyan',
                        status === 'completed' && 'bg-success/10 text-success',
                        status === 'upcoming' && 'bg-surface-2 text-text-secondary'
                      )}
                    >
                      {status === 'completed' ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="hidden text-left md:block">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          status === 'current' ? 'text-text-primary' : 'text-text-secondary'
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-text-secondary">{step.description}</p>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'mx-2 hidden h-px w-12 lg:block',
                        status === 'completed' ? 'bg-success' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-border/50 bg-surface p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex gap-6">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-text-primary">Upload Video</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Select a video file to analyze for lip-sync manipulation
                  </p>
                </div>
                <div className="hidden md:block">
                  <img 
                    src="/images/upload-visual.jpg" 
                    alt="" 
                    className="h-20 w-20 rounded-xl object-cover opacity-80"
                  />
                </div>
              </div>
              <FileDropzone
                accept="video"
                file={videoFile}
                onFileSelect={setVideoFile}
              />
              <div className="rounded-lg border border-border/50 bg-surface-2 p-4">
                <h3 className="text-sm font-medium text-text-primary">Video Requirements</h3>
                <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                  <li>Video with clear, visible face and audio</li>
                  <li>Good lighting and minimal motion blur</li>
                  <li>Recommended resolution: 480p or higher</li>
                  <li>Maximum duration: 10 minutes</li>
                  <li>Supported formats: MP4, MOV, AVI, WebM</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Configure Detection</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Customize the detection settings for your analysis
                </p>
              </div>

              <div className="space-y-5">
                {/* Model Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-text-primary">Detection Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="w-full bg-surface-2 border-border text-text-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {modelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="ml-2 text-xs text-text-secondary">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sensitivity Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-text-primary">Detection Sensitivity</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {sensitivityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSensitivity(option.value as 'low' | 'medium' | 'high')}
                        className={cn(
                          'rounded-xl border p-4 text-left transition-all',
                          sensitivity === option.value
                            ? 'border-accent-cyan bg-accent-cyan/5'
                            : 'border-border hover:border-text-secondary'
                        )}
                      >
                        <p
                          className={cn(
                            'text-sm font-medium',
                            sensitivity === option.value ? 'text-accent-cyan' : 'text-text-primary'
                          )}
                        >
                          {option.label}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Box with Visual */}
                <div className="rounded-lg border border-border/50 bg-surface-2 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label htmlFor="include-debug" className="text-sm font-medium text-text-primary">
                        Include Debug Data
                      </Label>
                      <p className="mt-1 text-xs text-text-secondary">
                        Sends `include_debug` when reading backend results. Keep ON for richer diagnostics.
                      </p>
                    </div>
                    <Switch
                      id="include-debug"
                      checked={includeDebug}
                      onCheckedChange={setIncludeDebug}
                    />
                  </div>
                </div>

                {/* Info Box with Visual */}
                <div className="relative overflow-hidden rounded-lg border border-accent-violet/20 bg-accent-violet/5 p-4">
                  <div className="relative z-10">
                    <h3 className="text-sm font-medium text-text-primary">How Detection Works</h3>
                    <p className="mt-1 text-xs text-text-secondary max-w-md">
                      Our AI analyzes facial landmarks, audio-visual synchronization, and temporal coherence 
                      to detect signs of lip-sync manipulation or deepfake generation.
                    </p>
                  </div>
                  <div className="absolute -right-4 -top-4 hidden md:block">
                    <img 
                      src="/images/analysis-visual.jpg" 
                      alt="" 
                      className="h-24 w-24 rounded-lg object-cover opacity-40"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Review & Analyze</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Review your settings and start the detection analysis
                </p>
              </div>

              {/* Summary */}
              <div className="space-y-4 rounded-xl border border-border/50 bg-surface-2 p-5">
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <span className="text-sm text-text-secondary">Video File</span>
                  <span className="text-sm font-medium text-text-primary">
                    {videoFile?.name || 'Not selected'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <span className="text-sm text-text-secondary">File Size</span>
                  <span className="text-sm font-medium text-text-primary">
                    {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-4">
                  <span className="text-sm text-text-secondary">Detection Model</span>
                  <span className="text-sm font-medium text-text-primary">
                    {modelOptions.find((m) => m.value === model)?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Sensitivity</span>
                  <span className="text-sm font-medium text-text-primary capitalize">{sensitivity}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="text-sm text-text-secondary">Include Debug Data</span>
                  <span className="text-sm font-medium text-text-primary">{includeDebug ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>

              {/* Processing Info */}
              <div className="flex items-center gap-3 rounded-xl border border-accent-cyan/20 bg-accent-cyan/5 p-4">
                <ScanSearch className="h-5 w-5 text-accent-cyan" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Detection Analysis</p>
                  <p className="text-xs text-text-secondary">
                    Analysis time depends on video length. Typically 1-3 minutes for most videos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-6">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="gap-2 text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed(currentStep)}
                className="gap-2 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed(3) || isSubmitting}
                className="gap-2 bg-accent-cyan text-primary-foreground hover:bg-accent-cyan/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Job...
                  </>
                ) : (
                  <>
                    <ScanSearch className="h-4 w-4" />
                    Start Detection
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
