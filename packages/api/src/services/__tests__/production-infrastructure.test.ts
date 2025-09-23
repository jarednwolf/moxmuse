import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { sentryService } from '../monitoring/SentryService'
import { metricsService } from '../monitoring/MetricsService'
import { healthCheckService } from '../health/HealthCheckService'
import { databaseBackupService } from '../backup/DatabaseBackupService'
import { RateLimiter, ddosProtection } from '../../middleware/rate-limiter'
import { errorHandler } from '../../middleware/error-handler'

// Mock external dependencies
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  Integrations: {
    Http: vi.fn().mockImplementation(() => ({})),
    Express: vi.fn().mockImplementation(() => ({})),
  },
  captureException: vi.fn(() => 'mock-error-id'),
  captureMessage: vi.fn(() => 'mock-message-id'),
  withScope: vi.fn((callback) => callback({ setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn() })),
  startTransaction: vi.fn(() => ({ finish: vi.fn(), setTag: vi.fn(), setData: vi.fn(), setStatus: vi.fn() })),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
  default: {
    init: vi.fn(),
    Integrations: {
      Http: vi.fn().mockImplementation(() => ({})),
      Express: vi.fn().mockImplementation(() => ({})),
    },
  },
}))

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    pipeline: vi.fn(() => ({
      incr: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(() => Promise.resolve([[null, 1], [null, 'OK']])),
    })),
    ping: vi.fn(() => Promise.resolve('PONG')),
    disconnect: vi.fn(),
  })),
}))

