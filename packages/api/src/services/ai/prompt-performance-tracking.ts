import { z } from 'zod'

// Performance metrics types
export const PerformanceMetricsSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  sessionId: z.string(),
  userId: z.string().optional(),
  timestamp: z.date(),
  
  // Core metrics
  success: z.boolean(),
  responseTime: z.number(), // milliseconds
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }),
  cost: z.number(), // USD
  
  // Quality metrics
  userSatisfactionScore: z.number().min(1).max(5).optional(),
  accuracyScore: z.number().min(0).max(1).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
  completenessScore: z.number().min(0).max(1).optional(),
  
  // Context metrics
  taskType: z.string(),
  modelUsed: z.string(),
  inputComplexity: z.enum(['low', 'moderate', 'high', 'research']),
  outputLength: z.number(),
  
  // Error information
  errorType: z.string().optional(),
  errorMessage: z.string().optional(),
  
  // User feedback
  userFeedback: z.object({
    helpful: z.boolean().optional(),
    accurate: z.boolean().optional(),
    relevant: z.boolean().optional(),
    comments: z.string().optional(),
  }).optional(),
})

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>

// Aggregated performance data
export const AggregatedPerformanceSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  
  // Sample size
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  
  // Performance averages
  averageResponseTime: z.number(),
  averageCost: z.number(),
  averageTokenUsage: z.number(),
  
  // Quality averages
  averageUserSatisfaction: z.number(),
  averageAccuracy: z.number(),
  averageRelevance: z.number(),
  averageCompleteness: z.number(),
  
  // Success rates
  successRate: z.number().min(0).max(1),
  
  // Percentiles
  responseTimePercentiles: z.object({
    p50: z.number(),
    p90: z.number(),
    p95: z.number(),
    p99: z.number(),
  }),
  
  // Trends
  trend: z.enum(['improving', 'stable', 'declining']),
  trendConfidence: z.number().min(0).max(1),
  
  lastUpdated: z.date(),
})

export type AggregatedPerformance = z.infer<typeof AggregatedPerformanceSchema>

// Performance alerts
export const PerformanceAlertSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.string(),
  alertType: z.enum([
    'success_rate_drop',
    'response_time_spike',
    'cost_increase',
    'satisfaction_drop',
    'error_rate_spike',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string(),
  threshold: z.number(),
  currentValue: z.number(),
  triggeredAt: z.date(),
  acknowledged: z.boolean().default(false),
  resolvedAt: z.date().optional(),
})

export type PerformanceAlert = z.infer<typeof PerformanceAlertSchema>

/**
 * PromptPerformanceTracking monitors and analyzes prompt performance
 * Provides real-time metrics, alerts, and optimization recommendations
 */
export class PromptPerformanceTracking {
  private metricsData: Map<string, PerformanceMetrics[]> = new Map()
  private aggregatedData: Map<string, AggregatedPerformance> = new Map()
  private alerts: Map<string, PerformanceAlert> = new Map()
  private alertThresholds: Map<string, AlertThreshold> = new Map()
  private performanceBaselines: Map<string, PerformanceBaseline> = new Map()

  constructor() {
    this.initializeAlertThresholds()
    this.startPerformanceAggregation()
  }

