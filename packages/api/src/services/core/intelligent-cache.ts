/**
 * Intelligent Caching Layer
 * 
 * Provides multi-level caching with intelligent invalidation, compression,
 * tag-based cache management, and performance optimization.
 */

import {
  CacheService,
  CacheOptions,
  CacheStats,
  Logger,
  MetricsCollector,
  BaseService,
  ServiceHealthStatus
} from './interfaces'

interface CacheEntry<T = any> {
  value: T
  ttl: number
  createdAt: number
  lastAccessed: number
  accessCount: number
  tags: Set<string>
  compressed: boolean
  size: number
}

interface CacheConfig {
  maxMemory: number // Maximum memory usage in bytes
  defaultTtl: number // Default TTL in seconds
  compressionThreshold: number // Compress values larger than this (bytes)
  maxKeyLength: number
  cleanupInterval: number // Cleanup interval in milliseconds
  enableMetrics: boolean
}

export class IntelligentCache implements CacheService, BaseService {
  readonly name = 'IntelligentCache'
  readonly version = '1.0.0'
  private cache = new Map<string, CacheEntry>()
  private tagIndex = new Map<string, Set<string>>() // tag -> set of keys
  private config: CacheConfig
  private logger: Logger
  private metrics?: MetricsCollector
  private stats: CacheStats
  private cleanupTimer?: NodeJS.Timeout
  private memoryUsage = 0

  constructor(
    config: Partial<CacheConfig> = {},
    logger: Logger,
    metrics?: MetricsCollector
  ) {
    this.config = {
      maxMemory: 100 * 1024 * 1024, // 100MB default
      defaultTtl: 3600, // 1 hour default
      compressionThreshold: 1024, // 1KB
      maxKeyLength: 250,
      cleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config
    }

    this.logger = logger.child({ service: 'IntelligentCache' })
    this.metrics = metrics

    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      memoryUsage: 0,
      keyCount: 0
    }

