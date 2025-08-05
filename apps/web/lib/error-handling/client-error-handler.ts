import { TRPCClientError } from '@trpc/client'

// Toast utility - will be replaced with actual toast implementation
const toast = {
  error: (message: string, options?: any) => console.error('Toast Error:', message),
  warning: (message: string, options?: any) => console.warn('Toast Warning:', message),
  info: (message: string, options?: any) => console.info('Toast Info:', message),
  success: (message: string, options?: any) => console.log('Toast Success:', message)
}

/**
 * Client-side error handling utilities
 * Provides network resilience, user-friendly error messages, and recovery strategies
 */

export interface ClientErrorContext {
  operation: string
  component?: string
  userId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface NetworkRetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableStatusCodes: number[]
}

export interface ErrorDisplayConfig {
  showToast: boolean
  toastDuration?: number
  logToConsole: boolean
  storeInLocalStorage: boolean
  reportToService: boolean
}

export const defaultNetworkRetryConfig: NetworkRetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 8000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
}

export const defaultErrorDisplayConfig: ErrorDisplayConfig = {
  showToast: true,
  toastDuration: 5000,
  logToConsole: true,
  storeInLocalStorage: true,
  reportToService: false // Enable in production
}

/**
 * Enhanced client error class with user-friendly messaging
 */
export class ClientError extends Error {
  public readonly code: string
  public readonly statusCode?: number
  public readonly context: ClientErrorContext
  public readonly userMessage: string
  public readonly recoveryActions: string[]
  public readonly retryable: boolean
  public readonly severity: 'low' | 'medium' | 'high' | 'critical'

  constructor(
    message: string,
    code: string,
    context: ClientErrorContext,
    options: {
      statusCode?: number
      userMessage?: string
      recoveryActions?: string[]
      retryable?: boolean
      severity?: 'low' | 'medium' | 'high' | 'critical'
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'ClientError'
    this.code = code
    this.statusCode = options.statusCode
    this.context = context
    this.userMessage = options.userMessage || this.getDefaultUserMessage(code)
    this.recoveryActions = options.recoveryActions || this.getDefaultRecoveryActions(code)
    this.retryable = options.retryable ?? this.isRetryableByDefault(code)
    this.severity = options.severity || this.getDefaultSeverity(code)
    this.cause = options.cause
  }

  private getDefaultUserMessage(code: string): string {
    switch (code) {
      case 'NETWORK_ERROR':
        return 'Connection failed. Please check your internet connection and try again.'
      case 'TIMEOUT':
        return 'The request took too long. Please try again.'
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment before trying again.'
      case 'UNAUTHORIZED':
        return 'Please log in to continue.'
      case 'FORBIDDEN':
        return 'You don\'t have permission to perform this action.'
      case 'NOT_FOUND':
        return 'The requested item could not be found.'
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again.'
      case 'AI_SERVICE_ERROR':
        return 'AI services are temporarily unavailable. Please try again.'
      case 'DECK_GENERATION_ERROR':
        return 'Failed to generate deck. Please try again with different parameters.'
      case 'CARD_SEARCH_ERROR':
        return 'Card search failed. Please try again.'
      case 'SAVE_ERROR':
        return 'Failed to save changes. Please try again.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }

  private getDefaultRecoveryActions(code: string): string[] {
    switch (code) {
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again'
        ]
      case 'TIMEOUT':
        return [
          'Try the action again',
          'Check your internet speed',
          'Try with simpler parameters'
        ]
      case 'RATE_LIMITED':
        return [
          'Wait a few minutes',
          'Reduce the frequency of requests',
          'Try again later'
        ]
      case 'UNAUTHORIZED':
        return [
          'Log in to your account',
          'Refresh the page',
          'Clear browser cache'
        ]
      case 'AI_SERVICE_ERROR':
        return [
          'Wait a moment and try again',
          'Try with different parameters',
          'Check if the issue persists'
        ]
      case 'VALIDATION_ERROR':
        return [
          'Check all required fields',
          'Verify input format',
          'Remove special characters'
        ]
      default:
        return [
          'Try the action again',
          'Refresh the page',
          'Contact support if issue persists'
        ]
    }
  }

  private isRetryableByDefault(code: string): boolean {
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'AI_SERVICE_ERROR',
      'DECK_GENERATION_ERROR',
      'CARD_SEARCH_ERROR',
      'SAVE_ERROR'
    ]
    return retryableCodes.includes(code)
  }

  private getDefaultSeverity(code: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (code) {
      case 'VALIDATION_ERROR':
      case 'NOT_FOUND':
        return 'low'
      case 'UNAUTHORIZED':
      case 'FORBIDDEN':
      case 'RATE_LIMITED':
        return 'medium'
      case 'AI_SERVICE_ERROR':
      case 'DECK_GENERATION_ERROR':
        return 'high'
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return 'critical'
      default:
        return 'medium'
    }
  }
}

/**
 * Network retry manager with exponential backoff
 */
export class NetworkRetryManager {
  constructor(private config: NetworkRetryConfig = defaultNetworkRetryConfig) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ClientErrorContext,
    customConfig?: Partial<NetworkRetryConfig>
  ): Promise<T> {
    const config = { ...this.config, ...customConfig }
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry if it's the last attempt
        if (attempt === config.maxAttempts) {
          break
        }

        // Check if error is retryable
        if (!this.isRetryable(error, config)) {
          break
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
        const jitter = Math.random() * 0.1 * baseDelay // Add 10% jitter
        const delay = Math.min(baseDelay + jitter, config.maxDelay)

        console.warn(`Retrying ${context.operation} (attempt ${attempt}/${config.maxAttempts}) after ${Math.round(delay)}ms`, {
          error: error instanceof Error ? error.message : String(error),
          context
        })

        await this.sleep(delay)
      }
    }

