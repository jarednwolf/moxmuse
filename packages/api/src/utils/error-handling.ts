import { TRPCError } from '@trpc/server'
import { ZodError } from 'zod'
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library'

/**
 * Comprehensive error handling utilities for API layer
 * Provides consistent error formatting, retry logic, and graceful degradation
 */

export interface ErrorContext {
  operation: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'TIMEOUT',
    'INTERNAL_SERVER_ERROR',
    'BAD_GATEWAY',
    'SERVICE_UNAVAILABLE',
    'GATEWAY_TIMEOUT'
  ]
}

/**
 * Enhanced error class with context and recovery suggestions
 */
export class MoxMuseError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly context: ErrorContext
  public readonly userMessage: string
  public readonly recoveryActions: string[]
  public readonly retryable: boolean

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context: ErrorContext,
    options: {
      userMessage?: string
      recoveryActions?: string[]
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'MoxMuseError'
    this.code = code
    this.statusCode = statusCode
    this.context = context
    this.userMessage = options.userMessage || this.getDefaultUserMessage(code)
    this.recoveryActions = options.recoveryActions || this.getDefaultRecoveryActions(code)
    this.retryable = options.retryable ?? this.isRetryableByDefault(code)
    this.cause = options.cause
  }

  private getDefaultUserMessage(code: string): string {
    switch (code) {
      case 'AI_SERVICE_UNAVAILABLE':
        return 'AI services are temporarily unavailable. Please try again in a moment.'
      case 'RATE_LIMIT_EXCEEDED':
        return 'You\'ve made too many requests. Please wait a moment before trying again.'
      case 'INVALID_INPUT':
        return 'The information provided is invalid. Please check your input and try again.'
      case 'DECK_NOT_FOUND':
        return 'The requested deck could not be found.'
      case 'UNAUTHORIZED':
        return 'You need to be logged in to perform this action.'
      case 'FORBIDDEN':
        return 'You don\'t have permission to perform this action.'
      case 'DATABASE_ERROR':
        return 'A database error occurred. Please try again.'
      case 'NETWORK_ERROR':
        return 'Network connection failed. Please check your internet connection.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  private getDefaultRecoveryActions(code: string): string[] {
    switch (code) {
      case 'AI_SERVICE_UNAVAILABLE':
        return [
          'Wait a few moments and try again',
          'Check if the issue persists',
          'Contact support if the problem continues'
        ]
      case 'RATE_LIMIT_EXCEEDED':
        return [
          'Wait for the rate limit to reset',
          'Reduce the frequency of requests',
          'Consider upgrading your plan for higher limits'
        ]
      case 'INVALID_INPUT':
        return [
          'Check your input for errors',
          'Ensure all required fields are filled',
          'Verify the format matches requirements'
        ]
      case 'UNAUTHORIZED':
        return [
          'Log in to your account',
          'Refresh the page',
          'Clear your browser cache and cookies'
        ]
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Wait a moment and try again'
        ]
      default:
        return [
          'Try the action again',
          'Refresh the page',
          'Contact support if the issue persists'
        ]
    }
  }

  private isRetryableByDefault(code: string): boolean {
    const retryableCodes = [
      'AI_SERVICE_UNAVAILABLE',
      'DATABASE_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT',
      'INTERNAL_SERVER_ERROR'
    ]
    return retryableCodes.includes(code)
  }

  toTRPCError(): TRPCError {
    return new TRPCError({
      code: this.getTRPCCode(),
      message: this.userMessage,
      cause: this
    })
  }

  private getTRPCCode(): TRPCError['code'] {
    switch (this.code) {
      case 'UNAUTHORIZED':
        return 'UNAUTHORIZED'
      case 'FORBIDDEN':
        return 'FORBIDDEN'
      case 'INVALID_INPUT':
        return 'BAD_REQUEST'
      case 'DECK_NOT_FOUND':
        return 'NOT_FOUND'
      case 'RATE_LIMIT_EXCEEDED':
        return 'TOO_MANY_REQUESTS'
      case 'TIMEOUT':
        return 'TIMEOUT'
      default:
        return 'INTERNAL_SERVER_ERROR'
    }
  }
}

/**
 * Error factory for creating consistent errors
 */
export class ErrorFactory {
  static createAIServiceError(context: ErrorContext, cause?: Error): MoxMuseError {
    return new MoxMuseError(
      'AI service is currently unavailable',
      'AI_SERVICE_UNAVAILABLE',
      503,
      context,
      {
        userMessage: 'AI services are temporarily unavailable. Please try again in a moment.',
        retryable: true,
        cause
      }
    )
  }

  static createRateLimitError(context: ErrorContext, resetTime?: Date): MoxMuseError {
    const resetMessage = resetTime 
      ? ` You can try again after ${resetTime.toLocaleTimeString()}.`
      : ' Please wait a moment before trying again.'

    return new MoxMuseError(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      context,
      {
        userMessage: `You've made too many requests.${resetMessage}`,
        retryable: false
      }
    )
  }

  static createValidationError(context: ErrorContext, details: string, cause?: Error): MoxMuseError {
    return new MoxMuseError(
      `Validation failed: ${details}`,
      'INVALID_INPUT',
      400,
      context,
      {
        userMessage: 'The information provided is invalid. Please check your input and try again.',
        retryable: false,
        cause
      }
    )
  }

  static createDatabaseError(context: ErrorContext, cause?: Error): MoxMuseError {
    return new MoxMuseError(
      'Database operation failed',
      'DATABASE_ERROR',
      500,
      context,
      {
        userMessage: 'A database error occurred. Please try again.',
        retryable: true,
        cause
      }
    )
  }

