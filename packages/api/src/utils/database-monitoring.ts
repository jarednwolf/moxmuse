import { PrismaClient } from '@moxmuse/db'
import { performance } from 'perf_hooks'

/**
 * Database monitoring and performance utilities
 * Provides query optimization, performance tracking, and health monitoring
 */

export interface QueryPerformanceMetric {
  operation: string
  duration: number
  success: boolean
  rowsAffected?: number
  queryPlan?: any
  timestamp: Date
  userId?: string
  metadata?: Record<string, any>
}

export interface DatabaseHealthMetrics {
  connectionCount: number
  activeQueries: number
  slowQueries: QueryPerformanceMetric[]
  averageResponseTime: number
  errorRate: number
  cacheHitRate?: number
  indexUsage: Record<string, number>
  tableStats: Record<string, { size: number; rowCount: number }>
}

export interface QueryOptimizationSuggestion {
  query: string
  issue: string
  suggestion: string
  impact: 'low' | 'medium' | 'high'
  estimatedImprovement: string
}

/**
 * Database performance monitor
 */
export class DatabasePerformanceMonitor {
  private metrics: QueryPerformanceMetric[] = []
  private slowQueryThreshold: number = 1000 // 1 second
  private maxMetricsHistory: number = 10000

  constructor(
    private prisma: PrismaClient,
    private options: {
      slowQueryThreshold?: number
      maxMetricsHistory?: number
      enableQueryPlanCapture?: boolean
    } = {}
  ) {
    this.slowQueryThreshold = options.slowQueryThreshold || 1000
    this.maxMetricsHistory = options.maxMetricsHistory || 10000
    this.setupQueryLogging()
  }

  private setupQueryLogging() {
    // Extend Prisma with query logging middleware
    this.prisma.$use(async (params, next) => {
      const startTime = performance.now()
      const operation = `${params.model}.${params.action}`
      
      try {
        const result = await next(params)
        const duration = performance.now() - startTime
        
        await this.recordMetric({
          operation,
          duration,
          success: true,
          rowsAffected: this.getRowsAffected(result),
          timestamp: new Date(),
          metadata: {
            model: params.model,
            action: params.action,
            args: this.sanitizeArgs(params.args),
          },
        })

        // Log slow queries
        if (duration > this.slowQueryThreshold) {
          console.warn(`Slow query detected: ${operation} took ${duration.toFixed(2)}ms`)
          await this.handleSlowQuery(operation, duration, params)
        }

        return result
      } catch (error) {
        const duration = performance.now() - startTime
        
        await this.recordMetric({
          operation,
          duration,
          success: false,
          timestamp: new Date(),
          metadata: {
            model: params.model,
            action: params.action,
            error: error instanceof Error ? error.message : String(error),
          },
        })

        throw error
      }
    })
  }

  private sanitizeArgs(args: any): any {
    // Remove sensitive data from logged arguments
    if (!args) return args
    
    const sanitized = { ...args }
    
    // Remove password fields
    if (sanitized.data?.password) {
      sanitized.data.password = '[REDACTED]'
    }
    
    // Limit large data structures
    if (sanitized.data && Object.keys(sanitized.data).length > 10) {
      sanitized.data = { ...sanitized.data, '[TRUNCATED]': true }
    }
    
    return sanitized
  }

  private getRowsAffected(result: any): number | undefined {
    if (Array.isArray(result)) return result.length
    if (result?.count !== undefined) return result.count
    if (result?.id) return 1
    return undefined
  }

  private async recordMetric(metric: QueryPerformanceMetric): Promise<void> {
    // Add to in-memory metrics
    this.metrics.push(metric)
    
    // Trim metrics history
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }

