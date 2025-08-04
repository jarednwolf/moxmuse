/**
 * Performance Monitoring and Metrics Collection
 * 
 * Provides comprehensive performance tracking, metrics collection,
 * profiling capabilities, and performance reporting.
 */

import {
  MetricsCollector,
  Timer,
  MetricSnapshot,
  PerformanceMonitor,
  PerformanceContext,
  PerformanceMetric,
  TimeRange,
  PerformanceReport,
  OperationStats,
  PerformanceSummary,
  ProfileSession,
  ProfileResult,
  MemoryUsage,
  ProfileBreakdown,
  Logger,
  BaseService,
  ServiceHealthStatus
} from './interfaces'

interface MetricEntry {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
  value: number
  tags: Record<string, string>
  timestamp: Date
}

interface HistogramData {
  values: number[]
  count: number
  sum: number
  min: number
  max: number
}

interface TimerInstance {
  metric: string
  startTime: number
  tags: Record<string, string>
}

export class ComprehensiveMetricsCollector implements MetricsCollector, BaseService {
  readonly name = 'ComprehensiveMetricsCollector'
  readonly version = '1.0.0'
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private histograms = new Map<string, HistogramData>()
  private metrics: MetricEntry[] = []
  private logger: Logger
  private flushInterval?: NodeJS.Timeout
  private maxMetricsBuffer: number

  constructor(logger: Logger, maxMetricsBuffer = 10000) {
    this.logger = logger.child({ service: 'MetricsCollector' })
    this.maxMetricsBuffer = maxMetricsBuffer
    this.startFlushTimer()
  }

  async initialize(): Promise<void> {
    // Metrics collector initialization if needed
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: 'healthy',
      metrics: {
        metricsBuffered: this.metrics.length,
        countersCount: this.counters.size,
        gaugesCount: this.gauges.size,
        histogramsCount: this.histograms.size
      },
      timestamp: new Date()
    }
  }

  increment(metric: string, value = 1, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(metric, tags)
    const currentValue = this.counters.get(key) || 0
    this.counters.set(key, currentValue + value)

    this.recordMetric({
      name: metric,
      type: 'counter',
      value: currentValue + value,
      tags,
      timestamp: new Date()
    })
  }

  decrement(metric: string, value = 1, tags: Record<string, string> = {}): void {
    this.increment(metric, -value, tags)
  }

  gauge(metric: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(metric, tags)
    this.gauges.set(key, value)

    this.recordMetric({
      name: metric,
      type: 'gauge',
      value,
      tags,
      timestamp: new Date()
    })
  }

  histogram(metric: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(metric, tags)
    let histogram = this.histograms.get(key)

    if (!histogram) {
      histogram = {
        values: [],
        count: 0,
        sum: 0,
        min: value,
        max: value
      }
      this.histograms.set(key, histogram)
    }

    histogram.values.push(value)
    histogram.count++
    histogram.sum += value
    histogram.min = Math.min(histogram.min, value)
    histogram.max = Math.max(histogram.max, value)

    // Keep only recent values to prevent memory issues
    if (histogram.values.length > 1000) {
      histogram.values = histogram.values.slice(-1000)
    }

    this.recordMetric({
      name: metric,
      type: 'histogram',
      value,
      tags,
      timestamp: new Date()
    })
  }

  timing(metric: string, duration: number, tags: Record<string, string> = {}): void {
    this.histogram(metric, duration, tags)
  }

  startTimer(metric: string, tags: Record<string, string> = {}): Timer {
    const timer: TimerInstance = {
      metric,
      startTime: Date.now(),
      tags
    }

    return {
      stop: (additionalTags: Record<string, string> = {}) => {
        const duration = Date.now() - timer.startTime
        this.timing(timer.metric, duration, { ...timer.tags, ...additionalTags })
      }
    }
  }

  async getMetrics(): Promise<MetricSnapshot[]> {
    return this.metrics.map(metric => ({
      name: metric.name,
      type: metric.type,
      value: metric.value,
      tags: metric.tags,
      timestamp: metric.timestamp
    }))
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) {
      return
    }

    // In a real implementation, you would send metrics to an external system
    // like Prometheus, DataDog, CloudWatch, etc.
    this.logger.debug(`Flushing ${this.metrics.length} metrics`)

    // Clear metrics buffer
    this.metrics = []
  }

  private recordMetric(metric: MetricEntry): void {
    this.metrics.push(metric)

    // Prevent memory issues by limiting buffer size
    if (this.metrics.length > this.maxMetricsBuffer) {
      this.metrics = this.metrics.slice(-this.maxMetricsBuffer)
    }
  }

  private getMetricKey(metric: string, tags: Record<string, string>): string {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',')
    
    return tagString ? `${metric}{${tagString}}` : metric
  }

  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(error => {
        this.logger.error('Error flushing metrics', error)
      })
    }, 60000) // Flush every minute
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = undefined
    }

    await this.flush()
    this.logger.info('Metrics collector shutdown complete')
  }
}

export class AdvancedPerformanceMonitor implements PerformanceMonitor, BaseService {
  readonly name = 'AdvancedPerformanceMonitor'
  readonly version = '1.0.0'
  private performanceMetrics: PerformanceMetric[] = []
  private profileSessions = new Map<string, ProfileSession>()
  private logger: Logger
  private metrics: MetricsCollector

  constructor(logger: Logger, metrics: MetricsCollector) {
    this.logger = logger.child({ service: 'PerformanceMonitor' })
    this.metrics = metrics
  }

