/**
 * Monitoring API Router
 * 
 * Provides endpoints for accessing performance metrics, errors,
 * AI usage stats, and user satisfaction data.
 */

import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { performanceMonitor } from '../services/core/performance-monitor'
import { aiUsageMonitor } from '../services/monitoring/ai-usage-monitor'
import { errorTracker } from '../services/monitoring/error-tracker'
import { userSatisfactionTracker } from '../services/monitoring/user-satisfaction-tracker'
import { logger } from '../services/core/logging'
import { prisma } from '@moxmuse/db'

// Input schemas
const timeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime()
})

const metricFilterSchema = z.object({
  operation: z.string().optional(),
  userId: z.string().optional(),
  timeRange: timeRangeSchema.optional()
})

const errorFilterSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']).optional(),
  source: z.string().optional(),
  timeRange: timeRangeSchema.optional()
})

const aiUsageFilterSchema = z.object({
  model: z.string().optional(),
  taskType: z.string().optional(),
  timeRange: timeRangeSchema.optional()
})

const satisfactionFeedbackSchema = z.object({
  deckId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
  aspects: z.object({
    cardChoices: z.number().min(1).max(5).optional(),
    explanations: z.number().min(1).max(5).optional(),
    synergyMapping: z.number().min(1).max(5).optional(),
    budgetOptimization: z.number().min(1).max(5).optional()
  }).optional()
})

export const monitoringRouter = createTRPCRouter({
  // Performance metrics endpoints
  performanceMetrics: protectedProcedure
    .input(metricFilterSchema)
    .query(async ({ input, ctx }) => {
      try {
        const timeRange = input.timeRange ? {
          start: new Date(input.timeRange.start),
          end: new Date(input.timeRange.end)
        } : undefined

        const report = await performanceMonitor.getPerformanceReport(timeRange)
        
        // Filter by operation if specified
        if (input.operation) {
          const filterOperation = input.operation
          report.operations = report.operations.filter(
            op => op.operation.includes(filterOperation)
          )
        }

        return {
          success: true,
          data: report
        }
      } catch (error) {
        logger.error('Error fetching performance metrics', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch performance metrics'
        })
      }
    }),

  // Real-time metrics stream
  metricsStream: protectedProcedure
    .subscription(async function* ({ ctx }) {
      try {
        // Send metrics every 5 seconds
        while (true) {
          const report = await performanceMonitor.getPerformanceReport({
            start: new Date(Date.now() - 60000), // Last minute
            end: new Date()
          })

          yield {
            timestamp: new Date(),
            metrics: report.summary,
            topOperations: report.operations
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
          }

          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      } catch (error) {
        logger.error('Error in metrics stream', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Metrics stream error'
        })
      }
    }),

  // Error tracking endpoints
  errors: protectedProcedure
    .input(errorFilterSchema)
    .query(async ({ input, ctx }) => {
      try {
        const filter = {
          ...input,
          timeRange: input.timeRange ? {
            start: new Date(input.timeRange.start),
            end: new Date(input.timeRange.end)
          } : undefined
        }
        
        const errors = await errorTracker.getErrors(filter)
        const summary = await errorTracker.getErrorSummary(filter.timeRange)

        return {
          success: true,
          data: {
            errors,
            summary
          }
        }
      } catch (error) {
        logger.error('Error fetching error data', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch error data'
        })
      }
    }),

  // AI usage monitoring
  aiUsage: protectedProcedure
    .input(aiUsageFilterSchema)
    .query(async ({ input, ctx }) => {
      try {
        const timeRange = input.timeRange ? {
          start: new Date(input.timeRange.start),
          end: new Date(input.timeRange.end)
        } : undefined

        const usage = await aiUsageMonitor.getUsageStats({ ...input, timeRange })
        const costs = await aiUsageMonitor.getCostAnalysis(timeRange)
        const trends = await aiUsageMonitor.getUsageTrends(timeRange)

        return {
          success: true,
          data: {
            usage,
            costs,
            trends
          }
        }
      } catch (error) {
        logger.error('Error fetching AI usage data', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch AI usage data'
        })
      }
    }),

  // User satisfaction tracking
  satisfaction: protectedProcedure
    .input(timeRangeSchema.optional())
    .query(async ({ input, ctx }) => {
      try {
        const timeRange = input ? {
          start: new Date(input.start),
          end: new Date(input.end)
        } : undefined

        const stats = await userSatisfactionTracker.getSatisfactionStats(timeRange)
        const trends = await userSatisfactionTracker.getSatisfactionTrends(timeRange)
        const insights = await userSatisfactionTracker.getInsights()

        return {
          success: true,
          data: {
            stats,
            trends,
            insights
          }
        }
      } catch (error) {
        logger.error('Error fetching satisfaction data', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch satisfaction data'
        })
      }
    }),

  // Submit satisfaction feedback
  submitSatisfaction: protectedProcedure
    .input(satisfactionFeedbackSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await userSatisfactionTracker.recordFeedback({
          ...input,
          userId: ctx.session?.user?.id || 'anonymous',
          timestamp: new Date()
        })

        return {
          success: true,
          message: 'Thank you for your feedback!'
        }
      } catch (error) {
        logger.error('Error submitting satisfaction feedback', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit feedback'
        })
      }
    }),

  // System health check
  systemHealth: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const performanceHealth = await performanceMonitor.healthCheck()
        const dbHealth = await checkDatabaseHealth()

        const overallStatus = [
          performanceHealth.status,
          dbHealth.status
        ].every(s => s === 'healthy') ? 'healthy' : 'degraded'

        return {
          success: true,
          data: {
            status: overallStatus,
            services: {
              performance: performanceHealth,
              database: dbHealth
            },
            timestamp: new Date()
          }
        }
      } catch (error) {
        logger.error('Error checking system health', error as Error)
        return {
          success: false,
          data: {
            status: 'error',
            services: {},
            timestamp: new Date()
          }
        }
      }
    }),

  // Dashboard summary
  dashboardSummary: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // Get last 24 hours of data
        const timeRange = {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        }

        // Fetch all monitoring data in parallel
        const [performance, errors, aiUsage, satisfaction] = await Promise.all([
          performanceMonitor.getPerformanceReport(timeRange),
          errorTracker.getErrorSummary(timeRange),
          aiUsageMonitor.getUsageStats({ timeRange }),
          userSatisfactionTracker.getSatisfactionStats(timeRange)
        ])

        return {
          success: true,
          data: {
            performance: performance.summary,
            topOperations: performance.operations
              .sort((a: any, b: any) => b.count - a.count)
              .slice(0, 5),
            errors: errors,
            aiUsage: {
              totalTokens: aiUsage.totalTokens,
              totalCost: aiUsage.totalCost,
              requestCount: aiUsage.requestCount
            },
            satisfaction: {
              averageRating: satisfaction.averageRating,
              totalFeedback: satisfaction.totalFeedback,
              nps: satisfaction.nps
            },
            timestamp: new Date()
          }
        }
      } catch (error) {
        logger.error('Error fetching dashboard summary', error as Error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard summary'
        })
      }
    })
})

// Helper function to check database health
async function checkDatabaseHealth() {
  try {
    // Simple query to check DB connectivity
    const result = await prisma.$queryRaw`SELECT 1`
    return {
      status: 'healthy' as const,
      metrics: {
        responseTime: 0 // Would measure actual response time
      },
      timestamp: new Date()
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }
  }
}