    // All retries failed, throw wrapped error
    throw this.wrapError(lastError!, context)
  }

  private isRetryable(error: unknown, config: NetworkRetryConfig): boolean {
    if (error instanceof ClientError) {
      return error.retryable
    }

    if (error instanceof TRPCClientError) {
      const statusCode = this.extractStatusCode(error)
      return statusCode ? config.retryableStatusCodes.includes(statusCode) : false
    }

    // Check for network-related errors
    if (error instanceof Error) {
      const networkErrorPatterns = [
        'network error',
        'fetch failed',
        'connection refused',
        'timeout',
        'aborted'
      ]
      return networkErrorPatterns.some(pattern => 
        error.message.toLowerCase().includes(pattern)
      )
    }

    return false
  }

  private extractStatusCode(error: TRPCClientError<any>): number | null {
    // Try to extract status code from TRPC error
    if (error.data?.httpStatus) {
      return error.data.httpStatus
    }
    
    if (error.shape?.data?.httpStatus) {
      return error.shape.data.httpStatus
    }

    return null
  }

  private wrapError(error: Error, context: ClientErrorContext): ClientError {
    if (error instanceof ClientError) {
      return error
    }

    if (error instanceof TRPCClientError) {
      return this.handleTRPCError(error, context)
    }

    // Handle network errors
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch')) {
      return new ClientError(
        error.message,
        'NETWORK_ERROR',
        context,
        { cause: error, retryable: true, severity: 'critical' }
      )
    }

    // Handle timeout errors
    if (error.message.toLowerCase().includes('timeout')) {
      return new ClientError(
        error.message,
        'TIMEOUT',
        context,
        { cause: error, retryable: true, severity: 'high' }
      )
    }

    // Generic error
    return new ClientError(
      error.message,
      'UNKNOWN_ERROR',
      context,
      { cause: error, severity: 'medium' }
    )
  }

  private handleTRPCError(error: TRPCClientError<any>, context: ClientErrorContext): ClientError {
    const statusCode = this.extractStatusCode(error)
    
    switch (error.shape?.code || error.data?.code) {
      case 'UNAUTHORIZED':
        return new ClientError(
          error.message,
          'UNAUTHORIZED',
          context,
          { statusCode: statusCode || undefined, retryable: false, severity: 'medium' }
        )
      case 'FORBIDDEN':
        return new ClientError(
          error.message,
          'FORBIDDEN',
          context,
          { statusCode: statusCode || undefined, retryable: false, severity: 'medium' }
        )
      case 'NOT_FOUND':
        return new ClientError(
          error.message,
          'NOT_FOUND',
          context,
          { statusCode: statusCode || undefined, retryable: false, severity: 'low' }
        )
      case 'TOO_MANY_REQUESTS':
        return new ClientError(
          error.message,
          'RATE_LIMITED',
          context,
          { statusCode: statusCode || undefined, retryable: true, severity: 'medium' }
        )
      case 'BAD_REQUEST':
        return new ClientError(
          error.message,
          'VALIDATION_ERROR',
          context,
          { statusCode: statusCode || undefined, retryable: false, severity: 'low' }
        )
      case 'TIMEOUT':
        return new ClientError(
          error.message,
          'TIMEOUT',
          context,
          { statusCode: statusCode || undefined, retryable: true, severity: 'high' }
        )
      default:
        return new ClientError(
          error.message,
          'SERVER_ERROR',
          context,
          { statusCode: statusCode || undefined, retryable: true, severity: 'high' }
        )
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Error display and logging manager
 */
export class ErrorDisplayManager {
  constructor(private config: ErrorDisplayConfig = defaultErrorDisplayConfig) {}

  handleError(error: ClientError | Error, customConfig?: Partial<ErrorDisplayConfig>): void {
    const config = { ...this.config, ...customConfig }
    const clientError = error instanceof ClientError ? error : this.wrapGenericError(error)

    // Log to console
    if (config.logToConsole) {
      this.logToConsole(clientError)
    }

    // Store in localStorage for debugging
    if (config.storeInLocalStorage) {
      this.storeInLocalStorage(clientError)
    }

    // Show user-friendly toast
    if (config.showToast) {
      this.showToast(clientError, config.toastDuration)
    }

    // Report to error tracking service
    if (config.reportToService) {
      this.reportToService(clientError)
    }
  }

  private wrapGenericError(error: Error): ClientError {
    return new ClientError(
      error.message,
      'GENERIC_ERROR',
      {
        operation: 'unknown',
        timestamp: new Date()
      },
      { cause: error }
    )
  }

  private logToConsole(error: ClientError): void {
    const logData = {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      severity: error.severity,
      retryable: error.retryable,
      stack: error.stack
    }

    switch (error.severity) {
      case 'critical':
        console.error('🚨 Critical Error:', logData)
        break
      case 'high':
        console.error('❌ High Severity Error:', logData)
        break
      case 'medium':
        console.warn('⚠️ Medium Severity Error:', logData)
        break
      case 'low':
        console.info('ℹ️ Low Severity Error:', logData)
        break
    }
  }

  private storeInLocalStorage(error: ClientError): void {
    try {
      const errorData = {
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
        context: error.context,
        severity: error.severity,
        timestamp: error.context.timestamp.toISOString()
      }

      const existingErrors = JSON.parse(localStorage.getItem('moxmuse_client_errors') || '[]')
      existingErrors.push(errorData)
      
      // Keep only last 20 errors
      const recentErrors = existingErrors.slice(-20)
      localStorage.setItem('moxmuse_client_errors', JSON.stringify(recentErrors))
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e)
    }
  }

  private showToast(error: ClientError, duration?: number): void {
    const toastOptions = {
      duration: duration || 5000,
      action: error.recoveryActions.length > 0 ? {
        label: 'Help',
        onClick: () => this.showRecoveryActions(error)
      } : undefined
    }

    switch (error.severity) {
      case 'critical':
        toast.error(error.userMessage, toastOptions)
        break
      case 'high':
        toast.error(error.userMessage, toastOptions)
        break
      case 'medium':
        toast.warning(error.userMessage, toastOptions)
        break
      case 'low':
        toast.info(error.userMessage, toastOptions)
        break
    }
  }

  private showRecoveryActions(error: ClientError): void {
    const actionsText = error.recoveryActions.map((action, index) => 
      `${index + 1}. ${action}`
    ).join('\n')

    toast.info(`Recovery suggestions:\n${actionsText}`, {
      duration: 10000
    })
  }

  private reportToService(error: ClientError): void {
    // In production, send to error tracking service
    // For now, just log that we would report it
    console.info('Would report error to tracking service:', {
      code: error.code,
      message: error.message,
      context: error.context,
      severity: error.severity
    })
  }
}

/**
 * Main client error handler
 */
export class ClientErrorHandler {
  private retryManager = new NetworkRetryManager()
  private displayManager = new ErrorDisplayManager()

  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: ClientErrorContext,
    options: {
      retryConfig?: Partial<NetworkRetryConfig>
      displayConfig?: Partial<ErrorDisplayConfig>
      suppressDisplay?: boolean
    } = {}
  ): Promise<T> {
    try {
      return await this.retryManager.executeWithRetry(operation, context, options.retryConfig)
    } catch (error) {
      const clientError = error instanceof ClientError ? error : new ClientError(
        error instanceof Error ? error.message : String(error),
        'EXECUTION_ERROR',
        context,
        { cause: error instanceof Error ? error : undefined }
      )

      if (!options.suppressDisplay) {
        this.displayManager.handleError(clientError, options.displayConfig)
      }

      throw clientError
    }
  }

  handleError(error: Error | ClientError, displayConfig?: Partial<ErrorDisplayConfig>): void {
    this.displayManager.handleError(error, displayConfig)
  }

  createContext(
    operation: string,
    component?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): ClientErrorContext {
    return {
      operation,
      component,
      userId,
      metadata,
      timestamp: new Date()
    }
  }
}

