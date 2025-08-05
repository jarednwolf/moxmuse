import { PrismaClient } from '@moxmuse/db'
import { performance } from 'perf_hooks'

/**
 * Comprehensive error monitoring and alerting system
 * Tracks errors, generates alerts, and provides insights for system health
 */

export interface ErrorEvent {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'critical'
  category: 'api' | 'database' | 'ai' | 'auth' | 'network' | 'validation' | 'business'
  operation: string
  message: string
  stack?: string
  context: {
    userId?: string
    sessionId?: string
    requestId?: string
    userAgent?: string
    ipAddress?: string
    metadata?: Record<string, any>
  }
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  tags: string[]
}

export interface ErrorPattern {
  pattern: string
  count: number
  firstSeen: Date
  lastSeen: Date
  affectedUsers: Set<string>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface AlertRule {
  id: string
  name: string
  condition: {
    errorCount?: number
    timeWindow?: number // milliseconds
    errorRate?: number // percentage
    categories?: string[]
    levels?: string[]
    pattern?: string
  }
  actions: {
    email?: string[]
    webhook?: string
    slack?: string
    createTicket?: boolean
  }
  enabled: boolean
  cooldown: number // milliseconds between alerts
  lastTriggered?: Date
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  errorRate: number
  responseTime: number
  uptime: number
  activeErrors: number
  resolvedErrors: number
  categories: Record<string, {
    count: number
    rate: number
    trend: 'increasing' | 'stable' | 'decreasing'
  }>
}

/**
 * Error aggregation and pattern detection
 */
export class ErrorAggregator {
  private patterns = new Map<string, ErrorPattern>()
  private recentErrors: ErrorEvent[] = []
  private maxRecentErrors = 1000

  addError(error: ErrorEvent): void {
    // Add to recent errors
    this.recentErrors.push(error)
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift()
    }

    // Update patterns
    this.updatePatterns(error)
  }

  private updatePatterns(error: ErrorEvent): void {
    // Create pattern key from error characteristics
    const patternKey = this.createPatternKey(error)
    
    let pattern = this.patterns.get(patternKey)
    if (!pattern) {
      pattern = {
        pattern: patternKey,
        count: 0,
        firstSeen: error.timestamp,
        lastSeen: error.timestamp,
        affectedUsers: new Set(),
        severity: this.calculateSeverity(error)
      }
      this.patterns.set(patternKey, pattern)
    }

    pattern.count++
    pattern.lastSeen = error.timestamp
    if (error.context.userId) {
      pattern.affectedUsers.add(error.context.userId)
    }
    
    // Update severity based on frequency and impact
    pattern.severity = this.calculatePatternSeverity(pattern)
  }

  private createPatternKey(error: ErrorEvent): string {
    // Create a pattern key that groups similar errors
    const operation = error.operation
    const category = error.category
    const messagePattern = this.extractMessagePattern(error.message)
    
    return `${category}:${operation}:${messagePattern}`
  }

  private extractMessagePattern(message: string): string {
    // Extract pattern from error message by replacing variable parts
    return message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/\b\w+@\w+\.\w+\b/g, 'EMAIL') // Replace emails
      .replace(/\/\w+/g, '/PATH') // Replace path segments
      .substring(0, 100) // Limit length
  }

  private calculateSeverity(error: ErrorEvent): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.level) {
      case 'critical':
        return 'critical'
      case 'error':
        return error.category === 'auth' || error.category === 'database' ? 'high' : 'medium'
      case 'warn':
        return 'low'
      default:
        return 'low'
    }
  }

  private calculatePatternSeverity(pattern: ErrorPattern): 'low' | 'medium' | 'high' | 'critical' {
    const hoursSinceFirst = (Date.now() - pattern.firstSeen.getTime()) / (1000 * 60 * 60)
    const frequency = pattern.count / Math.max(hoursSinceFirst, 1)
    const userImpact = pattern.affectedUsers.size

    if (frequency > 10 || userImpact > 50) return 'critical'
    if (frequency > 5 || userImpact > 20) return 'high'
    if (frequency > 1 || userImpact > 5) return 'medium'
    return 'low'
  }

  getPatterns(): ErrorPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.count - a.count)
  }

  getRecentErrors(minutes: number = 60): ErrorEvent[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000)
    return this.recentErrors.filter(error => error.timestamp >= cutoff)
  }

  getErrorRate(minutes: number = 60): number {
    const recentErrors = this.getRecentErrors(minutes)
    return recentErrors.length / minutes // errors per minute
  }

  clearOldData(hours: number = 24): void {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    // Clear old recent errors
    this.recentErrors = this.recentErrors.filter(error => error.timestamp >= cutoff)
    
    // Clear old patterns
    for (const [key, pattern] of this.patterns.entries()) {
      if (pattern.lastSeen < cutoff) {
        this.patterns.delete(key)
      }
    }
  }
}