describe('Production Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('SentryService', () => {
    it('should initialize Sentry with correct configuration', () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123'
      process.env.NODE_ENV = 'production'
      
      sentryService.initialize()
      
      expect(vi.mocked(require('@sentry/node').init)).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'production',
          tracesSampleRate: 0.1,
          profilesSampleRate: 0.1,
        })
      )
    })

    it('should capture errors with context', () => {
      const error = new Error('Test error')
      const context = {
        userId: 'user-123',
        component: 'TestComponent',
        action: 'testAction',
      }

      sentryService.captureError(error, context)

      expect(vi.mocked(require('@sentry/node').withScope)).toHaveBeenCalled()
      expect(vi.mocked(require('@sentry/node').captureException)).toHaveBeenCalledWith(error)
    })

    it('should record performance metrics', () => {
      const performanceContext = {
        operation: 'deck_generation',
        duration: 1500,
        tags: { userId: 'user-123' },
      }

      sentryService.recordPerformance(performanceContext)

      expect(vi.mocked(require('@sentry/node').addBreadcrumb)).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance',
          message: 'deck_generation completed in 1500ms',
          level: 'info',
        })
      )
    })
  })

  describe('MetricsService', () => {
    it('should record metrics with proper structure', () => {
      const metric = {
        name: 'test_metric',
        value: 100,
        unit: 'milliseconds' as const,
        tags: { operation: 'test' },
      }

      metricsService.recordMetric(metric)

      const metrics = metricsService.getMetrics('test_metric', 1)
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'test_metric',
        value: 100,
        unit: 'milliseconds',
        tags: { operation: 'test' },
      })
    })

    it('should calculate average metrics correctly', () => {
      metricsService.recordMetric({ name: 'avg_test', value: 100 })
      metricsService.recordMetric({ name: 'avg_test', value: 200 })
      metricsService.recordMetric({ name: 'avg_test', value: 300 })

      const average = metricsService.getAverageMetric('avg_test', 60)
      expect(average).toBe(200)
    })

    it('should provide system metrics', () => {
      const systemMetrics = metricsService.getSystemMetrics()

      expect(systemMetrics).toMatchObject({
        responseTime: expect.any(Number),
        throughput: expect.any(Number),
        errorRate: expect.any(Number),
        memoryUsage: expect.any(Number),
        activeUsers: expect.any(Number),
        deckGenerations: expect.any(Number),
        successRate: expect.any(Number),
        timestamp: expect.any(Date),
      })
    })
  })

  describe('HealthCheckService', () => {
    it('should register and run health checkers', async () => {
      const mockChecker = {
        name: 'test-service',
        check: vi.fn().mockResolvedValue({
          name: 'test-service',
          status: 'healthy' as const,
          lastCheck: new Date(),
        }),
      }

      healthCheckService.registerChecker(mockChecker)
      const result = await healthCheckService.checkHealth()

      expect(result.services).toContainEqual(
        expect.objectContaining({
          name: 'test-service',
          status: 'healthy',
        })
      )
    })

    it('should handle health check failures gracefully', async () => {
      const failingChecker = {
        name: 'failing-service',
        check: vi.fn().mockRejectedValue(new Error('Service unavailable')),
      }

      healthCheckService.registerChecker(failingChecker)
      const result = await healthCheckService.checkHealth()

      const failingService = result.services.find(s => s.name === 'failing-service')
      expect(failingService).toMatchObject({
        name: 'failing-service',
        status: 'unhealthy',
        error: 'Service unavailable',
      })
    })

    it('should determine overall status correctly', async () => {
      const healthyChecker = {
        name: 'healthy-service',
        check: vi.fn().mockResolvedValue({
          name: 'healthy-service',
          status: 'healthy' as const,
          lastCheck: new Date(),
        }),
      }

      const unhealthyChecker = {
        name: 'unhealthy-service',
        critical: true,
        check: vi.fn().mockResolvedValue({
          name: 'unhealthy-service',
          status: 'unhealthy' as const,
          lastCheck: new Date(),
        }),
      }

      healthCheckService.registerChecker(healthyChecker)
      healthCheckService.registerChecker(unhealthyChecker)

      const result = await healthCheckService.checkHealth()
      expect(result.status).toBe('unhealthy')
    })
  })

  describe('RateLimiter', () => {
    it('should allow requests within limits', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      })

      const mockContext = {
        user: { id: 'user-123' },
        req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      } as any

      const result = await rateLimiter.checkLimit(mockContext)
      
      expect(result.totalHitsInWindow).toBe(1)
      expect(result.remainingRequests).toBe(9)
    })

    it('should throw error when rate limit exceeded', async () => {
      const rateLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      })

      const mockContext = {
        user: { id: 'user-123' },
        req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      } as any

      // First request should succeed
      await rateLimiter.checkLimit(mockContext)

      // Second request should fail
      await expect(rateLimiter.checkLimit(mockContext)).rejects.toThrow(TRPCError)
    })
  })

  describe('DDoSProtection', () => {
    it('should allow normal request patterns', () => {
      const mockContext = {
        req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
      } as any

      expect(() => ddosProtection.checkRequest(mockContext)).not.toThrow()
    })

    it('should provide statistics', () => {
      const stats = ddosProtection.getStats()
      
      expect(stats).toMatchObject({
        suspiciousIPs: expect.any(Number),
        blockedIPs: expect.any(Number),
      })
    })
  })

  describe('ErrorHandler', () => {
    it('should handle TRPC errors appropriately', () => {
      const trcpError = new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid input',
      })

      const mockContext = {
        user: { id: 'user-123' },
        requestId: 'req-123',
      } as any

      const result = errorHandler.handleTRPCError(trcpError, mockContext)
      
      expect(result).toBeInstanceOf(TRPCError)
      expect(result.code).toBe('BAD_REQUEST')
    })

    it('should handle unknown errors', () => {
      const unknownError = new Error('Something went wrong')
      
      const mockContext = {
        user: { id: 'user-123' },
        requestId: 'req-123',
      } as any

      const result = errorHandler.handleUnknownError(unknownError, mockContext)
      
      expect(result).toBeInstanceOf(TRPCError)
      expect(result.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('should handle database errors with specific codes', () => {
      const dbError = new Error('Database error') as any
      dbError.code = 'P2002' // Unique constraint violation
      
      const mockContext = {
        user: { id: 'user-123' },
        requestId: 'req-123',
      } as any

      const result = errorHandler.handleDatabaseError(dbError, 'createUser', mockContext)
      
      expect(result).toBeInstanceOf(TRPCError)
      expect(result.code).toBe('CONFLICT')
    })

    it('should handle AI service errors', () => {
      const aiError = new Error('AI service timeout')
      
      const mockContext = {
        user: { id: 'user-123' },
        requestId: 'req-123',
      } as any

      const result = errorHandler.handleAIServiceError(aiError, 'generateDeck', mockContext)
      
      expect(result).toBeInstanceOf(TRPCError)
      expect(result.code).toBe('SERVICE_UNAVAILABLE')
    })
  })

  describe('DatabaseBackupService', () => {
    beforeEach(() => {
      // Mock child_process.exec
      vi.mock('child_process', () => ({
        exec: vi.fn((command, options, callback) => {
          if (callback) callback(null, { stdout: 'success', stderr: '' })
        }),
      }))

      // Mock fs operations
      vi.mock('fs/promises', () => ({
        writeFile: vi.fn(),
        readFile: vi.fn(() => Promise.resolve(JSON.stringify({
          id: 'test-backup',
          timestamp: new Date(),
          size: 1000,
          compressed: false,
          encrypted: false,
          checksum: 'abc123',
          tables: ['users', 'decks'],
          version: 'PostgreSQL 15.0',
        }))),
        mkdir: vi.fn(),
        stat: vi.fn(() => Promise.resolve({ size: 1000 })),
        readdir: vi.fn(() => Promise.resolve(['backup-1.metadata.json'])),
      }))

      vi.mock('fs', () => ({
        existsSync: vi.fn(() => true),
      }))
    })

    it('should create backup with metadata', async () => {
      const backup = await databaseBackupService.createBackup({ manual: true })
      
      expect(backup).toMatchObject({
        id: expect.any(String),
        timestamp: expect.any(Date),
        size: expect.any(Number),
        compressed: expect.any(Boolean),
        encrypted: expect.any(Boolean),
        checksum: expect.any(String),
        tables: expect.any(Array),
        version: expect.any(String),
      })
    })

    it('should list existing backups', async () => {
      const backups = await databaseBackupService.listBackups()
      
      expect(Array.isArray(backups)).toBe(true)
    })

    it('should validate backup integrity', async () => {
      const mockMetadata = {
        id: 'test-backup',
        timestamp: new Date(),
        size: 1000,
        compressed: false,
        encrypted: false,
        checksum: 'abc123',
        tables: ['users'],
        version: 'PostgreSQL 15.0',
      }

      // Mock checksum calculation
      vi.mock('crypto', () => ({
        createHash: vi.fn(() => ({
          update: vi.fn(),
          digest: vi.fn(() => 'abc123'),
        })),
      }))

      const isValid = await databaseBackupService.validateBackupIntegrity(mockMetadata)
      expect(isValid).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete error flow with monitoring', async () => {
      const error = new Error('Integration test error')
      const mockContext = {
        user: { id: 'user-123' },
        requestId: 'req-123',
        procedure: 'test.procedure',
      } as any

      // This should trigger error handling, metrics recording, and Sentry capture
      const handledError = errorHandler.handleUnknownError(error, mockContext)
      
      expect(handledError).toBeInstanceOf(TRPCError)
      expect(vi.mocked(require('@sentry/node').captureException)).toHaveBeenCalledWith(error)
    })

    it('should provide comprehensive health status', async () => {
      const healthResult = await healthCheckService.checkHealth()
      const systemMetrics = metricsService.getSystemMetrics()
      
      const status = {
        overall: healthResult.status,
        services: healthResult.summary,
        performance: {
          responseTime: systemMetrics.responseTime,
          errorRate: systemMetrics.errorRate,
        },
        uptime: healthResult.uptime,
      }

      expect(status).toMatchObject({
        overall: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        services: {
          total: expect.any(Number),
          healthy: expect.any(Number),
          degraded: expect.any(Number),
          unhealthy: expect.any(Number),
        },
        performance: {
          responseTime: expect.any(Number),
          errorRate: expect.any(Number),
        },
        uptime: expect.any(Number),
      })
    })
  })
})

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks()
})