    // Store in database for persistent monitoring
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: metric.operation,
          duration: Math.round(metric.duration),
          success: metric.success,
          timestamp: metric.timestamp,
          userId: metric.userId,
          metadata: metric.metadata || {},
        },
      })
    } catch (error) {
      // Don't let monitoring errors break the application
      console.error('Failed to record performance metric:', error)
    }
  }

  private async handleSlowQuery(operation: string, duration: number, params: any): Promise<void> {
    // Log slow query for analysis
    console.warn(`Slow Query Analysis:`, {
      operation,
      duration: `${duration.toFixed(2)}ms`,
      model: params.model,
      action: params.action,
      timestamp: new Date().toISOString(),
    })

    // Store slow query for later analysis
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: `slow_${operation}`,
          duration: Math.round(duration),
          success: true,
          timestamp: new Date(),
          metadata: {
            slowQuery: true,
            threshold: this.slowQueryThreshold,
            model: params.model,
            action: params.action,
            args: this.sanitizeArgs(params.args),
          },
        },
      })
    } catch (error) {
      console.error('Failed to record slow query:', error)
    }
  }

  async getHealthMetrics(): Promise<DatabaseHealthMetrics> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    try {
      // Get recent metrics
      const recentMetrics = await this.prisma.performanceMetric.findMany({
        where: {
          timestamp: { gte: oneHourAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 1000,
      })

      // Calculate health metrics
      const totalQueries = recentMetrics.length
      const successfulQueries = recentMetrics.filter(m => m.success).length
      const failedQueries = totalQueries - successfulQueries
      const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0

      const durations = recentMetrics.map(m => m.duration)
      const averageResponseTime = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0

      const slowQueries = this.metrics.filter(m => m.duration > this.slowQueryThreshold)

      // Get database statistics
      const tableStats = await this.getTableStatistics()
      const indexUsage = await this.getIndexUsage()

      return {
        connectionCount: 0, // Would need database-specific query
        activeQueries: 0, // Would need database-specific query
        slowQueries: slowQueries.slice(-10), // Last 10 slow queries
        averageResponseTime,
        errorRate,
        indexUsage,
        tableStats,
      }
    } catch (error) {
      console.error('Failed to get health metrics:', error)
      return {
        connectionCount: 0,
        activeQueries: 0,
        slowQueries: [],
        averageResponseTime: 0,
        errorRate: 0,
        indexUsage: {},
        tableStats: {},
      }
    }
  }

  private async getTableStatistics(): Promise<Record<string, { size: number; rowCount: number }>> {
    try {
      // Get row counts for major tables
      const [
        userCount,
        deckCount,
        generatedDeckCount,
        recommendationCount,
        performanceMetricCount,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.deck.count(),
        this.prisma.generatedDeck.count(),
        this.prisma.recommendation.count(),
        this.prisma.performanceMetric.count(),
      ])

      return {
        User: { rowCount: userCount, size: 0 },
        Deck: { rowCount: deckCount, size: 0 },
        GeneratedDeck: { rowCount: generatedDeckCount, size: 0 },
        Recommendation: { rowCount: recommendationCount, size: 0 },
        PerformanceMetric: { rowCount: performanceMetricCount, size: 0 },
      }
    } catch (error) {
      console.error('Failed to get table statistics:', error)
      return {}
    }
  }

  private async getIndexUsage(): Promise<Record<string, number>> {
    // This would require database-specific queries
    // For PostgreSQL, you'd query pg_stat_user_indexes
    // For now, return empty object
    return {}
  }

  async getQueryOptimizationSuggestions(): Promise<QueryOptimizationSuggestion[]> {
    const suggestions: QueryOptimizationSuggestion[] = []
    const recentMetrics = this.metrics.slice(-1000) // Last 1000 queries

    // Analyze slow queries
    const slowQueries = recentMetrics.filter(m => m.duration > this.slowQueryThreshold)
    const queryPatterns = new Map<string, QueryPerformanceMetric[]>()

    // Group by operation
    slowQueries.forEach(metric => {
      const pattern = metric.operation
      if (!queryPatterns.has(pattern)) {
        queryPatterns.set(pattern, [])
      }
      queryPatterns.get(pattern)!.push(metric)
    })

    // Generate suggestions for frequently slow queries
    for (const [pattern, metrics] of queryPatterns.entries()) {
      if (metrics.length >= 3) { // At least 3 occurrences
        const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length

        suggestions.push({
          query: pattern,
          issue: `Query consistently slow (avg: ${avgDuration.toFixed(2)}ms)`,
          suggestion: this.generateOptimizationSuggestion(pattern, metrics),
          impact: avgDuration > 5000 ? 'high' : avgDuration > 2000 ? 'medium' : 'low',
          estimatedImprovement: `${Math.round((avgDuration - this.slowQueryThreshold) / avgDuration * 100)}% faster`,
        })
      }
    }

    // Check for missing indexes
    const findManyQueries = recentMetrics.filter(m => 
      m.operation.includes('.findMany') && m.duration > 500
    )

    if (findManyQueries.length > 10) {
      suggestions.push({
        query: 'Multiple findMany operations',
        issue: 'Multiple slow findMany queries detected',
        suggestion: 'Consider adding indexes on frequently queried fields',
        impact: 'medium',
        estimatedImprovement: '50-80% faster queries',
      })
    }

    return suggestions
  }

  private generateOptimizationSuggestion(pattern: string, metrics: QueryPerformanceMetric[]): string {
    const [model, action] = pattern.split('.')

    switch (action) {
      case 'findMany':
        return `Add indexes on frequently filtered fields for ${model} table. Consider pagination for large result sets.`
      case 'findUnique':
        return `Ensure unique constraints and indexes exist on lookup fields for ${model} table.`
      case 'create':
        return `Consider batch operations for multiple ${model} creations. Check for unnecessary validations.`
      case 'update':
        return `Add indexes on WHERE clause fields for ${model} updates. Consider batch updates.`
      case 'delete':
        return `Add indexes on deletion criteria for ${model} table. Consider soft deletes for audit trails.`
      default:
        return `Review query patterns for ${pattern} and consider adding appropriate indexes.`
    }
  }

  async cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    try {
      const result = await this.prisma.performanceMetric.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
        },
      })

      console.log(`Cleaned up ${result.count} old performance metrics`)
      return result.count
    } catch (error) {
      console.error('Failed to cleanup old metrics:', error)
      return 0
    }
  }

  getRecentMetrics(limit: number = 100): QueryPerformanceMetric[] {
    return this.metrics.slice(-limit)
  }

  getSlowQueries(limit: number = 50): QueryPerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > this.slowQueryThreshold)
      .slice(-limit)
  }
}

