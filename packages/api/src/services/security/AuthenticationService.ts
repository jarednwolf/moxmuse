import { TRPCError } from '@trpc/server'
import { prisma } from '@moxmuse/db'
import { securityService } from './SecurityService'
import { sentryService } from '../monitoring/SentryService'
import { metricsService } from '../monitoring/MetricsService'
import type { Context } from '../../trpc'
import crypto from 'crypto'

export interface SessionData {
  id: string
  userId: string
  ip: string
  userAgent: string
  createdAt: Date
  lastAccessedAt: Date
  expiresAt: Date
  isActive: boolean
  metadata?: Record<string, any>
}

export interface AuthenticationResult {
  success: boolean
  user?: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
  session?: SessionData
  error?: string
  requiresMFA?: boolean
}

export interface LoginAttempt {
  id: string
  email: string
  ip: string
  userAgent: string
  success: boolean
  failureReason?: string
  timestamp: Date
}

export interface SecurityPolicy {
  maxLoginAttempts: number
  lockoutDurationMs: number
  sessionTimeoutMs: number
  requireMFA: boolean
  passwordMinLength: number
  passwordRequireSpecialChars: boolean
}

export class AuthenticationService {
  private readonly sessions = new Map<string, SessionData>()
  private readonly loginAttempts: LoginAttempt[] = []
  private readonly lockedAccounts = new Map<string, Date>()
  
  private readonly securityPolicy: SecurityPolicy = {
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
    sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
    requireMFA: false, // Can be enabled per user
    passwordMinLength: 8,
    passwordRequireSpecialChars: true,
  }

  constructor() {
    // Cleanup expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), 60000) // Every minute
    
    // Cleanup old login attempts periodically
    setInterval(() => this.cleanupOldLoginAttempts(), 5 * 60000) // Every 5 minutes
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(
    email: string,
    password: string,
    ctx: Context
  ): Promise<AuthenticationResult> {
    const startTime = Date.now()
    
    try {
      // Validate input
      if (!email || !password) {
        return this.handleAuthFailure(email, ctx, 'missing_credentials')
      }

      // Check if account is locked
      if (this.isAccountLocked(email)) {
        return this.handleAuthFailure(email, ctx, 'account_locked')
      }

      // Check for suspicious activity
      if (securityService.detectSuspiciousActivity(ctx)) {
        return this.handleAuthFailure(email, ctx, 'suspicious_activity')
      }

      // Find user in database
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          password: true,
          isActive: true,
          lastLoginAt: true,
          mfaEnabled: true,
          mfaSecret: true,
        },
      })

      if (!user) {
        return this.handleAuthFailure(email, ctx, 'user_not_found')
      }

      if (!user.isActive) {
        return this.handleAuthFailure(email, ctx, 'account_disabled')
      }

      if (!user.password) {
        return this.handleAuthFailure(email, ctx, 'no_password_set')
      }

      // Verify password
      const isPasswordValid = await securityService.verifyPassword(password, user.password)
      if (!isPasswordValid) {
        return this.handleAuthFailure(email, ctx, 'invalid_password')
      }

