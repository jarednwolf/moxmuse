import { sentryService } from './SentryService'

export interface MetricData {
  name: string
  value: number
  unit?: 'milliseconds' | 'count' | 'bytes' | 'percentage'
  tags?: Record<string, string>
  timestamp?: Date
}

export interface AlertRule {
  metricName: string
  threshold: number
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  windowMinutes: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export interface SystemMetrics {
  // Performance metrics
  responseTime: number
  throughput: number
  errorRate: number
  
  // Resource metrics
  memoryUsage: number
  cpuUsage: number
  
  // Business metrics
  activeUsers: number
  deckGenerations: number
  successRate: number
  
  timestamp: Date
}

export class MetricsService {
  private static instance: MetricsService
  private metrics: Map<string, MetricData[]> = new Map()
  private alertRules: AlertRule[] = []
  private alertCooldowns: Map<string, Date> = new Map()

  private constructor() {
    this.setupDefaultAlertRules()
    this.startMetricsCollection()
  }

  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService()
    }
    return MetricsService.instance
  }

  recordMetric(data: MetricData): void {
    const key = data.name
    const timestamp = data.timestamp || new Date()
    
    const metricWithTimestamp = {
      ...data,
      timestamp,
    }

    // Store metric
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    
    const metricHistory = this.metrics.get(key)!
    metricHistory.push(metricWithTimestamp)
    
    // Keep only last 1000 entries per metric
    if (metricHistory.length > 1000) {
      metricHistory.shift()
    }

    // Send to Sentry for monitoring
    sentryService.recordPerformance({
      operation: data.name,
      duration: data.value,
      tags: data.tags,
      metadata: {
        unit: data.unit,
        timestamp: timestamp.toISOString(),
      },
    })

    // Check alert rules
    this.checkAlertRules(data)

    // Log important metrics
    if (this.isImportantMetric(data.name)) {
      console.log(`Metric [${data.name}]: ${data.value}${data.unit ? ` ${data.unit}` : ''}`, data.tags)
    }
  }

  recordResponseTime(operation: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name: `response_time.${operation}`,
      value: duration,
      unit: 'milliseconds',
      tags: {
        operation,
        ...tags,
      },
    })
  }

  recordError(operation: string, errorType: string, tags?: Record<string, string>): void {
    this.recordMetric({
      name: `error.${operation}`,
      value: 1,
      unit: 'count',
      tags: {
        operation,
        errorType,
        ...tags,
      },
    })
  }

  recordBusinessMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name: `business.${name}`,
      value,
      unit: 'count',
      tags,
    })
  }

  getMetrics(metricName: string, windowMinutes: number = 60): MetricData[] {
    const metrics = this.metrics.get(metricName) || []
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000)
    
    return metrics.filter(metric => metric.timestamp! >= cutoff)
  }

  getAverageMetric(metricName: string, windowMinutes: number = 60): number {
    const metrics = this.getMetrics(metricName, windowMinutes)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
    return sum / metrics.length
  }

  getSystemMetrics(): SystemMetrics {
    const now = new Date()
    
    return {
      responseTime: this.getAverageMetric('response_time.deck_generation', 15),
      throughput: this.getMetrics('business.deck_generation', 60).length,
      errorRate: this.calculateErrorRate(),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0, // Would need system monitoring for real CPU usage
      activeUsers: this.getMetrics('business.active_user', 60).length,
      deckGenerations: this.getMetrics('business.deck_generation', 60).length,
      successRate: this.calculateSuccessRate(),
      timestamp: now,
    }
  }

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        metricName: 'response_time.deck_generation',
        threshold: 120000, // 2 minutes
        operator: 'gt',
        windowMinutes: 15,
        severity: 'high',
        description: 'Deck generation response time is too high',
      },
      {
        metricName: 'error_rate',
        threshold: 0.05, // 5%
        operator: 'gt',
        windowMinutes: 15,
        severity: 'medium',
        description: 'Error rate is above acceptable threshold',
      },
      {
        metricName: 'memory_usage',
        threshold: 0.85, // 85%
        operator: 'gt',
        windowMinutes: 5,
        severity: 'high',
        description: 'Memory usage is critically high',
      },
      {
        metricName: 'business.deck_generation',
        threshold: 0,
        operator: 'eq',
        windowMinutes: 30,
        severity: 'critical',
        description: 'No deck generations in the last 30 minutes',
      },
    ]
  }

  private checkAlertRules(metric: MetricData): void {
    const relevantRules = this.alertRules.filter(rule => 
      metric.name.includes(rule.metricName) || rule.metricName === 'error_rate'
    )

    for (const rule of relevantRules) {
      const alertKey = `${rule.metricName}_${rule.severity}`
      const lastAlert = this.alertCooldowns.get(alertKey)
      
      // Check cooldown (don't spam alerts)
      if (lastAlert && Date.now() - lastAlert.getTime() < 15 * 60 * 1000) {
        continue
      }

      let shouldAlert = false
      let currentValue = metric.value

      // For error rate, calculate it specially
      if (rule.metricName === 'error_rate') {
        currentValue = this.calculateErrorRate()
      }

      // Check threshold
      switch (rule.operator) {
        case 'gt':
          shouldAlert = currentValue > rule.threshold
          break
        case 'lt':
          shouldAlert = currentValue < rule.threshold
          break
        case 'gte':
          shouldAlert = currentValue >= rule.threshold
          break
        case 'lte':
          shouldAlert = currentValue <= rule.threshold
          break
        case 'eq':
          shouldAlert = currentValue === rule.threshold
          break
      }

      if (shouldAlert) {
        this.triggerAlert(rule, currentValue)
        this.alertCooldowns.set(alertKey, new Date())
      }
    }
  }

  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alertMessage = `ALERT [${rule.severity.toUpperCase()}]: ${rule.description}. Current value: ${currentValue}, Threshold: ${rule.threshold}`
    
    console.error(alertMessage)
    
    sentryService.captureMessage(alertMessage, 'error', {
      component: 'MetricsService',
      action: 'alert',
      metadata: {
        rule,
        currentValue,
        severity: rule.severity,
      },
    })

    // In production, you might want to send to Slack, PagerDuty, etc.
    if (process.env.NODE_ENV === 'production' && process.env.SLACK_WEBHOOK_URL) {
      this.sendSlackAlert(rule, currentValue)
    }
  }

  private async sendSlackAlert(rule: AlertRule, currentValue: number): Promise<void> {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL!
      const color = this.getSeverityColor(rule.severity)
      
      const payload = {
        attachments: [
          {
            color,
            title: `🚨 ${rule.severity.toUpperCase()} Alert`,
            text: rule.description,
            fields: [
              {
                title: 'Metric',
                value: rule.metricName,
                short: true,
              },
              {
                title: 'Current Value',
                value: currentValue.toString(),
                short: true,
              },
              {
                title: 'Threshold',
                value: rule.threshold.toString(),
                short: true,
              },
              {
                title: 'Environment',
                value: process.env.NODE_ENV || 'unknown',
                short: true,
              },
            ],
            timestamp: Math.floor(Date.now() / 1000),
          },
        ],
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      console.error('Failed to send Slack alert:', error)
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ff0000'
      case 'high': return '#ff6600'
      case 'medium': return '#ffcc00'
      case 'low': return '#00ff00'
      default: return '#cccccc'
    }
  }

  private calculateErrorRate(): number {
    const errors = this.getMetrics('error', 15)
    const total = this.getMetrics('request', 15)
    
    if (total.length === 0) return 0
    return errors.length / total.length
  }

  private calculateSuccessRate(): number {
    const errorRate = this.calculateErrorRate()
    return Math.max(0, 1 - errorRate)
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return usage.heapUsed / usage.heapTotal
    }
    return 0
  }

  private isImportantMetric(metricName: string): boolean {
    const importantMetrics = [
      'response_time.deck_generation',
      'business.deck_generation',
      'error',
      'memory_usage',
    ]
    
    return importantMetrics.some(important => metricName.includes(important))
  }

  private startMetricsCollection(): void {
    // Collect system metrics every minute
    setInterval(() => {
      const memoryUsage = this.getMemoryUsage()
      this.recordMetric({
        name: 'memory_usage',
        value: memoryUsage,
        unit: 'percentage',
      })
    }, 60000)

    // Collect business metrics every 5 minutes
    setInterval(() => {
      const systemMetrics = this.getSystemMetrics()
      
      this.recordMetric({
        name: 'system.throughput',
        value: systemMetrics.throughput,
        unit: 'count',
      })
      
      this.recordMetric({
        name: 'system.success_rate',
        value: systemMetrics.successRate,
        unit: 'percentage',
      })
    }, 5 * 60000)
  }
}

// Export singleton instance
export const metricsService = MetricsService.getInstance()