  /**
   * Record performance metrics for a prompt execution
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    const key = `${metrics.templateId}:${metrics.version}`
    const existing = this.metricsData.get(key) || []
    existing.push(metrics)
    this.metricsData.set(key, existing)

    // Check for alerts
    this.checkAlerts(metrics)

    // Update real-time aggregations
    this.updateAggregations(metrics)

    console.log(`📊 Recorded metrics for ${metrics.templateId} v${metrics.version}:`, {
      success: metrics.success,
      responseTime: metrics.responseTime,
      cost: metrics.cost,
      satisfaction: metrics.userSatisfactionScore,
    })
  }

  /**
   * Get performance metrics for a template version
   */
  getMetrics(
    templateId: string,
    version: string,
    timeRange?: { start: Date; end: Date }
  ): PerformanceMetrics[] {
    const key = `${templateId}:${version}`
    let metrics = this.metricsData.get(key) || []

    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      )
    }

    return metrics
  }

  /**
   * Get aggregated performance data
   */
  getAggregatedPerformance(
    templateId: string,
    version: string
  ): AggregatedPerformance | null {
    const key = `${templateId}:${version}`
    return this.aggregatedData.get(key) || null
  }

  /**
   * Compare performance between template versions
   */
  compareVersions(
    templateId: string,
    versionA: string,
    versionB: string,
    timeRange?: { start: Date; end: Date }
  ): VersionComparison {
    const metricsA = this.getMetrics(templateId, versionA, timeRange)
    const metricsB = this.getMetrics(templateId, versionB, timeRange)

    if (metricsA.length === 0 || metricsB.length === 0) {
      return {
        templateId,
        versionA,
        versionB,
        comparison: 'insufficient_data',
        metrics: {},
        recommendations: ['Insufficient data for comparison'],
      }
    }

    const avgA = this.calculateAverageMetrics(metricsA)
    const avgB = this.calculateAverageMetrics(metricsB)

    const comparison: VersionComparison = {
      templateId,
      versionA,
      versionB,
      comparison: this.determineOverallComparison(avgA, avgB),
      metrics: {
        successRate: {
          versionA: avgA.successRate,
          versionB: avgB.successRate,
          improvement: ((avgB.successRate - avgA.successRate) / avgA.successRate) * 100,
        },
        responseTime: {
          versionA: avgA.responseTime,
          versionB: avgB.responseTime,
          improvement: ((avgA.responseTime - avgB.responseTime) / avgA.responseTime) * 100,
        },
        userSatisfaction: {
          versionA: avgA.userSatisfaction,
          versionB: avgB.userSatisfaction,
          improvement: ((avgB.userSatisfaction - avgA.userSatisfaction) / avgA.userSatisfaction) * 100,
        },
        cost: {
          versionA: avgA.cost,
          versionB: avgB.cost,
          improvement: ((avgA.cost - avgB.cost) / avgA.cost) * 100,
        },
      },
      recommendations: this.generateComparisonRecommendations(avgA, avgB),
    }

    return comparison
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(
    templateId: string,
    version: string,
    timeRange: { start: Date; end: Date },
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): PerformanceTrend[] {
    const metrics = this.getMetrics(templateId, version, timeRange)
    
    if (metrics.length === 0) {
      return []
    }

    // Group metrics by time buckets
    const buckets = this.groupMetricsByTime(metrics, granularity)
    
    // Calculate trends for each bucket
    const trends: PerformanceTrend[] = []
    
    for (const [timestamp, bucketMetrics] of Array.from(buckets.entries())) {
      const avgMetrics = this.calculateAverageMetrics(bucketMetrics)
      
      trends.push({
        timestamp: new Date(timestamp),
        successRate: avgMetrics.successRate,
        averageResponseTime: avgMetrics.responseTime,
        averageUserSatisfaction: avgMetrics.userSatisfaction,
        averageCost: avgMetrics.cost,
        requestCount: bucketMetrics.length,
      })
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Get active performance alerts
   */
  getActiveAlerts(templateId?: string): PerformanceAlert[] {
    const alerts = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged && !alert.resolvedAt)

    if (templateId) {
      return alerts.filter(alert => alert.templateId === templateId)
    }

    return alerts
  }

  /**
   * Acknowledge a performance alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      console.log(`✅ Acknowledged alert: ${alert.message}`)
    }
  }

  /**
   * Get performance recommendations for a template
   */
  getPerformanceRecommendations(
    templateId: string,
    version: string
  ): PerformanceRecommendation[] {
    const aggregated = this.getAggregatedPerformance(templateId, version)
    if (!aggregated) {
      return []
    }

    const recommendations: PerformanceRecommendation[] = []
    const baseline = this.performanceBaselines.get(templateId)

    // Success rate recommendations
    if (aggregated.successRate < 0.8) {
      recommendations.push({
        type: 'success_rate',
        priority: 'high',
        title: 'Low Success Rate',
        description: `Success rate is ${(aggregated.successRate * 100).toFixed(1)}%. Consider simplifying the prompt or adding more examples.`,
        impact: 'high',
        effort: 'medium',
      })
    }

    // Response time recommendations
    if (aggregated.averageResponseTime > 10000) {
      recommendations.push({
        type: 'response_time',
        priority: 'medium',
        title: 'Slow Response Time',
        description: `Average response time is ${(aggregated.averageResponseTime / 1000).toFixed(1)}s. Consider using a faster model or optimizing the prompt.`,
        impact: 'medium',
        effort: 'low',
      })
    }

    // Cost recommendations
    if (baseline && aggregated.averageCost > baseline.averageCost * 1.5) {
      recommendations.push({
        type: 'cost',
        priority: 'medium',
        title: 'High Cost',
        description: `Cost is ${((aggregated.averageCost / baseline.averageCost - 1) * 100).toFixed(1)}% above baseline. Consider using a more cost-effective model.`,
        impact: 'low',
        effort: 'low',
      })
    }

    // User satisfaction recommendations
    if (aggregated.averageUserSatisfaction < 3.5) {
      recommendations.push({
        type: 'user_satisfaction',
        priority: 'high',
        title: 'Low User Satisfaction',
        description: `User satisfaction is ${aggregated.averageUserSatisfaction.toFixed(1)}/5. Review user feedback and improve response quality.`,
        impact: 'high',
        effort: 'high',
      })
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Set performance baseline for a template
   */
  setPerformanceBaseline(
    templateId: string,
    baseline: PerformanceBaseline
  ): void {
    this.performanceBaselines.set(templateId, baseline)
    console.log(`📏 Set performance baseline for ${templateId}`)
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(
    templateId: string,
    version: string,
    format: 'json' | 'csv' = 'json'
  ): string {
    const metrics = this.getMetrics(templateId, version)
    
    if (format === 'csv') {
      return this.convertToCSV(metrics)
    }
    
    return JSON.stringify(metrics, null, 2)
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const key = `${metrics.templateId}:${metrics.version}`
    const recentMetrics = this.getRecentMetrics(key, 100) // Last 100 requests
    
    if (recentMetrics.length < 10) return // Need enough data

    const avgMetrics = this.calculateAverageMetrics(recentMetrics)
    
    // Check each alert threshold
    for (const [alertType, threshold] of Array.from(this.alertThresholds.entries())) {
      const shouldAlert = this.shouldTriggerAlert(avgMetrics, threshold)
      
      if (shouldAlert) {
        this.createAlert(metrics, alertType, threshold, avgMetrics)
      }
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    metrics: PerformanceMetrics,
    alertType: string,
    threshold: AlertThreshold,
    currentMetrics: any
  ): void {
    const alertId = `${metrics.templateId}-${metrics.version}-${alertType}-${Date.now()}`
    
    const alert: PerformanceAlert = {
      id: alertId,
      templateId: metrics.templateId,
      version: metrics.version,
      alertType: alertType as any,
      severity: threshold.severity,
      message: this.buildAlertMessage(alertType, threshold, currentMetrics),
      threshold: threshold.value,
      currentValue: this.getCurrentValue(currentMetrics, alertType),
      triggeredAt: new Date(),
      acknowledged: false,
    }

    this.alerts.set(alertId, alert)
    
    console.log(`🚨 Performance alert: ${alert.message}`)
  }

  /**
   * Update aggregated performance data
   */
  private updateAggregations(metrics: PerformanceMetrics): void {
    const key = `${metrics.templateId}:${metrics.version}`
    const recentMetrics = this.getRecentMetrics(key, 1000) // Last 1000 requests
    
    if (recentMetrics.length === 0) return

    const aggregated = this.calculateAggregatedPerformance(
      metrics.templateId,
      metrics.version,
      recentMetrics
    )

    this.aggregatedData.set(key, aggregated)
  }

  /**
   * Calculate aggregated performance from metrics
   */
  private calculateAggregatedPerformance(
    templateId: string,
    version: string,
    metrics: PerformanceMetrics[]
  ): AggregatedPerformance {
    const successful = metrics.filter(m => m.success)
    const failed = metrics.filter(m => !m.success)
    
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b)
    
    return {
      templateId,
      version,
      timeRange: {
        start: new Date(Math.min(...metrics.map(m => m.timestamp.getTime()))),
        end: new Date(Math.max(...metrics.map(m => m.timestamp.getTime()))),
      },
      totalRequests: metrics.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      averageCost: metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length,
      averageTokenUsage: metrics.reduce((sum, m) => sum + m.tokenUsage.total, 0) / metrics.length,
      averageUserSatisfaction: this.calculateAverage(metrics, m => m.userSatisfactionScore),
      averageAccuracy: this.calculateAverage(metrics, m => m.accuracyScore),
      averageRelevance: this.calculateAverage(metrics, m => m.relevanceScore),
      averageCompleteness: this.calculateAverage(metrics, m => m.completenessScore),
      successRate: successful.length / metrics.length,
      responseTimePercentiles: {
        p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
        p90: responseTimes[Math.floor(responseTimes.length * 0.9)],
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      },
      trend: this.calculateTrend(metrics),
      trendConfidence: 0.8, // Simplified
      lastUpdated: new Date(),
    }
  }

  /**
   * Calculate average for optional metrics
   */
  private calculateAverage(
    metrics: PerformanceMetrics[],
    accessor: (m: PerformanceMetrics) => number | undefined
  ): number {
    const values = metrics.map(accessor).filter(v => v !== undefined) as number[]
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(metrics: PerformanceMetrics[]): 'improving' | 'stable' | 'declining' {
    if (metrics.length < 20) return 'stable'

    // Simple trend calculation based on success rate over time
    const sortedMetrics = metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const firstHalf = sortedMetrics.slice(0, Math.floor(sortedMetrics.length / 2))
    const secondHalf = sortedMetrics.slice(Math.floor(sortedMetrics.length / 2))

    const firstHalfSuccess = firstHalf.filter(m => m.success).length / firstHalf.length
    const secondHalfSuccess = secondHalf.filter(m => m.success).length / secondHalf.length

    const improvement = secondHalfSuccess - firstHalfSuccess

    if (improvement > 0.05) return 'improving'
    if (improvement < -0.05) return 'declining'
    return 'stable'
  }

  /**
   * Get recent metrics for a template version
   */
  private getRecentMetrics(key: string, limit: number): PerformanceMetrics[] {
    const metrics = this.metricsData.get(key) || []
    return metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Calculate average metrics from array
   */
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): {
    successRate: number
    responseTime: number
    userSatisfaction: number
    cost: number
  } {
    const successful = metrics.filter(m => m.success).length
    const satisfactionScores = metrics
      .map(m => m.userSatisfactionScore)
      .filter(s => s !== undefined) as number[]

    return {
      successRate: successful / metrics.length,
      responseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      userSatisfaction: satisfactionScores.length > 0 
        ? satisfactionScores.reduce((sum, s) => sum + s, 0) / satisfactionScores.length 
        : 0,
      cost: metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length,
    }
  }

  /**
   * Determine overall comparison result
   */
  private determineOverallComparison(avgA: any, avgB: any): 'better' | 'worse' | 'similar' {
    let score = 0
    
    // Success rate (weight: 3)
    if (avgB.successRate > avgA.successRate * 1.05) score += 3
    else if (avgB.successRate < avgA.successRate * 0.95) score -= 3

    // Response time (weight: 2, lower is better)
    if (avgB.responseTime < avgA.responseTime * 0.9) score += 2
    else if (avgB.responseTime > avgA.responseTime * 1.1) score -= 2

    // User satisfaction (weight: 3)
    if (avgB.userSatisfaction > avgA.userSatisfaction * 1.1) score += 3
    else if (avgB.userSatisfaction < avgA.userSatisfaction * 0.9) score -= 3

    // Cost (weight: 1, lower is better)
    if (avgB.cost < avgA.cost * 0.9) score += 1
    else if (avgB.cost > avgA.cost * 1.1) score -= 1

    if (score >= 3) return 'better'
    if (score <= -3) return 'worse'
    return 'similar'
  }

  /**
   * Generate comparison recommendations
   */
  private generateComparisonRecommendations(avgA: any, avgB: any): string[] {
    const recommendations: string[] = []

    if (avgB.successRate > avgA.successRate * 1.05) {
      recommendations.push('Version B shows improved success rate')
    }
    if (avgB.responseTime < avgA.responseTime * 0.9) {
      recommendations.push('Version B has better response time')
    }
    if (avgB.userSatisfaction > avgA.userSatisfaction * 1.1) {
      recommendations.push('Version B has higher user satisfaction')
    }
    if (avgB.cost < avgA.cost * 0.9) {
      recommendations.push('Version B is more cost effective')
    }

    if (recommendations.length === 0) {
      recommendations.push('No significant differences found between versions')
    }

    return recommendations
  }

  /**
   * Group metrics by time buckets
   */
  private groupMetricsByTime(
    metrics: PerformanceMetrics[],
    granularity: 'hour' | 'day' | 'week'
  ): Map<number, PerformanceMetrics[]> {
    const buckets = new Map<number, PerformanceMetrics[]>()

    for (const metric of metrics) {
      const timestamp = this.getBucketTimestamp(metric.timestamp, granularity)
      const existing = buckets.get(timestamp) || []
      existing.push(metric)
      buckets.set(timestamp, existing)
    }

    return buckets
  }

  /**
   * Get bucket timestamp for grouping
   */
  private getBucketTimestamp(date: Date, granularity: 'hour' | 'day' | 'week'): number {
    const d = new Date(date)
    
    switch (granularity) {
      case 'hour':
        d.setMinutes(0, 0, 0)
        break
      case 'day':
        d.setHours(0, 0, 0, 0)
        break
      case 'week':
        const dayOfWeek = d.getDay()
        d.setDate(d.getDate() - dayOfWeek)
        d.setHours(0, 0, 0, 0)
        break
    }

    return d.getTime()
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(metrics: any, threshold: AlertThreshold): boolean {
    const value = this.getCurrentValue(metrics, threshold.metric)
    
    switch (threshold.operator) {
      case 'less_than':
        return value < threshold.value
      case 'greater_than':
        return value > threshold.value
      case 'equals':
        return Math.abs(value - threshold.value) < 0.001
      default:
        return false
    }
  }

  /**
   * Get current value for alert checking
   */
  private getCurrentValue(metrics: any, alertType: string): number {
    switch (alertType) {
      case 'success_rate_drop':
        return metrics.successRate
      case 'response_time_spike':
        return metrics.responseTime
      case 'cost_increase':
        return metrics.cost
      case 'satisfaction_drop':
        return metrics.userSatisfaction
      default:
        return 0
    }
  }

  /**
   * Build alert message
   */
  private buildAlertMessage(alertType: string, threshold: AlertThreshold, metrics: any): string {
    const currentValue = this.getCurrentValue(metrics, alertType)
    
    switch (alertType) {
      case 'success_rate_drop':
        return `Success rate dropped to ${(currentValue * 100).toFixed(1)}% (threshold: ${(threshold.value * 100).toFixed(1)}%)`
      case 'response_time_spike':
        return `Response time increased to ${(currentValue / 1000).toFixed(1)}s (threshold: ${(threshold.value / 1000).toFixed(1)}s)`
      case 'cost_increase':
        return `Cost increased to $${currentValue.toFixed(4)} (threshold: $${threshold.value.toFixed(4)})`
      case 'satisfaction_drop':
        return `User satisfaction dropped to ${currentValue.toFixed(1)}/5 (threshold: ${threshold.value.toFixed(1)}/5)`
      default:
        return `Performance alert triggered for ${alertType}`
    }
  }

  /**
   * Convert metrics to CSV format
   */
  private convertToCSV(metrics: PerformanceMetrics[]): string {
    if (metrics.length === 0) return ''

    const headers = [
      'timestamp', 'templateId', 'version', 'success', 'responseTime',
      'inputTokens', 'outputTokens', 'totalTokens', 'cost',
      'userSatisfactionScore', 'accuracyScore', 'relevanceScore',
      'taskType', 'modelUsed', 'inputComplexity'
    ]

    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.templateId,
      m.version,
      m.success,
      m.responseTime,
      m.tokenUsage.input,
      m.tokenUsage.output,
      m.tokenUsage.total,
      m.cost,
      m.userSatisfactionScore || '',
      m.accuracyScore || '',
      m.relevanceScore || '',
      m.taskType,
      m.modelUsed,
      m.inputComplexity,
    ])

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
  }

  /**
   * Initialize alert thresholds
   */
  private initializeAlertThresholds(): void {
    this.alertThresholds.set('success_rate_drop', {
      metric: 'success_rate_drop',
      operator: 'less_than',
      value: 0.7,
      severity: 'high',
    })

    this.alertThresholds.set('response_time_spike', {
      metric: 'response_time_spike',
      operator: 'greater_than',
      value: 15000, // 15 seconds
      severity: 'medium',
    })

    this.alertThresholds.set('cost_increase', {
      metric: 'cost_increase',
      operator: 'greater_than',
      value: 0.1, // $0.10
      severity: 'low',
    })

    this.alertThresholds.set('satisfaction_drop', {
      metric: 'satisfaction_drop',
      operator: 'less_than',
      value: 3.0,
      severity: 'high',
    })

    console.log('✅ Initialized alert thresholds')
  }

  /**
   * Start performance aggregation background process
   */
  private startPerformanceAggregation(): void {
    // In a real implementation, this would run periodically
    setInterval(() => {
      this.aggregatePerformanceData()
    }, 60000) // Every minute

    console.log('✅ Started performance aggregation')
  }

  /**
   * Aggregate performance data periodically
   */
  private aggregatePerformanceData(): void {
    // This would run aggregation for all templates
    // For now, just log that it's running
    console.log('🔄 Running performance aggregation...')
  }
}

// Supporting interfaces
interface AlertThreshold {
  metric: string
  operator: 'less_than' | 'greater_than' | 'equals'
  value: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface PerformanceBaseline {
  successRate: number
  averageResponseTime: number
  averageCost: number
  averageUserSatisfaction: number
  establishedAt: Date
}

interface VersionComparison {
  templateId: string
  versionA: string
  versionB: string
  comparison: 'better' | 'worse' | 'similar' | 'insufficient_data'
  metrics: Record<string, {
    versionA: number
    versionB: number
    improvement: number
  }>
  recommendations: string[]
}

interface PerformanceTrend {
  timestamp: Date
  successRate: number
  averageResponseTime: number
  averageUserSatisfaction: number
  averageCost: number
  requestCount: number
}

interface PerformanceRecommendation {
  type: string
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
}

// Export singleton instance
export const promptPerformanceTracking = new PromptPerformanceTracking()