/**
 * Error Tracking Service
 * 
 * Centralized error tracking and monitoring
 * for application-wide error visibility.
 */

import { logger } from '../core/logging'
import { performanceMonitor } from '../core/performance-monitor'

interface ErrorRecord {
  id: string
  timestamp: Date
  severity: 'error' | 'warning' | 'info'
  source: string
  message: string
  stack?: string
  userId?: string
  metadata?: Record<string, any>
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: string
  occurrences: number
}

interface ErrorSummary {
  totalErrors: number
  errorsBySeverity: Record<string, number>
  errorsBySource: Record<string, number>
  topErrors: {
    message: string
    source: string
    count: number
    lastOccurrence: Date
  }[]
  errorRate: number
  resolutionRate: number
}

interface ErrorFilter {
  severity?: 'error' | 'warning' | 'info'
  source?: string
  resolved?: boolean
  userId?: string
  timeRange?: {
    start: Date
    end: Date
  }
}

export class ErrorTracker {
  private errors: ErrorRecord[] = []
  private errorPatterns = new Map<string, ErrorRecord>()
  private logger = logger.child({ service: 'ErrorTracker' })

  async trackError(error: Omit<ErrorRecord, 'id' | 'timestamp' | 'resolved' | 'occurrences'>): Promise<void> {
    const errorKey = this.getErrorKey(error.message, error.source)
    const existingError = this.errorPatterns.get(errorKey)

    if (existingError) {
      // Increment occurrence count for existing error pattern
      existingError.occurrences++
      existingError.timestamp = new Date() // Update last occurrence
      if (error.userId) {
        existingError.userId = error.userId // Update with latest user
      }
    } else {
      // Create new error record
      const newError: ErrorRecord = {
        id: this.generateId(),
        timestamp: new Date(),
        resolved: false,
        occurrences: 1,
        ...error
      }

      this.errors.push(newError)
      this.errorPatterns.set(errorKey, newError)

      // Keep only recent errors to prevent memory issues
      if (this.errors.length > 10000) {
        this.errors = this.errors.slice(-10000)
      }
    }

    // Log the error
    const logMethod = error.severity === 'error' ? 'error' : 
                     error.severity === 'warning' ? 'warn' : 'info'
    
    // Log with appropriate context
    this.logger[logMethod](`${error.severity}: ${error.message} [${error.source}]`)

    // Record metrics
    performanceMonitor.recordMetric({
      operation: `error.${error.source}`,
      duration: 0,
      success: false,
      error: error.message,
      metadata: {
        severity: error.severity,
        userId: error.userId || 'anonymous'
      },
      timestamp: new Date()
    })
  }

  async getErrors(filter: ErrorFilter = {}): Promise<ErrorRecord[]> {
    return this.filterErrors(filter)
  }

  async getErrorSummary(timeRange?: { start: Date; end: Date }): Promise<ErrorSummary> {
    const range = timeRange || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date()
    }

    const filteredErrors = this.filterErrors({ timeRange: range })
    
    const summary: ErrorSummary = {
      totalErrors: 0,
      errorsBySeverity: {
        error: 0,
        warning: 0,
        info: 0
      },
      errorsBySource: {},
      topErrors: [],
      errorRate: 0,
      resolutionRate: 0
    }

    // Count total occurrences
    let totalOccurrences = 0
    let resolvedCount = 0
    const errorCountMap = new Map<string, { 
      message: string, 
      source: string, 
      count: number, 
      lastOccurrence: Date 
    }>()

    for (const error of filteredErrors) {
      totalOccurrences += error.occurrences
      summary.errorsBySeverity[error.severity] += error.occurrences

      // Count by source
      if (!summary.errorsBySource[error.source]) {
        summary.errorsBySource[error.source] = 0
      }
      summary.errorsBySource[error.source] += error.occurrences

      // Track for top errors
      const key = `${error.source}:${error.message}`
      if (!errorCountMap.has(key)) {
        errorCountMap.set(key, {
          message: error.message,
          source: error.source,
          count: 0,
          lastOccurrence: error.timestamp
        })
      }
      const errorCount = errorCountMap.get(key)!
      errorCount.count += error.occurrences
      if (error.timestamp > errorCount.lastOccurrence) {
        errorCount.lastOccurrence = error.timestamp
      }

      if (error.resolved) {
        resolvedCount++
      }
    }

    summary.totalErrors = totalOccurrences

    // Get top 10 errors
    summary.topErrors = Array.from(errorCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate rates
    const timeRangeHours = (range.end.getTime() - range.start.getTime()) / (60 * 60 * 1000)
    summary.errorRate = totalOccurrences / timeRangeHours // errors per hour

    if (filteredErrors.length > 0) {
      summary.resolutionRate = resolvedCount / filteredErrors.length
    }

    return summary
  }

  async resolveError(errorId: string, resolvedBy: string): Promise<void> {
    const error = this.errors.find(e => e.id === errorId)
    if (error && !error.resolved) {
      error.resolved = true
      error.resolvedAt = new Date()
      error.resolvedBy = resolvedBy

      this.logger.info('Error resolved', {
        errorId,
        resolvedBy,
        message: error.message,
        source: error.source
      })
    }
  }

  async getUnresolvedErrors(): Promise<ErrorRecord[]> {
    return this.filterErrors({ resolved: false })
  }

  async getErrorTrends(timeRange: { start: Date; end: Date }, granularity: 'hour' | 'day' = 'hour'): Promise<{
    timestamp: Date
    errors: number
    warnings: number
    info: number
  }[]> {
    const errors = this.filterErrors({ timeRange })
    const trends = new Map<string, {
      timestamp: Date
      errors: number
      warnings: number
      info: number
    }>()

    for (const error of errors) {
      const key = this.getTimeKey(error.timestamp, granularity)
      
      if (!trends.has(key)) {
        const timestamp = granularity === 'hour' 
          ? new Date(error.timestamp.getFullYear(), error.timestamp.getMonth(), error.timestamp.getDate(), error.timestamp.getHours())
          : new Date(error.timestamp.getFullYear(), error.timestamp.getMonth(), error.timestamp.getDate())
        
        trends.set(key, {
          timestamp,
          errors: 0,
          warnings: 0,
          info: 0
        })
      }

      const trend = trends.get(key)!
      if (error.severity === 'error') {
        trend.errors += error.occurrences
      } else if (error.severity === 'warning') {
        trend.warnings += error.occurrences
      } else {
        trend.info += error.occurrences
      }
    }

    return Array.from(trends.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  private filterErrors(filter: ErrorFilter): ErrorRecord[] {
    return this.errors.filter(error => {
      if (filter.severity && error.severity !== filter.severity) return false
      if (filter.source && error.source !== filter.source) return false
      if (filter.resolved !== undefined && error.resolved !== filter.resolved) return false
      if (filter.userId && error.userId !== filter.userId) return false
      if (filter.timeRange) {
        if (error.timestamp < filter.timeRange.start) return false
        if (error.timestamp > filter.timeRange.end) return false
      }
      return true
    })
  }

  private getErrorKey(message: string, source: string): string {
    // Create a key for error deduplication
    // Remove dynamic parts like IDs, timestamps, etc.
    const normalizedMessage = message
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE')
      .replace(/\b\d+\b/g, 'NUMBER')
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID')
    
    return `${source}:${normalizedMessage}`
  }

  private getTimeKey(date: Date, granularity: 'hour' | 'day'): string {
    if (granularity === 'hour') {
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
    } else {
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    }
  }

  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker()
