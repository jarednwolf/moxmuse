'use client'

import React from 'react'
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  ArrowLeft, 
  Bug, 
  Wifi, 
  Server, 
  Clock,
  HelpCircle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingButton } from './loading-states'

// Error types for better categorization
export type ErrorType = 
  | 'network' 
  | 'server' 
  | 'timeout' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'not-found' 
  | 'rate-limit'
  | 'ai-service'
  | 'unknown'

export interface ErrorAction {
  label: string
  action: () => void | Promise<void>
  variant?: 'primary' | 'secondary' | 'danger'
  isLoading?: boolean
}

export interface ErrorStateProps {
  type?: ErrorType
  title?: string
  message?: string
  details?: string
  actions?: ErrorAction[]
  showDetails?: boolean
  onToggleDetails?: () => void
  className?: string
}

// Get appropriate icon for error type
function getErrorIcon(type: ErrorType) {
  switch (type) {
    case 'network':
      return <Wifi className="w-12 h-12 text-red-400" />
    case 'server':
      return <Server className="w-12 h-12 text-red-400" />
    case 'timeout':
      return <Clock className="w-12 h-12 text-yellow-400" />
    case 'not-found':
      return <HelpCircle className="w-12 h-12 text-blue-400" />
    case 'ai-service':
      return <Bug className="w-12 h-12 text-purple-400" />
    default:
      return <AlertTriangle className="w-12 h-12 text-red-400" />
  }
}

// Get default title and message for error type
function getErrorDefaults(type: ErrorType) {
  switch (type) {
    case 'network':
      return {
        title: 'Connection Problem',
        message: 'Unable to connect to our servers. Please check your internet connection and try again.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Disable any VPN or proxy',
          'Contact support if the problem persists'
        ]
      }
    case 'server':
      return {
        title: 'Server Error',
        message: 'Our servers are experiencing issues. We\'re working to fix this as quickly as possible.',
        suggestions: [
          'Try again in a few minutes',
          'Check our status page for updates',
          'Contact support if urgent'
        ]
      }
    case 'timeout':
      return {
        title: 'Request Timeout',
        message: 'The operation took too long to complete. This might be due to high server load.',
        suggestions: [
          'Try the operation again',
          'Break large requests into smaller ones',
          'Try again during off-peak hours'
        ]
      }
    case 'validation':
      return {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        suggestions: [
          'Review the form for errors',
          'Ensure all required fields are filled',
          'Check data format requirements'
        ]
      }
    case 'authentication':
      return {
        title: 'Authentication Required',
        message: 'You need to sign in to access this feature.',
        suggestions: [
          'Sign in to your account',
          'Create a new account if needed',
          'Reset your password if forgotten'
        ]
      }
    case 'authorization':
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to access this resource.',
        suggestions: [
          'Contact an administrator',
          'Upgrade your account if needed',
          'Ensure you\'re signed in to the correct account'
        ]
      }
    case 'not-found':
      return {
        title: 'Not Found',
        message: 'The page or resource you\'re looking for doesn\'t exist.',
        suggestions: [
          'Check the URL for typos',
          'Use the navigation menu',
          'Go back to the previous page',
          'Search for what you\'re looking for'
        ]
      }
    case 'rate-limit':
      return {
        title: 'Too Many Requests',
        message: 'You\'ve made too many requests. Please wait a moment before trying again.',
        suggestions: [
          'Wait a few minutes before retrying',
          'Reduce the frequency of requests',
          'Consider upgrading for higher limits'
        ]
      }
    case 'ai-service':
      return {
        title: 'AI Service Unavailable',
        message: 'Our AI service is temporarily unavailable. We\'re working to restore it.',
        suggestions: [
          'Try again in a few minutes',
          'Use manual deck building tools',
          'Check our status page for updates'
        ]
      }
    default:
      return {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        suggestions: [
          'Refresh the page',
          'Try again in a few minutes',
          'Contact support if the problem persists'
        ]
      }
  }
}

