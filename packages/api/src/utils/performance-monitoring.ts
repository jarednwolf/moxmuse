import { performance } from 'perf_hooks'
import { PrismaClient } from '@moxmuse/db'

/**
 * Comprehensive Performance Monitoring System
 * Provides real-time metrics collection, analysis, and alerting
 */

export interface PerformanceMetric {
  id: string
  name: string
  value: number
  unit: string
  timestamp: Date
  category: 'api' | 'database' | 'ai' | 'cache' | 'network' | 'memory' | 'cpu'
  severity: 'info' | 'warning' | 'error' | 'critical'
  metadata?: Record<string, any>
  tags?: string[]
}

export interface PerformanceThresholds {
  api: {
    responseTime: { warning: 1000, error: 3000, critical: 5000 }
    errorRate: { warning: 1, error: 5, critical: 10 }
    throughput: { warning: 100, error: 50, critical: 25 }
  }
  database: {
    queryTime: { warning: 500, error: 1000, critical: 2000 }
    connectionPool: { warning: 70, error: 85, critical: 95 }
    slowQueries: { warning: 5, error: 10, critical: 20 }
  }
  ai: {
    responseTime: { warning: 5000, error: 10000, critical: 15000 }
    tokenUsage: { warning: 1000, error: 2000, critical: 3000 }
    errorRate: { warning: 2, error: 5, critical: 10 }
  }
  memory: {
    heapUsage: { warning: 70, error: 85, critical: 95 }
    gcPause: { warning: 100, error: 200, critical: 500 }
  }
  cache: {
    hitRate: { warning: 80, error: 60, critical: 40 }
    evictionRate: { warning: 10, error: 20, critical: 30 }
  }
}

export interface PerformanceAlert {
  id: string
  type: string
  severity: 'warning' | 'error' | 'critical'
  message: string
  metric: PerformanceMetric
  threshold: number
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
}

/**
 * Advanced Performance Monitor with real-time analytics
 */
