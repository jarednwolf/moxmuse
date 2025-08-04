import { z } from 'zod'

// Performance metrics schemas
export const PerformanceMetricSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  metricType: z.enum([
    'response_time',
    'ai_processing_time',
    'database_query_time',
    'memory_usage',
    'cpu_usage',
    'error_rate',
    'user_satisfaction',
    'mobile_performance',
    'ai_accuracy'
  ]),
  value: z.number(),
  unit: z.string(),
  context: z.record(z.any()).optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  endpoint: z.string().optional(),
  userAgent: z.string().optional(),
})

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>

export const UserExperienceMetricSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  userId: z.string(),
  sessionId: z.string(),
  metricType: z.enum([
    'page_load_time',
    'time_to_interactive',
    'first_contentful_paint',
    'largest_contentful_paint',
    'cumulative_layout_shift',
    'first_input_delay',
    'task_completion_time',
    'user_satisfaction_score',
    'feature_usage_frequency',
    'error_recovery_time'
  ]),
  value: z.number(),
  context: z.object({
    page: z.string().optional(),
    feature: z.string().optional(),
    device: z.string().optional(),
    connection: z.string().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  }).optional(),
})

export type UserExperienceMetric = z.infer<typeof UserExperienceMetricSchema>

export const AIAccuracyMetricSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  aiTaskType: z.string(),
  modelUsed: z.string(),
  accuracy: z.number().min(0).max(1),
  userFeedback: z.enum(['positive', 'negative', 'neutral']).optional(),
  suggestionAccepted: z.boolean().optional(),
  responseTime: z.number(),
  confidence: z.number().min(0).max(1),
  context: z.object({
    deckId: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    promptVersion: z.string().optional(),
  }).optional(),
})

export type AIAccuracyMetric = z.infer<typeof AIAccuracyMetricSchema>

export const MobilePerformanceMetricSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  userId: z.string().optional(),
  sessionId: z.string(),
  device: z.object({
    type: z.enum(['mobile', 'tablet', 'desktop']),
    os: z.string(),
    browser: z.string(),
    screenSize: z.object({
      width: z.number(),
      height: z.number(),
    }),
    connection: z.string().optional(),
  }),
  metrics: z.object({
    touchResponseTime: z.number(),
    gestureRecognitionAccuracy: z.number().min(0).max(1),
    scrollPerformance: z.number(),
    batteryImpact: z.number().optional(),
    memoryUsage: z.number(),
    renderTime: z.number(),
  }),
  context: z.object({
    feature: z.string(),
    action: z.string(),
    duration: z.number(),
  }),
})

export type MobilePerformanceMetric = z.infer<typeof MobilePerformanceMetricSchema>