/**
 * Alert management system
 */
export class AlertManager {
  private rules: AlertRule[] = []
  private alertHistory: Array<{
    ruleId: string
    timestamp: Date
    triggered: boolean
    context: any
  }> = []

  constructor(private errorAggregator: ErrorAggregator) {
    this.setupDefaultRules()
  }

  private setupDefaultRules(): void {
    this.rules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: {
          errorRate: 10, // 10 errors per minute
          timeWindow: 5 * 60 * 1000 // 5 minutes
        },
        actions: {
          webhook: process.env.ALERT_WEBHOOK_URL,
          createTicket: true
        },
        enabled: true,
        cooldown: 15 * 60 * 1000 // 15 minutes
      },
      {
        id: 'critical-errors',
        name: 'Critical Errors',
        condition: {
          errorCount: 1,
          levels: ['critical'],
          timeWindow: 60 * 1000 // 1 minute
        },
        actions: {
          webhook: process.env.ALERT_WEBHOOK_URL,
          createTicket: true
        },
        enabled: true,
        cooldown: 5 * 60 * 1000 // 5 minutes
      },
      {
        id: 'database-errors',
        name: 'Database Errors',
        condition: {
          errorCount: 5,
          categories: ['database'],
          timeWindow: 10 * 60 * 1000 // 10 minutes
        },
        actions: {
          webhook: process.env.ALERT_WEBHOOK_URL
        },
        enabled: true,
        cooldown: 10 * 60 * 1000 // 10 minutes
      },
      {
        id: 'ai-service-errors',
        name: 'AI Service Errors',
        condition: {
          errorCount: 10,
          categories: ['ai'],
          timeWindow: 15 * 60 * 1000 // 15 minutes
        },
        actions: {
          webhook: process.env.ALERT_WEBHOOK_URL
        },
        enabled: true,
        cooldown: 20 * 60 * 1000 // 20 minutes
      }
    ]
  }

  checkAlerts(): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue
      
      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue
      }

      if (this.evaluateRule(rule)) {
        this.triggerAlert(rule)
      }
    }
  }

  private evaluateRule(rule: AlertRule): boolean {
    const { condition } = rule
    const timeWindow = condition.timeWindow || 60 * 1000 // Default 1 minute
    const recentErrors = this.errorAggregator.getRecentErrors(timeWindow / (60 * 1000))

    // Filter errors based on conditions
    let filteredErrors = recentErrors

    if (condition.categories) {
      filteredErrors = filteredErrors.filter(error => 
        condition.categories!.includes(error.category)
      )
    }

    if (condition.levels) {
      filteredErrors = filteredErrors.filter(error => 
        condition.levels!.includes(error.level)
      )
    }

    if (condition.pattern) {
      const regex = new RegExp(condition.pattern, 'i')
      filteredErrors = filteredErrors.filter(error => 
        regex.test(error.message) || regex.test(error.operation)
      )
    }

    // Check error count
    if (condition.errorCount && filteredErrors.length >= condition.errorCount) {
      return true
    }

    // Check error rate
    if (condition.errorRate) {
      const rate = filteredErrors.length / (timeWindow / (60 * 1000)) // errors per minute
      if (rate >= condition.errorRate) {
        return true
      }
    }

    return false
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    console.warn(`🚨 Alert triggered: ${rule.name}`)
    
    rule.lastTriggered = new Date()
    
    const context = {
      rule: rule.name,
      timestamp: new Date(),
      recentErrors: this.errorAggregator.getRecentErrors(5),
      patterns: this.errorAggregator.getPatterns().slice(0, 5)
    }

    this.alertHistory.push({
      ruleId: rule.id,
      timestamp: new Date(),
      triggered: true,
      context
    })

    // Execute alert actions
    if (rule.actions.webhook) {
      await this.sendWebhookAlert(rule, context)
    }

    if (rule.actions.email) {
      await this.sendEmailAlert(rule, context)
    }

    if (rule.actions.slack) {
      await this.sendSlackAlert(rule, context)
    }

    if (rule.actions.createTicket) {
      await this.createSupportTicket(rule, context)
    }
  }

  private async sendWebhookAlert(rule: AlertRule, context: any): Promise<void> {
    try {
      if (!rule.actions.webhook) return

      const payload = {
        alert: rule.name,
        severity: this.getAlertSeverity(rule),
        timestamp: new Date().toISOString(),
        context: {
          errorCount: context.recentErrors.length,
          topPatterns: context.patterns.map((p: any) => ({
            pattern: p.pattern,
            count: p.count,
            severity: p.severity
          }))
        }
      }

      // In production, send actual webhook
      console.log('Would send webhook alert:', payload)
    } catch (error) {
      console.error('Failed to send webhook alert:', error)
    }
  }

  private async sendEmailAlert(rule: AlertRule, context: any): Promise<void> {
    // Email alert implementation
    console.log('Would send email alert for:', rule.name)
  }

  private async sendSlackAlert(rule: AlertRule, context: any): Promise<void> {
    // Slack alert implementation
    console.log('Would send Slack alert for:', rule.name)
  }

  private async createSupportTicket(rule: AlertRule, context: any): Promise<void> {
    // Support ticket creation implementation
    console.log('Would create support ticket for:', rule.name)
  }

  private getAlertSeverity(rule: AlertRule): string {
    if (rule.condition.levels?.includes('critical')) return 'critical'
    if (rule.condition.errorRate && rule.condition.errorRate > 20) return 'high'
    if (rule.condition.categories?.includes('database')) return 'high'
    return 'medium'
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule)
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId)
  }

  getAlertHistory(hours: number = 24): typeof this.alertHistory {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.alertHistory.filter(alert => alert.timestamp >= cutoff)
  }
}

