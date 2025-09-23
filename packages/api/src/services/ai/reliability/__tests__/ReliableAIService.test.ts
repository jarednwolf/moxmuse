/**
 * Reliable AI Service Tests
 * 
 * Comprehensive tests for AI service reliability features including
 * retry logic, circuit breakers, timeouts, request queuing, and monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReliableAIService } from '../../ReliableAIService'
import { CircuitBreakerError, TimeoutError, RequestQueueError } from '../index'

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

describe('ReliableAIService', () => {
  let reliableAI: ReliableAIService
  let mockOpenAI: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Create service with test configuration
    reliableAI = new ReliableAIService({
      retry: {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeoutMs: 5000
      },
      timeout: {
        defaultTimeoutMs: 5000,
        operationTimeouts: {
          'test-operation': 2000
        }
      },
      queue: {
        maxConcurrentRequests: 2,
        maxQueueSize: 10,
        rateLimitPerMinute: 100
      },
      openai: {
        apiKey: 'sk-test-key'
      }
    })

    // Get the mocked OpenAI instance
    mockOpenAI = (reliableAI as any).openaiClient
  })

  afterEach(async () => {
    await reliableAI.shutdown()
  })

  describe('Basic Operation', () => {
    it('should execute successful operation', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }]
      }
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation',
          userId: 'test-user'
        }
      )

      expect(result.success).toBe(true)
      expect(result.result).toEqual(mockResponse)
      expect(result.metrics.retryAttempts).toBe(0)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })

    it('should handle operation failure', async () => {
      const error = new Error('API Error')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation',
          userId: 'test-user'
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toEqual(error)
      expect(result.metrics.retryAttempts).toBeGreaterThan(0)
    })
  })

  describe('Retry Logic', () => {
    it('should retry on retryable errors', async () => {
      const error = new Error('ECONNRESET')
      const mockResponse = { choices: [{ message: { content: 'Success after retry' } }] }
      
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(mockResponse)

      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation'
        }
      )

      expect(result.success).toBe(true)
      expect(result.result).toEqual(mockResponse)
      expect(result.metrics.retryAttempts).toBe(2)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('invalid_api_key')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation'
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toEqual(error)
      expect(result.metrics.retryAttempts).toBe(0)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('Circuit Breaker', () => {
    it('should trip circuit breaker after threshold failures', async () => {
      const error = new Error('Service unavailable')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      // Execute operations to trip the circuit breaker
      for (let i = 0; i < 4; i++) {
        await reliableAI.executeOperation(
          async (client) => {
            return await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'test' }]
            })
          },
          {
            operationType: 'test-operation'
          }
        )
      }

      // Next operation should fail fast due to circuit breaker
      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation'
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(CircuitBreakerError)
      expect(result.metrics.circuitBreakerState).toBe('OPEN')
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout long-running operations', async () => {
      // Mock a long-running operation
      mockOpenAI.chat.completions.create.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      )

      const result = await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation',
          customTimeout: 1000 // 1 second timeout
        }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(TimeoutError)
      expect(result.metrics.totalDurationMs).toBeGreaterThan(1000)
      expect(result.metrics.totalDurationMs).toBeLessThan(2000)
    })
  })

  describe('Request Queue', () => {
    it('should queue requests when at capacity', async () => {
      const mockResponse = { choices: [{ message: { content: 'Response' } }] }
      
      // Mock slow operations
      mockOpenAI.chat.completions.create.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 500))
      )

      // Start multiple operations simultaneously
      const operations = Array.from({ length: 5 }, (_, i) =>
        reliableAI.executeOperation(
          async (client) => {
            return await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: `test ${i}` }]
            })
          },
          {
            operationType: 'test-operation',
            userId: `user-${i}`
          }
        )
      )

      const results = await Promise.all(operations)

      // All operations should succeed
      expect(results.every(r => r.success)).toBe(true)
      
      // Some operations should have queue wait time
      const queueWaitTimes = results.map(r => r.metrics.queueWaitMs)
      expect(queueWaitTimes.some(time => time > 0)).toBe(true)
    })

    it('should reject requests when queue is full', async () => {
      // Create service with very small queue
      const smallQueueAI = new ReliableAIService({
        queue: {
          maxConcurrentRequests: 1,
          maxQueueSize: 2,
          rateLimitPerMinute: 100
        },
        openai: {
          apiKey: 'sk-test-key'
        }
      })

      // Mock slow operations
      mockOpenAI.chat.completions.create.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      // Start operations to fill queue
      const operations = Array.from({ length: 5 }, (_, i) =>
        smallQueueAI.executeOperation(
          async (client) => {
            return await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: `test ${i}` }]
            })
          },
          {
            operationType: 'test-operation'
          }
        )
      )

      const results = await Promise.allSettled(operations)
      
      // Some operations should be rejected due to queue overflow
      const rejectedResults = results.filter(r => r.status === 'rejected')
      expect(rejectedResults.length).toBeGreaterThan(0)

      await smallQueueAI.shutdown()
    })
  })

  describe('Monitoring', () => {
    it('should track performance metrics', async () => {
      const mockResponse = { choices: [{ message: { content: 'Response' } }] }
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation',
          userId: 'test-user'
        }
      )

      const stats = reliableAI.getStats()
      
      expect(stats.monitoring.performance.totalOperations).toBe(1)
      expect(stats.monitoring.performance.successRate).toBe(100)
      expect(stats.monitoring.performance.averageResponseTime).toBeGreaterThan(0)
    })

    it('should track error metrics', async () => {
      const error = new Error('Test error')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      await reliableAI.executeOperation(
        async (client) => {
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }]
          })
        },
        {
          operationType: 'test-operation',
          userId: 'test-user'
        }
      )

      const stats = reliableAI.getStats()
      
      expect(stats.monitoring.errors.totalErrors).toBeGreaterThan(0)
      expect(stats.monitoring.errors.errorsByType['Error']).toBeGreaterThan(0)
    })
  })

  describe('Health Status', () => {
    it('should report healthy status for normal operations', async () => {
      const health = reliableAI.getHealthStatus()
      
      expect(health.overall).toBe('healthy')
      expect(health.components.openai).toBe('available')
      expect(health.components.circuitBreaker).toBe('CLOSED')
    })

    it('should report unhealthy status when circuit breaker is open', async () => {
      // Trip the circuit breaker
      const error = new Error('Service error')
      mockOpenAI.chat.completions.create.mockRejectedValue(error)

      for (let i = 0; i < 4; i++) {
        await reliableAI.executeOperation(
          async (client) => {
            return await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: 'test' }]
            })
          },
          {
            operationType: 'test-operation'
          }
        )
      }

      const health = reliableAI.getHealthStatus()
      
      expect(health.overall).toBe('unhealthy')
      expect(health.components.circuitBreaker).toBe('OPEN')
      expect(health.recommendations).toContain('AI service is unavailable')
    })
  })

  describe('Chat Completion Wrapper', () => {
    it('should generate chat completion successfully', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI response' } }],
        usage: { total_tokens: 100 }
      }
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await reliableAI.generateChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        {
          userId: 'test-user',
          sessionId: 'test-session',
          model: 'gpt-4o-mini',
          maxTokens: 1000,
          temperature: 0.7
        }
      )

      expect(result.success).toBe(true)
      expect(result.result).toEqual(mockResponse)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1000,
          temperature: 0.7
        }),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      )
    })
  })
})