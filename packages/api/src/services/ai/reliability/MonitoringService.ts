/**
 * Monitoring Service
 * 
 * Comprehensive error logging and monitoring for AI operations with
 * metrics collection, alerting, and performance tracking.
 */

export interface MonitoringConfig {
  enableMetrics: boolean
  enableErrorTracking: boolean
  enablePerformanceTracking: boolean
  metricsRetentionMs: number
  errorRetentionMs: number
  alertThresholds: {
    errorRatePercentage: number
    responseTimeMs: number
    queueSizeThreshold: number
  }
}

export interface ErrorEvent {
  id: string
  timestamp: Date
  operationType: string
  errorType: string
  errorMessage: string
  stackTrace?: string
  userId?: string
  sessionId?: string
  context: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface MetricEvent {
  id: string
  timestamp: Date
  name: string
  value: number
  unit: string
  tags: Record<string, string>
  operationType?: string
}

export interface PerformanceEvent {
  id: string
  timestamp: Date
  operationType: string
  durationMs: number
  success: boolean
  userId?: string
  metadata: Record<string, any>
}

export interface AlertEvent {
  id: string
  timestamp: Date
  type: 'error_rate' | 'performance' | 'queue_size' | 'circuit_breaker'
  severity: 'warning' | 'critical'
  message: string
  data: Record<string, any>
}

export class MonitoringService {
  private static readonly DEFAULT_CONFIG: MonitoringConfig = {
    enableMetrics: true,
    enableErrorTracking: true,
    enablePerformanceTracking: true,
    metricsRetentionMs: 3600000, // 1 hour
    errorRetentionMs: 86400000,  // 24 hours
    alertThresholds: {
      errorRatePercentage: 10,
      responseTimeMs: 30000,
      queueSizeThreshold: 50
    }
  }

  private errors: ErrorEvent[] = []
  private metrics: MetricEvent[] = []
  private performance: PerformanceEvent[] = []
  private alerts: AlertEvent[] = []

  constructor(
    private serviceName: string,
    private config: MonitoringConfig = MonitoringService.DEFAULT_CONFIG
  ) {
    this.config = { ...MonitoringService.DEFAULT_CONFIG, ...config }
    console.log(`📊 Monitoring service initialized for ${serviceName}`)
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 300000) // Every 5 minutes
  }

  /**
   * Record error event
   */
  recordError(
    operationType: string,
    error: Error,
    context: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string,
    sessionId?: string
  ): void {
    if (!this.config.enableErrorTracking) return

    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      operationType,
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      userId,
      sessionId,
      context,
      severity
    }

    this.errors.push(errorEvent)
    
    console.error(`🚨 [${this.serviceName}] Error recorded:`, {
      id: errorEvent.id,
      operationType,
      errorType: error.name,
      severity,
      userId
    })

