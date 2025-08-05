import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import crypto from 'crypto'
import { PrismaClient } from '@moxmuse/db'

/**
 * Security utilities for authentication, authorization, and input validation
 */

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (userId: string, operation: string) => string
}

export interface SecurityConfig {
  csrfSecret: string
  rateLimits: {
    ai: RateLimitConfig
    general: RateLimitConfig
    auth: RateLimitConfig
  }
}

export const defaultSecurityConfig: SecurityConfig = {
  csrfSecret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
  rateLimits: {
    ai: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 50, // 50 AI requests per hour
    },
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 general requests per 15 minutes
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 auth attempts per 15 minutes
    },
  },
}

/**
 * Rate limiting implementation
 */
export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  async checkLimit(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - this.config.windowMs
    
    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k)
      }
    }

    const current = rateLimitStore.get(key)
    
    if (!current || current.resetTime < now) {
      // First request in window or window expired
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      })
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      }
    }

    if (current.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
      }
    }

    current.count++
    return {
      allowed: true,
      remaining: this.config.maxRequests - current.count,
      resetTime: current.resetTime,
    }
  }
}

/**
 * CSRF Protection
 */
export class CSRFProtection {
  constructor(private secret: string) {}

  generateToken(sessionId: string): string {
    const timestamp = Date.now().toString()
    const data = `${sessionId}:${timestamp}`
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(data)
      .digest('hex')
    
    return Buffer.from(`${data}:${signature}`).toString('base64')
  }

  validateToken(token: string, sessionId: string, maxAge: number = 3600000): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [receivedSessionId, timestamp, signature] = decoded.split(':')
      
      if (receivedSessionId !== sessionId) {
        return false
      }

      const age = Date.now() - parseInt(timestamp)
      if (age > maxAge) {
        return false
      }

      const data = `${receivedSessionId}:${timestamp}`
      const expectedSignature = crypto
        .createHmac('sha256', this.secret)
        .update(data)
        .digest('hex')
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }
}

/**
 * Input validation and sanitization
 */
export const sanitizeInput = {
  // Remove potentially dangerous characters
  text: (input: string): string => {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
  },

  // Sanitize HTML content
  html: (input: string): string => {
    // Basic HTML sanitization - in production, use a library like DOMPurify
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  },

  // Sanitize deck names and descriptions
  deckName: (input: string): string => {
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML-sensitive characters
      .substring(0, 100) // Limit length
      .trim()
  },

  // Sanitize card search queries
  cardQuery: (input: string): string => {
    return input
      .replace(/[<>\"'&;]/g, '') // Remove potentially dangerous characters
      .substring(0, 500) // Limit length
      .trim()
  },
}

/**
 * Enhanced input validation schemas
 */
export const secureSchemas = {
  deckName: z.string()
    .min(1, 'Deck name is required')
    .max(100, 'Deck name must be less than 100 characters')
    .transform(sanitizeInput.deckName),

  deckDescription: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .transform(sanitizeInput.html)
    .optional(),

  cardQuery: z.string()
    .min(1, 'Search query is required')
    .max(500, 'Search query must be less than 500 characters')
    .transform(sanitizeInput.cardQuery),

  userPrompt: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must be less than 2000 characters')
    .transform(sanitizeInput.text),

  sessionId: z.string()
    .uuid('Invalid session ID format'),

  cardId: z.string()
    .uuid('Invalid card ID format'),

  deckId: z.string()
    .cuid('Invalid deck ID format'),

  budget: z.number()
    .min(0, 'Budget must be positive')
    .max(10000, 'Budget must be less than $10,000'),

  powerLevel: z.number()
    .int('Power level must be an integer')
    .min(1, 'Power level must be at least 1')
    .max(10, 'Power level must be at most 10'),
}

/**
 * Session management utilities
 */
export class SessionManager {
  constructor(private prisma: PrismaClient) {}

  async validateSession(sessionToken: string): Promise<{ valid: boolean; userId?: string; user?: any }> {
    try {
      const session = await this.prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      })

      if (!session || session.expires < new Date()) {
        return { valid: false }
      }

      return {
        valid: true,
        userId: session.userId,
        user: session.user,
      }
    } catch (error) {
      console.error('Session validation error:', error)
      return { valid: false }
    }
  }

  async invalidateSession(sessionToken: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({
        where: { sessionToken },
      })
      return true
    } catch (error) {
      console.error('Session invalidation error:', error)
      return false
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.prisma.session.deleteMany({
        where: {
          expires: { lt: new Date() },
        },
      })
      return result.count
    } catch (error) {
      console.error('Session cleanup error:', error)
      return 0
    }
  }

  async getUserSessions(userId: string): Promise<any[]> {
    try {
      return await this.prisma.session.findMany({
        where: { 
          userId,
          expires: { gt: new Date() },
        },
        orderBy: { expires: 'desc' },
      })
    } catch (error) {
      console.error('Get user sessions error:', error)
      return []
    }
  }
}

/**
 * Security audit logging
 */
export class SecurityAuditLogger {
  constructor(private prisma: PrismaClient) {}

  async logSecurityEvent(event: {
    userId?: string
    action: string
    resource?: string
    ipAddress?: string
    userAgent?: string
    success: boolean
    details?: Record<string, any>
  }): Promise<void> {
    try {
      await this.prisma.performanceMetric.create({
        data: {
          userId: event.userId,
          operation: `security_${event.action}`,
          duration: 0,
          success: event.success,
          metadata: {
            resource: event.resource,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            details: event.details,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      console.error('Security audit logging error:', error)
    }
  }

  async logAuthAttempt(userId: string, success: boolean, ipAddress?: string): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action: 'auth_attempt',
      ipAddress,
      success,
      details: { timestamp: new Date().toISOString() },
    })
  }

  async logRateLimitExceeded(userId: string, operation: string, ipAddress?: string): Promise<void> {
    await this.logSecurityEvent({
      userId,
      action: 'rate_limit_exceeded',
      resource: operation,
      ipAddress,
      success: false,
      details: { operation, timestamp: new Date().toISOString() },
    })
  }
}

/**
 * API key management for external services
 */
export class APIKeyManager {
  private static instance: APIKeyManager
  private keys: Map<string, { key: string; lastRotated: Date }> = new Map()

  static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager()
    }
    return APIKeyManager.instance
  }

  getKey(service: 'openai' | 'scryfall' | 'edhrec'): string | null {
    switch (service) {
      case 'openai':
        return process.env.OPENAI_API_KEY || null
      case 'scryfall':
        return process.env.SCRYFALL_API_KEY || null
      case 'edhrec':
        return process.env.EDHREC_API_KEY || null
      default:
        return null
    }
  }

  validateKeyFormat(service: string, key: string): boolean {
    switch (service) {
      case 'openai':
        return key.startsWith('sk-') && key.length > 20
      case 'scryfall':
        return key.length > 10 // Basic validation
      case 'edhrec':
        return key.length > 10 // Basic validation
      default:
        return false
    }
  }

  maskKey(key: string): string {
    if (key.length <= 8) return '***'
    return key.substring(0, 4) + '***' + key.substring(key.length - 4)
  }
}

// Export singleton instances
export const rateLimiters = {
  ai: new RateLimiter(defaultSecurityConfig.rateLimits.ai),
  general: new RateLimiter(defaultSecurityConfig.rateLimits.general),
  auth: new RateLimiter(defaultSecurityConfig.rateLimits.auth),
}

export const csrfProtection = new CSRFProtection(defaultSecurityConfig.csrfSecret)
export const apiKeyManager = APIKeyManager.getInstance()