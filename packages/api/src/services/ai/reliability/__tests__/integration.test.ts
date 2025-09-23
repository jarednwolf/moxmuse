/**
 * Integration Test for AI Service Reliability
 * 
 * Simple integration test to verify the reliability components work together.
 */

import { describe, it, expect } from 'vitest'
import { 
  RetryService, 
  CircuitBreakerService, 
  TimeoutService, 
  RequestQueueService, 
  MonitoringService 
} from '../index'

describe('AI Reliability Integration', () => {
  it('should create all reliability services without errors', () => {
    expect(() => {
      const retryService = new RetryService()
      const circuitBreaker = new CircuitBreakerService('test-service')
      const timeoutService = new TimeoutService()
      const queueService = new RequestQueueService('test-queue')
      const monitoringService = new MonitoringService('test-monitoring')
      
      // Basic functionality checks
      expect(retryService.getConfig()).toBeDefined()
      expect(circuitBreaker.getStats()).toBeDefined()
      expect(timeoutService.getConfig()).toBeDefined()
      expect(queueService.getStats()).toBeDefined()
      expect(monitoringService.getHealthSummary()).toBeDefined()
    }).not.toThrow()
  })

  it('should handle retry logic correctly', async () => {
    const retryService = new RetryService({
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 100
    })

    let attempts = 0
    const result = await retryService.executeWithRetry(async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('ECONNRESET') // Retryable error
      }
      return 'success'
    }, 'test-operation')

    expect(result.success).toBe(true)
    expect(result.result).toBe('success')
    expect(result.attempts.length).toBe(3)
    expect(attempts).toBe(3)
  })

  it('should handle circuit breaker correctly', async () => {
    const circuitBreaker = new CircuitBreakerService('test', {
      failureThreshold: 2,
      recoveryTimeoutMs: 1000
    })

    // First failure
    try {
      await circuitBreaker.execute(async () => {
        throw new Error('Service error')
      })
    } catch (error) {
      // Expected
    }

    // Second failure should trip the circuit
    try {
      await circuitBreaker.execute(async () => {
        throw new Error('Service error')
      })
    } catch (error) {
      // Expected
    }

    // Third call should fail fast
    try {
      await circuitBreaker.execute(async () => {
        return 'should not reach here'
      })
      expect.fail('Should have thrown CircuitBreakerError')
    } catch (error) {
      expect(error.name).toBe('CircuitBreakerError')
    }

    const stats = circuitBreaker.getStats()
    expect(stats.state).toBe('OPEN')
  })

  it('should handle timeouts correctly', async () => {
    const timeoutService = new TimeoutService({
      defaultTimeoutMs: 100
    })

    const result = await timeoutService.executeWithTimeout(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return 'should timeout'
      },
      'test-operation'
    )

    expect(result.success).toBe(false)
    expect(result.timedOut).toBe(true)
    expect(result.error?.name).toBe('TimeoutError')
  })

  it('should handle monitoring correctly', () => {
    const monitoring = new MonitoringService('test')

    // Record some metrics
    monitoring.recordMetric('test.metric', 100, 'ms')
    monitoring.recordError('test-operation', new Error('Test error'))
    monitoring.recordPerformance('test-operation', 150, true)

    const errorStats = monitoring.getErrorStats()
    const perfStats = monitoring.getPerformanceStats()
    const health = monitoring.getHealthSummary()

    expect(errorStats.totalErrors).toBe(1)
    expect(perfStats.totalOperations).toBe(1)
    expect(health.status).toBeDefined()
  })
})