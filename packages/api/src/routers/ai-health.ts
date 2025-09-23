/**
 * AI Health Router
 * 
 * Provides endpoints for monitoring AI service health, reliability metrics,
 * and system status for production monitoring and alerting.
 */

import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { openaiOrchestrator } from '../services/ai'

export const aiHealthRouter = createTRPCRouter({
  /**
   * Get overall AI service health status
   */
  getHealthStatus: publicProcedure.query(async () => {
    try {
      const health = openaiOrchestrator.getHealthStatus()
      
      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get AI health status:', error)
      
      return {
        success: false,
        error: 'Failed to retrieve health status',
        data: {
          overall: 'unhealthy' as const,
          components: {
            openai: 'unavailable' as const,
            circuitBreaker: 'UNKNOWN',
            queue: {
              size: 0,
              activeRequests: 0
            },
            monitoring: {
              errorRate: 100,
              averageResponseTime: 0
            }
          },
          recommendations: ['Service is experiencing critical issues']
        },
        timestamp: new Date().toISOString()
      }
    }
  }),

  /**
   * Get detailed reliability statistics
   */
  getReliabilityStats: publicProcedure.query(async () => {
    try {
      const stats = openaiOrchestrator.getReliabilityStats()
      
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get reliability stats:', error)
      
      return {
        success: false,
        error: 'Failed to retrieve reliability statistics',
        timestamp: new Date().toISOString()
      }
    }
  }),

  /**
   * Get performance metrics for specific time window
   */
  getPerformanceMetrics: publicProcedure
    .input(z.object({
      timeWindowMs: z.number().optional().default(3600000) // 1 hour default
    }))
    .query(async ({ input }) => {
      try {
        const stats = openaiOrchestrator.getReliabilityStats()
        
        // Extract performance metrics
        const performance = stats.monitoring.performance
        
        return {
          success: true,
          data: {
            timeWindowMs: input.timeWindowMs,
            totalOperations: performance.totalOperations,
            successRate: performance.successRate,
            averageResponseTime: performance.averageResponseTime,
            p95ResponseTime: performance.p95ResponseTime,
            p99ResponseTime: performance.p99ResponseTime,
            operationStats: performance.operationStats
          },
          timestamp: new Date().toISOString()
        }
      } catch (error) {
        console.error('Failed to get performance metrics:', error)
        
        return {
          success: false,
          error: 'Failed to retrieve performance metrics',
          timestamp: new Date().toISOString()
        }
      }
    }),

  /**
   * Get error statistics and recent errors
   */
  getErrorStats: publicProcedure
    .input(z.object({
      timeWindowMs: z.number().optional().default(3600000) // 1 hour default
    }))
    .query(async ({ input }) => {
      try {
        const stats = openaiOrchestrator.getReliabilityStats()
        
        // Extract error metrics
        const errors = stats.monitoring.errors
        
        return {
          success: true,
          data: {
            timeWindowMs: input.timeWindowMs,
            totalErrors: errors.totalErrors,
            errorRate: errors.errorRate,
            errorsByType: errors.errorsByType,
            errorsBySeverity: errors.errorsBySeverity,
            recentErrors: errors.recentErrors.map(error => ({
              id: error.id,
              timestamp: error.timestamp,
              operationType: error.operationType,
              errorType: error.errorType,
              errorMessage: error.errorMessage,
              severity: error.severity,
              userId: error.userId
            }))
          },
          timestamp: new Date().toISOString()
        }
      } catch (error) {
        console.error('Failed to get error stats:', error)
        
        return {
          success: false,
          error: 'Failed to retrieve error statistics',
          timestamp: new Date().toISOString()
        }
      }
    }),

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus: publicProcedure.query(async () => {
    try {
      const stats = openaiOrchestrator.getReliabilityStats()
      const circuitBreaker = stats.circuitBreaker
      
      return {
        success: true,
        data: {
          state: circuitBreaker.state,
          failureCount: circuitBreaker.failureCount,
          successCount: circuitBreaker.successCount,
          totalRequests: circuitBreaker.totalRequests,
          errorRate: circuitBreaker.errorRate,
          lastFailureTime: circuitBreaker.lastFailureTime,
          lastSuccessTime: circuitBreaker.lastSuccessTime,
          nextRetryTime: circuitBreaker.nextRetryTime
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get circuit breaker status:', error)
      
      return {
        success: false,
        error: 'Failed to retrieve circuit breaker status',
        timestamp: new Date().toISOString()
      }
    }
  }),

  /**
   * Get request queue status
   */
  getQueueStatus: publicProcedure.query(async () => {
    try {
      const stats = openaiOrchestrator.getReliabilityStats()
      const queue = stats.queue
      
      return {
        success: true,
        data: {
          queueSize: queue.queueSize,
          activeRequests: queue.activeRequests,
          totalProcessed: queue.totalProcessed,
          totalFailed: queue.totalFailed,
          averageWaitTimeMs: queue.averageWaitTimeMs,
          averageProcessingTimeMs: queue.averageProcessingTimeMs,
          requestsPerMinute: queue.requestsPerMinute
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get queue status:', error)
      
      return {
        success: false,
        error: 'Failed to retrieve queue status',
        timestamp: new Date().toISOString()
      }
    }
  }),

  /**
   * Test AI service connectivity
   */
  testConnectivity: publicProcedure.query(async () => {
    try {
      const isAvailable = openaiOrchestrator.isOpenAIAvailable()
      
      if (!isAvailable) {
        return {
          success: false,
          error: 'AI service is not available',
          data: {
            available: false,
            reason: 'Invalid or missing API key'
          },
          timestamp: new Date().toISOString()
        }
      }

      // Try a simple test operation
      const testResult = await openaiOrchestrator.getReliableAIService().generateChatCompletion(
        [{ role: 'user', content: 'Test connectivity - respond with "OK"' }],
        {
          operationType: 'connectivity-test',
          priority: 1,
          maxTokens: 10,
          temperature: 0,
          customTimeout: 10000 // 10 second timeout
        }
      )

      return {
        success: testResult.success,
        data: {
          available: testResult.success,
          responseTime: testResult.metrics.totalDurationMs,
          retryAttempts: testResult.metrics.retryAttempts,
          circuitBreakerState: testResult.metrics.circuitBreakerState,
          error: testResult.error?.message
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Connectivity test failed:', error)
      
      return {
        success: false,
        error: 'Connectivity test failed',
        data: {
          available: false,
          reason: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      }
    }
  }),

  /**
   * Get system recommendations based on current health
   */
  getRecommendations: publicProcedure.query(async () => {
    try {
      const health = openaiOrchestrator.getHealthStatus()
      const stats = openaiOrchestrator.getReliabilityStats()
      
      const recommendations: Array<{
        type: 'warning' | 'error' | 'info'
        message: string
        action?: string
      }> = []

      // Health-based recommendations
      health.recommendations.forEach(rec => {
        recommendations.push({
          type: health.overall === 'unhealthy' ? 'error' : 'warning',
          message: rec
        })
      })

      // Circuit breaker recommendations
      if (stats.circuitBreaker.state === 'OPEN') {
        recommendations.push({
          type: 'error',
          message: 'Circuit breaker is OPEN - AI service is failing fast',
          action: 'Check AI service connectivity and error logs'
        })
      } else if (stats.circuitBreaker.state === 'HALF_OPEN') {
        recommendations.push({
          type: 'warning',
          message: 'Circuit breaker is HALF_OPEN - testing recovery',
          action: 'Monitor for successful operations'
        })
      }

      // Queue recommendations
      if (stats.queue.queueSize > 20) {
        recommendations.push({
          type: 'warning',
          message: `High queue size: ${stats.queue.queueSize} requests waiting`,
          action: 'Consider scaling AI service capacity'
        })
      }

      if (stats.queue.averageWaitTimeMs > 30000) {
        recommendations.push({
          type: 'warning',
          message: `High queue wait time: ${Math.round(stats.queue.averageWaitTimeMs)}ms average`,
          action: 'Increase concurrent request limit or add more capacity'
        })
      }

      // Performance recommendations
      if (stats.monitoring.performance.averageResponseTime > 60000) {
        recommendations.push({
          type: 'warning',
          message: `Slow response times: ${Math.round(stats.monitoring.performance.averageResponseTime)}ms average`,
          action: 'Check AI service performance and network connectivity'
        })
      }

      if (stats.monitoring.performance.successRate < 95) {
        recommendations.push({
          type: 'error',
          message: `Low success rate: ${stats.monitoring.performance.successRate.toFixed(1)}%`,
          action: 'Investigate error patterns and AI service stability'
        })
      }

      // Add positive recommendations if everything is healthy
      if (recommendations.length === 0) {
        recommendations.push({
          type: 'info',
          message: 'AI service is operating normally',
          action: 'Continue monitoring for any changes'
        })
      }

      return {
        success: true,
        data: {
          overall: health.overall,
          recommendations
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error)
      
      return {
        success: false,
        error: 'Failed to generate recommendations',
        timestamp: new Date().toISOString()
      }
    }
  })
})