/**
 * Main error monitoring service
 */
export class ErrorMonitoringService {
  private errorAggregator = new ErrorAggregator()
  private alertManager = new AlertManager(this.errorAggregator)
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor(private prisma: PrismaClient) {
    this.startMonitoring()
  }

  logError(error: Partial<ErrorEvent>): void {
    const errorEvent: ErrorEvent = {
      id: error.id || this.generateId(),
      timestamp: error.timestamp || new Date(),
      level: error.level || 'error',
      category: error.category || 'api',
      operation: error.operation || 'unknown',
      message: error.message || 'Unknown error',
      stack: error.stack,
      context: error.context || {},
      resolved: false,
      tags: error.tags || []
    }

    // Add to aggregator
    this.errorAggregator.addError(errorEvent)

    // Store in database
    this.storeError(errorEvent)

    // Log to console based on level
    this.logToConsole(errorEvent)
  }

  private async storeError(error: ErrorEvent): Promise<void> {
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: `error_${error.category}_${error.operation}`,
          duration: 0,
          success: false,
          timestamp: error.timestamp,
          userId: error.context.userId,
          metadata: {
            errorId: error.id,
            level: error.level,
            category: error.category,
            message: error.message,
            stack: error.stack,
            context: error.context,
            tags: error.tags
          }
        }
      })
    } catch (dbError) {
      console.error('Failed to store error in database:', dbError)
    }
  }

  private logToConsole(error: ErrorEvent): void {
    const logData = {
      id: error.id,
      operation: error.operation,
      message: error.message,
      context: error.context
    }

    switch (error.level) {
      case 'critical':
        console.error('🚨 CRITICAL ERROR:', logData)
        break
      case 'error':
        console.error('❌ ERROR:', logData)
        break
      case 'warn':
        console.warn('⚠️ WARNING:', logData)
        break
      case 'info':
        console.info('ℹ️ INFO:', logData)
        break
    }
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startMonitoring(): void {
    // Check alerts every minute
    this.monitoringInterval = setInterval(() => {
      this.alertManager.checkAlerts()
      this.errorAggregator.clearOldData()
    }, 60 * 1000)
  }

  getSystemHealth(): SystemHealth {
    const recentErrors = this.errorAggregator.getRecentErrors(60)
    const patterns = this.errorAggregator.getPatterns()
    
    // Calculate error rate
    const errorRate = this.errorAggregator.getErrorRate(60)
    
    // Determine overall status
    let status: SystemHealth['status'] = 'healthy'
    if (errorRate > 20 || recentErrors.some(e => e.level === 'critical')) {
      status = 'critical'
    } else if (errorRate > 10 || recentErrors.filter(e => e.level === 'error').length > 5) {
      status = 'degraded'
    }

    // Calculate category statistics
    const categories: SystemHealth['categories'] = {}
    for (const error of recentErrors) {
      if (!categories[error.category]) {
        categories[error.category] = { count: 0, rate: 0, trend: 'stable' }
      }
      categories[error.category].count++
    }

    // Calculate rates and trends
    for (const [category, stats] of Object.entries(categories)) {
      stats.rate = stats.count / 60 // per minute
      // Simplified trend calculation
      stats.trend = stats.rate > 1 ? 'increasing' : 'stable'
    }

    return {
      status,
      errorRate,
      responseTime: 0, // Would be calculated from actual metrics
      uptime: process.uptime(),
      activeErrors: recentErrors.length,
      resolvedErrors: 0, // Would track resolved errors
      categories
    }
  }

  getErrorPatterns(): ErrorPattern[] {
    return this.errorAggregator.getPatterns()
  }

  getRecentErrors(minutes: number = 60): ErrorEvent[] {
    return this.errorAggregator.getRecentErrors(minutes)
  }

  getAlertHistory(hours: number = 24): any[] {
    return this.alertManager.getAlertHistory(hours)
  }

  resolveError(errorId: string, resolvedBy: string): void {
    // Mark error as resolved
    console.log(`Error ${errorId} resolved by ${resolvedBy}`)
  }

  addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule)
  }

  removeAlertRule(ruleId: string): void {
    this.alertManager.removeRule(ruleId)
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}

// Export singleton instance creator
export const createErrorMonitoringService = (prisma: PrismaClient) => {
  return new ErrorMonitoringService(prisma)
}

// Utility functions for common error logging
export const logApiError = (
  service: ErrorMonitoringService,
  operation: string,
  error: Error,
  context: Partial<ErrorEvent['context']> = {}
) => {
  service.logError({
    level: 'error',
    category: 'api',
    operation,
    message: error.message,
    stack: error.stack,
    context,
    tags: ['api', operation]
  })
}

export const logDatabaseError = (
  service: ErrorMonitoringService,
  operation: string,
  error: Error,
  context: Partial<ErrorEvent['context']> = {}
) => {
  service.logError({
    level: 'error',
    category: 'database',
    operation,
    message: error.message,
    stack: error.stack,
    context,
    tags: ['database', operation]
  })
}

export const logAIError = (
  service: ErrorMonitoringService,
  operation: string,
  error: Error,
  context: Partial<ErrorEvent['context']> = {}
) => {
  service.logError({
    level: 'error',
    category: 'ai',
    operation,
    message: error.message,
    stack: error.stack,
    context,
    tags: ['ai', operation]
  })
}