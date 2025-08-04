'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { RefreshCw, AlertCircle, Clock, Wifi } from 'lucide-react'
import { Button } from './button'

interface RetryConfig {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryCondition?: (error: Error) => boolean
}

interface RetryHandlerProps {
  onRetry: () => Promise<void> | void
  error?: Error | null
  config?: RetryConfig
  children?: React.ReactNode
  showManualRetry?: boolean
  autoRetry?: boolean
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    return (
      error.message.includes('Network Error') ||
      error.message.includes('timeout') ||
      error.message.includes('fetch') ||
      error.message.includes('500') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('504')
    )
  }
}

export const RetryHandler: React.FC<RetryHandlerProps> = ({
  onRetry,
  error,
  config = {},
  children,
  showManualRetry = true,
  autoRetry = true
}) => {
  const [attemptCount, setAttemptCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [nextRetryIn, setNextRetryIn] = useState<number | null>(null)
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(autoRetry)

  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  const calculateDelay = useCallback((attempt: number) => {
    const delay = Math.min(
      finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
      finalConfig.maxDelay
    )
    return delay
  }, [finalConfig])

  const shouldRetry = useCallback((error: Error, attempt: number) => {
    return (
      attempt < finalConfig.maxAttempts &&
      finalConfig.retryCondition(error)
    )
  }, [finalConfig])

  const executeRetry = useCallback(async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      await onRetry()
      // Reset on success
      setAttemptCount(0)
      setNextRetryIn(null)
    } catch (retryError) {
      console.error('Retry failed:', retryError)
      // The error will be handled by the parent component
    } finally {
      setIsRetrying(false)
    }
  }, [onRetry, isRetrying])

  const scheduleAutoRetry = useCallback(() => {
    if (!error || !autoRetryEnabled || !shouldRetry(error, attemptCount)) {
      return
    }

    const delay = calculateDelay(attemptCount)
    setNextRetryIn(delay)

    const interval = setInterval(() => {
      setNextRetryIn(prev => {
        if (prev === null || prev <= 1000) {
          clearInterval(interval)
          setAttemptCount(prev => prev + 1)
          executeRetry()
          return null
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [error, autoRetryEnabled, attemptCount, shouldRetry, calculateDelay, executeRetry])

  // Schedule auto retry when error changes
  useEffect(() => {
    if (error && autoRetryEnabled) {
      const cleanup = scheduleAutoRetry()
      return cleanup
    }
  }, [error, scheduleAutoRetry, autoRetryEnabled])

  const handleManualRetry = useCallback(() => {
    setAttemptCount(prev => prev + 1)
    setNextRetryIn(null)
    executeRetry()
  }, [executeRetry])

  const getErrorType = (error: Error) => {
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'network'
    }
    if (error.message.includes('timeout')) {
      return 'timeout'
    }
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504')) {
      return 'server'
    }
    return 'unknown'
  }

  const getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return <Wifi className="w-5 h-5 text-orange-400" />
      case 'timeout':
        return <Clock className="w-5 h-5 text-yellow-400" />
      default:
        return <AlertCircle className="w-5 h-5 text-red-400" />
    }
  }

  const getErrorMessage = (error: Error, errorType: string) => {
    switch (errorType) {
      case 'network':
        return 'Connection failed. Check your internet connection.'
      case 'timeout':
        return 'Request timed out. The server may be busy.'
      case 'server':
        return 'Server error. Our team has been notified.'
      default:
        return error.message || 'An unexpected error occurred.'
    }
  }

  if (!error) {
    return <>{children}</>
  }

  const errorType = getErrorType(error)
  const canRetry = shouldRetry(error, attemptCount)
  const isAutoRetrying = nextRetryIn !== null

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="flex items-center gap-3 text-center">
        {getErrorIcon(errorType)}
        <div>
          <h3 className="text-lg font-medium text-zinc-100">
            {errorType === 'network' ? 'Connection Problem' : 
             errorType === 'timeout' ? 'Request Timeout' :
             errorType === 'server' ? 'Server Error' : 'Error Occurred'}
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            {getErrorMessage(error, errorType)}
          </p>
        </div>
      </div>

      {/* Retry Status */}
      {canRetry && (
        <div className="text-center space-y-3">
          {isAutoRetrying ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>
                Retrying in {Math.ceil((nextRetryIn || 0) / 1000)} seconds...
              </span>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              Attempt {attemptCount + 1} of {finalConfig.maxAttempts}
            </p>
          )}

          {/* Manual Retry Button */}
          {showManualRetry && (
            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleManualRetry}
                disabled={isRetrying || isAutoRetrying}
                variant="outline"
                size="sm"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Now
                  </>
                )}
              </Button>

              {autoRetryEnabled && isAutoRetrying && (
                <Button
                  onClick={() => {
                    setAutoRetryEnabled(false)
                    setNextRetryIn(null)
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  Cancel Auto-retry
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Max attempts reached */}
      {!canRetry && attemptCount >= finalConfig.maxAttempts && (
        <div className="text-center space-y-2">
          <p className="text-sm text-red-400">
            Maximum retry attempts reached
          </p>
          <Button
            onClick={() => {
              setAttemptCount(0)
              setAutoRetryEnabled(true)
              handleManualRetry()
            }}
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-300 hover:bg-red-900/30"
          >
            Try Again
          </Button>
        </div>
      )}

      {children}
    </div>
  )
}

// Hook for using retry logic in components
export const useRetry = (config?: RetryConfig) => {
  const [error, setError] = useState<Error | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  const executeWithRetry = useCallback(async (
    operation: () => Promise<any>,
    onSuccess?: (result: any) => void,
    onError?: (error: Error) => void
  ): Promise<any> => {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
      try {
        setIsRetrying(attempt > 0)
        setError(null)
        
        if (attempt > 0) {
          const delay = Math.min(
            finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
            finalConfig.maxDelay
          )
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        const result = await operation()
        setIsRetrying(false)
        onSuccess?.(result)
        return result
        
      } catch (error) {
        lastError = error as Error
        console.error(`Attempt ${attempt + 1} failed:`, error)
        
        if (!finalConfig.retryCondition(lastError) || attempt === finalConfig.maxAttempts - 1) {
          break
        }
      }
    }
    
    setIsRetrying(false)
    setError(lastError)
    onError?.(lastError!)
    return null
  }, [finalConfig])

  return {
    executeWithRetry,
    error,
    isRetrying,
    clearError: () => setError(null)
  }
}