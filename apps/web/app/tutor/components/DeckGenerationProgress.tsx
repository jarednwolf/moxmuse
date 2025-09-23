'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Wand2, Brain, Sparkles, Search, CheckCircle, AlertCircle, Clock, Pause, Play } from 'lucide-react'
import { ProgressIndicator } from '../../components/ui/loading-states'
import { ErrorState, AIServiceError } from '../../components/ui/error-states'
import { AccessibleProgress, LiveRegion } from '../../components/ui/accessibility'
import { MobileButton, MobileCard } from '../../components/ui/mobile-optimized'
import { cn } from '@/lib/utils'

interface ProgressUpdate {
  stage: 'initializing' | 'consulting' | 'generating' | 'looking-up' | 'validating' | 'complete' | 'error'
  percent: number
  message: string
  estimatedTimeRemaining?: number
  details?: {
    cardsProcessed?: number
    totalCards?: number
    currentBatch?: number
    totalBatches?: number
    currentStep?: string
    errorDetails?: string
  }
}

interface DeckGenerationProgressProps {
  progress: ProgressUpdate
  model: string
  onCancel?: () => void
  onRetry?: () => void
  onBackgroundProcess?: () => void
  canCancel?: boolean
}

export function DeckGenerationProgress({ 
  progress,
  model,
  onCancel,
  onRetry,
  onBackgroundProcess,
  canCancel = true
}: DeckGenerationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const startTime = useRef(Date.now())
  
  useEffect(() => {
    if (isPaused) return
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [isPaused])
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 
      ? `${minutes}m ${seconds % 60}s`
      : `${seconds}s`
  }
  
  const getStageInfo = () => {
    switch (progress.stage) {
      case 'initializing':
        return {
          icon: <Wand2 className="w-6 h-6 text-blue-400 animate-pulse" />,
          title: 'Initializing',
          description: 'Setting up your deck generation...'
        }
      case 'consulting':
        return {
          icon: <Brain className="w-6 h-6 text-purple-400 animate-pulse" />,
          title: 'AI Consultation',
          description: 'Analyzing your preferences and strategy...'
        }
      case 'generating':
        return {
          icon: <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />,
          title: 'Generating Deck',
          description: 'Creating your personalized deck list...'
        }
      case 'looking-up':
        return {
          icon: <Search className="w-6 h-6 text-blue-400 animate-pulse" />,
          title: 'Card Lookup',
          description: 'Fetching card details and prices...'
        }
      case 'validating':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-400 animate-pulse" />,
          title: 'Validating',
          description: 'Ensuring deck quality and legality...'
        }
      case 'complete':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-400" />,
          title: 'Complete',
          description: 'Your deck is ready!'
        }
      case 'error':
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-400" />,
          title: 'Error',
          description: 'Something went wrong during generation'
        }
      default:
        return {
          icon: <Clock className="w-6 h-6 text-zinc-400" />,
          title: 'Processing',
          description: 'Working on your deck...'
        }
    }
  }
  
  const getModelDisplay = () => {
    const modelNames: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'o1-preview': 'O1 Preview',
      'o1': 'O1',
      'deep-research': 'Deep Research'
    }
    return modelNames[model] || model
  }
  
  const stageInfo = getStageInfo()
  const isLongRunning = elapsedTime > 60000
  const isVeryLongRunning = elapsedTime > 120000
  const isAdvancedModel = model.includes('o1') || model.includes('research')
  
  // Error state
  if (progress.stage === 'error') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <AIServiceError
          onRetry={onRetry}
          onFallback={() => {
            // Fallback to manual deck building
            window.location.href = '/decks'
          }}
          isRetrying={false}
        />
        
        {progress.details?.errorDetails && (
          <MobileCard className="mt-4" padding="md">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {showDetails ? 'Hide' : 'Show'} error details
            </button>
            
            {showDetails && (
              <div className="mt-3 p-3 bg-zinc-800/60 rounded-lg">
                <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all">
                  {progress.details.errorDetails}
                </pre>
              </div>
            )}
          </MobileCard>
        )}
      </div>
    )
  }
  
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Main progress card */}
      <MobileCard padding="lg">
        <div className="text-center">
          {/* Stage icon and title */}
          <div className="flex items-center justify-center mb-4">
            {stageInfo.icon}
          </div>
          
          <h3 className="text-xl font-semibold text-zinc-100 mb-2">
            {stageInfo.title}
          </h3>
          
          <p className="text-zinc-300 mb-2">
            {progress.message || stageInfo.description}
          </p>
          
          <p className="text-sm text-zinc-400 mb-6">
            Using {getModelDisplay()}
          </p>
          
          {/* Progress bar */}
          <AccessibleProgress
            value={progress.percent}
            label="Deck Generation Progress"
            description={`${stageInfo.title}: ${progress.message}`}
            showPercentage
            className="mb-4"
          />
          
          {/* Time and details */}
          <div className="flex items-center justify-between text-sm text-zinc-400 mb-4">
            <span>Elapsed: {formatTime(elapsedTime)}</span>
            {progress.estimatedTimeRemaining && (
              <span>~{formatTime(progress.estimatedTimeRemaining * 1000)} remaining</span>
            )}
          </div>
          
          {/* Detailed progress */}
          {progress.details && (
            <div className="space-y-2 text-sm text-zinc-400">
              {progress.details.cardsProcessed !== undefined && progress.details.totalCards && (
                <div className="flex justify-between">
                  <span>Cards processed:</span>
                  <span>{progress.details.cardsProcessed} / {progress.details.totalCards}</span>
                </div>
              )}
              {progress.details.currentBatch !== undefined && progress.details.totalBatches && (
                <div className="flex justify-between">
                  <span>Batch:</span>
                  <span>{progress.details.currentBatch} / {progress.details.totalBatches}</span>
                </div>
              )}
              {progress.details.currentStep && (
                <div className="text-center text-zinc-300 font-medium">
                  {progress.details.currentStep}
                </div>
              )}
            </div>
          )}
        </div>
      </MobileCard>
      
      {/* Long running process notice */}
      {isLongRunning && progress.stage !== 'complete' && (
        <MobileCard className="bg-blue-500/10 border-blue-500/20" padding="md">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-300 mb-1">
                Taking longer than usual
              </h4>
              <p className="text-sm text-blue-200">
                {isAdvancedModel 
                  ? 'Advanced AI models require more processing time for better results.'
                  : 'We\'re working hard on your deck - please be patient!'}
              </p>
            </div>
          </div>
        </MobileCard>
      )}
      
      {/* Background processing option */}
      {isVeryLongRunning && progress.stage !== 'complete' && onBackgroundProcess && (
        <MobileCard className="bg-yellow-500/10 border-yellow-500/20" padding="md">
          <div className="text-center">
            <h4 className="text-sm font-medium text-yellow-300 mb-2">
              Continue in background?
            </h4>
            <p className="text-sm text-yellow-200 mb-4">
              We can continue generating your deck in the background and notify you when it's ready.
            </p>
            <MobileButton
              onClick={onBackgroundProcess}
              variant="secondary"
              size="sm"
            >
              Process in Background
            </MobileButton>
          </div>
        </MobileCard>
      )}
      
      {/* Success state */}
      {progress.stage === 'complete' && (
        <MobileCard className="bg-green-500/10 border-green-500/20" padding="md">
          <div className="text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h4 className="text-lg font-semibold text-green-300 mb-1">
              Deck Generated Successfully!
            </h4>
            <p className="text-sm text-green-200">
              Total time: {formatTime(elapsedTime)}
            </p>
          </div>
        </MobileCard>
      )}
      
      {/* Action buttons */}
      {progress.stage !== 'complete' && progress.stage !== 'error' && (
        <div className="flex gap-3 justify-center">
          {canCancel && onCancel && (
            <MobileButton
              variant="ghost"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </MobileButton>
          )}
          
          <MobileButton
            variant="ghost"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            )}
          </MobileButton>
        </div>
      )}
      
      {/* Live region for screen readers */}
      <LiveRegion>
        {progress.stage === 'complete' && 'Deck generation completed successfully'}
        {progress.stage === 'error' && 'Deck generation failed'}
        {progress.stage !== 'complete' && progress.stage !== 'error' && 
          `${stageInfo.title}: ${progress.percent}% complete`}
      </LiveRegion>
    </div>
  )
}