    this.startCleanupTimer()
  }

  async initialize(): Promise<void> {
    // Cache initialization if needed
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    const stats = await this.getStats()
    return {
      status: 'healthy',
      metrics: {
        hitRate: stats.hitRate,
        keyCount: stats.keyCount,
        memoryUsage: stats.memoryUsage
      },
      timestamp: new Date()
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.validateKey(key)

    const entry = this.cache.get(key)
    if (!entry) {
      this.recordMiss(key)
      return null
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key)
      this.recordMiss(key)
      return null
    }

    // Update access statistics
    entry.lastAccessed = Date.now()
    entry.accessCount++

    this.recordHit(key)

    // Decompress and deserialize if needed
    let value = entry.compressed ? this.decompress(entry.value) : entry.value
    
    // If the value was serialized, deserialize it
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {
        // If parsing fails, return the string as-is
      }
    }
    
    return value as T
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    this.validateKey(key)

    const ttl = options.ttl || this.config.defaultTtl
    const tags = new Set(options.tags || [])
    const now = Date.now()

    // Serialize and potentially compress the value
    let serializedValue: any = options.serialize !== false ? this.serialize(value) : value
    let compressed = false
    let size = this.estimateSize(serializedValue)

    if (options.compress !== false && size > this.config.compressionThreshold) {
      serializedValue = this.compress(serializedValue)
      compressed = true
      size = this.estimateSize(serializedValue)
    }

    // Check memory limits and evict if necessary
    await this.ensureMemoryLimit(size)

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      await this.delete(key)
    }

    // Create new entry
    const entry: CacheEntry<T> = {
      value: serializedValue,
      ttl: ttl * 1000, // Convert to milliseconds
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      tags,
      compressed,
      size
    }

    // Store entry
    this.cache.set(key, entry)
    this.memoryUsage += size

    // Update tag index
    for (const tag of Array.from(tags)) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(key)
    }

    this.updateStats()

    this.logger.debug(`Cached key: ${key}`, {
      size,
      ttl,
      compressed,
      tags: Array.from(tags)
    })

    if (this.metrics) {
      this.metrics.increment('cache.set', 1)
      this.metrics.gauge('cache.memory_usage', this.memoryUsage)
    }
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    if (!entry) {
      return false
    }

    // Remove from cache
    this.cache.delete(key)
    this.memoryUsage -= entry.size

    // Remove from tag index
    for (const tag of Array.from(entry.tags)) {
      const tagKeys = this.tagIndex.get(tag)
      if (tagKeys) {
        tagKeys.delete(key)
        if (tagKeys.size === 0) {
          this.tagIndex.delete(tag)
        }
      }
    }

    this.updateStats()

    if (this.metrics) {
      this.metrics.increment('cache.delete', 1)
    }

    return true
  }

  async clear(pattern?: string): Promise<number> {
    let deletedCount = 0

    if (!pattern) {
      // Clear all
      deletedCount = this.cache.size
      this.cache.clear()
      this.tagIndex.clear()
      this.memoryUsage = 0
    } else {
      // Clear by pattern (simple glob-style matching)
      const regex = this.patternToRegex(pattern)
      const keysToDelete: string[] = []

      for (const key of Array.from(this.cache.keys())) {
        if (regex.test(key)) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        if (await this.delete(key)) {
          deletedCount++
        }
      }
    }

    this.updateStats()

    if (this.metrics) {
      this.metrics.increment('cache.clear', deletedCount)
    }

    return deletedCount
  }

  async getMulti<T>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {}

    for (const key of keys) {
      result[key] = await this.get<T>(key)
    }

    return result
  }

  async setMulti<T>(entries: Record<string, T>, options: CacheOptions = {}): Promise<void> {
    const promises = Object.entries(entries).map(([key, value]) =>
      this.set(key, value, options)
    )

    await Promise.all(promises)
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key)
    return entry !== undefined && !this.isExpired(entry)
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key)
    if (!entry) {
      return -2 // Key doesn't exist
    }

    if (this.isExpired(entry)) {
      return -2
    }

    const remaining = (entry.createdAt + entry.ttl - Date.now()) / 1000
    return Math.max(0, Math.floor(remaining))
  }

  async invalidateTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag)
    if (!keys) {
      return 0
    }

    let deletedCount = 0
    for (const key of Array.from(keys)) {
      if (await this.delete(key)) {
        deletedCount++
      }
    }

    this.logger.debug(`Invalidated tag: ${tag}`, { deletedCount })

    if (this.metrics) {
      this.metrics.increment('cache.tag_invalidation', 1, { tag })
    }

    return deletedCount
  }

  async getStats(): Promise<CacheStats> {
    return { ...this.stats }
  }

  // Private methods

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string')
    }

    if (key.length > this.config.maxKeyLength) {
      throw new Error(`Cache key too long: ${key.length} > ${this.config.maxKeyLength}`)
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.createdAt + entry.ttl
  }

  private recordHit(key: string): void {
    this.stats.hits++
    this.updateHitRate()

    if (this.metrics) {
      this.metrics.increment('cache.hit', 1)
    }
  }

  private recordMiss(key: string): void {
    this.stats.misses++
    this.updateHitRate()

    if (this.metrics) {
      this.metrics.increment('cache.miss', 1)
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }

  private updateStats(): void {
    this.stats.keyCount = this.cache.size
    this.stats.memoryUsage = this.memoryUsage

    if (this.metrics) {
      this.metrics.gauge('cache.keys', this.stats.keyCount)
      this.metrics.gauge('cache.hit_rate', this.stats.hitRate)
    }
  }

  private serialize<T>(value: T): string {
    try {
      return JSON.stringify(value)
    } catch (error) {
      throw new Error(`Failed to serialize cache value: ${error}`)
    }
  }

  private compress(value: string): string {
    // In a real implementation, you would use a compression library like zlib
    // For now, we'll just return the value as-is
    return value
  }

  private decompress(value: string): any {
    // In a real implementation, you would decompress using zlib
    // For now, we'll just return the value as-is since it's already decompressed
    return value
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2 // Rough estimate for UTF-16
    }
    
    try {
      return JSON.stringify(value).length * 2
    } catch {
      return 1024 // Default estimate
    }
  }

  private async ensureMemoryLimit(newEntrySize: number): Promise<void> {
    if (this.memoryUsage + newEntrySize <= this.config.maxMemory) {
      return
    }

    // Evict entries using LRU strategy
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed)

    let freedMemory = 0
    let evictedCount = 0

    for (const { key } of entries) {
      if (this.memoryUsage + newEntrySize - freedMemory <= this.config.maxMemory) {
        break
      }

      const entry = this.cache.get(key)
      if (entry) {
        freedMemory += entry.size
        await this.delete(key)
        evictedCount++
      }
    }

    this.logger.debug(`Evicted ${evictedCount} entries to free ${freedMemory} bytes`)

    if (this.metrics) {
      this.metrics.increment('cache.evictions', evictedCount)
    }
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert glob-style pattern to regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.') // Convert ? to .

    return new RegExp(`^${escaped}$`)
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Error during cache cleanup', error)
      })
    }, this.config.cleanupInterval)
  }

  private async cleanup(): Promise<void> {
    const now = Date.now()
    const expiredKeys: string[] = []

    // Find expired entries
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key)
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      await this.delete(key)
    }

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`)
    }
  }

  // Shutdown method
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    await this.clear()
    this.logger.info('Cache shutdown complete')
  }
}

// Import the logger singleton
import { logger } from './logging'

// Export singleton instance
export const intelligentCache = new IntelligentCache({}, logger)