/**
 * Real-time performance monitoring system
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private uxMetrics: Map<string, UserExperienceMetric[]> = new Map()
  private aiMetrics: Map<string, AIAccuracyMetric[]> = new Map()
  private mobileMetrics: Map<string, MobilePerformanceMetric[]> = new Map()
  private alerts: PerformanceAlert[] = []
  private thresholds: PerformanceThresholds

  constructor() {
    this.thresholds = {
      responseTime: 2000, // 2 seconds
      aiProcessingTime: 10000, // 10 seconds
      errorRate: 0.05, // 5%
      userSatisfaction: 0.8, // 80%
      mobileResponseTime: 100, // 100ms for touch
      aiAccuracy: 0.7, // 70%
      memoryUsage: 100 * 1024 * 1024, // 100MB
    }

    console.log('📊 Performance Monitor initialized')
    this.startPeriodicReporting()
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      ...metric,
    }

    const key = `${metric.metricType}_${metric.userId || 'anonymous'}`
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    this.metrics.get(key)!.push(fullMetric)
    this.checkThresholds(fullMetric)
    
    // Keep only last 1000 metrics per key
    const metrics = this.metrics.get(key)!
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000)
    }

    console.log(`📈 Recorded ${metric.metricType}: ${metric.value}${metric.unit}`)
  }

  /**
   * Record user experience metric
   */
  recordUXMetric(metric: Omit<UserExperienceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: UserExperienceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      ...metric,
    }

    const key = `${metric.metricType}_${metric.userId}`
    if (!this.uxMetrics.has(key)) {
      this.uxMetrics.set(key, [])
    }
    
    this.uxMetrics.get(key)!.push(fullMetric)
    this.checkUXThresholds(fullMetric)
    
    console.log(`👤 Recorded UX metric ${metric.metricType}: ${metric.value}`)
  }

  /**
   * Record AI accuracy metric
   */
  recordAIAccuracy(metric: Omit<AIAccuracyMetric, 'id' | 'timestamp'>): void {
    const fullMetric: AIAccuracyMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      ...metric,
    }

    const key = `${metric.aiTaskType}_${metric.modelUsed}`
    if (!this.aiMetrics.has(key)) {
      this.aiMetrics.set(key, [])
    }
    
    this.aiMetrics.get(key)!.push(fullMetric)
    this.checkAIThresholds(fullMetric)
    
    console.log(`🤖 Recorded AI accuracy for ${metric.aiTaskType}: ${(metric.accuracy * 100).toFixed(1)}%`)
  }

  /**
   * Record mobile performance metric
   */
  recordMobilePerformance(metric: Omit<MobilePerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: MobilePerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      ...metric,
    }

    const key = `mobile_${metric.device.type}_${metric.context.feature}`
    if (!this.mobileMetrics.has(key)) {
      this.mobileMetrics.set(key, [])
    }
    
    this.mobileMetrics.get(key)!.push(fullMetric)
    this.checkMobileThresholds(fullMetric)
    
    console.log(`📱 Recorded mobile performance for ${metric.context.feature}: ${metric.metrics.touchResponseTime}ms`)
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeRange?: { start: Date; end: Date }): PerformanceSummary {
    const now = new Date()
    const start = timeRange?.start || new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
    const end = timeRange?.end || now

    const filteredMetrics = this.filterMetricsByTime(start, end)
    const filteredUXMetrics = this.filterUXMetricsByTime(start, end)
    const filteredAIMetrics = this.filterAIMetricsByTime(start, end)
    const filteredMobileMetrics = this.filterMobileMetricsByTime(start, end)

    return {
      timeRange: { start, end },
      overview: {
        totalRequests: filteredMetrics.length,
        averageResponseTime: this.calculateAverage(filteredMetrics, 'response_time'),
        errorRate: this.calculateErrorRate(filteredMetrics),
        userSatisfaction: this.calculateUserSatisfaction(filteredUXMetrics),
        aiAccuracy: this.calculateAIAccuracy(filteredAIMetrics),
        mobilePerformance: this.calculateMobilePerformance(filteredMobileMetrics),
      },
      breakdown: {
        responseTimePercentiles: this.calculatePercentiles(filteredMetrics, 'response_time'),
        topSlowEndpoints: this.getTopSlowEndpoints(filteredMetrics),
        aiModelPerformance: this.getAIModelPerformance(filteredAIMetrics),
        mobileDevicePerformance: this.getMobileDevicePerformance(filteredMobileMetrics),
        userExperienceBreakdown: this.getUserExperienceBreakdown(filteredUXMetrics),
      },
      alerts: this.getActiveAlerts(),
      recommendations: this.generateRecommendations(filteredMetrics, filteredUXMetrics, filteredAIMetrics),
    }
  }

  /**
   * Get real-time performance dashboard data
   */
  getRealTimeDashboard(): RealTimeDashboard {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000)
    const recentMetrics = this.filterMetricsByTime(last5Minutes, new Date())
    const recentUXMetrics = this.filterUXMetricsByTime(last5Minutes, new Date())
    const recentAIMetrics = this.filterAIMetricsByTime(last5Minutes, new Date())

    return {
      timestamp: new Date(),
      liveMetrics: {
        requestsPerMinute: this.calculateRequestsPerMinute(recentMetrics),
        averageResponseTime: this.calculateAverage(recentMetrics, 'response_time'),
        currentErrorRate: this.calculateErrorRate(recentMetrics),
        activeUsers: this.getActiveUserCount(recentUXMetrics),
        aiTasksInProgress: this.getAITasksInProgress(recentAIMetrics),
      },
      systemHealth: {
        status: this.getSystemHealthStatus(),
        cpuUsage: this.getCurrentCPUUsage(),
        memoryUsage: this.getCurrentMemoryUsage(),
        activeConnections: this.getActiveConnections(),
      },
      alerts: this.getActiveAlerts(),
      trends: {
        responseTimeTrend: this.getResponseTimeTrend(),
        errorRateTrend: this.getErrorRateTrend(),
        userSatisfactionTrend: this.getUserSatisfactionTrend(),
      },
    }
  }

  /**
   * Start A/B test for performance optimization
   */
  startPerformanceABTest(config: PerformanceABTestConfig): string {
    const testId = this.generateId()
    
    console.log(`🧪 Starting performance A/B test: ${config.name}`)
    
    // Implementation would track performance differences between variants
    return testId
  }

  /**
   * Get error tracking and recovery data
   */
  getErrorTrackingData(timeRange?: { start: Date; end: Date }): ErrorTrackingData {
    const now = new Date()
    const start = timeRange?.start || new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const end = timeRange?.end || now

    const errors = this.getErrorsInTimeRange(start, end)
    
    return {
      timeRange: { start, end },
      totalErrors: errors.length,
      errorsByType: this.groupErrorsByType(errors),
      errorsByEndpoint: this.groupErrorsByEndpoint(errors),
      recoveryTimes: this.calculateRecoveryTimes(errors),
      errorTrends: this.calculateErrorTrends(errors),
      criticalErrors: errors.filter(e => e.severity === 'critical'),
      recommendations: this.generateErrorRecommendations(errors),
    }
  }

  // Private helper methods
  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private checkThresholds(metric: PerformanceMetric): void {
    if (metric.metricType === 'response_time' && metric.value > this.thresholds.responseTime) {
      this.createAlert({
        type: 'performance',
        severity: 'warning',
        message: `High response time: ${metric.value}ms`,
        metric,
        threshold: this.thresholds.responseTime,
      })
    }

    if (metric.metricType === 'error_rate' && metric.value > this.thresholds.errorRate) {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: `High error rate: ${(metric.value * 100).toFixed(1)}%`,
        metric,
        threshold: this.thresholds.errorRate,
      })
    }
  }

  private checkUXThresholds(metric: UserExperienceMetric): void {
    if (metric.metricType === 'user_satisfaction_score' && metric.value < this.thresholds.userSatisfaction) {
      this.createAlert({
        type: 'user_experience',
        severity: 'warning',
        message: `Low user satisfaction: ${(metric.value * 100).toFixed(1)}%`,
        metric,
        threshold: this.thresholds.userSatisfaction,
      })
    }
  }

  private checkAIThresholds(metric: AIAccuracyMetric): void {
    if (metric.accuracy < this.thresholds.aiAccuracy) {
      this.createAlert({
        type: 'ai_performance',
        severity: 'warning',
        message: `Low AI accuracy for ${metric.aiTaskType}: ${(metric.accuracy * 100).toFixed(1)}%`,
        metric,
        threshold: this.thresholds.aiAccuracy,
      })
    }
  }

  private checkMobileThresholds(metric: MobilePerformanceMetric): void {
    if (metric.metrics.touchResponseTime > this.thresholds.mobileResponseTime) {
      this.createAlert({
        type: 'mobile_performance',
        severity: 'warning',
        message: `Slow mobile response: ${metric.metrics.touchResponseTime}ms`,
        metric,
        threshold: this.thresholds.mobileResponseTime,
      })
    }
  }

  private createAlert(alert: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): void {
    const fullAlert: PerformanceAlert = {
      id: this.generateId(),
      timestamp: new Date(),
      resolved: false,
      ...alert,
    }

    this.alerts.push(fullAlert)
    console.warn(`🚨 Performance alert: ${alert.message}`)

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100)
    }
  }

  private filterMetricsByTime(start: Date, end: Date): PerformanceMetric[] {
    const filtered: PerformanceMetric[] = []
    for (const metrics of this.metrics.values()) {
      filtered.push(...metrics.filter(m => m.timestamp >= start && m.timestamp <= end))
    }
    return filtered
  }

  private filterUXMetricsByTime(start: Date, end: Date): UserExperienceMetric[] {
    const filtered: UserExperienceMetric[] = []
    for (const metrics of this.uxMetrics.values()) {
      filtered.push(...metrics.filter(m => m.timestamp >= start && m.timestamp <= end))
    }
    return filtered
  }

  private filterAIMetricsByTime(start: Date, end: Date): AIAccuracyMetric[] {
    const filtered: AIAccuracyMetric[] = []
    for (const metrics of this.aiMetrics.values()) {
      filtered.push(...metrics.filter(m => m.timestamp >= start && m.timestamp <= end))
    }
    return filtered
  }

  private filterMobileMetricsByTime(start: Date, end: Date): MobilePerformanceMetric[] {
    const filtered: MobilePerformanceMetric[] = []
    for (const metrics of this.mobileMetrics.values()) {
      filtered.push(...metrics.filter(m => m.timestamp >= start && m.timestamp <= end))
    }
    return filtered
  }

  private calculateAverage(metrics: PerformanceMetric[], type: string): number {
    const filtered = metrics.filter(m => m.metricType === type)
    if (filtered.length === 0) return 0
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    const errorMetrics = metrics.filter(m => m.metricType === 'error_rate')
    if (errorMetrics.length === 0) return 0
    return errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length
  }

  private calculateUserSatisfaction(metrics: UserExperienceMetric[]): number {
    const satisfactionMetrics = metrics.filter(m => m.metricType === 'user_satisfaction_score')
    if (satisfactionMetrics.length === 0) return 0
    return satisfactionMetrics.reduce((sum, m) => sum + m.value, 0) / satisfactionMetrics.length
  }

  private calculateAIAccuracy(metrics: AIAccuracyMetric[]): number {
    if (metrics.length === 0) return 0
    return metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length
  }

  private calculateMobilePerformance(metrics: MobilePerformanceMetric[]): number {
    if (metrics.length === 0) return 0
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.metrics.touchResponseTime, 0) / metrics.length
    return Math.max(0, 1 - (avgResponseTime / this.thresholds.mobileResponseTime))
  }

  private calculatePercentiles(metrics: PerformanceMetric[], type: string): any {
    const values = metrics.filter(m => m.metricType === type).map(m => m.value).sort((a, b) => a - b)
    if (values.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 }

    return {
      p50: values[Math.floor(values.length * 0.5)],
      p90: values[Math.floor(values.length * 0.9)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    }
  }

  private getTopSlowEndpoints(metrics: PerformanceMetric[]): any[] {
    const endpointTimes = new Map<string, number[]>()
    
    metrics
      .filter(m => m.metricType === 'response_time' && m.endpoint)
      .forEach(m => {
        if (!endpointTimes.has(m.endpoint!)) {
          endpointTimes.set(m.endpoint!, [])
        }
        endpointTimes.get(m.endpoint!)!.push(m.value)
      })

    return Array.from(endpointTimes.entries())
      .map(([endpoint, times]) => ({
        endpoint,
        averageTime: times.reduce((sum, t) => sum + t, 0) / times.length,
        requestCount: times.length,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
  }

  private getAIModelPerformance(metrics: AIAccuracyMetric[]): any[] {
    const modelPerformance = new Map<string, { accuracy: number[]; responseTime: number[] }>()
    
    metrics.forEach(m => {
      if (!modelPerformance.has(m.modelUsed)) {
        modelPerformance.set(m.modelUsed, { accuracy: [], responseTime: [] })
      }
      const perf = modelPerformance.get(m.modelUsed)!
      perf.accuracy.push(m.accuracy)
      perf.responseTime.push(m.responseTime)
    })

    return Array.from(modelPerformance.entries())
      .map(([model, data]) => ({
        model,
        averageAccuracy: data.accuracy.reduce((sum, a) => sum + a, 0) / data.accuracy.length,
        averageResponseTime: data.responseTime.reduce((sum, t) => sum + t, 0) / data.responseTime.length,
        taskCount: data.accuracy.length,
      }))
      .sort((a, b) => b.averageAccuracy - a.averageAccuracy)
  }

  private getMobileDevicePerformance(metrics: MobilePerformanceMetric[]): any[] {
    const devicePerformance = new Map<string, MobilePerformanceMetric[]>()
    
    metrics.forEach(m => {
      const key = `${m.device.type}_${m.device.os}`
      if (!devicePerformance.has(key)) {
        devicePerformance.set(key, [])
      }
      devicePerformance.get(key)!.push(m)
    })

    return Array.from(devicePerformance.entries())
      .map(([device, data]) => ({
        device,
        averageResponseTime: data.reduce((sum, d) => sum + d.metrics.touchResponseTime, 0) / data.length,
        averageMemoryUsage: data.reduce((sum, d) => sum + d.metrics.memoryUsage, 0) / data.length,
        gestureAccuracy: data.reduce((sum, d) => sum + d.metrics.gestureRecognitionAccuracy, 0) / data.length,
        sampleCount: data.length,
      }))
      .sort((a, b) => a.averageResponseTime - b.averageResponseTime)
  }

  private getUserExperienceBreakdown(metrics: UserExperienceMetric[]): any {
    const breakdown = {
      pageLoadTimes: [] as number[],
      timeToInteractive: [] as number[],
      taskCompletionTimes: [] as number[],
      satisfactionScores: [] as number[],
    }

    metrics.forEach(m => {
      switch (m.metricType) {
        case 'page_load_time':
          breakdown.pageLoadTimes.push(m.value)
          break
        case 'time_to_interactive':
          breakdown.timeToInteractive.push(m.value)
          break
        case 'task_completion_time':
          breakdown.taskCompletionTimes.push(m.value)
          break
        case 'user_satisfaction_score':
          breakdown.satisfactionScores.push(m.value)
          break
      }
    })

    return {
      averagePageLoadTime: this.average(breakdown.pageLoadTimes),
      averageTimeToInteractive: this.average(breakdown.timeToInteractive),
      averageTaskCompletionTime: this.average(breakdown.taskCompletionTimes),
      averageSatisfactionScore: this.average(breakdown.satisfactionScores),
    }
  }

  private getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved)
  }

  private generateRecommendations(
    metrics: PerformanceMetric[],
    uxMetrics: UserExperienceMetric[],
    aiMetrics: AIAccuracyMetric[]
  ): string[] {
    const recommendations: string[] = []

    const avgResponseTime = this.calculateAverage(metrics, 'response_time')
    if (avgResponseTime > this.thresholds.responseTime) {
      recommendations.push('Consider implementing response caching or optimizing database queries')
    }

    const aiAccuracy = this.calculateAIAccuracy(aiMetrics)
    if (aiAccuracy < this.thresholds.aiAccuracy) {
      recommendations.push('Review AI prompt templates and consider model fine-tuning')
    }

    const userSatisfaction = this.calculateUserSatisfaction(uxMetrics)
    if (userSatisfaction < this.thresholds.userSatisfaction) {
      recommendations.push('Focus on improving user experience and interface responsiveness')
    }

    return recommendations
  }

  private startPeriodicReporting(): void {
    setInterval(() => {
      const summary = this.getPerformanceSummary()
      console.log(`📊 Performance Summary - Avg Response: ${summary.overview.averageResponseTime.toFixed(0)}ms, Error Rate: ${(summary.overview.errorRate * 100).toFixed(1)}%`)
    }, 60000) // Every minute
  }

  // Additional helper methods
  private calculateRequestsPerMinute(metrics: PerformanceMetric[]): number {
    return metrics.length / 5 // 5-minute window
  }

  private getActiveUserCount(metrics: UserExperienceMetric[]): number {
    const uniqueUsers = new Set(metrics.map(m => m.userId))
    return uniqueUsers.size
  }

  private getAITasksInProgress(metrics: AIAccuracyMetric[]): number {
    // This would track active AI tasks in a real implementation
    return metrics.length
  }

  private getSystemHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const activeAlerts = this.getActiveAlerts()
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical')
    
    if (criticalAlerts.length > 0) return 'critical'
    if (activeAlerts.length > 5) return 'warning'
    return 'healthy'
  }

  private getCurrentCPUUsage(): number {
    // Mock implementation - would use actual system monitoring
    return Math.random() * 100
  }

  private getCurrentMemoryUsage(): number {
    // Mock implementation - would use actual system monitoring
    return Math.random() * this.thresholds.memoryUsage
  }

  private getActiveConnections(): number {
    // Mock implementation - would track actual connections
    return Math.floor(Math.random() * 1000)
  }

  private getResponseTimeTrend(): number[] {
    // Mock implementation - would calculate actual trend
    return Array.from({ length: 10 }, () => Math.random() * 3000)
  }

  private getErrorRateTrend(): number[] {
    // Mock implementation - would calculate actual trend
    return Array.from({ length: 10 }, () => Math.random() * 0.1)
  }

  private getUserSatisfactionTrend(): number[] {
    // Mock implementation - would calculate actual trend
    return Array.from({ length: 10 }, () => 0.7 + Math.random() * 0.3)
  }

  private getErrorsInTimeRange(start: Date, end: Date): any[] {
    // Mock implementation - would get actual errors
    return []
  }

  private groupErrorsByType(errors: any[]): Record<string, number> {
    return {}
  }

  private groupErrorsByEndpoint(errors: any[]): Record<string, number> {
    return {}
  }

  private calculateRecoveryTimes(errors: any[]): number[] {
    return []
  }

  private calculateErrorTrends(errors: any[]): any {
    return {}
  }

  private generateErrorRecommendations(errors: any[]): string[] {
    return []
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }
}

