import { PrismaClient } from '@moxmuse/db'
import { createPerformanceMonitor, AdvancedPerformanceMonitor } from '../../utils/performance-monitoring'
import { createDatabaseMonitoring } from '../../utils/database-monitoring'

/**
 * Centralized Performance Monitoring Service
 * Integrates all performance monitoring capabilities across the application
 */

export interface PerformanceReport {
  timestamp: Date
  summary: {
    totalRequests: number
    avgResponseTime: number
    errorRate: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
  database: {
    avgQueryTime: number
    slowQueries: number
    connectionPoolUsage: number
    errorRate: number
  }
  ai: {
    avgResponseTime: number
    tokenUsage: number
    errorRate: number
    requestsPerMinute: number
  }
  frontend: {
    avgPageLoadTime: number
    webVitalsScore: number
    resourceLoadTime: number
    memoryUsage: number
  }
  alerts: Array<{
    type: string
    severity: 'warning' | 'error' | 'critical'
    message: string
    timestamp: Date
  }>
  recommendations: Array<{
    category: string
    priority: 'low' | 'medium' | 'high'
    description: string
    estimatedImpact: string
  }>
}

export class PerformanceMonitoringService {
  private performanceMonitor: AdvancedPerformanceMonitor
  private databaseMonitoring: ReturnType<typeof createDatabaseMonitoring>
  private reportingInterval: NodeJS.Timeout | null = null

  constructor(private prisma: PrismaClient) {
    this.performanceMonitor = createPerformanceMonitor(prisma)

    this.databaseMonitoring = createDatabaseMonitoring(prisma)
    this.startPeriodicReporting()
  }

