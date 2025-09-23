import { TRPCError } from '@trpc/server'
import { securityService } from '../services/security/SecurityService'
import { authenticationService } from '../services/security/AuthenticationService'
import { ddosProtection } from './rate-limiter'
import { sentryService } from '../services/monitoring/SentryService'
import { metricsService } from '../services/monitoring/MetricsService'
import type { Context } from '../trpc'

export interface SecurityMiddlewareOptions {
  requireAuth?: boolean
  requireCSRF?: boolean
  validateInput?: boolean
  enableDDoSProtection?: boolean
  logSecurityEvents?: boolean
}

/**
 * Comprehensive security middleware for tRPC procedures
 */
export function createSecurityMiddleware(options: SecurityMiddlewareOptions = {}) {
  const {
    requireAuth = false,
    requireCSRF = false,
    validateInput = true,
    enableDDoSProtection = true,
    logSecurityEvents = true,
  } = options

  return async (opts: { ctx: Context; next: () => Promise<any>; input?: any }) => {
    const { ctx, next, input } = opts
    const startTime = Date.now()

    try {
      // Apply security headers
      applySecurityHeaders(ctx)

      // DDoS protection
      if (enableDDoSProtection) {
        ddosProtection.checkRequest(ctx)
      }

      // Authentication check
      if (requireAuth && !ctx.user) {
        if (logSecurityEvents) {
          securityService.logSecurityEvent(
            ctx,
            'unauthorized_access_attempt',
            'api',
            false,
            { procedure: ctx.procedure }
          )
        }

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        })
      }

      // CSRF protection
      if (requireCSRF) {
        const csrfToken = ctx.req?.headers['x-csrf-token'] as string
        if (!csrfToken || !securityService.validateCSRFToken(csrfToken, ctx)) {
          if (logSecurityEvents) {
            securityService.logSecurityEvent(
              ctx,
              'csrf_validation_failed',
              'api',
              false,
              { procedure: ctx.procedure }
            )
          }

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Invalid CSRF token',
          })
        }
      }

      // Input validation
      if (validateInput && input) {
        validateSecurityInput(input, ctx)
      }

      // Session validation for authenticated requests
      if (ctx.user && ctx.sessionId) {
        const session = await authenticationService.validateSession(ctx.sessionId, ctx)
        if (!session) {
          if (logSecurityEvents) {
            securityService.logSecurityEvent(
              ctx,
              'invalid_session',
              'api',
              false,
              { sessionId: ctx.sessionId }
            )
          }

          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired session',
          })
        }
      }

      // Proceed with the request
      const result = await next()

      // Log successful security check
      if (logSecurityEvents) {
        metricsService.recordMetric({
          name: 'security.middleware.success',
          value: 1,
          unit: 'count',
          tags: {
            procedure: ctx.procedure || 'unknown',
            userId: ctx.user?.id || 'anonymous',
            requireAuth: requireAuth.toString(),
            requireCSRF: requireCSRF.toString(),
          },
        })
      }

      return result

    } catch (error) {
      // Log security middleware failures
      if (logSecurityEvents) {
        metricsService.recordError('security', 'middleware_failed', {
          procedure: ctx.procedure || 'unknown',
          userId: ctx.user?.id || 'anonymous',
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        if (error instanceof TRPCError && error.code !== 'UNAUTHORIZED') {
          sentryService.captureError(error, {
            component: 'SecurityMiddleware',
            metadata: {
              procedure: ctx.procedure,
              userId: ctx.user?.id,
              options,
            },
          })
        }
      }

      throw error

    } finally {
      // Record timing metrics
      metricsService.recordMetric({
        name: 'security.middleware.duration',
        value: Date.now() - startTime,
        unit: 'milliseconds',
        tags: {
          procedure: ctx.procedure || 'unknown',
        },
      })
    }
  }
}

/**
 * Apply security headers to HTTP response
 */
function applySecurityHeaders(ctx: Context): void {
  if (!ctx.res) return

  const headers = securityService.getSecurityHeaders()
  
  for (const [name, value] of Object.entries(headers)) {
    ctx.res.setHeader(name, value)
  }

  // Additional security headers
  ctx.res.setHeader('X-Powered-By', '') // Remove server information
  ctx.res.setHeader('Server', '') // Remove server information
  
  // CORS headers (if needed)
  if (process.env.NODE_ENV === 'development') {
    ctx.res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
    ctx.res.setHeader('Access-Control-Allow-Credentials', 'true')
    ctx.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    ctx.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Session-ID')
  }
}