    // Check for alert conditions
    this.checkErrorRateAlert()
  }

  /**
   * Record metric event
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'count',
    tags: Record<string, string> = {},
    operationType?: string
  ): void {
    if (!this.config.enableMetrics) return

    const metricEvent: MetricEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      name,
      value,
      unit,
      tags,
      operationType
    }

    this.metrics.push(metricEvent)
    
    console.log(`📈 [${this.serviceName}] Metric recorded: ${name}=${value}${unit}`, tags)
  }

  /**
   * Record performance event
   */
  recordPerformance(
    operationType: string,
    durationMs: number,
    success: boolean,
    metadata: Record<string, any> = {},
    userId?: string
  ): void {
    if (!this.config.enablePerformanceTracking) return

    const performanceEvent: PerformanceEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      operationType,
      durationMs,
      success,
      userId,
      metadata
    }

    this.performance.push(performanceEvent)
    
    console.log(`⏱️ [${this.serviceName}] Performance recorded: ${operationType} ${durationMs}ms (${success ? 'success' : 'failure'})`)

    // Check for performance alerts
    if (durationMs > this.config.alertThresholds.responseTimeMs) {
      this.recordAlert(
        'performance',
        'warning',
        `Slow operation: ${operationType} took ${durationMs}ms`,
        { operationType, durationMs, threshold: this.config.alertThresholds.responseTimeMs }
      )
    }
  }

  /**
   * Record alert event
   */
  recordAlert(
    type: 'error_rate' | 'performance' | 'queue_size' | 'circuit_breaker',
    severity: 'warning' | 'critical',
    message: string,
    data: Record<string, any> = {}
  ): void {
    const alertEvent: AlertEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      severity,
      message,
      data
    }

    this.alerts.push(alertEvent)
    
    const emoji = severity === 'critical' ? '🚨' : '⚠️'
    console.warn(`${emoji} [${this.serviceName}] Alert: ${message}`, data)
  }

  /**
   * Get error statistics
   */
  getErrorStats(timeWindowMs: number = 3600000): {
    totalErrors: number
    errorRate: number
    errorsByType: Record<string, number>
    errorsBySeverity: Record<string, number>
    recentErrors: ErrorEvent[]
  } {
    const cutoff = new Date(Date.now() - timeWindowMs)
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoff)
    const recentPerformance = this.performance.filter(p => p.timestamp >= cutoff)
    
    const totalOperations = recentPerformance.length
    const errorRate = totalOperations > 0 ? (recentErrors.length / totalOperations) * 100 : 0

    const errorsByType: Record<string, number> = {}
    const errorsBySeverity: Record<string, number> = {}

    for (const error of recentErrors) {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1
    }

    return {
      totalErrors: recentErrors.length,
      errorRate,
      errorsByType,
      errorsBySeverity,
      recentErrors: recentErrors.slice(-10) // Last 10 errors
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindowMs: number = 3600000): {
    totalOperations: number
    successRate: number
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    operationStats: Record<string, {
      count: number
      averageMs: number
      successRate: number
    }>
  } {
    const cutoff = new Date(Date.now() - timeWindowMs)
    const recentPerformance = this.performance.filter(p => p.timestamp >= cutoff)
    
    const totalOperations = recentPerformance.length
    const successfulOperations = recentPerformance.filter(p => p.success).length
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0

    const responseTimes = recentPerformance.map(p => p.durationMs).sort((a, b) => a - b)
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0

    const p95Index = Math.floor(responseTimes.length * 0.95)
    const p99Index = Math.floor(responseTimes.length * 0.99)
    const p95ResponseTime = responseTimes[p95Index] || 0
    const p99ResponseTime = responseTimes[p99Index] || 0

    // Operation-specific stats
    const operationStats: Record<string, { count: number; averageMs: number; successRate: number }> = {}
    
    for (const perf of recentPerformance) {
      if (!operationStats[perf.operationType]) {
        operationStats[perf.operationType] = { count: 0, averageMs: 0, successRate: 0 }
      }
      operationStats[perf.operationType].count++
    }

    for (const [operationType, stats] of Object.entries(operationStats)) {
      const operationPerfs = recentPerformance.filter(p => p.operationType === operationType)
      const successfulOps = operationPerfs.filter(p => p.success).length
      
      stats.averageMs = operationPerfs.reduce((sum, p) => sum + p.durationMs, 0) / operationPerfs.length
      stats.successRate = (successfulOps / operationPerfs.length) * 100
    }

    return {
      totalOperations,
      successRate,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      operationStats
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): AlertEvent[] {
    return this.alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    errorRate: number
    averageResponseTime: number
    activeAlerts: number
    lastError?: ErrorEvent
    recommendations: string[]
  } {
    const errorStats = this.getErrorStats()
    const perfStats = this.getPerformanceStats()
    const recentAlerts = this.getRecentAlerts(5)
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    const recommendations: string[] = []

    // Determine health status
    if (errorStats.errorRate > this.config.alertThresholds.errorRatePercentage) {
      status = 'unhealthy'
      recommendations.push(`High error rate: ${errorStats.errorRate.toFixed(1)}%`)
    } else if (errorStats.errorRate > this.config.alertThresholds.errorRatePercentage / 2) {
      status = 'degraded'
      recommendations.push(`Elevated error rate: ${errorStats.errorRate.toFixed(1)}%`)
    }

    if (perfStats.averageResponseTime > this.config.alertThresholds.responseTimeMs) {
      status = status === 'healthy' ? 'degraded' : 'unhealthy'
      recommendations.push(`Slow response times: ${perfStats.averageResponseTime.toFixed(0)}ms average`)
    }

    if (recentAlerts.filter(a => a.severity === 'critical').length > 0) {
      status = 'unhealthy'
      recommendations.push('Critical alerts detected')
    }

    return {
      status,
      errorRate: errorStats.errorRate,
      averageResponseTime: perfStats.averageResponseTime,
      activeAlerts: recentAlerts.length,
      lastError: errorStats.recentErrors[0],
      recommendations
    }
  }

  /**
   * Check error rate alert condition
   */
  private checkErrorRateAlert(): void {
    const errorStats = this.getErrorStats(600000) // Last 10 minutes
    
    if (errorStats.errorRate > this.config.alertThresholds.errorRatePercentage) {
      this.recordAlert(
        'error_rate',
        'critical',
        `High error rate: ${errorStats.errorRate.toFixed(1)}%`,
        { 
          errorRate: errorStats.errorRate, 
          threshold: this.config.alertThresholds.errorRatePercentage,
          totalErrors: errorStats.totalErrors
        }
      )
    }
  }

  /**
   * Clean up old data
   */
  private cleanup(): void {
    const now = Date.now()
    
    // Clean up errors
    const errorCutoff = new Date(now - this.config.errorRetentionMs)
    const errorsBefore = this.errors.length
    this.errors = this.errors.filter(e => e.timestamp >= errorCutoff)
    
    // Clean up metrics
    const metricsCutoff = new Date(now - this.config.metricsRetentionMs)
    const metricsBefore = this.metrics.length
    this.metrics = this.metrics.filter(m => m.timestamp >= metricsCutoff)
    
    // Clean up performance data
    const perfCutoff = new Date(now - this.config.metricsRetentionMs)
    const perfBefore = this.performance.length
    this.performance = this.performance.filter(p => p.timestamp >= perfCutoff)
    
    // Clean up alerts (keep for 24 hours)
    const alertCutoff = new Date(now - 86400000)
    const alertsBefore = this.alerts.length
    this.alerts = this.alerts.filter(a => a.timestamp >= alertCutoff)
    
    if (errorsBefore > this.errors.length || metricsBefore > this.metrics.length || 
        perfBefore > this.performance.length || alertsBefore > this.alerts.length) {
      console.log(`🧹 [${this.serviceName}] Cleaned up old monitoring data`)
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log(`🔧 [${this.serviceName}] Monitoring configuration updated`)
  }

  /**
   * Export data for external monitoring systems
   */
  exportData(): {
    errors: ErrorEvent[]
    metrics: MetricEvent[]
    performance: PerformanceEvent[]
    alerts: AlertEvent[]
  } {
    return {
      errors: [...this.errors],
      metrics: [...this.metrics],
      performance: [...this.performance],
      alerts: [...this.alerts]
    }
  }
}