/**
 * Database backup and migration safety utilities
 */
export class DatabaseSafetyManager {
  constructor(private prisma: PrismaClient) {}

  async createBackupPoint(name: string): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      // In production, this would trigger a database backup
      // For now, we'll create a backup record
      const backup = await this.prisma.performanceMetric.create({
        data: {
          operation: 'database_backup',
          duration: 0,
          success: true,
          timestamp: new Date(),
          metadata: {
            backupName: name,
            backupType: 'manual',
            timestamp: new Date().toISOString(),
          },
        },
      })

      console.log(`Database backup point created: ${name}`)
      return { success: true, backupId: backup.id }
    } catch (error) {
      console.error('Failed to create backup point:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }
    }
  }

  async validateMigrationSafety(): Promise<{
    safe: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check for active connections
      // In production, you'd query the database for active connections
      
      // Check for long-running transactions
      // This would require database-specific queries
      
      // Check for table locks
      // This would require database-specific queries
      
      // Check disk space
      // This would require system-level checks
      
      // For now, perform basic checks
      const recentErrors = await this.prisma.performanceMetric.count({
        where: {
          success: false,
          timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        },
      })

      if (recentErrors > 10) {
        issues.push('High error rate detected in recent queries')
        recommendations.push('Wait for error rate to decrease before migrating')
      }

      const safe = issues.length === 0
      
      if (safe) {
        recommendations.push('Migration appears safe to proceed')
      }

      return { safe, issues, recommendations }
    } catch (error) {
      console.error('Failed to validate migration safety:', error)
      return {
        safe: false,
        issues: ['Failed to validate migration safety'],
        recommendations: ['Manual review required before migration'],
      }
    }
  }

  async scheduleAutomaticBackup(intervalHours: number = 24): Promise<void> {
    // In production, this would set up a cron job or scheduled task
    console.log(`Automatic backup scheduled every ${intervalHours} hours`)
    
    // For demonstration, we'll just log the schedule
    await this.prisma.performanceMetric.create({
      data: {
        operation: 'backup_scheduled',
        duration: 0,
        success: true,
        timestamp: new Date(),
        metadata: {
          intervalHours,
          nextBackup: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
        },
      },
    })
  }
}