      // Check if MFA is required
      if (user.mfaEnabled && user.mfaSecret) {
        // MFA verification would be handled in a separate step
        return {
          success: false,
          requiresMFA: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          },
        }
      }

      // Create session
      const session = await this.createSession(user.id, ctx)

      // Update user's last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Log successful authentication
      this.logLoginAttempt(email, ctx, true)
      
      securityService.logSecurityEvent(
        ctx,
        'user_authentication_success',
        'user',
        true,
        { userId: user.id }
      )

      // Record metrics
      metricsService.recordMetric({
        name: 'auth.login.success',
        value: 1,
        unit: 'count',
        tags: { userId: user.id },
      })

      metricsService.recordMetric({
        name: 'auth.login.duration',
        value: Date.now() - startTime,
        unit: 'milliseconds',
      })

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
        session,
      }

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'AuthenticationService',
        operation: 'authenticateUser',
        metadata: { email },
      })

      return this.handleAuthFailure(email, ctx, 'internal_error')
    }
  }

  /**
   * Create a new session for authenticated user
   */
  async createSession(userId: string, ctx: Context): Promise<SessionData> {
    const sessionId = crypto.randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.securityPolicy.sessionTimeoutMs)

    const session: SessionData = {
      id: sessionId,
      userId,
      ip: this.getClientIP(ctx),
      userAgent: ctx.req?.headers['user-agent'] || 'unknown',
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      isActive: true,
      metadata: {
        loginMethod: 'password',
      },
    }

    // Store session in memory (in production, use Redis or database)
    this.sessions.set(sessionId, session)

    // Store session in database for persistence
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        ip: session.ip,
        userAgent: session.userAgent,
        expiresAt,
        metadata: session.metadata,
      },
    })

    metricsService.recordMetric({
      name: 'auth.session.created',
      value: 1,
      unit: 'count',
      tags: { userId },
    })

    return session
  }

  /**
   * Validate and refresh session
   */
  async validateSession(sessionId: string, ctx: Context): Promise<SessionData | null> {
    try {
      // Check memory cache first
      let session = this.sessions.get(sessionId)

      // If not in memory, check database
      if (!session) {
        const dbSession = await prisma.userSession.findUnique({
          where: { id: sessionId },
          include: { user: true },
        })

        if (!dbSession || !dbSession.user.isActive) {
          return null
        }

        session = {
          id: dbSession.id,
          userId: dbSession.userId,
          ip: dbSession.ip,
          userAgent: dbSession.userAgent,
          createdAt: dbSession.createdAt,
          lastAccessedAt: dbSession.lastAccessedAt,
          expiresAt: dbSession.expiresAt,
          isActive: true,
          metadata: dbSession.metadata as Record<string, any>,
        }

        // Cache in memory
        this.sessions.set(sessionId, session)
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.invalidateSession(sessionId)
        return null
      }

      // Check if IP has changed (potential session hijacking)
      const currentIP = this.getClientIP(ctx)
      if (session.ip !== currentIP) {
        securityService.logSecurityEvent(
          ctx,
          'session_ip_mismatch',
          'session',
          false,
          {
            sessionId,
            originalIP: session.ip,
            currentIP,
          }
        )

        // Optionally invalidate session on IP change
        if (process.env.NODE_ENV === 'production') {
          await this.invalidateSession(sessionId)
          return null
        }
      }

      // Update last accessed time
      session.lastAccessedAt = new Date()
      
      // Update in database periodically (not on every request for performance)
      const timeSinceLastUpdate = Date.now() - session.lastAccessedAt.getTime()
      if (timeSinceLastUpdate > 5 * 60 * 1000) { // 5 minutes
        await prisma.userSession.update({
          where: { id: sessionId },
          data: { lastAccessedAt: session.lastAccessedAt },
        })
      }

      metricsService.recordMetric({
        name: 'auth.session.validated',
        value: 1,
        unit: 'count',
        tags: { userId: session.userId },
      })

      return session

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'AuthenticationService',
        operation: 'validateSession',
        metadata: { sessionId },
      })

      return null
    }
  }

  /**
   * Invalidate a session
   */
  async invalidateSession(sessionId: string): Promise<void> {
    try {
      // Remove from memory
      const session = this.sessions.get(sessionId)
      this.sessions.delete(sessionId)

      // Remove from database
      await prisma.userSession.delete({
        where: { id: sessionId },
      })

      metricsService.recordMetric({
        name: 'auth.session.invalidated',
        value: 1,
        unit: 'count',
        tags: { userId: session?.userId || 'unknown' },
      })

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'AuthenticationService',
        operation: 'invalidateSession',
        metadata: { sessionId },
      })
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      // Remove from memory
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.userId === userId) {
          this.sessions.delete(sessionId)
        }
      }

      // Remove from database
      await prisma.userSession.deleteMany({
        where: { userId },
      })

      metricsService.recordMetric({
        name: 'auth.sessions.invalidated_all',
        value: 1,
        unit: 'count',
        tags: { userId },
      })

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'AuthenticationService',
        operation: 'invalidateAllUserSessions',
        metadata: { userId },
      })
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < this.securityPolicy.passwordMinLength) {
      errors.push(`Password must be at least ${this.securityPolicy.passwordMinLength} characters long`)
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    if (this.securityPolicy.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ]

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const dbSessions = await prisma.userSession.findMany({
        where: {
          userId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastAccessedAt: 'desc' },
      })

      return dbSessions.map(session => ({
        id: session.id,
        userId: session.userId,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        expiresAt: session.expiresAt,
        isActive: true,
        metadata: session.metadata as Record<string, any>,
      }))

    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'AuthenticationService',
        operation: 'getUserSessions',
        metadata: { userId },
      })

      return []
    }
  }

  private handleAuthFailure(
    email: string,
    ctx: Context,
    reason: string
  ): AuthenticationResult {
    // Log failed attempt
    this.logLoginAttempt(email, ctx, false, reason)

    // Check if account should be locked
    this.checkAndLockAccount(email)

    // Log security event
    securityService.logSecurityEvent(
      ctx,
      'user_authentication_failed',
      'user',
      false,
      { email, reason }
    )

    // Record metrics
    metricsService.recordError('auth', 'login_failed', {
      email,
      reason,
      ip: this.getClientIP(ctx),
    })

    return {
      success: false,
      error: this.getPublicErrorMessage(reason),
    }
  }

  private logLoginAttempt(
    email: string,
    ctx: Context,
    success: boolean,
    failureReason?: string
  ): void {
    const attempt: LoginAttempt = {
      id: crypto.randomUUID(),
      email,
      ip: this.getClientIP(ctx),
      userAgent: ctx.req?.headers['user-agent'] || 'unknown',
      success,
      failureReason,
      timestamp: new Date(),
    }

    this.loginAttempts.push(attempt)

    // Keep only last 1000 attempts in memory
    if (this.loginAttempts.length > 1000) {
      this.loginAttempts.splice(0, this.loginAttempts.length - 1000)
    }
  }

  private checkAndLockAccount(email: string): void {
    const now = new Date()
    const cutoff = new Date(now.getTime() - this.securityPolicy.lockoutDurationMs)

    // Count recent failed attempts for this email
    const recentFailures = this.loginAttempts.filter(attempt => 
      attempt.email === email &&
      !attempt.success &&
      attempt.timestamp > cutoff
    )

    if (recentFailures.length >= this.securityPolicy.maxLoginAttempts) {
      const lockUntil = new Date(now.getTime() + this.securityPolicy.lockoutDurationMs)
      this.lockedAccounts.set(email, lockUntil)

      metricsService.recordError('auth', 'account_locked', {
        email,
        failureCount: recentFailures.length.toString(),
      })
    }
  }

  private isAccountLocked(email: string): boolean {
    const lockUntil = this.lockedAccounts.get(email)
    if (!lockUntil) return false

    if (lockUntil < new Date()) {
      this.lockedAccounts.delete(email)
      return false
    }

    return true
  }

  private getPublicErrorMessage(reason: string): string {
    // Return generic error messages to prevent information disclosure
    switch (reason) {
      case 'missing_credentials':
        return 'Email and password are required'
      case 'account_locked':
        return 'Account temporarily locked due to too many failed attempts'
      case 'suspicious_activity':
        return 'Suspicious activity detected. Please try again later'
      case 'account_disabled':
        return 'Account is disabled. Please contact support'
      default:
        return 'Invalid email or password'
    }
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

  private cleanupExpiredSessions(): void {
    const now = new Date()
    let cleanedCount = 0

    // Cleanup memory sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId)
        cleanedCount++
      }
    }

    // Cleanup database sessions (run less frequently)
    if (Math.random() < 0.1) { // 10% chance each minute
      prisma.userSession.deleteMany({
        where: { expiresAt: { lt: now } },
      }).catch(error => {
        sentryService.captureError(error, {
          component: 'AuthenticationService',
          operation: 'cleanupExpiredSessions',
        })
      })
    }

    if (cleanedCount > 0) {
      metricsService.recordMetric({
        name: 'auth.sessions.cleaned',
        value: cleanedCount,
        unit: 'count',
      })
    }
  }

  private cleanupOldLoginAttempts(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    const originalLength = this.loginAttempts.length

    // Remove old attempts
    for (let i = this.loginAttempts.length - 1; i >= 0; i--) {
      if (this.loginAttempts[i].timestamp < cutoff) {
        this.loginAttempts.splice(i, 1)
      }
    }

    const cleanedCount = originalLength - this.loginAttempts.length
    if (cleanedCount > 0) {
      metricsService.recordMetric({
        name: 'auth.login_attempts.cleaned',
        value: cleanedCount,
        unit: 'count',
      })
    }
  }
}

// Export singleton instance
export const authenticationService = new AuthenticationService()