export class AdvancedPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private alerts: PerformanceAlert[] = []
  private thresholds: PerformanceThresholds
  private metricsBuffer: PerformanceMetric[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private maxBufferSize = 1000
  private flushIntervalMs = 30000 // 30 seconds

  constructor(
    private prisma: PrismaClient,
    thresholds?: Partial<PerformanceThresholds>
  ) {
    this.thresholds = this.mergeThresholds(thresholds)
    this.startMetricsFlush()
    this.setupSystemMetrics()
  }

  private mergeThresholds(custom?: Partial<PerformanceThresholds>): PerformanceThresholds {
    const defaults: PerformanceThresholds = {
      api: {
        responseTime: { warning: 1000, error: 3000, critical: 5000 },
        errorRate: { warning: 1, error: 5, critical: 10 },
        throughput: { warning: 100, error: 50, critical: 25 }
      },
      database: {
        queryTime: { warning: 500, error: 1000, critical: 2000 },
        connectionPool: { warning: 70, error: 85, critical: 95 },
        slowQueries: { warning: 5, error: 10, critical: 20 }
      },
      ai: {
        responseTime: { warning: 5000, error: 10000, critical: 15000 },
        tokenUsage: { warning: 1000, error: 2000, critical: 3000 },
        errorRate: { warning: 2, error: 5, critical: 10 }
      },
      memory: {
        heapUsage: { warning: 70, error: 85, critical: 95 },
        gcPause: { warning: 100, error: 200, critical: 500 }
      },
      cache: {
        hitRate: { warning: 80, error: 60, critical: 40 },
        evictionRate: { warning: 10, error: 20, critical: 30 }
      }
    }

    return { ...defaults, ...custom } as PerformanceThresholds
  }

  private setupSystemMetrics() {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics()
    }, 10000)
  }

  private collectSystemMetrics() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    // Memory metrics
    this.recordMetric({
      name: 'memory.heap.used',
      value: memUsage.heapUsed,
      unit: 'bytes',
      category: 'memory',
      metadata: {
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      }
    })

    // CPU metrics
    this.recordMetric({
      name: 'cpu.user',
      value: cpuUsage.user,
      unit: 'microseconds',
      category: 'cpu',
      metadata: { system: cpuUsage.system }
    })

    // Event loop lag
    const start = process.hrtime.bigint()
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000 // Convert to ms
      this.recordMetric({
        name: 'eventloop.lag',
        value: lag,
        unit: 'milliseconds',
        category: 'cpu'
      })
    })
  }

  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'severity'>) {
    const fullMetric: PerformanceMetric = {
      id: this.generateMetricId(),
      timestamp: new Date(),
      severity: this.calculateSeverity(metric),
      ...metric
    }

    // Add to in-memory storage
    const key = `${metric.category}.${metric.name}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metricsList = this.metrics.get(key)!
    metricsList.push(fullMetric)
    
    // Keep only last 1000 metrics per type
    if (metricsList.length > 1000) {
      metricsList.splice(0, metricsList.length - 1000)
    }

    // Add to buffer for batch persistence
    this.metricsBuffer.push(fullMetric)

    // Check for alerts
    this.checkAlerts(fullMetric)

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.maxBufferSize) {
      this.flushMetrics()
    }
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateSeverity(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'severity'>): 'info' | 'warning' | 'error' | 'critical' {
    const thresholds = this.getThresholdsForMetric(metric)
    if (!thresholds) return 'info'

    if (metric.value >= thresholds.critical) return 'critical'
    if (metric.value >= thresholds.error) return 'error'
    if (metric.value >= thresholds.warning) return 'warning'
    return 'info'
  }

  private getThresholdsForMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'severity'>) {
    const category = this.thresholds[metric.category as keyof PerformanceThresholds]
    if (!category) return null

    // Map metric names to threshold keys
    const metricMap: Record<string, string> = {
      'api.response.time': 'responseTime',
      'api.error.rate': 'errorRate',
      'api.throughput': 'throughput',
      'database.query.time': 'queryTime',
      'database.connection.pool': 'connectionPool',
      'database.slow.queries': 'slowQueries',
      'ai.response.time': 'responseTime',
      'ai.token.usage': 'tokenUsage',
      'ai.error.rate': 'errorRate',
      'memory.heap.usage': 'heapUsage',
      'memory.gc.pause': 'gcPause',
      'cache.hit.rate': 'hitRate',
      'cache.eviction.rate': 'evictionRate'
    }

    const key = `${metric.category}.${metric.name}`
    const thresholdKey = metricMap[key]
    
    return thresholdKey ? (category as any)[thresholdKey] : null
  }

  private checkAlerts(metric: PerformanceMetric) {
    if (metric.severity === 'info') return

    const thresholds = this.getThresholdsForMetric(metric)
    if (!thresholds) return

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: `${metric.category}.${metric.name}`,
      severity: metric.severity as 'warning' | 'error' | 'critical',
      message: this.generateAlertMessage(metric, thresholds),
      metric,
      threshold: this.getThresholdValue(thresholds, metric.severity),
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.push(alert)
    this.handleAlert(alert)
  }

  private generateAlertMessage(metric: PerformanceMetric, thresholds: any): string {
    const value = metric.value.toFixed(2)
    const unit = metric.unit
    const threshold = this.getThresholdValue(thresholds, metric.severity)

    return `${metric.category.toUpperCase()} ALERT: ${metric.name} is ${value}${unit} (threshold: ${threshold}${unit})`
  }

  private getThresholdValue(thresholds: any, severity: string): number {
    return thresholds[severity] || 0
  }

  private async handleAlert(alert: PerformanceAlert) {
    console.warn(`🚨 PERFORMANCE ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`)

    // Store alert in database
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: `alert_${alert.type}`,
          duration: Math.round(alert.metric.value),
          success: false,
          timestamp: alert.timestamp,
          metadata: {
            alertId: alert.id,
            severity: alert.severity,
            message: alert.message,
            threshold: alert.threshold,
            metricCategory: alert.metric.category,
            metricName: alert.metric.name,
            metricValue: alert.metric.value,
            metricUnit: alert.metric.unit,
            metricMetadata: alert.metric.metadata
          }
        }
      })
    } catch (error) {
      console.error('Failed to store performance alert:', error)
    }

    // Send notifications for critical alerts
    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(alert)
    }
  }

  private async sendCriticalAlert(alert: PerformanceAlert) {
    // In production, this would send notifications via email, Slack, etc.
    console.error(`🔥 CRITICAL PERFORMANCE ALERT: ${alert.message}`)
    
    // Log critical alert
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: 'critical_alert_sent',
          duration: 0,
          success: true,
          timestamp: new Date(),
          metadata: {
            alertId: alert.id,
            alertType: alert.type,
            message: alert.message
          }
        }
      })
    } catch (error) {
      console.error('Failed to log critical alert:', error)
    }
  }

  private startMetricsFlush() {
    this.flushInterval = setInterval(() => {
      this.flushMetrics()
    }, this.flushIntervalMs)
  }

  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return

    const metricsToFlush = [...this.metricsBuffer]
    this.metricsBuffer = []

    try {
      // Batch insert metrics
      await this.prisma.performanceMetric.createMany({
        data: metricsToFlush.map(metric => ({
          operation: `${metric.category}.${metric.name}`,
          duration: Math.round(metric.value),
          success: metric.severity !== 'error' && metric.severity !== 'critical',
          timestamp: metric.timestamp,
          metadata: {
            metricId: metric.id,
            category: metric.category,
            name: metric.name,
            value: metric.value,
            unit: metric.unit,
            severity: metric.severity,
            tags: metric.tags,
            ...metric.metadata
          }
        }))
      })

      console.log(`📊 Flushed ${metricsToFlush.length} performance metrics to database`)
    } catch (error) {
      console.error('Failed to flush performance metrics:', error)
      // Re-add failed metrics to buffer
      this.metricsBuffer.unshift(...metricsToFlush)
    }
  }

  // API Performance Tracking
  measureApiCall<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    
    return fn()
      .then(result => {
        const duration = performance.now() - start
        this.recordMetric({
          name: 'response.time',
          value: duration,
          unit: 'milliseconds',
          category: 'api',
          metadata: { operation, success: true }
        })
        return result
      })
      .catch(error => {
        const duration = performance.now() - start
        this.recordMetric({
          name: 'response.time',
          value: duration,
          unit: 'milliseconds',
          category: 'api',
          metadata: { operation, success: false, error: error.message }
        })
        throw error
      })
  }

  // AI Service Performance Tracking
  measureAICall<T>(service: string, operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    
    return fn()
      .then(result => {
        const duration = performance.now() - start
        this.recordMetric({
          name: 'response.time',
          value: duration,
          unit: 'milliseconds',
          category: 'ai',
          metadata: { service, operation, success: true }
        })
        return result
      })
      .catch(error => {
        const duration = performance.now() - start
        this.recordMetric({
          name: 'response.time',
          value: duration,
          unit: 'milliseconds',
          category: 'ai',
          metadata: { service, operation, success: false, error: error.message }
        })
        throw error
      })
  }

  // Cache Performance Tracking
  recordCacheHit(cacheType: string, key: string, hit: boolean) {
    this.recordMetric({
      name: 'hit.rate',
      value: hit ? 1 : 0,
      unit: 'boolean',
      category: 'cache',
      metadata: { cacheType, keyType: key.split(':')[0], hit }
    })
  }

  // Database Performance Tracking
  recordDatabaseQuery(operation: string, duration: number, success: boolean, metadata?: any) {
    this.recordMetric({
      name: 'query.time',
      value: duration,
      unit: 'milliseconds',
      category: 'database',
      metadata: { operation, success, ...metadata }
    })
  }

  // Get Performance Summary
  async getPerformanceSummary(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<{
    summary: Record<string, any>
    alerts: PerformanceAlert[]
    trends: Record<string, any>
  }> {
    const now = new Date()
    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    }[timeRange]

    const since = new Date(now.getTime() - timeRangeMs)

    try {
      // Get metrics from database
      const dbMetrics = await this.prisma.performanceMetric.findMany({
        where: {
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' }
      })

      // Calculate summary statistics
      const summary = this.calculateSummaryStats(dbMetrics)
      
      // Get recent alerts
      const recentAlerts = this.alerts.filter(alert => 
        alert.timestamp >= since
      ).slice(0, 50)

      // Calculate trends
      const trends = this.calculateTrends(dbMetrics)

      return { summary, alerts: recentAlerts, trends }
    } catch (error) {
      console.error('Failed to get performance summary:', error)
      return { summary: {}, alerts: [], trends: {} }
    }
  }

  private calculateSummaryStats(metrics: any[]): Record<string, any> {
    const summary: Record<string, any> = {}
    
    // Group by operation
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = []
      }
      acc[metric.operation].push(metric)
      return acc
    }, {} as Record<string, any[]>)

    // Calculate stats for each operation
    Object.entries(grouped).forEach(([operation, operationMetrics]) => {
      const typedMetrics = operationMetrics as any[]
      const durations = typedMetrics.map((m: any) => m.duration as number)
      const successCount = typedMetrics.filter((m: any) => m.success).length
      const totalCount = typedMetrics.length

      summary[operation] = {
        count: totalCount,
        successRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0,
        avgDuration: durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
        p95Duration: durations.length > 0 ? this.calculatePercentile(durations, 95) : 0
      }
    })

    return summary
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index] || 0
  }

  private calculateTrends(metrics: any[]): Record<string, any> {
    // Calculate hourly trends for the last 24 hours
    const trends: Record<string, any> = {}
    const now = new Date()
    
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      
      const hourMetrics = metrics.filter(m => 
        new Date(m.timestamp) >= hourStart && new Date(m.timestamp) < hourEnd
      )

      const hour = hourStart.getHours()
      trends[`hour_${hour}`] = {
        totalRequests: hourMetrics.length,
        avgResponseTime: hourMetrics.length > 0 
          ? hourMetrics.reduce((sum, m) => sum + m.duration, 0) / hourMetrics.length 
          : 0,
        errorRate: hourMetrics.length > 0 
          ? (hourMetrics.filter(m => !m.success).length / hourMetrics.length) * 100 
          : 0
      }
    }

    return trends
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flushMetrics() // Final flush
  }
}

// Export singleton instance
export const createPerformanceMonitor = (prisma: PrismaClient, thresholds?: Partial<PerformanceThresholds>) => {
  return new AdvancedPerformanceMonitor(prisma, thresholds)
}

// Utility functions for common performance measurements
export const measureFunction = async <T>(
  monitor: AdvancedPerformanceMonitor,
  name: string,
  category: 'api' | 'database' | 'ai' | 'cache' | 'network',
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now()
  
  try {
    const result = await fn()
    const duration = performance.now() - start
    
    monitor.recordMetric({
      name,
      value: duration,
      unit: 'milliseconds',
      category,
      metadata: { success: true }
    })
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    
    monitor.recordMetric({
      name,
      value: duration,
      unit: 'milliseconds',
      category,
      metadata: { success: false, error: error instanceof Error ? error.message : String(error) }
    })
    
    throw error
  }
}