import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../trpc'
import { healthCheckService } from '../services/health/HealthCheckService'
import { metricsService } from '../services/monitoring/MetricsService'
import { databaseBackupService } from '../services/backup/DatabaseBackupService'

export const healthRouter = createTRPCRouter({
  // Basic health check endpoint
  check: publicProcedure
    .input(z.object({
      includeNonCritical: z.boolean().optional().default(true),
    }))
    .query(async ({ input }) => {
      const result = await healthCheckService.checkHealth(input.includeNonCritical)
      
      // Record health check metric
      metricsService.recordMetric({
        name: 'health_check.request',
        value: 1,
        unit: 'count',
        tags: {
          status: result.status,
          includeNonCritical: input.includeNonCritical.toString(),
        },
      })

      return result
    }),

  // Check specific service
  checkService: publicProcedure
    .input(z.object({
      serviceName: z.string(),
    }))
    .query(async ({ input }) => {
      const result = await healthCheckService.checkService(input.serviceName)
      
      if (!result) {
        throw new Error(`Service not found: ${input.serviceName}`)
      }

      return result
    }),

  // Get list of registered services
  services: publicProcedure
    .query(() => {
      return {
        services: healthCheckService.getRegisteredServices(),
      }
    }),

  // Readiness probe (for Kubernetes/container orchestration)
  ready: publicProcedure
    .query(async () => {
      const result = await healthCheckService.checkHealth(false) // Only critical services
      
      if (result.status === 'unhealthy') {
        throw new Error('Service not ready')
      }

      return {
        status: 'ready',
        timestamp: result.timestamp,
        criticalServices: result.services.filter(s => 
          healthCheckService.getRegisteredServices().includes(s.name)
        ),
      }
    }),

  // Liveness probe (for Kubernetes/container orchestration)
  live: publicProcedure
    .query(() => {
      // Simple liveness check - if we can respond, we're alive
      return {
        status: 'alive',
        timestamp: new Date(),
        uptime: process.uptime(),
        pid: process.pid,
      }
    }),

  // Detailed system metrics
  metrics: publicProcedure
    .query(() => {
      const systemMetrics = metricsService.getSystemMetrics()
      
      return {
        ...systemMetrics,
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        memory: process.memoryUsage(),
      }
    }),

  // Database backup status
  backupStatus: publicProcedure
    .query(async () => {
      try {
        const backups = await databaseBackupService.listBackups()
        const latestBackup = backups[0]
        
        return {
          hasBackups: backups.length > 0,
          totalBackups: backups.length,
          latestBackup: latestBackup ? {
            id: latestBackup.id,
            timestamp: latestBackup.timestamp,
            size: latestBackup.size,
            age: Date.now() - latestBackup.timestamp.getTime(),
          } : null,
          oldestBackup: backups.length > 0 ? {
            id: backups[backups.length - 1].id,
            timestamp: backups[backups.length - 1].timestamp,
          } : null,
        }
      } catch (error) {
        return {
          hasBackups: false,
          totalBackups: 0,
          latestBackup: null,
          oldestBackup: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }),

  // Performance summary
  performance: publicProcedure
    .input(z.object({
      windowMinutes: z.number().min(1).max(1440).optional().default(60),
    }))
    .query(({ input }) => {
      const windowMinutes = input.windowMinutes

      return {
        responseTime: {
          deckGeneration: metricsService.getAverageMetric('response_time.deck_generation', windowMinutes),
          cardSearch: metricsService.getAverageMetric('response_time.card_search', windowMinutes),
          healthCheck: metricsService.getAverageMetric('health_check.duration', windowMinutes),
        },
        throughput: {
          deckGenerations: metricsService.getMetrics('business.deck_generation', windowMinutes).length,
          cardSearches: metricsService.getMetrics('business.card_search', windowMinutes).length,
          healthChecks: metricsService.getMetrics('health_check.request', windowMinutes).length,
        },
        errors: {
          total: metricsService.getMetrics('error', windowMinutes).length,
          byType: this.getErrorsByType(windowMinutes),
        },
        windowMinutes,
      }
    }),

  // System status summary
  status: publicProcedure
    .query(async () => {
      const healthResult = await healthCheckService.checkHealth(true)
      const systemMetrics = metricsService.getSystemMetrics()
      
      return {
        overall: healthResult.status,
        timestamp: healthResult.timestamp,
        uptime: healthResult.uptime,
        version: healthResult.version,
        services: {
          total: healthResult.summary.total,
          healthy: healthResult.summary.healthy,
          degraded: healthResult.summary.degraded,
          unhealthy: healthResult.summary.unhealthy,
        },
        performance: {
          responseTime: systemMetrics.responseTime,
          throughput: systemMetrics.throughput,
          errorRate: systemMetrics.errorRate,
          successRate: systemMetrics.successRate,
        },
        resources: {
          memoryUsage: systemMetrics.memoryUsage,
          activeUsers: systemMetrics.activeUsers,
        },
      }
    }),
})

// Helper function to get errors by type
function getErrorsByType(windowMinutes: number): Record<string, number> {
  const errorMetrics = metricsService.getMetrics('error', windowMinutes)
  const errorsByType: Record<string, number> = {}
  
  errorMetrics.forEach(metric => {
    const errorType = metric.tags?.errorType || 'unknown'
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
  })
  
  return errorsByType
}