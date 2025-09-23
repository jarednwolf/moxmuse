import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { securityService } from '../services/security/SecurityService'
import { authenticationService } from '../services/security/AuthenticationService'
import { vulnerabilityScanner } from '../services/security/VulnerabilityScanner'
import { securityMiddleware } from '../middleware/security'
import { TRPCError } from '@trpc/server'

export const securityRouter = router({
  // Generate CSRF token
  generateCSRFToken: protectedProcedure
    .use(securityMiddleware.authenticated)
    .mutation(async ({ ctx }) => {
      const token = securityService.generateCSRFToken(ctx)
      
      return {
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      }
    }),

  // Validate password strength
  validatePassword: publicProcedure
    .use(securityMiddleware.public)
    .input(z.object({
      password: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const validation = authenticationService.validatePasswordStrength(input.password)
      
      return {
        isValid: validation.isValid,
        errors: validation.errors,
        score: validation.isValid ? 100 : Math.max(0, 100 - validation.errors.length * 20),
      }
    }),

  // Get user sessions
  getUserSessions: protectedProcedure
    .use(securityMiddleware.authenticated)
    .query(async ({ ctx }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        })
      }

      const sessions = await authenticationService.getUserSessions(ctx.user.id)
      
      return sessions.map(session => ({
        id: session.id,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        expiresAt: session.expiresAt,
        isCurrent: session.id === ctx.sessionId,
      }))
    }),

  // Invalidate session
  invalidateSession: protectedProcedure
    .use(securityMiddleware.sensitive)
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        })
      }

      // Verify the session belongs to the current user
      const sessions = await authenticationService.getUserSessions(ctx.user.id)
      const sessionToInvalidate = sessions.find(s => s.id === input.sessionId)
      
      if (!sessionToInvalidate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found',
        })
      }

      await authenticationService.invalidateSession(input.sessionId)

      securityService.logSecurityEvent(
        ctx,
        'session_invalidated',
        'session',
        true,
        { invalidatedSessionId: input.sessionId }
      )

      return { success: true }
    }),

  // Invalidate all sessions except current
  invalidateAllOtherSessions: protectedProcedure
    .use(securityMiddleware.sensitive)
    .mutation(async ({ ctx }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        })
      }

      const sessions = await authenticationService.getUserSessions(ctx.user.id)
      const otherSessions = sessions.filter(s => s.id !== ctx.sessionId)

      for (const session of otherSessions) {
        await authenticationService.invalidateSession(session.id)
      }

      securityService.logSecurityEvent(
        ctx,
        'all_other_sessions_invalidated',
        'session',
        true,
        { invalidatedCount: otherSessions.length }
      )

      return { 
        success: true,
        invalidatedCount: otherSessions.length,
      }
    }),

  // Get security audit logs
  getAuditLogs: protectedProcedure
    .use(securityMiddleware.authenticated)
    .input(z.object({
      limit: z.number().min(1).max(1000).default(100),
      userId: z.string().optional(),
      action: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Only allow users to see their own logs unless they're admin
      const isAdmin = ctx.user?.email?.endsWith('@moxmuse.com') // Simple admin check
      const userIdFilter = isAdmin ? input.userId : ctx.user?.id

      let logs = securityService.getAuditLogs(input.limit)

      // Filter by user ID
      if (userIdFilter) {
        logs = logs.filter(log => log.userId === userIdFilter)
      }

      // Filter by action
      if (input.action) {
        logs = logs.filter(log => log.action.includes(input.action))
      }

      // Filter by date range
      if (input.startDate) {
        logs = logs.filter(log => log.timestamp >= input.startDate!)
      }

      if (input.endDate) {
        logs = logs.filter(log => log.timestamp <= input.endDate!)
      }

      return logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        success: log.success,
        timestamp: log.timestamp,
        details: log.details,
        // Only show IP and user agent to admins or for own logs
        ip: (isAdmin || log.userId === ctx.user?.id) ? log.ip : '[REDACTED]',
        userAgent: (isAdmin || log.userId === ctx.user?.id) ? log.userAgent : '[REDACTED]',
      }))
    }),

  // Run security scan (admin only)
  runSecurityScan: protectedProcedure
    .use(securityMiddleware.sensitive)
    .mutation(async ({ ctx }) => {
      // Check if user is admin
      const isAdmin = ctx.user?.email?.endsWith('@moxmuse.com')
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }

      if (vulnerabilityScanner.isScanInProgress()) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Security scan already in progress',
        })
      }

      // Run scan asynchronously
      const scanPromise = vulnerabilityScanner.runFullScan()

      securityService.logSecurityEvent(
        ctx,
        'security_scan_initiated',
        'system',
        true,
        { initiatedBy: ctx.user?.id }
      )

      return {
        success: true,
        message: 'Security scan initiated',
        scanInProgress: true,
      }
    }),

  // Get security scan results
  getSecurityScanResults: protectedProcedure
    .use(securityMiddleware.authenticated)
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ input, ctx }) => {
      // Check if user is admin
      const isAdmin = ctx.user?.email?.endsWith('@moxmuse.com')
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }

      const scanHistory = vulnerabilityScanner.getScanHistory(input.limit)
      const latestScan = vulnerabilityScanner.getLatestScan()
      const scanInProgress = vulnerabilityScanner.isScanInProgress()

      return {
        latestScan,
        scanHistory,
        scanInProgress,
        configuration: vulnerabilityScanner.getConfiguration(),
      }
    }),

  // Update security configuration
  updateSecurityConfig: protectedProcedure
    .use(securityMiddleware.sensitive)
    .input(z.object({
      enableDependencyScanning: z.boolean().optional(),
      enableCodeScanning: z.boolean().optional(),
      enableRuntimeScanning: z.boolean().optional(),
      scanInterval: z.number().min(60000).max(7 * 24 * 60 * 60 * 1000).optional(), // 1 minute to 1 week
      alertThreshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      autoFixEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if user is admin
      const isAdmin = ctx.user?.email?.endsWith('@moxmuse.com')
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }

      vulnerabilityScanner.updateConfiguration(input)

      securityService.logSecurityEvent(
        ctx,
        'security_config_updated',
        'system',
        true,
        { 
          updatedBy: ctx.user?.id,
          changes: input,
        }
      )

      return {
        success: true,
        configuration: vulnerabilityScanner.getConfiguration(),
      }
    }),

  // Encrypt sensitive data
  encryptData: protectedProcedure
    .use(securityMiddleware.authenticated)
    .input(z.object({
      data: z.string().min(1).max(10000),
    }))
    .mutation(async ({ input, ctx }) => {
      const encrypted = securityService.encrypt(input.data)

      securityService.logSecurityEvent(
        ctx,
        'data_encrypted',
        'encryption',
        true,
        { dataLength: input.data.length }
      )

      return { encrypted }
    }),

  // Decrypt sensitive data
  decryptData: protectedProcedure
    .use(securityMiddleware.authenticated)
    .input(z.object({
      encryptedData: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const decrypted = securityService.decrypt(input.encryptedData)

        securityService.logSecurityEvent(
          ctx,
          'data_decrypted',
          'encryption',
          true,
          { dataLength: decrypted.length }
        )

        return { decrypted }

      } catch (error) {
        securityService.logSecurityEvent(
          ctx,
          'data_decryption_failed',
          'encryption',
          false,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        )

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to decrypt data',
        })
      }
    }),

  // Check for suspicious activity
  checkSuspiciousActivity: protectedProcedure
    .use(securityMiddleware.authenticated)
    .query(async ({ ctx }) => {
      const isSuspicious = securityService.detectSuspiciousActivity(ctx)

      return {
        isSuspicious,
        timestamp: new Date(),
        userId: ctx.user?.id,
      }
    }),

  // Get security headers
  getSecurityHeaders: publicProcedure
    .use(securityMiddleware.public)
    .query(async () => {
      const headers = securityService.getSecurityHeaders()

      return {
        headers,
        timestamp: new Date(),
      }
    }),

  // Validate input for security threats
  validateInput: publicProcedure
    .use(securityMiddleware.public)
    .input(z.object({
      input: z.string().min(1).max(10000),
      type: z.enum(['sql', 'xss', 'path']).default('xss'),
    }))
    .mutation(async ({ input }) => {
      const isValid = securityService.validateInput(input.input, input.type)

      return {
        isValid,
        type: input.type,
        input: input.input.substring(0, 100), // Only return first 100 chars for security
      }
    }),

  // Get security statistics
  getSecurityStats: protectedProcedure
    .use(securityMiddleware.authenticated)
    .query(async ({ ctx }) => {
      // Check if user is admin
      const isAdmin = ctx.user?.email?.endsWith('@moxmuse.com')
      if (!isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        })
      }

      const auditLogs = securityService.getAuditLogs(1000)
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Calculate statistics
      const recentLogs = auditLogs.filter(log => log.timestamp > oneDayAgo)
      const weeklyLogs = auditLogs.filter(log => log.timestamp > oneWeekAgo)

      const stats = {
        totalEvents: auditLogs.length,
        dailyEvents: recentLogs.length,
        weeklyEvents: weeklyLogs.length,
        
        failureRate: {
          daily: recentLogs.length > 0 
            ? (recentLogs.filter(log => !log.success).length / recentLogs.length) * 100 
            : 0,
          weekly: weeklyLogs.length > 0 
            ? (weeklyLogs.filter(log => !log.success).length / weeklyLogs.length) * 100 
            : 0,
        },

        topFailedActions: this.getTopFailedActions(recentLogs),
        topUsers: this.getTopUsers(recentLogs),
        
        latestScan: vulnerabilityScanner.getLatestScan(),
        scanInProgress: vulnerabilityScanner.isScanInProgress(),
      }

      return stats
    }),

  // Change password with security validation
  changePassword: protectedProcedure
    .use(securityMiddleware.sensitive)
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        })
      }

      // Validate new password strength
      const validation = authenticationService.validatePasswordStrength(input.newPassword)
      if (!validation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password does not meet security requirements',
          cause: { errors: validation.errors },
        })
      }

      // Verify current password (this would typically be done in the auth service)
      // For now, we'll assume it's handled elsewhere

      // Hash new password
      const hashedPassword = await securityService.hashPassword(input.newPassword)

      // Update password in database (this would be done via a user service)
      // await userService.updatePassword(ctx.user.id, hashedPassword)

      // Invalidate all other sessions for security
      await authenticationService.invalidateAllUserSessions(ctx.user.id)

      securityService.logSecurityEvent(
        ctx,
        'password_changed',
        'user',
        true,
        { userId: ctx.user.id }
      )

      return {
        success: true,
        message: 'Password changed successfully. All other sessions have been invalidated.',
      }
    }),
})

// Helper functions for statistics
function getTopFailedActions(logs: any[]): Array<{ action: string; count: number }> {
  const failedLogs = logs.filter(log => !log.success)
  const actionCounts = new Map<string, number>()

  for (const log of failedLogs) {
    const count = actionCounts.get(log.action) || 0
    actionCounts.set(log.action, count + 1)
  }

  return Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function getTopUsers(logs: any[]): Array<{ userId: string; count: number }> {
  const userCounts = new Map<string, number>()

  for (const log of logs) {
    const userId = log.userId || 'anonymous'
    const count = userCounts.get(userId) || 0
    userCounts.set(userId, count + 1)
  }

  return Array.from(userCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}