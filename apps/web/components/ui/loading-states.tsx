'use client'

import React from 'react'
import { Loader2, Sparkles, Wand2, Brain, Search, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Base loading spinner component
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
}

export function LoadingSpinner({ 
  size = 'md', 
  className,
  color = 'primary' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }
  
  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-zinc-400',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500'
  }
  
  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      aria-label="Loading"
    />
  )
}

// Skeleton loading components
export interface SkeletonProps {
  className?: string
  variant?: 'text' | 'rectangular' | 'circular'
  width?: string | number
  height?: string | number
  lines?: number
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height,
  lines = 1
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-zinc-700/50 rounded'
  
  const variantClasses = {
    text: 'h-4 rounded-md',
    rectangular: 'rounded-lg',
    circular: 'rounded-full'
  }
  
  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClasses, variantClasses.text)}
            style={{ 
              width: i === lines - 1 ? '75%' : '100%',
              height: height || '1rem'
            }}
          />
        ))}
      </div>
    )
  }
  
  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{ width, height }}
    />
  )
}

// Card skeleton for deck lists
export function CardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40">
      <Skeleton variant="rectangular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton variant="text" width="60%" height="1rem" />
        <Skeleton variant="text" width="40%" height="0.75rem" className="mt-1" />
      </div>
      <Skeleton variant="text" width="3rem" height="0.75rem" />
    </div>
  )
}

// Deck editor skeleton
export function DeckEditorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width="200px" height="2rem" />
        <Skeleton variant="rectangular" width="120px" height="2.5rem" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// Progress indicators for different stages
export interface ProgressIndicatorProps {
  stage: 'initializing' | 'consulting' | 'generating' | 'looking-up' | 'validating' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTimeRemaining?: number
  showDetails?: boolean
  details?: {
    cardsProcessed?: number
    totalCards?: number
    currentStep?: string
  }
}

export function ProgressIndicator({
  stage,
  progress,
  message,
  estimatedTimeRemaining,
  showDetails = false,
  details
}: ProgressIndicatorProps) {
  const getStageIcon = () => {
    switch (stage) {
      case 'initializing':
        return <Wand2 className="w-5 h-5 text-blue-400 animate-pulse" />
      case 'consulting':
        return <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
      case 'generating':
        return <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
      case 'looking-up':
        return <Search className="w-5 h-5 text-blue-400 animate-pulse" />
      case 'validating':
        return <CheckCircle className="w-5 h-5 text-green-400 animate-pulse" />
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return <LoadingSpinner size="sm" />
    }
  }
  
  const getProgressColor = () => {
    if (stage === 'error') return 'bg-red-500'
    if (stage === 'complete') return 'bg-green-500'
    if (progress < 30) return 'bg-blue-500'
    if (progress < 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }
  
  return (
    <div className="w-full max-w-md mx-auto p-4 bg-zinc-800/60 backdrop-blur-sm rounded-lg border border-zinc-700/50">
      <div className="flex items-center gap-3 mb-3">
        {getStageIcon()}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-100">
            {stage.charAt(0).toUpperCase() + stage.slice(1).replace('-', ' ')}
          </h3>
          <p className="text-xs text-zinc-400">{message}</p>
        </div>
        {estimatedTimeRemaining && (
          <div className="text-xs text-zinc-400">
            ~{formatTime(estimatedTimeRemaining)}
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
          <div 
            className={cn(
              'h-2 rounded-full transition-all duration-500',
              getProgressColor()
            )}
            style={{ width: `${Math.min(progress, 100)}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress: ${progress}%`}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-zinc-400">
          <span>{progress}%</span>
          <span>Complete</span>
        </div>
      </div>
      
      {/* Details */}
      {showDetails && details && (
        <div className="text-xs text-zinc-400 space-y-1">
          {details.cardsProcessed !== undefined && details.totalCards && (
            <div className="flex justify-between">
              <span>Cards processed:</span>
              <span>{details.cardsProcessed} / {details.totalCards}</span>
            </div>
          )}
          {details.currentStep && (
            <div>
              <span className="text-zinc-300">Current step:</span> {details.currentStep}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Loading overlay for full-screen operations
export interface LoadingOverlayProps {
  isVisible: boolean
  title?: string
  message?: string
  progress?: number
  canCancel?: boolean
  onCancel?: () => void
}

export function LoadingOverlay({
  isVisible,
  title = 'Loading...',
  message,
  progress,
  canCancel = false,
  onCancel
}: LoadingOverlayProps) {
  if (!isVisible) return null
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-title"
      aria-describedby="loading-message"
    >
      <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border border-zinc-700/50">
        <div className="text-center">
          <LoadingSpinner size="xl" className="mx-auto mb-4" />
          <h2 id="loading-title" className="text-lg font-semibold text-zinc-100 mb-2">
            {title}
          </h2>
          {message && (
            <p id="loading-message" className="text-sm text-zinc-400 mb-4">
              {message}
            </p>
          )}
          
          {progress !== undefined && (
            <div className="mb-4">
              <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="text-xs text-zinc-400 mt-1">{progress}%</div>
            </div>
          )}
          
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Inline loading states for buttons
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  )
}