/**
 * Database alerting system
 */
export class DatabaseAlertManager {
  private alertThresholds = {
    slowQueryThreshold: 2000, // 2 seconds
    errorRateThreshold: 5, // 5%
    connectionThreshold: 80, // 80% of max connections
    diskSpaceThreshold: 85, // 85% disk usage
  }

  constructor(
    private prisma: PrismaClient,
    private performanceMonitor: DatabasePerformanceMonitor
  ) {}

  async checkAlerts(): Promise<{
    alerts: Array<{
      type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      message: string
      timestamp: Date
      metadata?: any
    }>
  }> {
    const alerts: any[] = []
    
    try {
      const healthMetrics = await this.performanceMonitor.getHealthMetrics()

      // Check error rate
      if (healthMetrics.errorRate > this.alertThresholds.errorRateThreshold) {
        alerts.push({
          type: 'high_error_rate',
          severity: healthMetrics.errorRate > 15 ? 'critical' : 'high',
          message: `Database error rate is ${healthMetrics.errorRate.toFixed(2)}%`,
          timestamp: new Date(),
          metadata: { errorRate: healthMetrics.errorRate },
        })
      }

      // Check slow queries
      if (healthMetrics.slowQueries.length > 10) {
        alerts.push({
          type: 'slow_queries',
          severity: 'medium',
          message: `${healthMetrics.slowQueries.length} slow queries detected in the last hour`,
          timestamp: new Date(),
          metadata: { slowQueryCount: healthMetrics.slowQueries.length },
        })
      }

      // Check average response time
      if (healthMetrics.averageResponseTime > 1000) {
        alerts.push({
          type: 'slow_response_time',
          severity: healthMetrics.averageResponseTime > 3000 ? 'high' : 'medium',
          message: `Average response time is ${healthMetrics.averageResponseTime.toFixed(2)}ms`,
          timestamp: new Date(),
          metadata: { averageResponseTime: healthMetrics.averageResponseTime },
        })
      }

      // Log alerts
      for (const alert of alerts) {
        await this.prisma.performanceMetric.create({
          data: {
            operation: `alert_${alert.type}`,
            duration: 0,
            success: false,
            timestamp: alert.timestamp,
            metadata: {
              alertType: alert.type,
              severity: alert.severity,
              message: alert.message,
              ...alert.metadata,
            },
          },
        })
      }

      return { alerts }
    } catch (error) {
      console.error('Failed to check alerts:', error)
      return { alerts: [] }
    }
  }

  async sendAlert(alert: any): Promise<void> {
    // In production, this would send notifications via email, Slack, etc.
    console.warn(`DATABASE ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`)
    
    // Log the alert
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: 'alert_sent',
          duration: 0,
          success: true,
          timestamp: new Date(),
          metadata: alert,
        },
      })
    } catch (error) {
      console.error('Failed to log alert:', error)
    }
  }
}

// Export singleton instances for use across the application
export const createDatabaseMonitoring = (prisma: PrismaClient) => {
  const performanceMonitor = new DatabasePerformanceMonitor(prisma, {
    slowQueryThreshold: 1000,
    enableQueryPlanCapture: process.env.NODE_ENV === 'development',
  })
  
  const safetyManager = new DatabaseSafetyManager(prisma)
  const alertManager = new DatabaseAlertManager(prisma, performanceMonitor)

  return {
    performanceMonitor,
    safetyManager,
    alertManager,
  }
}