/**
 * Validate input for security threats
 */
function validateSecurityInput(input: any, ctx: Context): void {
  try {
    // Recursively validate all string inputs
    validateInputRecursive(input, ctx)
  } catch (error) {
    securityService.logSecurityEvent(
      ctx,
      'malicious_input_detected',
      'api',
      false,
      { 
        procedure: ctx.procedure,
        inputType: typeof input,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    )

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid input detected',
    })
  }
}

/**
 * Recursively validate input objects
 */
function validateInputRecursive(obj: any, ctx: Context, path = ''): void {
  if (typeof obj === 'string') {
    // Validate string inputs
    if (!securityService.validateInput(obj, 'xss')) {
      throw new Error(`XSS attempt detected in ${path}`)
    }
    if (!securityService.validateInput(obj, 'sql')) {
      throw new Error(`SQL injection attempt detected in ${path}`)
    }
    if (!securityService.validateInput(obj, 'path')) {
      throw new Error(`Path traversal attempt detected in ${path}`)
    }

    // Check for excessively long strings (potential DoS)
    if (obj.length > 10000) {
      throw new Error(`Excessively long input detected in ${path}`)
    }

  } else if (Array.isArray(obj)) {
    // Validate array elements
    if (obj.length > 1000) {
      throw new Error(`Excessively large array detected in ${path}`)
    }

    obj.forEach((item, index) => {
      validateInputRecursive(item, ctx, `${path}[${index}]`)
    })

  } else if (obj && typeof obj === 'object') {
    // Validate object properties
    const keys = Object.keys(obj)
    if (keys.length > 100) {
      throw new Error(`Excessively large object detected in ${path}`)
    }

    for (const key of keys) {
      // Validate key names
      if (!securityService.validateInput(key, 'xss')) {
        throw new Error(`Invalid key name detected: ${key}`)
      }

      validateInputRecursive(obj[key], ctx, path ? `${path}.${key}` : key)
    }
  }
}

/**
 * Middleware for API rate limiting with user-based quotas
 */
export function createUserQuotaMiddleware(quotaConfig: {
  requestsPerHour: number
  requestsPerDay: number
  premiumMultiplier?: number
}) {
  const userQuotas = new Map<string, {
    hourlyCount: number
    dailyCount: number
    hourlyReset: Date
    dailyReset: Date
  }>()

  return async (opts: { ctx: Context; next: () => Promise<any> }) => {
    const { ctx, next } = opts
    const userId = ctx.user?.id || `anonymous:${getClientIP(ctx)}`
    const now = new Date()

    // Get or create user quota tracking
    let quota = userQuotas.get(userId)
    if (!quota) {
      quota = {
        hourlyCount: 0,
        dailyCount: 0,
        hourlyReset: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
        dailyReset: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      }
      userQuotas.set(userId, quota)
    }

    // Reset counters if time windows have passed
    if (now > quota.hourlyReset) {
      quota.hourlyCount = 0
      quota.hourlyReset = new Date(now.getTime() + 60 * 60 * 1000)
    }

    if (now > quota.dailyReset) {
      quota.dailyCount = 0
      quota.dailyReset = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    }

    // Check quotas
    const hourlyLimit = quotaConfig.requestsPerHour * (quotaConfig.premiumMultiplier || 1)
    const dailyLimit = quotaConfig.requestsPerDay * (quotaConfig.premiumMultiplier || 1)

    if (quota.hourlyCount >= hourlyLimit) {
      metricsService.recordError('security', 'hourly_quota_exceeded', {
        userId: ctx.user?.id || 'anonymous',
        requests: quota.hourlyCount.toString(),
        limit: hourlyLimit.toString(),
      })

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Hourly quota exceeded. Limit: ${hourlyLimit} requests per hour.`,
        cause: {
          quotaType: 'hourly',
          limit: hourlyLimit,
          used: quota.hourlyCount,
          resetTime: quota.hourlyReset,
        },
      })
    }

    if (quota.dailyCount >= dailyLimit) {
      metricsService.recordError('security', 'daily_quota_exceeded', {
        userId: ctx.user?.id || 'anonymous',
        requests: quota.dailyCount.toString(),
        limit: dailyLimit.toString(),
      })

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Daily quota exceeded. Limit: ${dailyLimit} requests per day.`,
        cause: {
          quotaType: 'daily',
          limit: dailyLimit,
          used: quota.dailyCount,
          resetTime: quota.dailyReset,
        },
      })
    }

    // Increment counters
    quota.hourlyCount++
    quota.dailyCount++

    // Record quota usage metrics
    metricsService.recordMetric({
      name: 'security.quota.usage',
      value: 1,
      unit: 'count',
      tags: {
        userId: ctx.user?.id || 'anonymous',
        quotaType: 'request',
      },
    })

    return next()
  }
}

