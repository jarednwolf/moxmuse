/**
 * Reliable AI Service
 * 
 * Enhanced AI service wrapper that integrates retry logic, circuit breakers,
 * timeouts, request queuing, and comprehensive monitoring for production reliability.
 */

import OpenAI from 'openai'
import {
  RetryService,
  CircuitBreakerService,
  TimeoutService,
  RequestQueueService,
  MonitoringService,
  CircuitBreakerError,
  TimeoutError,
  RequestQueueError,
  type RetryConfig,
  type CircuitBreakerConfig,
  type TimeoutConfig,
  type QueueConfig,
  type MonitoringConfig
} from './reliability'

export interface ReliableAIConfig {
  retry: Partial<RetryConfig>
  circuitBreaker: Partial<CircuitBreakerConfig>
  timeout: Partial<TimeoutConfig>
  queue: Partial<QueueConfig>
  monitoring: Partial<MonitoringConfig>
  openai: {
    apiKey: string
    model?: string
    maxTokens?: number
    temperature?: number
  }
}

export interface AIOperationContext {
  operationType: string
  userId?: string
  sessionId?: string
  priority?: number
  customTimeout?: number
  metadata?: Record<string, any>
}

export interface AIOperationResult<T> {
  success: boolean
  result?: T
  error?: Error
  metrics: {
    totalDurationMs: number
    retryAttempts: number
    queueWaitMs: number
    processingMs: number
    circuitBreakerState: string
  }
}

export class ReliableAIService {
  private openaiClient: OpenAI
  private retryService: RetryService
  private circuitBreakerService: CircuitBreakerService
  private timeoutService: TimeoutService
  private queueService: RequestQueueService
  private monitoringService: MonitoringService

