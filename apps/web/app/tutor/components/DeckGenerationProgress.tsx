'use client'

import React, { useState, useEffect, useRef } from 'react'

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
  }
}

interface DeckGenerationProgressProps {
  progress: ProgressUpdate
  model: string
}

export function DeckGenerationProgress({ 
  progress,
  model 
}: DeckGenerationProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const startTime = useRef(Date.now())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 
      ? `${minutes}m ${seconds % 60}s`
      : `${seconds}s`
  }
  
  const getProgressColor = () => {
    if (progress.stage === 'error') return 'bg-red-500'
    if (progress.stage === 'complete') return 'bg-green-500'
    if (progress.percent < 30) return 'bg-blue-500'
    if (progress.percent < 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  const getStageIcon = () => {
    switch (progress.stage) {
      case 'initializing':
        return '🚀'
      case 'consulting':
        return '🤖'
      case 'generating':
        return '📝'
      case 'looking-up':
        return '🔍'
      case 'validating':
        return '✅'
      case 'complete':
        return '🎉'
      case 'error':
        return '❌'
      default:
        return '⏳'
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
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <span>{getStageIcon()}</span>
          <span>Generating Your Deck with {getModelDisplay()}</span>
        </h3>
        <p className="text-sm text-gray-600">
          {progress.message}
        </p>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>{progress.percent}%</span>
          <span>Elapsed: {formatTime(elapsedTime)}</span>
        </div>
      </div>
      
      {/* Stage Details */}
      {progress.details && (
        <div className="text-sm text-gray-600 space-y-1">
          {progress.details.cardsProcessed !== undefined && (
            <p>Cards processed: {progress.details.cardsProcessed} / {progress.details.totalCards}</p>
          )}
          {progress.details.currentBatch !== undefined && (
            <p>Batch: {progress.details.currentBatch} / {progress.details.totalBatches}</p>
          )}
        </div>
      )}
      
      {/* Long Running Process Notice */}
      {elapsedTime > 60000 && progress.stage !== 'complete' && progress.stage !== 'error' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            ⏳ This is taking longer than usual. {model.includes('o1') || model.includes('research') 
              ? 'Advanced models require more processing time for better results.'
              : 'We\'re working on your deck - please be patient!'}
          </p>
        </div>
      )}
      
      {/* Option for Background Processing */}
      {elapsedTime > 120000 && progress.stage !== 'complete' && progress.stage !== 'error' && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-md">
          <p className="text-sm text-yellow-800 mb-2">
            Would you like to continue this in the background?
          </p>
          <button 
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            onClick={() => {
              // TODO: Implement background processing
              alert('Background processing coming soon!')
            }}
          >
            Process in Background & Notify Me
          </button>
        </div>
      )}
      
      {/* Error State */}
      {progress.stage === 'error' && (
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-800">
            ❌ An error occurred during deck generation. Please try again or contact support if the issue persists.
          </p>
        </div>
      )}
      
      {/* Success State */}
      {progress.stage === 'complete' && (
        <div className="mt-4 p-3 bg-green-50 rounded-md">
          <p className="text-sm text-green-800">
            🎉 Your deck has been generated successfully! Total time: {formatTime(elapsedTime)}
          </p>
        </div>
      )}
    </div>
  )
}