/**
 * Middleware for data encryption/decryption
 */
export function createEncryptionMiddleware(options: {
  encryptResponse?: boolean
  decryptInput?: boolean
  sensitiveFields?: string[]
}) {
  return async (opts: { ctx: Context; next: () => Promise<any>; input?: any }) => {
    const { ctx, next, input } = opts

    try {
      // Decrypt sensitive input fields
      if (options.decryptInput && input && options.sensitiveFields) {
        for (const field of options.sensitiveFields) {
          if (input[field] && typeof input[field] === 'string') {
            try {
              input[field] = securityService.decrypt(input[field])
            } catch (error) {
              // Field might not be encrypted, continue
            }
          }
        }
      }

      // Execute the procedure
      const result = await next()

      // Encrypt sensitive response fields
      if (options.encryptResponse && result && options.sensitiveFields) {
        for (const field of options.sensitiveFields) {
          if (result[field] && typeof result[field] === 'string') {
            result[field] = securityService.encrypt(result[field])
          }
        }
      }

      return result

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'EncryptionMiddleware',
        metadata: {
          procedure: ctx.procedure,
          userId: ctx.user?.id,
          options,
        },
      })

      throw error
    }
  }
}

/**
 * Middleware for audit logging
 */
export function createAuditMiddleware(options: {
  logInput?: boolean
  logOutput?: boolean
  sensitiveFields?: string[]
}) {
  return async (opts: { ctx: Context; next: () => Promise<any>; input?: any }) => {
    const { ctx, next, input } = opts
    const startTime = Date.now()

    try {
      // Log request start
      const auditData: any = {
        procedure: ctx.procedure,
        userId: ctx.user?.id,
        ip: getClientIP(ctx),
        userAgent: ctx.req?.headers['user-agent'],
        timestamp: new Date(),
      }

      if (options.logInput && input) {
        auditData.input = sanitizeAuditData(input, options.sensitiveFields)
      }

      // Execute the procedure
      const result = await next()

      // Log successful completion
      auditData.success = true
      auditData.duration = Date.now() - startTime

      if (options.logOutput && result) {
        auditData.output = sanitizeAuditData(result, options.sensitiveFields)
      }

      securityService.logSecurityEvent(
        ctx,
        'api_call_completed',
        ctx.procedure || 'unknown',
        true,
        auditData
      )

      return result

    } catch (error) {
      // Log error
      securityService.logSecurityEvent(
        ctx,
        'api_call_failed',
        ctx.procedure || 'unknown',
        false,
        {
          procedure: ctx.procedure,
          userId: ctx.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        }
      )

      throw error
    }
  }
}

/**
 * Sanitize audit data by removing sensitive fields
 */
function sanitizeAuditData(data: any, sensitiveFields: string[] = []): any {
  if (!data || typeof data !== 'object') return data

  const sanitized = { ...data }
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * Get client IP address
 */
function getClientIP(ctx: Context): string {
  const forwarded = ctx.req?.headers['x-forwarded-for']
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }

  const realIP = ctx.req?.headers['x-real-ip']
  if (realIP && typeof realIP === 'string') {
    return realIP
  }

  return ctx.req?.socket?.remoteAddress || 'unknown'
}

// Export commonly used middleware configurations
export const securityMiddleware = {
  // Basic security for public endpoints
  public: createSecurityMiddleware({
    requireAuth: false,
    requireCSRF: false,
    validateInput: true,
    enableDDoSProtection: true,
    logSecurityEvents: true,
  }),

  // Security for authenticated endpoints
  authenticated: createSecurityMiddleware({
    requireAuth: true,
    requireCSRF: false,
    validateInput: true,
    enableDDoSProtection: true,
    logSecurityEvents: true,
  }),

  // High security for sensitive operations
  sensitive: createSecurityMiddleware({
    requireAuth: true,
    requireCSRF: true,
    validateInput: true,
    enableDDoSProtection: true,
    logSecurityEvents: true,
  }),

  // User quota middleware for API limits
  userQuota: createUserQuotaMiddleware({
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    premiumMultiplier: 5,
  }),

  // Audit middleware for compliance
  audit: createAuditMiddleware({
    logInput: true,
    logOutput: false,
    sensitiveFields: ['password', 'token', 'secret', 'key'],
  }),
}