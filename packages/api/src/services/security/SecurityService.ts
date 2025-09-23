import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { TRPCError } from '@trpc/server'
import { sentryService } from '../monitoring/SentryService'
import { metricsService } from '../monitoring/MetricsService'
import type { Context } from '../../trpc'

export interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  tagLength: number
}

export interface SecurityHeaders {
  'Content-Security-Policy': string
  'X-Frame-Options': string
  'X-Content-Type-Options': string
  'Referrer-Policy': string
  'Permissions-Policy': string
  'Strict-Transport-Security': string
  'X-XSS-Protection': string
}

export interface CSRFTokenData {
  token: string
  userId?: string
  sessionId: string
  expiresAt: Date
}

export interface SecurityAuditLog {
  id: string
  userId?: string
  action: string
  resource: string
  ip: string
  userAgent: string
  success: boolean
  details?: Record<string, any>
  timestamp: Date
}

export class SecurityService {
  private readonly encryptionKey: Buffer
  private readonly config: EncryptionConfig
  private readonly csrfTokens = new Map<string, CSRFTokenData>()
  private readonly auditLogs: SecurityAuditLog[] = []

  constructor() {
    // Initialize encryption key from environment
    const keyString = process.env.ENCRYPTION_KEY
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required')
    }

    this.encryptionKey = Buffer.from(keyString, 'hex')
    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
    }

    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
    }

    // Cleanup expired CSRF tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 60000) // Every minute
  }

  /**
   * Encrypt sensitive data at rest
   */
  encrypt(plaintext: string): string {
    try {
      const iv = crypto.randomBytes(this.config.ivLength)
      const cipher = crypto.createCipheriv(this.config.algorithm, this.encryptionKey, iv)
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      // Combine IV:TAG:DATA
      const result = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
      
      metricsService.recordMetric({
        name: 'security.encryption.success',
        value: 1,
        unit: 'count',
        tags: { operation: 'encrypt' },
      })

      return result
    } catch (error) {
      metricsService.recordError('security', 'encryption_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      sentryService.captureError(error as Error, {
        component: 'SecurityService',
        operation: 'encrypt',
      })

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Encryption failed',
      })
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':')
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }

      const iv = Buffer.from(parts[0], 'hex')
      const tag = Buffer.from(parts[1], 'hex')
      const encrypted = Buffer.from(parts[2], 'hex')

      const decipher = crypto.createDecipheriv(this.config.algorithm, this.encryptionKey, iv)
      decipher.setAuthTag(tag)
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')

      metricsService.recordMetric({
        name: 'security.decryption.success',
        value: 1,
        unit: 'count',
        tags: { operation: 'decrypt' },
      })

      return decrypted
    } catch (error) {
      metricsService.recordError('security', 'decryption_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      sentryService.captureError(error as Error, {
        component: 'SecurityService',
        operation: 'decrypt',
      })

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Decryption failed',
      })
    }
  }

  /**
   * Hash passwords securely
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12
      const hash = await bcrypt.hash(password, saltRounds)

      metricsService.recordMetric({
        name: 'security.password_hash.success',
        value: 1,
        unit: 'count',
      })

      return hash
    } catch (error) {
      metricsService.recordError('security', 'password_hash_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Password hashing failed',
      })
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash)

      metricsService.recordMetric({
        name: 'security.password_verify.success',
        value: 1,
        unit: 'count',
        tags: { valid: isValid.toString() },
      })

      return isValid
    } catch (error) {
      metricsService.recordError('security', 'password_verify_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return false
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(ctx: Context): string {
    const token = crypto.randomBytes(32).toString('hex')
    const sessionId = this.getSessionId(ctx)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    const tokenData: CSRFTokenData = {
      token,
      userId: ctx.user?.id,
      sessionId,
      expiresAt,
    }

    this.csrfTokens.set(token, tokenData)

    metricsService.recordMetric({
      name: 'security.csrf_token.generated',
      value: 1,
      unit: 'count',
      tags: { userId: ctx.user?.id || 'anonymous' },
    })

    return token
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, ctx: Context): boolean {
    const tokenData = this.csrfTokens.get(token)
    
    if (!tokenData) {
      this.logSecurityEvent(ctx, 'csrf_validation_failed', 'token', false, {
        reason: 'token_not_found',
      })
      return false
    }

    if (tokenData.expiresAt < new Date()) {
      this.csrfTokens.delete(token)
      this.logSecurityEvent(ctx, 'csrf_validation_failed', 'token', false, {
        reason: 'token_expired',
      })
      return false
    }

    const sessionId = this.getSessionId(ctx)
    if (tokenData.sessionId !== sessionId) {
      this.logSecurityEvent(ctx, 'csrf_validation_failed', 'token', false, {
        reason: 'session_mismatch',
      })
      return false
    }

    if (tokenData.userId !== ctx.user?.id) {
      this.logSecurityEvent(ctx, 'csrf_validation_failed', 'token', false, {
        reason: 'user_mismatch',
      })
      return false
    }

    // Token is valid, remove it (one-time use)
    this.csrfTokens.delete(token)

    this.logSecurityEvent(ctx, 'csrf_validation_success', 'token', true)

    metricsService.recordMetric({
      name: 'security.csrf_token.validated',
      value: 1,
      unit: 'count',
      tags: { userId: ctx.user?.id || 'anonymous' },
    })

    return true
  }

  /**
   * Get security headers for HTTP responses
   */
  getSecurityHeaders(): SecurityHeaders {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.openai.com https://api.scryfall.com wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
      ].join(', '),
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-XSS-Protection': '1; mode=block',
    }
  }

  /**
   * Validate input for security threats
   */
  validateInput(input: string, type: 'sql' | 'xss' | 'path' = 'xss'): boolean {
    try {
      switch (type) {
        case 'sql':
          return this.validateSQLInjection(input)
        case 'xss':
          return this.validateXSS(input)
        case 'path':
          return this.validatePathTraversal(input)
        default:
          return true
      }
    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'SecurityService',
        operation: 'validateInput',
        metadata: { input: input.substring(0, 100), type },
      })
      return false
    }
  }

  /**
   * Log security events for audit trail
   */
  logSecurityEvent(
    ctx: Context,
    action: string,
    resource: string,
    success: boolean,
    details?: Record<string, any>
  ): void {
    const auditLog: SecurityAuditLog = {
      id: crypto.randomUUID(),
      userId: ctx.user?.id,
      action,
      resource,
      ip: this.getClientIP(ctx),
      userAgent: ctx.req?.headers['user-agent'] || 'unknown',
      success,
      details,
      timestamp: new Date(),
    }

    this.auditLogs.push(auditLog)

    // Keep only last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs.splice(0, this.auditLogs.length - 10000)
    }

    // Send to monitoring
    metricsService.recordMetric({
      name: 'security.audit_log',
      value: 1,
      unit: 'count',
      tags: {
        action,
        resource,
        success: success.toString(),
        userId: ctx.user?.id || 'anonymous',
      },
    })

    // Log security failures to Sentry
    if (!success) {
      sentryService.captureMessage(
        `Security event: ${action} failed for ${resource}`,
        'warning',
        {
          userId: ctx.user?.id,
          component: 'SecurityService',
          metadata: {
            action,
            resource,
            ip: this.getClientIP(ctx),
            details,
          },
        }
      )
    }
  }

  /**
   * Get security audit logs
   */
  getAuditLogs(limit = 100): SecurityAuditLog[] {
    return this.auditLogs
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Check for suspicious activity patterns
   */
  detectSuspiciousActivity(ctx: Context): boolean {
    const ip = this.getClientIP(ctx)
    const userId = ctx.user?.id
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Get recent failed attempts from this IP or user
    const recentFailures = this.auditLogs.filter(log => {
      const matchesIP = log.ip === ip
      const matchesUser = userId && log.userId === userId
      const isRecent = log.timestamp > fiveMinutesAgo
      const isFailed = !log.success

      return (matchesIP || matchesUser) && isRecent && isFailed
    })

    // Suspicious if more than 10 failures in 5 minutes
    const isSuspicious = recentFailures.length > 10

    if (isSuspicious) {
      this.logSecurityEvent(ctx, 'suspicious_activity_detected', 'system', true, {
        failureCount: recentFailures.length,
        timeWindow: '5_minutes',
      })

      metricsService.recordError('security', 'suspicious_activity', {
        ip,
        userId: userId || 'anonymous',
        failureCount: recentFailures.length.toString(),
      })
    }

    return isSuspicious
  }

  private validateSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i,
    ]

    return !sqlPatterns.some(pattern => pattern.test(input))
  }

  private validateXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^>]*>/gi,
    ]

    return !xssPatterns.some(pattern => pattern.test(input))
  }

  private validatePathTraversal(input: string): boolean {
    const pathPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.\.\%2f/gi,
      /\.\.\%5c/gi,
    ]

    return !pathPatterns.some(pattern => pattern.test(input))
  }

  private getSessionId(ctx: Context): string {
    // Extract session ID from request headers or generate one
    const sessionHeader = ctx.req?.headers['x-session-id']
    if (sessionHeader && typeof sessionHeader === 'string') {
      return sessionHeader
    }

    // Fallback to generating session ID from user agent and IP
    const userAgent = ctx.req?.headers['user-agent'] || ''
    const ip = this.getClientIP(ctx)
    return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex')
  }

  private getClientIP(ctx: Context): string {
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

  private cleanupExpiredTokens(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [token, data] of this.csrfTokens.entries()) {
      if (data.expiresAt < now) {
        this.csrfTokens.delete(token)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      metricsService.recordMetric({
        name: 'security.csrf_tokens.cleaned',
        value: cleanedCount,
        unit: 'count',
      })
    }
  }
}

// Export singleton instance
export const securityService = new SecurityService()