  private startPeriodicReporting() {
    // Generate performance reports every 5 minutes
    this.reportingInterval = setInterval(async () => {
      try {
        const report = await this.generatePerformanceReport()
        await this.processPerformanceReport(report)
      } catch (error) {
        console.error('Failed to generate performance report:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes
  }

  async generatePerformanceReport(timeRange: 'hour' | 'day' = 'hour'): Promise<PerformanceReport> {
    const now = new Date()
    const timeRangeMs = timeRange === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    const since = new Date(now.getTime() - timeRangeMs)

    try {
      // Get performance summary from advanced monitor
      const performanceSummary = await this.performanceMonitor.getPerformanceSummary(timeRange)
      
      // Get database health metrics
      const dbHealth = await this.databaseMonitoring.performanceMonitor.getHealthMetrics()
      
      // Get recent metrics from database
      const recentMetrics = await this.prisma.performanceMetric.findMany({
        where: {
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' }
      })

      // Calculate summary statistics
      const apiMetrics = recentMetrics.filter((m: any) => m.operation.startsWith('api.'))
      const dbMetrics = recentMetrics.filter((m: any) => m.operation.startsWith('database.'))
      const aiMetrics = recentMetrics.filter((m: any) => m.operation.startsWith('ai.'))
      const frontendMetrics = recentMetrics.filter((m: any) =>
        m.operation.startsWith('web_vital_') ||
        m.operation.startsWith('resource_') ||
        m.operation.startsWith('navigation_')
      )

      // Generate report
      const report: PerformanceReport = {
        timestamp: now,
        summary: this.calculateSummaryMetrics(recentMetrics),
        database: this.calculateDatabaseMetrics(dbMetrics, dbHealth),
        ai: this.calculateAIMetrics(aiMetrics),
        frontend: this.calculateFrontendMetrics(frontendMetrics),
        alerts: performanceSummary.alerts.map(alert => ({
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        })),
        recommendations: await this.generateRecommendations(recentMetrics)
      }

      return report
    } catch (error) {
      console.error('Failed to generate performance report:', error)
      throw error
    }
  }

  private calculateSummaryMetrics(metrics: any[]): PerformanceReport['summary'] {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      }
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
    const successCount = metrics.filter(m => m.success).length

    return {
      totalRequests: metrics.length,
      avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      errorRate: ((metrics.length - successCount) / metrics.length) * 100,
      p95ResponseTime: durations[Math.floor(durations.length * 0.95)] || 0,
      p99ResponseTime: durations[Math.floor(durations.length * 0.99)] || 0
    }
  }

  private calculateDatabaseMetrics(metrics: any[], health: any): PerformanceReport['database'] {
    const queryTimes = metrics.map(m => m.duration)
    const errorCount = metrics.filter(m => !m.success).length

    return {
      avgQueryTime: queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length : 0,
      slowQueries: health.slowQueries?.length || 0,
      connectionPoolUsage: 0, // Would need database-specific implementation
      errorRate: metrics.length > 0 ? (errorCount / metrics.length) * 100 : 0
    }
  }

  private calculateAIMetrics(metrics: any[]): PerformanceReport['ai'] {
    const responseTimes = metrics.map(m => m.duration)
    const errorCount = metrics.filter(m => !m.success).length
    const tokenUsage = metrics
      .map(m => m.metadata?.tokenUsage || 0)
      .reduce((a, b) => a + b, 0)

    return {
      avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      tokenUsage,
      errorRate: metrics.length > 0 ? (errorCount / metrics.length) * 100 : 0,
      requestsPerMinute: metrics.length // Simplified calculation
    }
  }

  private calculateFrontendMetrics(metrics: any[]): PerformanceReport['frontend'] {
    const pageLoadMetrics = metrics.filter(m => m.operation.startsWith('navigation_'))
    const webVitalMetrics = metrics.filter(m => m.operation.startsWith('web_vital_'))
    const resourceMetrics = metrics.filter(m => m.operation.startsWith('resource_'))
    const memoryMetrics = metrics.filter(m => m.operation === 'memory_usage')

    const avgPageLoadTime = pageLoadMetrics.length > 0 
      ? pageLoadMetrics.reduce((sum, m) => sum + m.duration, 0) / pageLoadMetrics.length 
      : 0

    const avgResourceLoadTime = resourceMetrics.length > 0 
      ? resourceMetrics.reduce((sum, m) => sum + m.duration, 0) / resourceMetrics.length 
      : 0

    const avgMemoryUsage = memoryMetrics.length > 0 
      ? memoryMetrics.reduce((sum, m) => sum + m.duration, 0) / memoryMetrics.length 
      : 0

    // Calculate Web Vitals score (simplified)
    const goodWebVitals = webVitalMetrics.filter(m => m.success).length
    const webVitalsScore = webVitalMetrics.length > 0 
      ? (goodWebVitals / webVitalMetrics.length) * 100 
      : 100

    return {
      avgPageLoadTime,
      webVitalsScore,
      resourceLoadTime: avgResourceLoadTime,
      memoryUsage: avgMemoryUsage
    }
  }

  private async generateRecommendations(metrics: any[]): Promise<PerformanceReport['recommendations']> {
    const recommendations: PerformanceReport['recommendations'] = []

    // Analyze slow API endpoints
    const slowApiCalls = metrics.filter(m => 
      m.operation.startsWith('api.') && m.duration > 2000
    )
    if (slowApiCalls.length > 5) {
      recommendations.push({
        category: 'API Performance',
        priority: 'high',
        description: `${slowApiCalls.length} slow API calls detected. Consider implementing caching or optimizing database queries.`,
        estimatedImpact: '30-50% faster response times'
      })
    }

    // Analyze database performance
    const slowQueries = metrics.filter(m => 
      m.operation.startsWith('database.') && m.duration > 1000
    )
    if (slowQueries.length > 3) {
      recommendations.push({
        category: 'Database Performance',
        priority: 'high',
        description: `${slowQueries.length} slow database queries detected. Review indexes and query optimization.`,
        estimatedImpact: '40-60% faster query execution'
      })
    }

    // Analyze frontend performance
    const slowPageLoads = metrics.filter(m => 
      m.operation.startsWith('navigation_') && m.duration > 3000
    )
    if (slowPageLoads.length > 2) {
      recommendations.push({
        category: 'Frontend Performance',
        priority: 'medium',
        description: `${slowPageLoads.length} slow page loads detected. Consider code splitting and resource optimization.`,
        estimatedImpact: '25-40% faster page loads'
      })
    }

    // Analyze memory usage
    const highMemoryUsage = metrics.filter(m => 
      m.operation === 'memory_usage' && m.duration > 80
    )
    if (highMemoryUsage.length > 5) {
      recommendations.push({
        category: 'Memory Management',
        priority: 'medium',
        description: 'High memory usage detected. Review memory leaks and optimize garbage collection.',
        estimatedImpact: '20-30% better memory efficiency'
      })
    }

    // Analyze AI service performance
    const slowAiCalls = metrics.filter(m => 
      m.operation.startsWith('ai.') && m.duration > 8000
    )
    if (slowAiCalls.length > 3) {
      recommendations.push({
        category: 'AI Performance',
        priority: 'medium',
        description: `${slowAiCalls.length} slow AI service calls detected. Consider request batching or caching.`,
        estimatedImpact: '35-50% faster AI responses'
      })
    }

    return recommendations
  }

  private async processPerformanceReport(report: PerformanceReport) {
    // Store report summary in database
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: 'performance_report',
          duration: 0,
          success: true,
          timestamp: report.timestamp,
          metadata: {
            reportType: 'automated',
            summary: report.summary,
            database: report.database,
            ai: report.ai,
            frontend: report.frontend,
            alertCount: report.alerts.length,
            recommendationCount: report.recommendations.length
          }
        }
      })

      // Log critical alerts
      const criticalAlerts = report.alerts.filter(a => a.severity === 'critical')
      if (criticalAlerts.length > 0) {
        console.error(`🚨 ${criticalAlerts.length} CRITICAL performance alerts detected!`)
        criticalAlerts.forEach(alert => {
          console.error(`  - ${alert.type}: ${alert.message}`)
        })
      }

      // Log high-priority recommendations
      const highPriorityRecs = report.recommendations.filter(r => r.priority === 'high')
      if (highPriorityRecs.length > 0) {
        console.warn(`⚡ ${highPriorityRecs.length} high-priority performance recommendations:`)
        highPriorityRecs.forEach(rec => {
          console.warn(`  - ${rec.category}: ${rec.description}`)
        })
      }

      console.log(`📊 Performance report generated: ${report.summary.totalRequests} requests, ${report.summary.avgResponseTime.toFixed(2)}ms avg response time`)
    } catch (error) {
      console.error('Failed to store performance report:', error)
    }
  }

