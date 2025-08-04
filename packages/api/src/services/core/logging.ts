/**
 * Logging Infrastructure
 * 
 * Provides structured logging with context awareness, multiple output formats,
 * and integration with performance monitoring and error handling.
 */

import { Logger, LogMeta, LogContext, BaseService, ServiceHealthStatus } from './interfaces'

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'json' | 'text'
  destination: 'console' | 'file' | 'both'
  enableColors: boolean
  includeTimestamp: boolean
  includeLevel: boolean
  includeContext: boolean
  maxLogSize?: number
  logRotation?: boolean
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: 'info',
  format: 'json',
  destination: 'console',
  enableColors: true,
  includeTimestamp: true,
  includeLevel: true,
  includeContext: true
}

interface LogEntry {
  timestamp: Date
  level: string
  message: string
  context?: LogContext
  meta?: LogMeta
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export class StructuredLogger implements Logger, BaseService {
  readonly name = 'StructuredLogger'
  readonly version = '1.0.0'
  private config: LoggerConfig
  private context: LogContext
  private logBuffer: LogEntry[] = []

  constructor(config: LoggerConfig = DEFAULT_LOGGER_CONFIG, context: LogContext = {}) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config }
    this.context = context
  }

  async initialize(): Promise<void> {
    // Logger initialization if needed
  }

  async shutdown(): Promise<void> {
    // Flush any remaining logs
    await this.flush()
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    return {
      status: 'healthy',
      metrics: {
        logBufferSize: this.logBuffer.length
      },
      timestamp: new Date()
    }
  }

  debug(message: string, meta?: LogMeta): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, undefined, meta)
    }
  }

  info(message: string, meta?: LogMeta): void {
    if (this.shouldLog('info')) {
      this.log('info', message, undefined, meta)
    }
  }

  warn(message: string, meta?: LogMeta): void {
    if (this.shouldLog('warn')) {
      this.log('warn', message, undefined, meta)
    }
  }

  error(message: string, error?: Error, meta?: LogMeta): void {
    if (this.shouldLog('error')) {
      this.log('error', message, error, meta)
    }
  }

  child(context: LogContext): Logger {
    const childContext = { ...this.context, ...context }
    return new StructuredLogger(this.config, childContext)
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const configLevelIndex = levels.indexOf(this.config.level)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= configLevelIndex
  }

  private log(level: string, message: string, error?: Error, meta?: LogMeta): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.config.includeContext ? this.context : undefined,
      meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    this.logBuffer.push(entry)
    this.output(entry)

    // Prevent memory issues by limiting buffer size
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-1000)
    }
  }

  private output(entry: LogEntry): void {
    const formatted = this.formatLogEntry(entry)

    switch (this.config.destination) {
      case 'console':
        this.outputToConsole(formatted, entry.level)
        break
      case 'file':
        this.outputToFile(formatted)
        break
      case 'both':
        this.outputToConsole(formatted, entry.level)
        this.outputToFile(formatted)
        break
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp: this.config.includeTimestamp ? entry.timestamp.toISOString() : undefined,
        level: this.config.includeLevel ? entry.level : undefined,
        message: entry.message,
        context: entry.context,
        meta: entry.meta,
        error: entry.error
      })
    } else {
      // Text format
      const parts: string[] = []

      if (this.config.includeTimestamp) {
        parts.push(`[${entry.timestamp.toISOString()}]`)
      }

      if (this.config.includeLevel) {
        const levelStr = this.config.enableColors ? this.colorizeLevel(entry.level) : entry.level.toUpperCase()
        parts.push(`[${levelStr}]`)
      }

      if (entry.context && Object.keys(entry.context).length > 0) {
        const contextStr = Object.entries(entry.context)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
        parts.push(`[${contextStr}]`)
      }

      parts.push(entry.message)

      if (entry.meta && Object.keys(entry.meta).length > 0) {
        parts.push(`| ${JSON.stringify(entry.meta)}`)
      }

      if (entry.error) {
        parts.push(`| ERROR: ${entry.error.name}: ${entry.error.message}`)
        if (entry.error.stack) {
          parts.push(`\n${entry.error.stack}`)
        }
      }

      return parts.join(' ')
    }
  }

  private colorizeLevel(level: string): string {
    if (!this.config.enableColors) {
      return level.toUpperCase()
    }

    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    }

    const reset = '\x1b[0m'
    const color = colors[level as keyof typeof colors] || ''
    return `${color}${level.toUpperCase()}${reset}`
  }

  private outputToConsole(formatted: string, level: string): void {
    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'debug':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
  }

  private outputToFile(formatted: string): void {
    // In a real implementation, you would write to a file
    // For now, we'll just add to buffer for potential file writing
    // This could be enhanced with file rotation, compression, etc.
  }

  private async flush(): Promise<void> {
    // Flush any buffered logs to file if needed
    if (this.config.destination === 'file' || this.config.destination === 'both') {
      // Implementation would write buffer to file
    }
  }
}

/**
 * Factory function to create a logger with default configuration
 */
export function createLogger(config?: Partial<LoggerConfig>, context?: LogContext): Logger {
  const fullConfig = { ...DEFAULT_LOGGER_CONFIG, ...config }
  return new StructuredLogger(fullConfig, context)
}

/**
 * Utility function to create a logger for a specific service
 */
export function createServiceLogger(serviceName: string, config?: Partial<LoggerConfig>): Logger {
  return createLogger(config, { service: serviceName })
}

/**
 * Log level utilities
 */
export function isLogLevelEnabled(currentLevel: string, targetLevel: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error']
  const currentIndex = levels.indexOf(currentLevel)
  const targetIndex = levels.indexOf(targetLevel)
  return targetIndex >= currentIndex
}

/**
 * Performance logging decorator
 */
export function logPerformance(logger: Logger, operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now()
      const operationName = operation || `${target.constructor.name}.${propertyKey}`

      logger.debug(`Starting operation: ${operationName}`)

      try {
        const result = await originalMethod.apply(this, args)
        const duration = Date.now() - startTime
        
        logger.info(`Operation completed: ${operationName}`, {
          duration,
          success: true
        })

        return result
      } catch (error) {
        const duration = Date.now() - startTime
        
        logger.error(`Operation failed: ${operationName}`, error as Error, {
          duration,
          success: false
        })

        throw error
      }
    }

    return descriptor
  }
}

/**
 * Request logging middleware helper
 */
export function createRequestLogger(logger: Logger) {
  return (requestId: string, userId?: string, operation?: string) => {
    return logger.child({
      requestId,
      userId,
      operation
    })
  }
}

// Export singleton logger instance
export const logger = new StructuredLogger(DEFAULT_LOGGER_CONFIG)
