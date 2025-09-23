import Redis from 'ioredis'
import { z } from 'zod'

// Cache entry interface
interface CacheEntry<T = any> {
  value: T
  expiresAt: number
  createdAt: number
  tags?: string[]
}

// Cache configuration
interface CacheConfig {
  memoryTtl: number // Memory cache TTL in milliseconds
  redisTtl: number // Redis cache TTL in seconds
  maxMemorySize: number // Maximum memory cache size
  compressionThreshold: number // Compress values larger than this
}

// Cache statistics
interface CacheStats {
  memoryHits: number
  memoryMisses: number
  redisHits: number
  redisMisses: number
  memorySize: number
  redisConnected: boolean
}

// Cache key patterns
export const CacheKeys = {
  CARD_DATA: (cardId: string) => `card:${cardId}`,
  CARD_SEARCH: (query: string) => `search:${Buffer.from(query).toString('base64')}`,
  DECK_ANALYSIS: (deckId: string) => `deck:analysis:${deckId}`,
  CONSULTATION_SESSION: (sessionId: string) => `session:${sessionId}`,
  USER_PREFERENCES: (userId: string) => `user:prefs:${userId}`,
  FORMAT_LEGALITY: (cardId: string, format: string) => `legality:${cardId}:${format}`,
  PRICE_DATA: (cardId: string) => `price:${cardId}`,
  AI_GENERATION: (promptHash: string) => `ai:gen:${promptHash}`,
} as const

export class CacheService {
  private redis: Redis | null = null
  private memoryCache = new Map<string, CacheEntry>()
  private stats: CacheStats = {
    memoryHits: 0,
    memoryMisses: 0,
    redisHits: 0,
    redisMisses: 0,
    memorySize: 0,
    redisConnected: false,
  }

  private readonly config: CacheConfig = {
    memoryTtl: 5 * 60 * 1000, // 5 minutes
    redisTtl: 60 * 60, // 1 hour
    maxMemorySize: 100 * 1024 * 1024, // 100MB
    compressionThreshold: 1024, // 1KB
  }

  constructor() {
    this.initializeRedis()
    this.startCleanupInterval()
  }

  private initializeRedis(): void {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        })

        this.redis.on('connect', () => {
          this.stats.redisConnected = true
          console.log('Redis cache connected')
        })

        this.redis.on('error', (error) => {
          this.stats.redisConnected = false
          console.warn('Redis cache error:', error.message)
        })
      }
    } catch (error) {
      console.warn('Failed to initialize Redis cache:', error)
    }
  }

  /**
   * Get value from cache with multi-layer fallback
   */
  async get<T>(key: string, schema?: z.ZodSchema<T>): Promise<T | null> {
    // Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.stats.memoryHits++
      return schema ? schema.parse(memoryEntry.value) : memoryEntry.value
    }

    this.stats.memoryMisses++

    // Check Redis cache (fast)
    if (this.redis && this.stats.redisConnected) {
      try {
        const redisValue = await this.redis.get(key)
        if (redisValue) {
          this.stats.redisHits++
          const parsed = JSON.parse(redisValue) as T

          // Update memory cache with shorter TTL
          this.setMemoryCache(key, parsed, this.config.memoryTtl)

          return schema ? schema.parse(parsed) : parsed
        }
      } catch (error) {
        console.warn('Redis get error:', error)
      }
    }

    this.stats.redisMisses++
    return null
  }

  /**
   * Set value in both memory and Redis cache
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      memoryTtl?: number
      redisTtl?: number
      tags?: string[]
    } = {}
  ): Promise<void> {
    const memoryTtl = options.memoryTtl ?? this.config.memoryTtl
    const redisTtl = options.redisTtl ?? this.config.redisTtl

    // Set in memory cache
    this.setMemoryCache(key, value, memoryTtl, options.tags)

    // Set in Redis cache
    if (this.redis && this.stats.redisConnected) {
      try {
        const serialized = JSON.stringify(value)
        await this.redis.setex(key, redisTtl, serialized)
      } catch (error) {
        console.warn('Redis set error:', error)
      }
    }
  }

  /**
   * Delete from both caches
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
    this.updateMemorySize()

    if (this.redis && this.stats.redisConnected) {
      try {
        await this.redis.del(key)
      } catch (error) {
        console.warn('Redis delete error:', error)
      }
    }
  }

  /**
   * Delete by pattern (Redis only, memory cache uses tags)
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0

    if (this.redis && this.stats.redisConnected) {
      try {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          deletedCount = await this.redis.del(...keys)
        }
      } catch (error) {
        console.warn('Redis delete pattern error:', error)
      }
    }

    return deletedCount
  }

  /**
   * Delete by tags (memory cache only)
   */
  deleteByTags(tags: string[]): number {
    let deletedCount = 0
    const toDelete: string[] = []

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        toDelete.push(key)
      }
    }

    toDelete.forEach(key => {
      this.memoryCache.delete(key)
      deletedCount++
    })

    this.updateMemorySize()
    return deletedCount
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    this.stats.memorySize = 0

    if (this.redis && this.stats.redisConnected) {
      try {
        await this.redis.flushdb()
      } catch (error) {
        console.warn('Redis clear error:', error)
      }
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpData: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const promises = warmUpData.map(({ key, value, ttl }) =>
      this.set(key, value, { redisTtl: ttl })
    )

    await Promise.allSettled(promises)
  }

  private setMemoryCache<T>(
    key: string,
    value: T,
    ttl: number,
    tags?: string[]
  ): void {
    // Check memory size limit
    if (this.stats.memorySize > this.config.maxMemorySize) {
      this.evictLRU()
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      tags,
    }

    this.memoryCache.set(key, entry)
    this.updateMemorySize()
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt
  }

  private updateMemorySize(): void {
    this.stats.memorySize = JSON.stringify([...this.memoryCache.entries()]).length
  }

  private evictLRU(): void {
    // Remove oldest entries until under size limit
    const entries = Array.from(this.memoryCache.entries())
    entries.sort(([, a], [, b]) => a.createdAt - b.createdAt)

    const toRemove = Math.ceil(entries.length * 0.1) // Remove 10% of entries
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.memoryCache.delete(entries[i][0])
    }

    this.updateMemorySize()
  }

  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now()
      const toDelete: string[] = []

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          toDelete.push(key)
        }
      }

      toDelete.forEach(key => this.memoryCache.delete(key))
      this.updateMemorySize()
    }, 5 * 60 * 1000)
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect()
      this.stats.redisConnected = false
    }
  }
}

// Singleton instance
export const cacheService = new CacheService()