  private static DEFAULT_CONFIG: ReliableAIConfig = {
    retry: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffFactor: 2
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeoutMs: 60000,
      monitoringWindowMs: 300000,
      minimumThroughput: 10,
      errorThresholdPercentage: 50
    },
    timeout: {
      defaultTimeoutMs: 120000,
      operationTimeouts: {
        'deck-generation': 180000,
        'card-recommendation': 60000,
        'synergy-analysis': 90000,
        'strategy-analysis': 90000,
        'vision-parsing': 30000
      }
    },
    queue: {
      maxConcurrentRequests: 5,
      maxQueueSize: 100,
      defaultPriority: 5,
      requestTimeoutMs: 300000,
      rateLimitPerMinute: 60
    },
    monitoring: {
      enableMetrics: true,
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      metricsRetentionMs: 3600000,
      errorRetentionMs: 86400000,
      alertThresholds: {
        errorRatePercentage: 10,
        responseTimeMs: 30000,
        queueSizeThreshold: 50
      }
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      maxTokens: 4000,
      temperature: 0.7
    }
  }

  constructor(config: Partial<ReliableAIConfig> = {}) {
    const mergedConfig = this.mergeConfig(config as ReliableAIConfig)
    
    console.log('🔧 Initializing Reliable AI Service...')
    
    // Initialize OpenAI client
    this.openaiClient = new OpenAI({
      apiKey: mergedConfig.openai.apiKey,
      timeout: mergedConfig.timeout.defaultTimeoutMs
    })

    // Initialize reliability services
    this.retryService = new RetryService(mergedConfig.retry as RetryConfig)
    this.circuitBreakerService = new CircuitBreakerService('OpenAI', mergedConfig.circuitBreaker as CircuitBreakerConfig)
    this.timeoutService = new TimeoutService(mergedConfig.timeout as TimeoutConfig)
    this.queueService = new RequestQueueService('AI-Operations', mergedConfig.queue as QueueConfig)
    this.monitoringService = new MonitoringService('ReliableAI', mergedConfig.monitoring as MonitoringConfig)

    console.log('✅ Reliable AI Service initialized successfully')
  }

  /**
   * Execute AI operation with full reliability stack
   */
  async executeOperation<T>(
    operation: (client: OpenAI, signal?: AbortSignal) => Promise<T>,
    context: AIOperationContext
  ): Promise<AIOperationResult<T>> {
    const startTime = Date.now()
    let queueWaitMs = 0
    let processingMs = 0
    let retryAttempts = 0

    try {
      // Queue the operation
      const queueStartTime = Date.now()
      
      const result = await this.queueService.enqueue(
        async () => {
          queueWaitMs = Date.now() - queueStartTime
          const processingStartTime = Date.now()

          try {
            // Execute through circuit breaker
            const operationResult = await this.circuitBreakerService.execute(async () => {
              // Execute with retry logic
              const retryResult = await this.retryService.executeWithRetry(async () => {
                // Execute with timeout
                const timeoutResult = await this.timeoutService.executeWithTimeout(
                  (signal) => operation(this.openaiClient, signal),
                  context.operationType,
                  context.customTimeout
                )

                if (!timeoutResult.success) {
                  throw timeoutResult.error!
                }

                return timeoutResult.result!
              }, context.operationType)

              retryAttempts = retryResult.attempts.length - 1 // Subtract initial attempt

              if (!retryResult.success) {
                throw retryResult.error!
              }

              return retryResult.result!
            })

            processingMs = Date.now() - processingStartTime
            return operationResult
          } catch (error) {
            processingMs = Date.now() - processingStartTime
            throw error
          }
        },
        context.operationType,
        context.priority,
        context.userId
      )

      const totalDurationMs = Date.now() - startTime

      // Record successful operation
      this.monitoringService.recordPerformance(
        context.operationType,
        totalDurationMs,
        true,
        {
          ...context.metadata,
          queueWaitMs,
          processingMs,
          retryAttempts
        },
        context.userId
      )

      this.monitoringService.recordMetric(
        'ai.operation.success',
        1,
        'count',
        { operationType: context.operationType }
      )

      console.log(`✅ [${context.operationType}] Operation completed successfully in ${totalDurationMs}ms`)

      return {
        success: true,
        result,
        metrics: {
          totalDurationMs,
          retryAttempts,
          queueWaitMs,
          processingMs,
          circuitBreakerState: this.circuitBreakerService.getStats().state
        }
      }
    } catch (error) {
      const totalDurationMs = Date.now() - startTime
      const errorInstance = error as Error

      // Determine error severity
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
      if (error instanceof CircuitBreakerError) {
        severity = 'critical'
      } else if (error instanceof TimeoutError) {
        severity = 'high'
      } else if (error instanceof RequestQueueError) {
        severity = 'high'
      }

      // Record error
      this.monitoringService.recordError(
        context.operationType,
        errorInstance,
        {
          ...context.metadata,
          queueWaitMs,
          processingMs,
          retryAttempts,
          circuitBreakerState: this.circuitBreakerService.getStats().state
        },
        severity,
        context.userId,
        context.sessionId
      )

      this.monitoringService.recordPerformance(
        context.operationType,
        totalDurationMs,
        false,
        {
          ...context.metadata,
          errorType: errorInstance.name,
          errorMessage: errorInstance.message
        },
        context.userId
      )

      this.monitoringService.recordMetric(
        'ai.operation.failure',
        1,
        'count',
        { 
          operationType: context.operationType,
          errorType: errorInstance.name
        }
      )

      console.error(`❌ [${context.operationType}] Operation failed after ${totalDurationMs}ms:`, errorInstance.message)

      return {
        success: false,
        error: errorInstance,
        metrics: {
          totalDurationMs,
          retryAttempts,
          queueWaitMs,
          processingMs,
          circuitBreakerState: this.circuitBreakerService.getStats().state
        }
      }
    }
  }

  /**
   * Generate chat completion with reliability
   */
  async generateChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    context: Omit<AIOperationContext, 'operationType'> & { 
      model?: string
      maxTokens?: number
      temperature?: number
    }
  ): Promise<AIOperationResult<OpenAI.Chat.Completions.ChatCompletion>> {
    return this.executeOperation(
      async (client, signal) => {
        return await client.chat.completions.create({
          model: context.model || ReliableAIService.DEFAULT_CONFIG.openai.model!,
          messages,
          max_tokens: context.maxTokens || ReliableAIService.DEFAULT_CONFIG.openai.maxTokens,
          temperature: context.temperature || ReliableAIService.DEFAULT_CONFIG.openai.temperature
        }, {
          signal
        })
      },
      {
        ...context,
        operationType: 'chat-completion'
      }
    )
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    const stats = this.circuitBreakerService.getStats()
    return stats.state !== 'OPEN' && !!process.env.OPENAI_API_KEY?.startsWith('sk-')
  }

  /**
   * Get comprehensive service health
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy'
    components: {
      openai: 'available' | 'unavailable'
      circuitBreaker: string
      queue: {
        size: number
        activeRequests: number
      }
      monitoring: {
        errorRate: number
        averageResponseTime: number
      }
    }
    recommendations: string[]
  } {
    const circuitStats = this.circuitBreakerService.getStats()
    const queueStats = this.queueService.getStats()
    const healthSummary = this.monitoringService.getHealthSummary()

    const components = {
      openai: this.isAvailable() ? 'available' as const : 'unavailable' as const,
      circuitBreaker: circuitStats.state,
      queue: {
        size: queueStats.queueSize,
        activeRequests: queueStats.activeRequests
      },
      monitoring: {
        errorRate: healthSummary.errorRate,
        averageResponseTime: healthSummary.averageResponseTime
      }
    }

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const recommendations: string[] = []

    // Determine overall health
    if (!this.isAvailable() || circuitStats.state === 'OPEN') {
      overall = 'unhealthy'
      recommendations.push('AI service is unavailable')
    } else if (circuitStats.state === 'HALF_OPEN' || healthSummary.status === 'degraded') {
      overall = 'degraded'
      recommendations.push('AI service is experiencing issues')
    }

    if (queueStats.queueSize > 50) {
      overall = overall === 'healthy' ? 'degraded' : 'unhealthy'
      recommendations.push(`High queue size: ${queueStats.queueSize}`)
    }

    recommendations.push(...healthSummary.recommendations)

    return {
      overall,
      components,
      recommendations
    }
  }

  /**
   * Get detailed statistics
   */
  getStats(): {
    retry: RetryConfig
    circuitBreaker: any
    queue: any
    monitoring: {
      errors: any
      performance: any
      health: any
    }
  } {
    return {
      retry: this.retryService.getConfig(),
      circuitBreaker: this.circuitBreakerService.getStats(),
      queue: this.queueService.getStats(),
      monitoring: {
        errors: this.monitoringService.getErrorStats(),
        performance: this.monitoringService.getPerformanceStats(),
        health: this.monitoringService.getHealthSummary()
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Reliable AI Service...')
    
    try {
      await this.queueService.stop()
      console.log('✅ Reliable AI Service shutdown complete')
    } catch (error) {
      console.error('❌ Error during shutdown:', error)
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<ReliableAIConfig>): ReliableAIConfig {
    return {
      retry: { ...ReliableAIService.DEFAULT_CONFIG.retry, ...config.retry },
      circuitBreaker: { ...ReliableAIService.DEFAULT_CONFIG.circuitBreaker, ...config.circuitBreaker },
      timeout: { ...ReliableAIService.DEFAULT_CONFIG.timeout, ...config.timeout },
      queue: { ...ReliableAIService.DEFAULT_CONFIG.queue, ...config.queue },
      monitoring: { ...ReliableAIService.DEFAULT_CONFIG.monitoring, ...config.monitoring },
      openai: { ...ReliableAIService.DEFAULT_CONFIG.openai, ...config.openai }
    }
  }
}