// Type definitions
interface PerformanceThresholds {
  responseTime: number
  aiProcessingTime: number
  errorRate: number
  userSatisfaction: number
  mobileResponseTime: number
  aiAccuracy: number
  memoryUsage: number
}

interface PerformanceAlert {
  id: string
  timestamp: Date
  type: 'performance' | 'error' | 'user_experience' | 'ai_performance' | 'mobile_performance'
  severity: 'info' | 'warning' | 'critical'
  message: string
  metric: any
  threshold: number
  resolved: boolean
}

interface PerformanceSummary {
  timeRange: { start: Date; end: Date }
  overview: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    userSatisfaction: number
    aiAccuracy: number
    mobilePerformance: number
  }
  breakdown: {
    responseTimePercentiles: any
    topSlowEndpoints: any[]
    aiModelPerformance: any[]
    mobileDevicePerformance: any[]
    userExperienceBreakdown: any
  }
  alerts: PerformanceAlert[]
  recommendations: string[]
}

interface RealTimeDashboard {
  timestamp: Date
  liveMetrics: {
    requestsPerMinute: number
    averageResponseTime: number
    currentErrorRate: number
    activeUsers: number
    aiTasksInProgress: number
  }
  systemHealth: {
    status: 'healthy' | 'warning' | 'critical'
    cpuUsage: number
    memoryUsage: number
    activeConnections: number
  }
  alerts: PerformanceAlert[]
  trends: {
    responseTimeTrend: number[]
    errorRateTrend: number[]
    userSatisfactionTrend: number[]
  }
}

interface PerformanceABTestConfig {
  name: string
  description: string
  variants: Array<{
    id: string
    name: string
    trafficAllocation: number
  }>
  metrics: string[]
  duration: number
}

interface ErrorTrackingData {
  timeRange: { start: Date; end: Date }
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByEndpoint: Record<string, number>
  recoveryTimes: number[]
  errorTrends: any
  criticalErrors: any[]
  recommendations: string[]
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

console.log('📊 Performance Monitor service initialized')