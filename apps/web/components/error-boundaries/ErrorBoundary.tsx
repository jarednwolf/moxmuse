'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'critical'
  context?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  retryCount: number
}

/**
 * Enhanced Error Boundary with multiple fallback strategies
 * Provides graceful error handling with user-friendly recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3
  private retryTimeout: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Log to monitoring service
    this.logError(error, errorInfo)
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    // In production, send to error tracking service (Sentry, LogRocket, etc.)
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      level: this.props.level,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    // For now, log to console. In production, send to monitoring service
    console.error('Error Boundary Report:', errorData)

    // Store in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('moxmuse_errors') || '[]')
      existingErrors.push(errorData)
      // Keep only last 10 errors
      const recentErrors = existingErrors.slice(-10)
      localStorage.setItem('moxmuse_errors', JSON.stringify(recentErrors))
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e)
    }
  }

  private handleRetry = () => {
    if (this.state.retryCount >= this.maxRetries) {
      return
    }

    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1
    }))

    // Add delay before retry to prevent rapid retries
    this.retryTimeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false
      })
    }, 1000)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }))
  }

  private renderCriticalError() {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900/20 via-zinc-900 to-zinc-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-zinc-800/60 backdrop-blur-sm rounded-xl border border-red-500/20 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Critical Application Error
            </h1>
            <p className="text-zinc-300">
              MoxMuse encountered a critical error and needs to restart
            </p>
          </div>

          <div className="bg-zinc-900/60 rounded-lg p-4 mb-6">
            <p className="text-sm text-zinc-400 mb-2">Error Details:</p>
            <p className="text-red-300 font-mono text-sm">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Restart Application
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-white font-medium"
            >
              <Home className="w-4 h-4" />
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    )
  }

  private renderPageError() {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-zinc-800/60 backdrop-blur-sm rounded-xl border border-zinc-700/50 p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Page Error
            </h2>
            <p className="text-zinc-300 text-sm">
              This page encountered an error and couldn't load properly
            </p>
          </div>

          <div className="space-y-3">
            {this.state.retryCount < this.maxRetries && (
              <button
                onClick={this.handleRetry}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors text-white font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again ({this.maxRetries - this.state.retryCount} attempts left)
              </button>
            )}
            
            <button
              onClick={this.handleGoHome}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors text-white font-medium"
            >
              <Home className="w-4 h-4" />
              Return to Homepage
            </button>

            <button
              onClick={this.toggleDetails}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-300 text-sm"
            >
              <Bug className="w-4 h-4" />
              {this.state.showDetails ? 'Hide' : 'Show'} Error Details
              {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {this.state.showDetails && (
            <div className="mt-4 bg-zinc-900/60 rounded-lg p-4">
              <p className="text-xs text-zinc-400 mb-2">Technical Details:</p>
              <pre className="text-xs text-red-300 font-mono overflow-auto max-h-32">
                {this.state.error?.stack || this.state.error?.message || 'No error details available'}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  private renderComponentError() {
    return (
      <div className="bg-zinc-800/40 backdrop-blur-sm rounded-lg border border-zinc-700/50 p-4 m-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Component Error</h3>
            <p className="text-xs text-zinc-400">
              {this.props.context || 'A component'} failed to load
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {this.state.retryCount < this.maxRetries && (
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
          
          <button
            onClick={this.toggleDetails}
            className="flex items-center gap-1 px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300 transition-colors"
          >
            <Bug className="w-3 h-3" />
            Details
          </button>
        </div>

        {this.state.showDetails && (
          <div className="mt-3 bg-zinc-900/60 rounded p-3">
            <p className="text-xs text-zinc-400 mb-1">Error:</p>
            <p className="text-xs text-red-300 font-mono">
              {this.state.error?.message || 'Unknown error'}
            </p>
          </div>
        )}
      </div>
    )
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Render appropriate error UI based on level
      switch (this.props.level) {
        case 'critical':
          return this.renderCriticalError()
        case 'page':
          return this.renderPageError()
        case 'component':
        default:
          return this.renderComponentError()
      }
    }

    return this.props.children
  }
}

// Convenience wrapper components
export const PageErrorBoundary: React.FC<{ children: ReactNode; context?: string }> = ({ children, context }) => (
  <ErrorBoundary level="page" context={context}>
    {children}
  </ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; context?: string }> = ({ children, context }) => (
  <ErrorBoundary level="component" context={context}>
    {children}
  </ErrorBoundary>
)

export const CriticalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="critical" context="Application Root">
    {children}
  </ErrorBoundary>
)