'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { Button } from './button'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
  context?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to console and external service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleRetry)
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error!}
          onRetry={this.handleRetry}
          showDetails={this.props.showDetails}
          context={this.props.context}
        />
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error
  onRetry: () => void
  showDetails?: boolean
  context?: string
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  showDetails = false,
  context
}) => {
  const [showFullError, setShowFullError] = React.useState(false)

  const getErrorMessage = (error: Error) => {
    // Provide user-friendly messages for common errors
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'Unable to connect to the server. Please check your internet connection.'
    }
    if (error.message.includes('timeout')) {
      return 'The request took too long to complete. Please try again.'
    }
    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      return 'Your session has expired. Please sign in again.'
    }
    if (error.message.includes('Forbidden') || error.message.includes('403')) {
      return 'You don\'t have permission to access this resource.'
    }
    if (error.message.includes('Not Found') || error.message.includes('404')) {
      return 'The requested resource could not be found.'
    }
    
    return error.message || 'An unexpected error occurred'
  }

  const getRecoveryActions = (error: Error) => {
    const actions = []
    
    // Always show retry
    actions.push({
      label: 'Try Again',
      icon: RefreshCw,
      action: onRetry,
      variant: 'default' as const
    })

    // Network errors - suggest refresh
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      actions.push({
        label: 'Refresh Page',
        icon: RefreshCw,
        action: () => window.location.reload(),
        variant: 'outline' as const
      })
    }

    // Auth errors - suggest going home
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      actions.push({
        label: 'Go Home',
        icon: Home,
        action: () => window.location.href = '/',
        variant: 'outline' as const
      })
    }

    return actions
  }

  const errorMessage = getErrorMessage(error)
  const recoveryActions = getRecoveryActions(error)

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-300">
              {context ? `${context} Error` : 'Something went wrong'}
            </h3>
            <p className="text-red-200/80 text-sm mt-1">
              {errorMessage}
            </p>
          </div>
        </div>

        {/* Recovery Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {recoveryActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              size="sm"
              onClick={action.action}
              className={
                action.variant === 'default'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'border-red-500/30 text-red-300 hover:bg-red-900/30'
              }
            >
              <action.icon className="w-4 h-4 mr-2" />
              {action.label}
            </Button>
          ))}
        </div>

        {/* Error Details Toggle */}
        {showDetails && (
          <div className="border-t border-red-500/20 pt-4">
            <button
              onClick={() => setShowFullError(!showFullError)}
              className="flex items-center gap-2 text-xs text-red-300/60 hover:text-red-300 transition-colors"
            >
              <Bug className="w-3 h-3" />
              {showFullError ? 'Hide' : 'Show'} technical details
            </button>
            
            {showFullError && (
              <div className="mt-3 p-3 bg-red-950/30 rounded border border-red-500/20">
                <pre className="text-xs text-red-200/60 whitespace-pre-wrap break-words">
                  {error.stack || error.message}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for using error boundary programmatically
export const useErrorHandler = () => {
  return React.useCallback((error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('Manual error report:', error, errorInfo)
    
    // In a real app, you might want to trigger error reporting here
    // or show a toast notification
    
    throw error // Re-throw to trigger error boundary
  }, [])
}