// Main error state component
export function ErrorState({
  type = 'unknown',
  title,
  message,
  details,
  actions = [],
  showDetails = false,
  onToggleDetails,
  className
}: ErrorStateProps) {
  const defaults = getErrorDefaults(type)
  const [copied, setCopied] = React.useState(false)
  
  const displayTitle = title || defaults.title
  const displayMessage = message || defaults.message
  
  const copyErrorDetails = async () => {
    if (!details) return
    
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy error details:', err)
    }
  }
  
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto',
      className
    )}>
      {/* Error Icon */}
      <div className="mb-6">
        {getErrorIcon(type)}
      </div>
      
      {/* Error Title */}
      <h2 className="text-xl font-semibold text-zinc-100 mb-3">
        {displayTitle}
      </h2>
      
      {/* Error Message */}
      <p className="text-zinc-400 mb-6 leading-relaxed">
        {displayMessage}
      </p>
      
      {/* Suggestions */}
      {defaults.suggestions && (
        <div className="mb-6 text-left w-full">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Try these solutions:</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            {defaults.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-zinc-500 mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6 w-full">
          {actions.map((action, index) => (
            <LoadingButton
              key={index}
              onClick={action.action}
              isLoading={action.isLoading}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors flex-1',
                action.variant === 'primary' && 'bg-blue-600 hover:bg-blue-700 text-white',
                action.variant === 'danger' && 'bg-red-600 hover:bg-red-700 text-white',
                (!action.variant || action.variant === 'secondary') && 
                  'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
              )}
            >
              {action.label}
            </LoadingButton>
          ))}
        </div>
      )}
      
      {/* Error Details Toggle */}
      {details && (
        <div className="w-full">
          <button
            onClick={onToggleDetails}
            className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors mb-3"
          >
            {showDetails ? 'Hide' : 'Show'} technical details
          </button>
          
          {showDetails && (
            <div className="bg-zinc-800/60 rounded-lg p-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-zinc-300">Error Details</h4>
                <button
                  onClick={copyErrorDetails}
                  className="p-1 hover:bg-zinc-700 rounded transition-colors"
                  title="Copy error details"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              </div>
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all">
                {details}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Specialized error components
export function NetworkError({ onRetry, isRetrying }: { 
  onRetry?: () => void | Promise<void>
  isRetrying?: boolean 
}) {
  return (
    <ErrorState
      type="network"
      actions={onRetry ? [{
        label: 'Try Again',
        action: onRetry,
        variant: 'primary',
        isLoading: isRetrying
      }] : []}
    />
  )
}

export function ServerError({ onRetry, isRetrying }: { 
  onRetry?: () => void | Promise<void>
  isRetrying?: boolean 
}) {
  return (
    <ErrorState
      type="server"
      actions={[
        ...(onRetry ? [{
          label: 'Retry',
          action: onRetry,
          variant: 'primary' as const,
          isLoading: isRetrying
        }] : []),
        {
          label: 'Status Page',
          action: () => window.open('https://status.moxmuse.com', '_blank'),
          variant: 'secondary' as const
        }
      ]}
    />
  )
}

export function NotFoundError({ onGoHome, onGoBack }: {
  onGoHome?: () => void
  onGoBack?: () => void
}) {
  return (
    <ErrorState
      type="not-found"
      actions={[
        ...(onGoBack ? [{
          label: 'Go Back',
          action: onGoBack,
          variant: 'secondary' as const
        }] : []),
        ...(onGoHome ? [{
          label: 'Go Home',
          action: onGoHome,
          variant: 'primary' as const
        }] : [])
      ]}
    />
  )
}

export function AIServiceError({ onRetry, onFallback, isRetrying }: {
  onRetry?: () => void | Promise<void>
  onFallback?: () => void
  isRetrying?: boolean
}) {
  return (
    <ErrorState
      type="ai-service"
      actions={[
        ...(onRetry ? [{
          label: 'Try Again',
          action: onRetry,
          variant: 'primary' as const,
          isLoading: isRetrying
        }] : []),
        ...(onFallback ? [{
          label: 'Use Manual Tools',
          action: onFallback,
          variant: 'secondary' as const
        }] : [])
      ]}
    />
  )
}

// Inline error component for forms and smaller spaces
export interface InlineErrorProps {
  message: string
  action?: ErrorAction
  className?: string
}

export function InlineError({ message, action, className }: InlineErrorProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg',
      className
    )}>
      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-300 flex-1">{message}</span>
      {action && (
        <LoadingButton
          onClick={action.action}
          isLoading={action.isLoading}
          className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          {action.label}
        </LoadingButton>
      )}
    </div>
  )
}

// Toast-style error notifications
export interface ErrorToastProps {
  title: string
  message?: string
  action?: ErrorAction
  onDismiss?: () => void
  autoHide?: boolean
  duration?: number
}

export function ErrorToast({ 
  title, 
  message, 
  action, 
  onDismiss,
  autoHide = true,
  duration = 5000
}: ErrorToastProps) {
  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
  }, [autoHide, duration, onDismiss])
  
  return (
    <div className="bg-red-900/90 backdrop-blur-sm border border-red-500/20 rounded-lg p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-100">{title}</h4>
          {message && (
            <p className="text-sm text-red-200 mt-1">{message}</p>
          )}
          {action && (
            <LoadingButton
              onClick={action.action}
              isLoading={action.isLoading}
              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded mt-2"
            >
              {action.label}
            </LoadingButton>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}