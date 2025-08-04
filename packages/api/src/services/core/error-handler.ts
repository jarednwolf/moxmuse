/**
 * Error Handling Infrastructure
 * 
 * Provides centralized error handling with custom error types,
 * context-aware error processing, and integration with logging and monitoring.
 */

import { ErrorHandler, ErrorContext, ErrorHandlerFunction, Logger, MetricsCollector, BaseService, ServiceHealthStatus } from './interfaces'

// Custom Error Types
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, any>
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, public readonly field?: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      'NOT_FOUND',
      404,
      { resource, id }
    )
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFLICT', 409, context)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends ServiceError {
  constructor(message: string = 'Rate limit exceeded', public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT', 429, { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends ServiceError {
  constructor(
    service: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, {
      service,
      originalError: originalError?.message
    })
    this.name = 'ExternalServiceError'
  }
}

export class DatabaseError extends ServiceError {
  constructor(message: string, public readonly operation?: string, originalError?: Error) {
    super(`Database error: ${message}`, 'DATABASE_ERROR', 500, {
      operation,
      originalError: originalError?.message
    })
    this.name = 'DatabaseError'
  }
}

export class CacheError extends ServiceError {
  constructor(message: string, public readonly operation?: string) {
    super(`Cache error: ${message}`, 'CACHE_ERROR', 500, { operation })
    this.name = 'CacheError'
  }
}

export class JobProcessingError extends ServiceError {
  constructor(jobType: string, message: string, public readonly jobId?: string) {
    super(`Job processing error (${jobType}): ${message}`, 'JOB_PROCESSING_ERROR', 500, {
      jobType,
      jobId
    })
    this.name = 'JobProcessingError'
  }
}

// Error Handler Implementation
export class CentralizedErrorHandler implements ErrorHandler, BaseService {
  readonly name = 'CentralizedErrorHandler'
  readonly version = '1.0.0'
  private handlers = new Map<string, ErrorHandlerFunction>()
  private logger: Logger
  private metrics?: MetricsCollector

  constructor(logger: Logger, metrics?: MetricsCollector) {
    this.logger = logger.child({ service: 'ErrorHandler' })
    this.metrics = metrics
    this.registerDefaultHandlers()
  }

  async initialize(): Promise<void> {
    // Error handler initialization if needed
  }

  async shutdown(): Promise<void> {
    // Error handler cleanup if needed
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: 'healthy',
      timestamp: new Date()
    }
  }

  async handle(error: Error, context: ErrorContext = {} as ErrorContext): Promise<void> {
    const errorType = error.constructor.name
    const handler = this.handlers.get(errorType) || this.handlers.get('default')

    // Log the error
    this.logger.error(`Handling error: ${error.message}`, error, {
      errorType,
      context
    })

    // Record metrics
    if (this.metrics) {
      this.metrics.increment('errors.total', 1, {
        error_type: errorType,
        service: context.service || 'unknown',
        operation: context.operation || 'unknown'
      })
    }

    // Execute handler
    if (handler) {
      try {
        await handler(error, context)
      } catch (handlerError) {
        this.logger.error('Error in error handler', handlerError as Error, {
          originalError: error.message,
          errorType
        })
      }
    }
  }

  register(errorType: new (...args: any[]) => Error, handler: ErrorHandlerFunction): void {
    this.handlers.set(errorType.name, handler)
    this.logger.debug(`Registered error handler for: ${errorType.name}`)
  }

  private registerDefaultHandlers(): void {
    // Default handler
    this.register(Error, async (error: Error, context: ErrorContext) => {
      // Default behavior - just log
      this.logger.error('Unhandled error', error, { context })
    })

    // Service error handler
    this.register(ServiceError, async (error: ServiceError, context: ErrorContext) => {
      this.logger.error(`Service error [${error.code}]`, error, {
        statusCode: error.statusCode,
        context: { ...context, ...error.context }
      })
    })

    // Validation error handler
    this.register(ValidationError, async (error: ValidationError, context: ErrorContext) => {
      this.logger.warn(`Validation error: ${error.message}`, {
        field: error.field,
        context
      })
    })

    // External service error handler
    this.register(ExternalServiceError, async (error: ExternalServiceError, context: ErrorContext) => {
      this.logger.error(`External service error`, error, {
        service: error.context?.service,
        originalError: error.originalError?.message,
        context
      })

      // Could implement retry logic, circuit breaker, etc.
    })

    // Database error handler
    this.register(DatabaseError, async (error: DatabaseError, context: ErrorContext) => {
      this.logger.error(`Database error`, error, {
        operation: error.operation,
        context
      })

      // Could implement connection retry, health checks, etc.
    })

    // Rate limit error handler
    this.register(RateLimitError, async (error: RateLimitError, context: ErrorContext) => {
      this.logger.warn(`Rate limit exceeded`, {
        retryAfter: error.retryAfter,
        context
      })

      if (this.metrics) {
        this.metrics.increment('rate_limit.exceeded', 1, {
          service: context.service || 'unknown'
        })
      }
    })

    // Job processing error handler
    this.register(JobProcessingError, async (error: JobProcessingError, context: ErrorContext) => {
      this.logger.error(`Job processing failed`, error, {
        jobType: error.context?.jobType,
        jobId: error.context?.jobId,
        context
      })

      // Could implement job retry logic, dead letter queue, etc.
    })
  }
}

// Error utilities
export function isServiceError(error: any): error is ServiceError {
  return error instanceof ServiceError
}

export function getErrorStatusCode(error: Error): number {
  if (isServiceError(error)) {
    return error.statusCode
  }
  return 500
}

export function getErrorCode(error: Error): string {
  if (isServiceError(error)) {
    return error.code
  }
  return 'INTERNAL_ERROR'
}

export function createErrorContext(
  service: string,
  operation: string,
  userId?: string,
  requestId?: string,
  metadata?: Record<string, any>
): ErrorContext {
  return {
    service,
    operation,
    userId,
    requestId,
    metadata
  }
}

// Error boundary for async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  errorHandler: ErrorHandler
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    await errorHandler.handle(error as Error, context)
    throw error
  }
}