import { TRPCError } from '@trpc/server'
import { sentryService } from '../services/monitoring/SentryService'
import { metricsService } from '../services/monitoring/MetricsService'
import type { Context } from '../trpc'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (ctx: Context) => string
  onLimitReached?: (ctx: Context, info: RateLimitInfo) => void
}

export interface RateLimitInfo {
  totalHits: number
  totalHitsInWindow: number
  resetTime: Date
  remainingRequests: number
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitInfo | null>
  set(key: string, info: RateLimitInfo): Promise<void>
  increment(key: string, windowMs: number): Promise<RateLimitInfo>
  reset(key: string): Promise<void>
}

// In-memory rate limit store (for development/single instance)
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>()

  async get(key: string): Promise<RateLimitInfo | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now > entry.resetTime) {
      this.store.delete(key)
      return null
    }

    return {
      totalHits: entry.count,
      totalHitsInWindow: entry.count,
      resetTime: new Date(entry.resetTime),
      remainingRequests: 0, // Will be calculated by the rate limiter
    }
  }

  async set(key: string, info: RateLimitInfo): Promise<void> {
    this.store.set(key, {
      count: info.totalHitsInWindow,
      resetTime: info.resetTime.getTime(),
    })
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now()
    const resetTime = now + windowMs
    const entry = this.store.get(key)

    if (!entry || now > entry.resetTime) {
      // Create new entry
      const newInfo: RateLimitInfo = {
        totalHits: 1,
        totalHitsInWindow: 1,
        resetTime: new Date(resetTime),
        remainingRequests: 0,
      }
      
      this.store.set(key, {
        count: 1,
        resetTime,
      })
      
      return newInfo
    }

    // Increment existing entry
    entry.count++
    const info: RateLimitInfo = {
      totalHits: entry.count,
      totalHitsInWindow: entry.count,
      resetTime: new Date(entry.resetTime),
      remainingRequests: 0,
    }

    return info
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }
}

// Redis rate limit store (for production/multi-instance)
class RedisRateLimitStore implements RateLimitStore {
  private redis: any

  constructor() {
    if (process.env.REDIS_URL) {
      // Import Redis dynamically
      import('ioredis').then(Redis => {
        this.redis = new Redis.default(process.env.REDIS_URL!)
      })
    }
  }

  async get(key: string): Promise<RateLimitInfo | null> {
    if (!this.redis) return null

    try {
      const data = await this.redis.get(`ratelimit:${key}`)
      if (!data) return null

      const parsed = JSON.parse(data)
      return {
        totalHits: parsed.count,
        totalHitsInWindow: parsed.count,
        resetTime: new Date(parsed.resetTime),
        remainingRequests: 0,
      }
    } catch (error) {
      console.warn('Redis rate limit get error:', error)
      return null
    }
  }

  async set(key: string, info: RateLimitInfo): Promise<void> {
    if (!this.redis) return

    try {
      const data = JSON.stringify({
        count: info.totalHitsInWindow,
        resetTime: info.resetTime.getTime(),
      })

      const ttl = Math.ceil((info.resetTime.getTime() - Date.now()) / 1000)
      await this.redis.setex(`ratelimit:${key}`, ttl, data)
    } catch (error) {
      console.warn('Redis rate limit set error:', error)
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    if (!this.redis) {
      // Fallback to memory store
      return memoryStore.increment(key, windowMs)
    }

    try {
      const redisKey = `ratelimit:${key}`
      const now = Date.now()
      const resetTime = now + windowMs

      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000))
      
      const results = await pipeline.exec()
      const count = results[0][1] as number

      return {
        totalHits: count,
        totalHitsInWindow: count,
        resetTime: new Date(resetTime),
        remainingRequests: 0,
      }
    } catch (error) {
      console.warn('Redis rate limit increment error:', error)
      return memoryStore.increment(key, windowMs)
    }
  }

  async reset(key: string): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.del(`ratelimit:${key}`)
    } catch (error) {
      console.warn('Redis rate limit reset error:', error)
    }
  }
}

// Store instances
const memoryStore = new MemoryRateLimitStore()
const redisStore = new RedisRateLimitStore()

// Cleanup memory store periodically
setInterval(() => {
  memoryStore.cleanup()
}, 60000) // Every minute

export class RateLimiter {
  private config: RateLimitConfig
  private store: RateLimitStore

  constructor(config: RateLimitConfig) {
    this.config = config
    this.store = process.env.REDIS_URL ? redisStore : memoryStore
  }