// Export singleton instance
export const clientErrorHandler = new ClientErrorHandler()

// Utility functions
export const withClientErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: ClientErrorContext,
  options?: {
    retryConfig?: Partial<NetworkRetryConfig>
    displayConfig?: Partial<ErrorDisplayConfig>
    suppressDisplay?: boolean
  }
): Promise<T> => {
  return clientErrorHandler.executeWithErrorHandling(operation, context, options)
}

export const createClientErrorContext = (
  operation: string,
  component?: string,
  userId?: string,
  metadata?: Record<string, any>
): ClientErrorContext => {
  return clientErrorHandler.createContext(operation, component, userId, metadata)
}

// Hook for React components
export const useErrorHandler = () => {
  const handleError = (error: Error | ClientError, displayConfig?: Partial<ErrorDisplayConfig>) => {
    clientErrorHandler.handleError(error, displayConfig)
  }

  const executeWithErrorHandling = async <T>(
    operation: () => Promise<T>,
    context: ClientErrorContext,
    options?: {
      retryConfig?: Partial<NetworkRetryConfig>
      displayConfig?: Partial<ErrorDisplayConfig>
      suppressDisplay?: boolean
    }
  ): Promise<T> => {
    return clientErrorHandler.executeWithErrorHandling(operation, context, options)
  }

  return {
    handleError,
    executeWithErrorHandling,
    createContext: clientErrorHandler.createContext
  }
}