'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { cn } from '@/lib/utils'

interface MobileLoadingProps {
  message?: string
  progress?: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'dots' | 'pulse'
}

export function MobileLoading({
  message = 'Loading...',
  progress,
  className,
  size = 'md',
  variant = 'spinner'
}: MobileLoadingProps) {
  const { isMobile } = useMobile()

  const sizeClasses = {
    sm: isMobile ? 'w-4 h-4' : 'w-5 h-5',
    md: isMobile ? 'w-6 h-6' : 'w-8 h-8',
    lg: isMobile ? 'w-8 h-8' : 'w-12 h-12'
  }

  const textSizeClasses = {
    sm: isMobile ? 'text-xs' : 'text-sm',
    md: isMobile ? 'text-sm' : 'text-base',
    lg: isMobile ? 'text-base' : 'text-lg'
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'bg-purple-500 rounded-full animate-pulse',
                isMobile ? 'w-2 h-2' : 'w-3 h-3'
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
        <p className={cn('text-zinc-400 text-center', textSizeClasses[size])}>
          {message}
        </p>
        {progress !== undefined && (
          <div className={cn('w-full bg-zinc-700 rounded-full h-1', isMobile ? 'max-w-48' : 'max-w-64')}>
            <div
              className="h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
        <div className={cn(
          'bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse',
          sizeClasses[size]
        )} />
        <p className={cn('text-zinc-400 text-center', textSizeClasses[size])}>
          {message}
        </p>
        {progress !== undefined && (
          <div className={cn('w-full bg-zinc-700 rounded-full h-1', isMobile ? 'max-w-48' : 'max-w-64')}>
            <div
              className="h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  // Default spinner variant
  return (
    <div className={cn('flex flex-col items-center justify-center space-y-3', className)}>
      <Loader2 className={cn('animate-spin text-purple-400', sizeClasses[size])} />
      <p className={cn('text-zinc-400 text-center', textSizeClasses[size])}>
        {message}
      </p>
      {progress !== undefined && (
        <div className={cn('w-full bg-zinc-700 rounded-full h-1', isMobile ? 'max-w-48' : 'max-w-64')}>
          <div
            className="h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

// Skeleton loading component for cards
interface CardSkeletonProps {
  count?: number
  className?: string
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
  const { isMobile } = useMobile()

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-zinc-800/50 rounded-lg border border-zinc-700/50 animate-pulse',
            isMobile ? 'p-3' : 'p-4'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'bg-zinc-700 rounded',
              isMobile ? 'w-8 h-10' : 'w-10 h-12'
            )} />
            <div className="flex-1 space-y-2">
              <div className={cn(
                'bg-zinc-700 rounded',
                isMobile ? 'h-3 w-3/4' : 'h-4 w-3/4'
              )} />
              <div className={cn(
                'bg-zinc-700 rounded',
                isMobile ? 'h-2 w-1/2' : 'h-3 w-1/2'
              )} />
            </div>
            <div className={cn(
              'bg-zinc-700 rounded',
              isMobile ? 'w-6 h-6' : 'w-8 h-8'
            )} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Touch-friendly button loading state
interface TouchButtonLoadingProps {
  children: React.ReactNode
  isLoading?: boolean
  className?: string
  disabled?: boolean
  onClick?: () => void
}

export function TouchButtonLoading({
  children,
  isLoading = false,
  className,
  disabled = false,
  onClick
}: TouchButtonLoadingProps) {
  const { isMobile } = useMobile()

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'relative flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
        'hover:from-purple-600 hover:to-blue-600',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-95',
        isMobile 
          ? 'px-4 py-3 text-base min-h-[44px]' // 44px is Apple's recommended minimum touch target
          : 'px-6 py-2 text-sm',
        className
      )}
    >
      {isLoading && (
        <Loader2 className={cn('animate-spin', isMobile ? 'w-5 h-5' : 'w-4 h-4')} />
      )}
      <span className={isLoading ? 'opacity-70' : ''}>{children}</span>
    </button>
  )
}