  async checkLimit(ctx: Context): Promise<RateLimitInfo> {
    const key = this.generateKey(ctx)
    const info = await this.store.increment(key, this.config.windowMs)
    
    info.remainingRequests = Math.max(0, this.config.maxRequests - info.totalHitsInWindow)

    // Record metrics
    metricsService.recordMetric({
      name: 'rate_limit.request',
      value: 1,
      unit: 'count',
      tags: {
        key: this.sanitizeKey(key),
        userId: ctx.user?.id || 'anonymous',
        exceeded: (info.totalHitsInWindow > this.config.maxRequests).toString(),
      },
    })

    // Check if limit exceeded
    if (info.totalHitsInWindow > this.config.maxRequests) {
      // Record rate limit exceeded
      metricsService.recordError('rate_limit', 'exceeded', {
        key: this.sanitizeKey(key),
        userId: ctx.user?.id || 'anonymous',
        requests: info.totalHitsInWindow.toString(),
        limit: this.config.maxRequests.toString(),
      })

      // Log rate limit violation
      sentryService.captureMessage(
        `Rate limit exceeded for key: ${this.sanitizeKey(key)}`,
        'warning',
        {
          userId: ctx.user?.id,
          component: 'RateLimiter',
          metadata: {
            key: this.sanitizeKey(key),
            requests: info.totalHitsInWindow,
            limit: this.config.maxRequests,
            windowMs: this.config.windowMs,
          },
        }
      )

      // Call custom handler if provided
      if (this.config.onLimitReached) {
        this.config.onLimitReached(ctx, info)
      }

      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil((info.resetTime.getTime() - Date.now()) / 1000)} seconds.`,
        cause: {
          rateLimitInfo: info,
          retryAfter: Math.ceil((info.resetTime.getTime() - Date.now()) / 1000),
        },
      })
    }

    return info
  }

  private generateKey(ctx: Context): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(ctx)
    }

    // Default key generation strategy
    const parts: string[] = []

    // Use user ID if authenticated
    if (ctx.user?.id) {
      parts.push(`user:${ctx.user.id}`)
    } else {
      // Use IP address for anonymous users
      const ip = this.getClientIP(ctx)
      parts.push(`ip:${ip}`)
    }

    // Add procedure name if available
    if (ctx.procedure) {
      parts.push(`proc:${ctx.procedure}`)
    }

    return parts.join(':')
  }

  private getClientIP(ctx: Context): string {
    // Try to get real IP from headers (for proxied requests)
    const forwarded = ctx.req?.headers['x-forwarded-for']
    if (forwarded && typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }

    const realIP = ctx.req?.headers['x-real-ip']
    if (realIP && typeof realIP === 'string') {
      return realIP
    }

    // Fallback to connection remote address
    return ctx.req?.socket?.remoteAddress || 'unknown'
  }

  private sanitizeKey(key: string): string {
    // Remove sensitive information from key for logging
    return key.replace(/user:\w+/g, 'user:***').replace(/ip:[\d.]+/g, 'ip:***')
  }
}

// Predefined rate limiters for different use cases
export const rateLimiters = {
  // General API rate limiting
  general: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
  }),

  // Strict rate limiting for expensive operations
  strict: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  }),

  // AI generation rate limiting
  aiGeneration: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 deck generations per hour
    onLimitReached: (ctx, info) => {
      console.warn(`AI generation rate limit exceeded for user ${ctx.user?.id || 'anonymous'}`)
    },
  }),

  // Authentication rate limiting
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 auth attempts per 15 minutes
    keyGenerator: (ctx) => {
      const ip = ctx.req?.headers['x-forwarded-for'] || ctx.req?.socket?.remoteAddress || 'unknown'
      return `auth:${ip}`
    },
  }),

  // Card search rate limiting
  cardSearch: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 searches per minute
  }),
}

// Middleware factory for tRPC procedures
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (opts: { ctx: Context; next: () => Promise<any> }) => {
    await limiter.checkLimit(opts.ctx)
    return opts.next()
  }
}

// DDoS protection middleware
export class DDoSProtection {
  private suspiciousIPs = new Map<string, { count: number; firstSeen: number }>()
  private blockedIPs = new Set<string>()
  private readonly SUSPICIOUS_THRESHOLD = 100 // requests per minute
  private readonly BLOCK_DURATION = 60 * 60 * 1000 // 1 hour

  checkRequest(ctx: Context): void {
    const ip = this.getClientIP(ctx)
    const now = Date.now()

    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      metricsService.recordError('ddos', 'blocked_request', { ip })
      
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your IP address has been temporarily blocked due to suspicious activity.',
      })
    }

    // Track suspicious activity
    const suspicious = this.suspiciousIPs.get(ip)
    if (suspicious) {
      // Reset counter if more than a minute has passed
      if (now - suspicious.firstSeen > 60000) {
        this.suspiciousIPs.set(ip, { count: 1, firstSeen: now })
      } else {
        suspicious.count++
        
        // Block if threshold exceeded
        if (suspicious.count > this.SUSPICIOUS_THRESHOLD) {
          this.blockedIPs.add(ip)
          this.suspiciousIPs.delete(ip)
          
          // Schedule unblock
          setTimeout(() => {
            this.blockedIPs.delete(ip)
            console.log(`Unblocked IP: ${ip}`)
          }, this.BLOCK_DURATION)

          metricsService.recordError('ddos', 'ip_blocked', { ip })
          
          sentryService.captureMessage(
            `IP blocked for DDoS protection: ${ip}`,
            'warning',
            {
              component: 'DDoSProtection',
              metadata: { ip, requestCount: suspicious.count },
            }
          )

          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Your IP address has been temporarily blocked due to suspicious activity.',
          })
        }
      }
    } else {
      this.suspiciousIPs.set(ip, { count: 1, firstSeen: now })
    }

    // Cleanup old entries
    this.cleanup()
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

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - 60000 // 1 minute ago

    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (data.firstSeen < cutoff) {
        this.suspiciousIPs.delete(ip)
      }
    }
  }

  getStats(): { suspiciousIPs: number; blockedIPs: number } {
    return {
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: this.blockedIPs.size,
    }
  }
}

// Export singleton DDoS protection instance
export const ddosProtection = new DDoSProtection()