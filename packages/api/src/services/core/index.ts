/**
 * Core Service Layer Architecture
 * 
 * This module provides the foundational infrastructure for the service layer,
 * including dependency injection, error handling, logging, job processing,
 * intelligent caching, and performance monitoring.
 */

// Interfaces
export * from './interfaces'

// Container and Dependency Injection
export { DIContainer, createServiceToken, SERVICE_TOKENS } from './container'

// Logging Infrastructure
export { StructuredLogger, createLogger, DEFAULT_LOGGER_CONFIG } from './logging'

// Error Handling
export {
  CentralizedErrorHandler,
  ServiceError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  CacheError,
  JobProcessingError,
  isServiceError,
  getErrorStatusCode,
  getErrorCode,
  createErrorContext,
  withErrorHandling
} from './error-handler'

// Job Processing
export { BackgroundJobProcessor } from './job-processor'

// Intelligent Caching
export { IntelligentCache } from './intelligent-cache'

// Performance Monitoring
export {
  ComprehensiveMetricsCollector,
  AdvancedPerformanceMonitor,
  withPerformanceTracking,
  createPerformanceDecorator
} from './performance-monitor'

// Service Factory Functions
import {
  Logger,
  ErrorHandler,
  JobProcessor,
  CacheService,
  MetricsCollector,
  PerformanceMonitor
} from './interfaces'

import { DIContainer, SERVICE_TOKENS } from './container'
import { StructuredLogger, DEFAULT_LOGGER_CONFIG } from './logging'
import { CentralizedErrorHandler } from './error-handler'
import { BackgroundJobProcessor } from './job-processor'
import { IntelligentCache } from './intelligent-cache'
import { ComprehensiveMetricsCollector, AdvancedPerformanceMonitor } from './performance-monitor'

/**
 * Factory function to create a fully configured service container
 * with all core services registered.
 */
export async function createServiceContainer(): Promise<DIContainer> {
  // Create logger first
  const logger = new StructuredLogger(DEFAULT_LOGGER_CONFIG)

  // Create container
  const container = new DIContainer(logger)

  // Register core services
  container.register(
    SERVICE_TOKENS.LOGGER,
    async () => logger,
    { singleton: true, lazy: false }
  )

  container.register(
    SERVICE_TOKENS.METRICS,
    async () => new ComprehensiveMetricsCollector(logger),
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER] }
  )

  container.register(
    SERVICE_TOKENS.ERROR_HANDLER,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new CentralizedErrorHandler(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.CACHE,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new IntelligentCache({}, logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.JOB_PROCESSOR,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new BackgroundJobProcessor(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.PERFORMANCE_MONITOR,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new AdvancedPerformanceMonitor(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  return container
}

/**
 * Service configuration interface for customizing service behavior
 */
export interface ServiceConfig {
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error'
    format?: 'json' | 'text'
    destination?: 'console' | 'file' | 'both'
    enableColors?: boolean
  }
  cache?: {
    maxMemory?: number
    defaultTtl?: number
    compressionThreshold?: number
    cleanupInterval?: number
  }
  jobProcessor?: {
    maxConcurrency?: number
    defaultTimeout?: number
    retryAttempts?: number
  }
  metrics?: {
    flushInterval?: number
    maxBufferSize?: number
    enableProfiling?: boolean
  }
}

/**
 * Factory function to create a configured service container with custom settings
 */
export async function createConfiguredServiceContainer(config: ServiceConfig = {}): Promise<DIContainer> {
  // Create logger with custom config
  const loggerConfig = {
    ...DEFAULT_LOGGER_CONFIG,
    ...config.logging
  }
  const logger = new StructuredLogger(loggerConfig)

  // Create container
  const container = new DIContainer(logger)

  // Register services with custom configurations
  container.register(
    SERVICE_TOKENS.LOGGER,
    async () => logger,
    { singleton: true, lazy: false }
  )

  container.register(
    SERVICE_TOKENS.METRICS,
    async () => new ComprehensiveMetricsCollector(
      logger,
      config.metrics?.maxBufferSize
    ),
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER] }
  )

  container.register(
    SERVICE_TOKENS.ERROR_HANDLER,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new CentralizedErrorHandler(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.CACHE,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new IntelligentCache(config.cache || {}, logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.JOB_PROCESSOR,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new BackgroundJobProcessor(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  container.register(
    SERVICE_TOKENS.PERFORMANCE_MONITOR,
    async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      return new AdvancedPerformanceMonitor(logger, metrics)
    },
    { singleton: true, lazy: false, dependencies: [SERVICE_TOKENS.LOGGER, SERVICE_TOKENS.METRICS] }
  )

  return container
}

/**
 * Utility function to get all core services from a container
 */
export async function getCoreServices(container: DIContainer) {
  const [
    logger,
    errorHandler,
    jobProcessor,
    cache,
    metrics,
    performanceMonitor
  ] = await Promise.all([
    container.resolve(SERVICE_TOKENS.LOGGER),
    container.resolve(SERVICE_TOKENS.ERROR_HANDLER),
    container.resolve(SERVICE_TOKENS.JOB_PROCESSOR),
    container.resolve(SERVICE_TOKENS.CACHE),
    container.resolve(SERVICE_TOKENS.METRICS),
    container.resolve(SERVICE_TOKENS.PERFORMANCE_MONITOR)
  ])

  return {
    logger,
    errorHandler,
    jobProcessor,
    cache,
    metrics,
    performanceMonitor
  }
}

/**
 * Health check utility for all core services
 */
export async function checkCoreServicesHealth(container: DIContainer) {
  try {
    const healthStatuses = await container.getHealthStatus()
    
    const overallHealth = Object.values(healthStatuses).every(
      status => status.status === 'healthy'
    )

    return {
      healthy: overallHealth,
      services: healthStatuses,
      timestamp: new Date()
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }
  }
}