  // Public API methods
  async getLatestReport(): Promise<PerformanceReport> {
    return this.generatePerformanceReport('hour')
  }

  async getDailyReport(): Promise<PerformanceReport> {
    return this.generatePerformanceReport('day')
  }

  async getPerformanceTrends(days: number = 7): Promise<{
    trends: Array<{
      date: string
      avgResponseTime: number
      errorRate: number
      requestCount: number
    }>
  }> {
    const trends = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)

      const dayMetrics = await this.prisma.performanceMetric.findMany({
        where: {
          timestamp: {
            gte: date,
            lt: nextDate
          }
        }
      })

      const avgResponseTime = dayMetrics.length > 0
        ? dayMetrics.reduce((sum: number, m: any) => sum + m.duration, 0) / dayMetrics.length
        : 0

      const errorCount = dayMetrics.filter((m: any) => !m.success).length
      const errorRate = dayMetrics.length > 0 ? (errorCount / dayMetrics.length) * 100 : 0

      trends.push({
        date: date.toISOString().split('T')[0],
        avgResponseTime,
        errorRate,
        requestCount: dayMetrics.length
      })
    }

    return { trends }
  }

  // Cleanup
  destroy() {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval)
    }
    this.performanceMonitor.destroy()
  }
}

// Export singleton factory
export const createPerformanceMonitoringService = (prisma: PrismaClient) => {
  return new PerformanceMonitoringService(prisma)
}