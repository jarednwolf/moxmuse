import { PrismaClient } from '@moxmuse/db'
import { performance } from 'perf_hooks'

/**
 * Advanced API Response Caching and Memoization Service
 * Provides intelligent caching with TTL, invalidation, and performance optimization
 */

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: Date
  ttl: number
  accessCount: number
  lastAccessed: Date
  size: number
  tags: string[]
  metadata?: Record<string, any>
}

export interface CacheStats {
  hitRate: number
  missRate: number
  totalRequests: number
  totalHits: number
  totalMisses: number
  cacheSize: number
  memoryUsage: number
  evictions: number
  averageAccessTime: number
}

export interface CacheConfiguration {
  maxSize: number
  defaultTTL: number
  maxMemoryUsage: number
  enableCompression: boolean
  enablePersistence: boolean
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size'
}

/**
 * Multi-level cache with memory and persistent storage
 */
export class AdvancedCachingService {
  private memoryCache = new Map<string, CacheEntry>()
  private accessTimes = new Map<string, number[]>()
  private stats: CacheStats = {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    cacheSize: 0,
    memoryUsage: 0,
    evictions: 0,
    averageAccessTime: 0
  }

  private config: CacheConfiguration = {
    maxSize: 10000,
    defaultTTL: 300000, // 5 minutes
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    enableCompression: true,
    enablePersistence: true,
    evictionPolicy: 'lru'
  }

  constructor(
    private prisma: PrismaClient,
    config?: Partial<CacheConfiguration>
  ) {
    this.config = { ...this.config, ...config }
    this.startPeriodicCleanup()
    this.loadPersistentCache()
  }