  static createNotFoundError(context: ErrorContext, resource: string): MoxMuseError {
    return new MoxMuseError(
      `${resource} not found`,
      `${resource.toUpperCase()}_NOT_FOUND`,
      404,
      context,
      {
        userMessage: `The requested ${resource.toLowerCase()} could not be found.`,
        retryable: false
      }
    )
  }

  static createUnauthorizedError(context: ErrorContext): MoxMuseError {
    return new MoxMuseError(
      'Unauthorized access',
      'UNAUTHORIZED',
      401,
      context,
      {
        userMessage: 'You need to be logged in to perform this action.',
        retryable: false
      }
    )
  }

  static createForbiddenError(context: ErrorContext): MoxMuseError {
    return new MoxMuseError(
      'Forbidden access',
      'FORBIDDEN',
      403,
      context,
      {
        userMessage: 'You don\'t have permission to perform this action.',
        retryable: false
      }
    )
  }
}

/**
 * Retry utility with exponential backoff
 */
export class RetryManager {
  constructor(private config: RetryConfig = defaultRetryConfig) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customConfig?: Partial<RetryConfig>
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

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )

        console.warn(`Retry attempt ${attempt}/${config.maxAttempts} for ${context.operation} after ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
          context
        })

        await this.sleep(delay)
      }
    }

    // All retries failed, throw the last error
    throw this.wrapError(lastError!, context)
  }

  private isRetryable(error: unknown, config: RetryConfig): boolean {
    if (error instanceof MoxMuseError) {
      return error.retryable
    }

    if (error instanceof TRPCError) {
      return config.retryableErrors.includes(error.code)
    }

    if (error instanceof Error) {
      return config.retryableErrors.some(code => 
        error.message.includes(code) || error.name.includes(code)
      )
    }

    return false
  }

  private wrapError(error: Error, context: ErrorContext): MoxMuseError {
    if (error instanceof MoxMuseError) {
      return error
    }

    if (error instanceof TRPCError) {
      return new MoxMuseError(
        error.message,
        error.code,
        this.getStatusCodeFromTRPCCode(error.code),
        context,
        { cause: error }
      )
    }

    return new MoxMuseError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      context,
      { cause: error }
    )
  }

  private getStatusCodeFromTRPCCode(code: string): number {
    switch (code) {
      case 'BAD_REQUEST': return 400
      case 'UNAUTHORIZED': return 401
      case 'FORBIDDEN': return 403
      case 'NOT_FOUND': return 404
      case 'TOO_MANY_REQUESTS': return 429
      case 'INTERNAL_SERVER_ERROR': return 500
      case 'TIMEOUT': return 504
      default: return 500
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime: Date | null = null
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'CLOSED'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = new Date()

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime()
    return timeSinceLastFailure >= this.config.resetTimeout
  }

  getState(): string {
    return this.state
  }

  getFailureCount(): number {
    return this.failures
  }
}

/**
 * Error handler for different error types
 */
export class ErrorHandler {
  private retryManager = new RetryManager()
  private circuitBreakers = new Map<string, CircuitBreaker>()

  handlePrismaError(error: unknown, context: ErrorContext): MoxMuseError {
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          return ErrorFactory.createValidationError(
            context,
            'A record with this information already exists',
            error
          )
        case 'P2025':
          return ErrorFactory.createNotFoundError(context, 'record')
        case 'P2003':
          return ErrorFactory.createValidationError(
            context,
            'Referenced record does not exist',
            error
          )
        default:
          return ErrorFactory.createDatabaseError(context, error)
      }
    }

    if (error instanceof PrismaClientUnknownRequestError) {
      return ErrorFactory.createDatabaseError(context, error)
    }

    return ErrorFactory.createDatabaseError(context, error as Error)
  }

  handleZodError(error: ZodError, context: ErrorContext): MoxMuseError {
    const details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return ErrorFactory.createValidationError(context, details, error)
  }

  handleOpenAIError(error: unknown, context: ErrorContext): MoxMuseError {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (errorMessage.includes('rate limit')) {
      return ErrorFactory.createRateLimitError(context)
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return new MoxMuseError(
        'OpenAI request failed',
        'AI_SERVICE_UNAVAILABLE',
        503,
        context,
        {
          userMessage: 'AI services are temporarily unavailable. Please try again in a moment.',
          retryable: true,
          cause: error as Error
        }
      )
    }

    return ErrorFactory.createAIServiceError(context, error as Error)
  }

  getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 300000 // 5 minutes
      }
      this.circuitBreakers.set(name, new CircuitBreaker(name, config || defaultConfig))
    }
    return this.circuitBreakers.get(name)!
  }

  async executeWithRetryAndCircuitBreaker<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    circuitBreakerName?: string,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const wrappedOperation = circuitBreakerName
      ? () => this.getCircuitBreaker(circuitBreakerName).execute(operation)
      : operation

    return this.retryManager.executeWithRetry(wrappedOperation, context, retryConfig)
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler()

// Utility functions for common error scenarios
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: {
    retryConfig?: Partial<RetryConfig>
    circuitBreakerName?: string
  } = {}
): Promise<T> => {
  try {
    return await errorHandler.executeWithRetryAndCircuitBreaker(
      operation,
      context,
      options.circuitBreakerName,
      options.retryConfig
    )
  } catch (error) {
    // Log error for monitoring
    console.error('Operation failed:', {
      operation: context.operation,
      error: error instanceof Error ? error.message : String(error),
      context
    })
    throw error
  }
}

export const createErrorContext = (
  operation: string,
  userId?: string,
  sessionId?: string,
  metadata?: Record<string, any>
): ErrorContext => ({
  operation,
  userId,
  sessionId,
  metadata,
  timestamp: new Date()
})