  async initialize(): Promise<void> {
    // Performance monitor initialization if needed
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: 'healthy',
      metrics: {
        performanceMetricsCount: this.performanceMetrics.length,
        activeProfileSessions: this.profileSessions.size
      },
      timestamp: new Date()
    }
  }

  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    context: PerformanceContext = { operation }
  ): Promise<T> {
    const startTime = Date.now()
    const timer = this.metrics.startTimer('operation.duration', {
      operation,
      userId: context.userId || 'anonymous'
    })

    let success = true
    let error: string | undefined

    try {
      const result = await fn()
      return result
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      const duration = Date.now() - startTime
      timer.stop({ success: success.toString() })

      // Record performance metric
      this.recordMetric({
        operation,
        duration,
        success,
        error,
        metadata: context.metadata,
        timestamp: new Date()
      })

      // Update metrics
      this.metrics.increment('operations.total', 1, { operation })
      this.metrics.increment(`operations.${success ? 'success' : 'error'}`, 1, { operation })
      this.metrics.histogram('operations.duration', duration, { operation })

      this.logger.debug(`Operation completed: ${operation}`, {
        duration,
        success,
        error,
        userId: context.userId
      })
    }
  }

  recordMetric(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric)

    // Keep only recent metrics to prevent memory issues
    if (this.performanceMetrics.length > 10000) {
      this.performanceMetrics = this.performanceMetrics.slice(-10000)
    }
  }

  async getPerformanceReport(timeRange?: TimeRange): Promise<PerformanceReport> {
    const now = new Date()
    const range = timeRange || {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: now
    }

    // Filter metrics by time range
    const filteredMetrics = this.performanceMetrics.filter(
      metric => metric.timestamp >= range.start && metric.timestamp <= range.end
    )

    // Group by operation
    const operationGroups = new Map<string, PerformanceMetric[]>()
    for (const metric of filteredMetrics) {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, [])
      }
      operationGroups.get(metric.operation)!.push(metric)
    }

    // Calculate statistics for each operation
    const operations: OperationStats[] = []
    let totalOperations = 0
    let totalDuration = 0
    let totalErrors = 0

    for (const [operation, metrics] of Array.from(operationGroups.entries())) {
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b)
      const successCount = metrics.filter(m => m.success).length
      const errorCount = metrics.length - successCount

      const stats: OperationStats = {
        operation,
        count: metrics.length,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p50Duration: this.percentile(durations, 0.5),
        p95Duration: this.percentile(durations, 0.95),
        p99Duration: this.percentile(durations, 0.99),
        successRate: successCount / metrics.length,
        errorRate: errorCount / metrics.length
      }

      operations.push(stats)
      totalOperations += metrics.length
      totalDuration += durations.reduce((sum, d) => sum + d, 0)
      totalErrors += errorCount
    }

    // Calculate summary
    const summary: PerformanceSummary = {
      totalOperations,
      averageResponseTime: totalOperations > 0 ? totalDuration / totalOperations : 0,
      errorRate: totalOperations > 0 ? totalErrors / totalOperations : 0,
      throughput: totalOperations / ((range.end.getTime() - range.start.getTime()) / 1000)
    }

    return {
      operations,
      summary,
      timeRange: range
    }
  }

  startProfiling(operation: string): ProfileSession {
    const sessionId = this.generateSessionId()
    const session: ProfileSession = {
      id: sessionId,
      operation,
      startTime: new Date()
    }

    this.profileSessions.set(sessionId, session)

    this.logger.debug(`Started profiling session: ${sessionId}`, { operation })

    return session
  }

  async stopProfiling(sessionId: string): Promise<ProfileResult> {
    const session = this.profileSessions.get(sessionId)
    if (!session) {
      throw new Error(`Profile session not found: ${sessionId}`)
    }

    const endTime = new Date()
    const duration = endTime.getTime() - session.startTime.getTime()

    // Get memory usage
    const memoryUsage = this.getMemoryUsage()

    // In a real implementation, you would collect detailed profiling data
    // For now, we'll provide basic information
    const result: ProfileResult = {
      sessionId,
      operation: session.operation,
      duration,
      memoryUsage,
      cpuUsage: 0, // Would be calculated from actual CPU profiling
      breakdown: [] // Would contain detailed function call breakdown
    }

    this.profileSessions.delete(sessionId)

    this.logger.debug(`Stopped profiling session: ${sessionId}`, {
      operation: session.operation,
      duration,
      memoryUsage
    })

    return result
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    
    const index = Math.ceil(values.length * p) - 1
    return values[Math.max(0, Math.min(index, values.length - 1))]
  }

  private getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    }
  }

  private generateSessionId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async shutdown(): Promise<void> {
    // Stop any active profiling sessions
    for (const sessionId of Array.from(this.profileSessions.keys())) {
      try {
        await this.stopProfiling(sessionId)
      } catch (error) {
        this.logger.error(`Error stopping profile session ${sessionId}`, error as Error)
      }
    }

    this.logger.info('Performance monitor shutdown complete')
  }
}

// Utility functions for performance monitoring
export function withPerformanceTracking<T>(
  monitor: PerformanceMonitor,
  operation: string,
  context?: PerformanceContext
) {
  return (fn: () => Promise<T>): Promise<T> => {
    return monitor.trackOperation(operation, fn, context)
  }
}

export function createPerformanceDecorator(
  monitor: PerformanceMonitor,
  operation?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const operationName = operation || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      return monitor.trackOperation(
        operationName,
        () => originalMethod.apply(this, args),
        { operation: operationName }
      )
    }

    return descriptor
  }
}

// Import the logger singleton
import { logger } from './logging'

// Export singleton instance
export const performanceMonitor = new AdvancedPerformanceMonitor(
  logger,
  new ComprehensiveMetricsCollector(logger)
)
