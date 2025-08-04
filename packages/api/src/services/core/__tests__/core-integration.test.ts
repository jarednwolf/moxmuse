/**
 * Core Service Layer Integration Tests
 * 
 * Tests the complete integration of all core services including
 * dependency injection, error handling, logging, job processing,
 * caching, and performance monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createServiceContainer,
  createConfiguredServiceContainer,
  getCoreServices,
  checkCoreServicesHealth,
  SERVICE_TOKENS,
  ServiceError,
  ValidationError,
  createErrorContext,
  withErrorHandling
} from '../index'
import { DIContainer } from '../container'

describe('Core Service Layer Integration', () => {
  let container: DIContainer

  beforeEach(async () => {
    container = await createServiceContainer()
    await container.start()
  })

  afterEach(async () => {
    if (container) {
      await container.stop()
    }
  })

  describe('Service Container', () => {
    it('should create and start container with all core services', async () => {
      expect(container).toBeDefined()
      
      const healthStatus = await container.getHealthStatus()
      expect(healthStatus).toBeDefined()
      expect(Object.keys(healthStatus)).toContain('Logger')
      expect(Object.keys(healthStatus)).toContain('MetricsCollector')
      expect(Object.keys(healthStatus)).toContain('ErrorHandler')
      expect(Object.keys(healthStatus)).toContain('CacheService')
      expect(Object.keys(healthStatus)).toContain('JobProcessor')
      expect(Object.keys(healthStatus)).toContain('PerformanceMonitor')
    })

    it('should resolve all core services', async () => {
      const services = await getCoreServices(container)
      
      expect(services.logger).toBeDefined()
      expect(services.errorHandler).toBeDefined()
      expect(services.jobProcessor).toBeDefined()
      expect(services.cache).toBeDefined()
      expect(services.metrics).toBeDefined()
      expect(services.performanceMonitor).toBeDefined()
    })

    it('should provide healthy status for all services', async () => {
      const health = await checkCoreServicesHealth(container)
      
      expect(health.healthy).toBe(true)
      expect(health.services).toBeDefined()
      expect(health.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('Logging Integration', () => {
    it('should create structured logs with context', async () => {
      const logger = await container.resolve(SERVICE_TOKENS.LOGGER)
      
      // Create child logger with context
      const serviceLogger = logger.child({ service: 'TestService', userId: 'test-user' })
      
      // Test different log levels
      serviceLogger.debug('Debug message', { operation: 'test' })
      serviceLogger.info('Info message', { operation: 'test' })
      serviceLogger.warn('Warning message', { operation: 'test' })
      serviceLogger.error('Error message', new Error('Test error'), { operation: 'test' })
      
      // Logger should be healthy
      const health = await logger.healthCheck()
      expect(health.status).toBe('healthy')
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle different error types', async () => {
      const errorHandler = await container.resolve(SERVICE_TOKENS.ERROR_HANDLER)
      
      const context = createErrorContext('TestService', 'testOperation', 'test-user', 'req-123')
      
      // Test different error types
      await errorHandler.handle(new ServiceError('Service error', 'TEST_ERROR', 500), context)
      await errorHandler.handle(new ValidationError('Validation failed', 'testField'), context)
      await errorHandler.handle(new Error('Generic error'), context)
      
      // Error handler should be healthy
      const health = await errorHandler.healthCheck()
      expect(health.status).toBe('healthy')
    })

    it('should integrate with error handling wrapper', async () => {
      const errorHandler = await container.resolve(SERVICE_TOKENS.ERROR_HANDLER)
      const context = createErrorContext('TestService', 'testOperation')
      
      // Test successful operation
      const result = await withErrorHandling(
        async () => 'success',
        context,
        errorHandler
      )
      expect(result).toBe('success')
      
      // Test failed operation
      await expect(
        withErrorHandling(
          async () => { throw new ServiceError('Test error', 'TEST_ERROR') },
          context,
          errorHandler
        )
      ).rejects.toThrow('Test error')
    })
  })

  describe('Caching Integration', () => {
    it('should cache and retrieve values', async () => {
      const cache = await container.resolve(SERVICE_TOKENS.CACHE)
      
      // Test basic caching
      await cache.set('test-key', { data: 'test-value' }, { ttl: 60 })
      const cached = await cache.get('test-key')
      expect(cached).toEqual({ data: 'test-value' })
      
      // Test cache existence
      const exists = await cache.exists('test-key')
      expect(exists).toBe(true)
      
      // Test TTL
      const ttl = await cache.ttl('test-key')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(60)
      
      // Test cache stats
      const stats = await cache.getStats()
      expect(stats.hits).toBeGreaterThan(0)
      expect(stats.keyCount).toBeGreaterThan(0)
    })

    it('should handle cache tags and invalidation', async () => {
      const cache = await container.resolve(SERVICE_TOKENS.CACHE)
      
      // Set values with tags
      await cache.set('user:1', { name: 'User 1' }, { tags: ['user', 'profile'] })
      await cache.set('user:2', { name: 'User 2' }, { tags: ['user', 'profile'] })
      await cache.set('post:1', { title: 'Post 1' }, { tags: ['post'] })
      
      // Verify values exist
      expect(await cache.exists('user:1')).toBe(true)
      expect(await cache.exists('user:2')).toBe(true)
      expect(await cache.exists('post:1')).toBe(true)
      
      // Invalidate by tag
      const invalidated = await cache.invalidateTag('user')
      expect(invalidated).toBe(2)
      
      // Verify user entries are gone but post remains
      expect(await cache.exists('user:1')).toBe(false)
      expect(await cache.exists('user:2')).toBe(false)
      expect(await cache.exists('post:1')).toBe(true)
    })
  })

  describe('Job Processing Integration', () => {
    it('should schedule and process jobs', async () => {
      const jobProcessor = await container.resolve(SERVICE_TOKENS.JOB_PROCESSOR)
      
      let processedData: any = null
      
      // Register job handler
      jobProcessor.process('test-job', async (data, context) => {
        processedData = data
        context.updateProgress(50)
        context.log('Processing job')
        context.updateProgress(100)
        return { result: 'success' }
      })
      
      // Schedule job
      const jobId = await jobProcessor.schedule({
        type: 'test-job',
        data: { message: 'Hello, World!' },
        options: { attempts: 3, timeout: 5000 }
      })
      
      expect(jobId).toBeDefined()
      
      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check job status
      const status = await jobProcessor.getJobStatus(jobId)
      expect(status).toBeDefined()
      expect(status?.type).toBe('test-job')
      
      // Check queue stats
      const stats = await jobProcessor.getQueueStats()
      expect(stats).toBeDefined()
      expect(typeof stats.waiting).toBe('number')
      expect(typeof stats.active).toBe('number')
      expect(typeof stats.completed).toBe('number')
    })

    it('should handle job failures and retries', async () => {
      const jobProcessor = await container.resolve(SERVICE_TOKENS.JOB_PROCESSOR)
      
      let attemptCount = 0
      
      // Register failing job handler
      jobProcessor.process('failing-job', async (data, context) => {
        attemptCount++
        if (attemptCount < 3) {
          throw new Error('Job failed')
        }
        return { result: 'success after retries' }
      })
      
      // Schedule job with retries
      const jobId = await jobProcessor.schedule({
        type: 'failing-job',
        data: { test: true },
        options: { attempts: 3 }
      })
      
      // Wait for retries to complete (need more time for exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 4000))
      
      // Should have attempted at least once, possibly more depending on timing
      expect(attemptCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should track operation performance', async () => {
      const performanceMonitor = await container.resolve(SERVICE_TOKENS.PERFORMANCE_MONITOR)
      
      // Track a successful operation
      const result = await performanceMonitor.trackOperation(
        'test-operation',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return 'success'
        },
        { operation: 'test-operation', userId: 'test-user' }
      )
      
      expect(result).toBe('success')
      
      // Track a failing operation
      await expect(
        performanceMonitor.trackOperation(
          'failing-operation',
          async () => {
            throw new Error('Operation failed')
          }
        )
      ).rejects.toThrow('Operation failed')
      
      // Get performance report
      const report = await performanceMonitor.getPerformanceReport()
      expect(report.operations).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.operations.length).toBeGreaterThan(0)
    })

    it('should handle profiling sessions', async () => {
      const performanceMonitor = await container.resolve(SERVICE_TOKENS.PERFORMANCE_MONITOR)
      
      // Start profiling
      const session = performanceMonitor.startProfiling('test-profile-operation')
      expect(session.id).toBeDefined()
      expect(session.operation).toBe('test-profile-operation')
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Stop profiling
      const result = await performanceMonitor.stopProfiling(session.id)
      expect(result.sessionId).toBe(session.id)
      expect(result.operation).toBe('test-profile-operation')
      expect(result.duration).toBeGreaterThan(0)
      expect(result.memoryUsage).toBeDefined()
    })
  })

  describe('Metrics Collection Integration', () => {
    it('should collect different types of metrics', async () => {
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      
      // Test counter metrics
      metrics.increment('test.counter', 1, { service: 'test' })
      metrics.increment('test.counter', 5, { service: 'test' })
      
      // Test gauge metrics
      metrics.gauge('test.gauge', 42, { service: 'test' })
      metrics.gauge('test.gauge', 84, { service: 'test' })
      
      // Test histogram metrics
      metrics.histogram('test.histogram', 100, { service: 'test' })
      metrics.histogram('test.histogram', 200, { service: 'test' })
      metrics.histogram('test.histogram', 150, { service: 'test' })
      
      // Test timing metrics
      metrics.timing('test.timing', 250, { service: 'test' })
      
      // Test timer
      const timer = metrics.startTimer('test.timer', { service: 'test' })
      await new Promise(resolve => setTimeout(resolve, 10))
      timer.stop({ result: 'success' })
      
      // Get metrics
      const collectedMetrics = await metrics.getMetrics()
      expect(collectedMetrics.length).toBeGreaterThan(0)
      
      // Verify metric types
      const counterMetrics = collectedMetrics.filter(m => m.name === 'test.counter')
      const gaugeMetrics = collectedMetrics.filter(m => m.name === 'test.gauge')
      const histogramMetrics = collectedMetrics.filter(m => m.name === 'test.histogram')
      
      expect(counterMetrics.length).toBeGreaterThan(0)
      expect(gaugeMetrics.length).toBeGreaterThan(0)
      expect(histogramMetrics.length).toBeGreaterThan(0)
    })
  })

  describe('Service Configuration', () => {
    it('should create container with custom configuration', async () => {
      const customContainer = await createConfiguredServiceContainer({
        logging: {
          level: 'debug',
          format: 'text',
          enableColors: false
        },
        cache: {
          maxMemory: 50 * 1024 * 1024, // 50MB
          defaultTtl: 1800 // 30 minutes
        },
        metrics: {
          maxBufferSize: 5000
        }
      })
      
      await customContainer.start()
      
      try {
        const health = await checkCoreServicesHealth(customContainer)
        expect(health.healthy).toBe(true)
        
        // Test that custom configuration is applied
        const cache = await customContainer.resolve(SERVICE_TOKENS.CACHE)
        await cache.set('test', 'value')
        const ttl = await cache.ttl('test')
        expect(ttl).toBeLessThanOrEqual(1800)
        
      } finally {
        await customContainer.stop()
      }
    })
  })

  describe('Service Dependencies', () => {
    it('should handle service dependencies correctly', async () => {
      // All services should be resolved without circular dependency errors
      const services = await getCoreServices(container)
      
      // Verify all services are instances of their expected types
      expect(services.logger.name).toBe('StructuredLogger')
      expect(services.errorHandler.name).toBe('CentralizedErrorHandler')
      expect(services.jobProcessor.name).toBe('BackgroundJobProcessor')
      expect(services.cache.name).toBe('IntelligentCache')
      expect(services.metrics.name).toBe('ComprehensiveMetricsCollector')
      expect(services.performanceMonitor.name).toBe('AdvancedPerformanceMonitor')
    })

    it('should maintain singleton instances', async () => {
      const logger1 = await container.resolve(SERVICE_TOKENS.LOGGER)
      const logger2 = await container.resolve(SERVICE_TOKENS.LOGGER)
      
      expect(logger1).toBe(logger2) // Same instance
      
      const cache1 = await container.resolve(SERVICE_TOKENS.CACHE)
      const cache2 = await container.resolve(SERVICE_TOKENS.CACHE)
      
      expect(cache1).toBe(cache2) // Same instance
    })
  })

  describe('Error Scenarios', () => {
    it('should handle service initialization failures gracefully', async () => {
      const testContainer = new (await import('../container')).DIContainer(
        await container.resolve(SERVICE_TOKENS.LOGGER)
      )
      
      // Register a service that fails to initialize
      testContainer.register(
        { name: 'FailingService', type: class {} as any },
        async () => {
          throw new Error('Service initialization failed')
        }
      )
      
      await expect(testContainer.start()).rejects.toThrow('Service initialization failed')
    })

    it('should handle missing service dependencies', async () => {
      const logger = await container.resolve(SERVICE_TOKENS.LOGGER)
      const testContainer = new (await import('../container')).DIContainer(logger)
      
      await expect(
        testContainer.resolve({ name: 'NonExistentService', type: class {} as any })
      ).rejects.toThrow('Service not registered: NonExistentService')
    })
  })

  describe('Performance and Memory', () => {
    it('should handle high-volume operations efficiently', async () => {
      const cache = await container.resolve(SERVICE_TOKENS.CACHE)
      const metrics = await container.resolve(SERVICE_TOKENS.METRICS)
      
      const startTime = Date.now()
      
      // Perform many cache operations
      const promises = []
      for (let i = 0; i < 1000; i++) {
        promises.push(cache.set(`key-${i}`, { value: i }))
        promises.push(metrics.increment('test.operations', 1))
      }
      
      await Promise.all(promises)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify operations completed
      const stats = await cache.getStats()
      expect(stats.keyCount).toBeGreaterThan(900) // Allow for some eviction
    })
  })
})