  /**
   * Get value from cache with performance tracking
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now()
    this.stats.totalRequests++

    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key)
      if (memoryEntry && this.isValidEntry(memoryEntry)) {
        this.updateAccessStats(key, memoryEntry, performance.now() - startTime)
        this.stats.totalHits++
        this.updateHitRate()
        return memoryEntry.value as T
      }

      // Check persistent cache if enabled
      if (this.config.enablePersistence) {
        const persistentEntry = await this.getPersistentEntry<T>(key)
        if (persistentEntry) {
          // Promote to memory cache
          this.memoryCache.set(key, persistentEntry)
          this.updateAccessStats(key, persistentEntry, performance.now() - startTime)
          this.stats.totalHits++
          this.updateHitRate()
          return persistentEntry.value as T
        }
      }

      // Cache miss
      this.stats.totalMisses++
      this.updateHitRate()
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.totalMisses++
      this.updateHitRate()
      return null
    }
  }

  /**
   * Set value in cache with intelligent storage
   */
  async set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number
      tags?: string[]
      metadata?: Record<string, any>
      priority?: 'low' | 'medium' | 'high'
    } = {}
  ): Promise<void> {
    const {
      ttl = this.config.defaultTTL,
      tags = [],
      metadata = {},
      priority = 'medium'
    } = options

    try {
      const serializedValue = this.serializeValue(value)
      const size = this.calculateSize(serializedValue)

      // Check memory constraints
      if (this.shouldEvict(size)) {
        await this.evictEntries(size)
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: new Date(),
        ttl,
        accessCount: 0,
        lastAccessed: new Date(),
        size,
        tags,
        metadata: { ...metadata, priority }
      }

      // Store in memory cache
      this.memoryCache.set(key, entry)
      this.stats.cacheSize = this.memoryCache.size
      this.updateMemoryUsage()

      // Store in persistent cache if enabled
      if (this.config.enablePersistence) {
        await this.setPersistentEntry(entry)
      }

      console.log(`📦 Cached: ${key} (${size} bytes, TTL: ${ttl}ms)`)
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  /**
   * Memoization wrapper for functions
   */
  memoize<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    options: {
      keyGenerator?: (...args: TArgs) => string
      ttl?: number
      tags?: string[]
      maxAge?: number
    } = {}
  ): (...args: TArgs) => Promise<TReturn> {
    const {
      keyGenerator = (...args) => `memoized:${fn.name}:${JSON.stringify(args)}`,
      ttl = this.config.defaultTTL,
      tags = [],
      maxAge = ttl
    } = options

    return async (...args: TArgs): Promise<TReturn> => {
      const key = keyGenerator(...args)
      
      // Try to get from cache
      const cached = await this.get<TReturn>(key)
      if (cached !== null) {
        return cached
      }

      // Execute function and cache result
      const startTime = performance.now()
      try {
        const result = await fn(...args)
        const executionTime = performance.now() - startTime
        
        await this.set(key, result, {
          ttl: Math.min(ttl, maxAge),
          tags: [...tags, 'memoized', fn.name],
          metadata: {
            functionName: fn.name,
            executionTime,
            args: args.length
          }
        })

        return result
      } catch (error) {
        // Don't cache errors, but log them
        console.error(`Memoized function error: ${fn.name}`, error)
        throw error
      }
    }
  }

  /**
   * Invalidate cache entries by key pattern or tags
   */
  async invalidate(pattern: string | RegExp | { tags: string[] }): Promise<number> {
    let invalidated = 0

    try {
      if (typeof pattern === 'string') {
        // Exact key match
        if (this.memoryCache.has(pattern)) {
          this.memoryCache.delete(pattern)
          invalidated++
        }
        if (this.config.enablePersistence) {
          await this.deletePersistentEntry(pattern)
        }
      } else if (pattern instanceof RegExp) {
        // Pattern matching
        for (const [key] of this.memoryCache) {
          if (pattern.test(key)) {
            this.memoryCache.delete(key)
            invalidated++
            if (this.config.enablePersistence) {
              await this.deletePersistentEntry(key)
            }
          }
        }
      } else if (pattern.tags) {
        // Tag-based invalidation
        for (const [key, entry] of this.memoryCache) {
          if (entry.tags.some(tag => pattern.tags.includes(tag))) {
            this.memoryCache.delete(key)
            invalidated++
            if (this.config.enablePersistence) {
              await this.deletePersistentEntry(key)
            }
          }
        }
      }

      this.stats.cacheSize = this.memoryCache.size
      this.updateMemoryUsage()
      
      console.log(`🗑️ Invalidated ${invalidated} cache entries`)
      return invalidated
    } catch (error) {
      console.error('Cache invalidation error:', error)
      return 0
    }
  }

  /**
   * Batch operations for better performance
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>()
    
    // Batch get from memory cache
    const memoryResults = new Map<string, T>()
    const missingKeys: string[] = []

    for (const key of keys) {
      const entry = this.memoryCache.get(key)
      if (entry && this.isValidEntry(entry)) {
        memoryResults.set(key, entry.value as T)
        this.stats.totalHits++
      } else {
        missingKeys.push(key)
        this.stats.totalMisses++
      }
      this.stats.totalRequests++
    }

    // Get missing keys from persistent cache
    if (this.config.enablePersistence && missingKeys.length > 0) {
      const persistentResults = await this.getBatchPersistentEntries<T>(missingKeys)
      for (const [key, entry] of persistentResults) {
        if (entry) {
          memoryResults.set(key, entry.value)
          // Promote to memory cache
          this.memoryCache.set(key, entry)
        }
      }
    }

    // Combine results
    for (const key of keys) {
      results.set(key, memoryResults.get(key) || null)
    }

    this.updateHitRate()
    return results
  }

  async mset<T>(entries: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    const promises = entries.map(({ key, value, options }) => 
      this.set(key, value, options)
    )
    await Promise.all(promises)
  }

  /**
   * Cache warming for predictive loading
   */
  async warmCache(warmingStrategy: {
    keys?: string[]
    patterns?: string[]
    tags?: string[]
    loader?: (key: string) => Promise<any>
  }): Promise<number> {
    let warmed = 0

    try {
      if (warmingStrategy.keys && warmingStrategy.loader) {
        for (const key of warmingStrategy.keys) {
          if (!this.memoryCache.has(key)) {
            try {
              const value = await warmingStrategy.loader(key)
              await this.set(key, value, { tags: ['warmed'] })
              warmed++
            } catch (error) {
              console.warn(`Failed to warm cache for key: ${key}`, error)
            }
          }
        }
      }

      console.log(`🔥 Warmed ${warmed} cache entries`)
      return warmed
    } catch (error) {
      console.error('Cache warming error:', error)
      return 0
    }
  }

  // Private helper methods
  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now()
    const entryTime = entry.timestamp.getTime()
    return (now - entryTime) < entry.ttl
  }

  private updateAccessStats(key: string, entry: CacheEntry, accessTime: number) {
    entry.accessCount++
    entry.lastAccessed = new Date()
    
    // Track access times for performance analysis
    if (!this.accessTimes.has(key)) {
      this.accessTimes.set(key, [])
    }
    const times = this.accessTimes.get(key)!
    times.push(accessTime)
    if (times.length > 100) {
      times.shift() // Keep only last 100 access times
    }
  }

  private updateHitRate() {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? (this.stats.totalHits / this.stats.totalRequests) * 100 
      : 0
    this.stats.missRate = 100 - this.stats.hitRate
  }

  private updateMemoryUsage() {
    let totalSize = 0
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size
    }
    this.stats.memoryUsage = totalSize
  }

  private shouldEvict(newEntrySize: number): boolean {
    return (
      this.memoryCache.size >= this.config.maxSize ||
      this.stats.memoryUsage + newEntrySize > this.config.maxMemoryUsage
    )
  }

  private async evictEntries(requiredSpace: number): Promise<void> {
    const entriesToEvict: string[] = []
    let freedSpace = 0

    // Sort entries by eviction policy
    const sortedEntries = Array.from(this.memoryCache.entries()).sort((a, b) => {
      switch (this.config.evictionPolicy) {
        case 'lru':
          return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
        case 'lfu':
          return a[1].accessCount - b[1].accessCount
        case 'ttl':
          return a[1].timestamp.getTime() - b[1].timestamp.getTime()
        case 'size':
          return b[1].size - a[1].size
        default:
          return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
      }
    })

    // Evict entries until we have enough space
    for (const [key, entry] of sortedEntries) {
      if (freedSpace >= requiredSpace && this.memoryCache.size < this.config.maxSize) {
        break
      }
      
      entriesToEvict.push(key)
      freedSpace += entry.size
      this.stats.evictions++
    }

    // Remove evicted entries
    for (const key of entriesToEvict) {
      this.memoryCache.delete(key)
      this.accessTimes.delete(key)
    }

    console.log(`🗑️ Evicted ${entriesToEvict.length} entries, freed ${freedSpace} bytes`)
  }

  private serializeValue(value: any): string {
    return JSON.stringify(value)
  }

  private calculateSize(serializedValue: string): number {
    return Buffer.byteLength(serializedValue, 'utf8')
  }

  // Persistent cache methods
  private async getPersistentEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const result = await this.prisma.performanceMetric.findFirst({
        where: {
          operation: 'cache_entry',
          metadata: {
            path: ['cacheKey'],
            equals: key
          }
        },
        orderBy: { timestamp: 'desc' }
      })

      if (result && result.metadata) {
        const entry = result.metadata as any
        if (this.isValidEntry(entry)) {
          return entry as CacheEntry<T>
        }
      }

      return null
    } catch (error) {
      console.error('Persistent cache get error:', error)
      return null
    }
  }

  private async setPersistentEntry(entry: CacheEntry): Promise<void> {
    try {
      await this.prisma.performanceMetric.create({
        data: {
          operation: 'cache_entry',
          duration: 0,
          success: true,
          timestamp: entry.timestamp,
          metadata: {
            cacheKey: entry.key,
            ...entry
          }
        }
      })
    } catch (error) {
      console.error('Persistent cache set error:', error)
    }
  }

  private async deletePersistentEntry(key: string): Promise<void> {
    try {
      await this.prisma.performanceMetric.deleteMany({
        where: {
          operation: 'cache_entry',
          metadata: {
            path: ['cacheKey'],
            equals: key
          }
        }
      })
    } catch (error) {
      console.error('Persistent cache delete error:', error)
    }
  }

  private async getBatchPersistentEntries<T>(keys: string[]): Promise<Map<string, CacheEntry<T> | null>> {
    const results = new Map<string, CacheEntry<T> | null>()
    
    try {
      const entries = await this.prisma.performanceMetric.findMany({
        where: {
          operation: 'cache_entry',
          metadata: {
            path: ['cacheKey'],
            in: keys
          }
        }
      })

      for (const entry of entries) {
        if (entry.metadata) {
          const cacheEntry = entry.metadata as any
          if (this.isValidEntry(cacheEntry)) {
            results.set(cacheEntry.cacheKey, cacheEntry as CacheEntry<T>)
          }
        }
      }

      // Fill in missing keys with null
      for (const key of keys) {
        if (!results.has(key)) {
          results.set(key, null)
        }
      }
    } catch (error) {
      console.error('Batch persistent cache get error:', error)
      // Return null for all keys on error
      for (const key of keys) {
        results.set(key, null)
      }
    }

    return results
  }

  private async loadPersistentCache(): Promise<void> {
    if (!this.config.enablePersistence) return

    try {
      const entries = await this.prisma.performanceMetric.findMany({
        where: {
          operation: 'cache_entry',
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        take: 1000 // Limit initial load
      })

      let loaded = 0
      for (const entry of entries) {
        if (entry.metadata) {
          const cacheEntry = entry.metadata as any
          if (this.isValidEntry(cacheEntry) && this.memoryCache.size < this.config.maxSize) {
            this.memoryCache.set(cacheEntry.cacheKey, cacheEntry)
            loaded++
          }
        }
      }

      console.log(`📥 Loaded ${loaded} cache entries from persistent storage`)
    } catch (error) {
      console.error('Failed to load persistent cache:', error)
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  private cleanup(): void {
    let cleaned = 0
    const now = Date.now()

    for (const [key, entry] of this.memoryCache) {
      if (!this.isValidEntry(entry)) {
        this.memoryCache.delete(key)
        this.accessTimes.delete(key)
        cleaned++
      }
    }

    this.stats.cacheSize = this.memoryCache.size
    this.updateMemoryUsage()

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`)
    }
  }

  // Public API methods
  getStats(): CacheStats {
    // Calculate average access time
    const allAccessTimes = Array.from(this.accessTimes.values()).flat()
    this.stats.averageAccessTime = allAccessTimes.length > 0
      ? allAccessTimes.reduce((a, b) => a + b, 0) / allAccessTimes.length
      : 0

    return { ...this.stats }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear()
    this.accessTimes.clear()
    this.stats.cacheSize = 0
    this.stats.memoryUsage = 0

    if (this.config.enablePersistence) {
      await this.prisma.performanceMetric.deleteMany({
        where: { operation: 'cache_entry' }
      })
    }

    console.log('🗑️ Cache cleared')
  }

  destroy(): void {
    this.memoryCache.clear()
    this.accessTimes.clear()
  }
}

// Export factory function
export const createCachingService = (
  prisma: PrismaClient,
  config?: Partial<CacheConfiguration>
) => {
  return new AdvancedCachingService(prisma, config)
}

// Decorator for automatic caching
export function Cached(options: {
  ttl?: number
  tags?: string[]
  keyGenerator?: (...args: any[]) => string
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // This would need to be injected or accessed from context
      // For now, it's a placeholder for the decorator pattern
      const cacheService = (this as any).cacheService as AdvancedCachingService
      
      if (cacheService) {
        const memoized = cacheService.memoize(originalMethod.bind(this), options)
        return memoized(...args)
      }
      
      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}