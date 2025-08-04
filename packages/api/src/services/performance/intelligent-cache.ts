import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import crypto from 'crypto'

interface CacheEntry<T> {
  data: T
  timestamp: Date
  ttl: number
  accessCount: number
  lastAccessed: Date
  computationTime: number
  dependencies: string[]
  version: string
  metadata?: Record<string, any>
}

interface CacheStats {
  hitRate: number
  missRate: number
  totalRequests: number
  averageComputationTime: number
  cacheSize: number
  evictionCount: number
}

interface CacheConfiguration {
  defaultTTL: number
  maxSize: number
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'adaptive'
  compressionEnabled: boolean
  persistToDisk: boolean
  warmupEnabled: boolean
}

interface DeckAnalysisCache {
  deckId: string
  analysis: any
  synergyMap: any
  weaknesses: string[]
  suggestions: any[]
  computedAt: Date
  version: string
}

interface AIModelCache {
  modelId: string
  prompt: string
  response: any
  tokens: number
  cost: number
  computedAt: Date
}

export class IntelligentCacheService {
  private readonly DEFAULT_CONFIG: CacheConfiguration = {
    defaultTTL: 60 * 60, // 1 hour
    maxSize: 10000,
    evictionPolicy: 'adaptive',
    compressionEnabled: true,
    persistToDisk: true,
    warmupEnabled: true
  }

  private cacheStats: CacheStats = {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    averageComputationTime: 0,
    cacheSize: 0,
    evictionCount: 0
  }

  constructor(
    private prisma: PrismaClient,
    private config: CacheConfiguration = {}
  ) {
    this.config = { ...this.DEFAULT_CONFIG, ...config }
  }

  /**
   * Get or compute deck analysis with intelligent caching
   */
  async getOrComputeDeckAnalysis<T>(
    deckId: string,
    computeFunction: () => Promise<T>,
    options: {
      ttl?: number
      dependencies?: string[]
      version?: string
      forceRefresh?: boolean
    } = {}
  ): Promise<T> {
    const cacheKey = `deck:analysis:${deckId}`
    const startTime = Date.now()

    try {
      // Check if force refresh is requested
      if (options.forceRefresh) {
        return await this.computeAndCache(cacheKey, computeFunction, options)
      }

      // Try to get from cache
      const cached = await this.getFromCache<T>(cacheKey)
      
      if (cached) {
        // Check if cache is still valid
        if (await this.isCacheValid(cacheKey, options.dependencies, options.version)) {
          await this.updateAccessStats(cacheKey)
          this.updateStats('hit', Date.now() - startTime)
          return cached.data
        }
      }

      // Cache miss or invalid - compute new value
      this.updateStats('miss', Date.now() - startTime)
      return await this.computeAndCache(cacheKey, computeFunction, options)
    } catch (error) {
      console.error(`Error in intelligent cache for ${cacheKey}:`, error)
      // Fallback to direct computation
      return await computeFunction()
    }
  }

  /**
   * Cache AI model responses with deduplication
   */
  async cacheAIResponse(
    modelId: string,
    prompt: string,
    response: any,
    metadata: {
      tokens: number
      cost: number
      computationTime: number
    }
  ): Promise<void> {
    try {
      const promptHash = this.hashPrompt(prompt)
      const cacheKey = `ai:response:${modelId}:${promptHash}`
      
      const cacheEntry: CacheEntry<AIModelCache> = {
        data: {
          modelId,
          prompt,
          response,
          tokens: metadata.tokens,
          cost: metadata.cost,
          computedAt: new Date()
        },
        timestamp: new Date(),
        ttl: this.config.defaultTTL * 2, // AI responses can be cached longer
        accessCount: 1,
        lastAccessed: new Date(),
        computationTime: metadata.computationTime,
        dependencies: [],
        version: '1.0'
      }

      await this.setInCache(cacheKey, cacheEntry)
      
      // Also store in database for persistence
      if (this.config.persistToDisk) {
        await this.persistAIResponse(cacheKey, cacheEntry)
      }
    } catch (error) {
      console.error('Error caching AI response:', error)
    }
  }

  /**
   * Get cached AI response by prompt similarity
   */
  async getCachedAIResponse(
    modelId: string,
    prompt: string,
    similarityThreshold: number = 0.8
  ): Promise<AIModelCache | null> {
    try {
      const promptHash = this.hashPrompt(prompt)
      const exactCacheKey = `ai:response:${modelId}:${promptHash}`
      
      // Try exact match first
      const exactMatch = await this.getFromCache<AIModelCache>(exactCacheKey)
      if (exactMatch) {
        await this.updateAccessStats(exactCacheKey)
        return exactMatch.data
      }

      // Try similarity search for near matches
      const similarResponse = await this.findSimilarAIResponse(modelId, prompt, similarityThreshold)
      if (similarResponse) {
        return similarResponse
      }

      return null
    } catch (error) {
      console.error('Error getting cached AI response:', error)
      return null
    }
  }

  /**
   * Invalidate cache entries based on dependencies
   */
  async invalidateDependencies(dependencies: string[]): Promise<void> {
    try {
      for (const dependency of dependencies) {
        const pattern = `*:${dependency}:*`
        await redisCache.deletePattern(pattern)
        
        // Also mark dependent entries as invalid
        await this.markDependentEntriesInvalid(dependency)
      }
    } catch (error) {
      console.error('Error invalidating dependencies:', error)
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmupCache(userId: string): Promise<void> {
    if (!this.config.warmupEnabled) return

    try {
      // Get user's most frequently accessed decks
      const frequentDecks = await this.getFrequentlyAccessedDecks(userId)
      
      // Precompute analysis for these decks
      for (const deckId of frequentDecks) {
        try {
          // This would trigger background computation
          await this.scheduleBackgroundComputation('deck:analysis', deckId)
        } catch (error) {
          console.warn(`Failed to warm up cache for deck ${deckId}:`, error)
        }
      }
    } catch (error) {
      console.error('Error warming up cache:', error)
    }
  }

  /**
   * Adaptive TTL based on access patterns
   */
  private calculateAdaptiveTTL(
    accessCount: number,
    computationTime: number,
    lastAccessed: Date
  ): number {
    const baseTime = this.config.defaultTTL
    const accessMultiplier = Math.min(accessCount / 10, 3) // Max 3x multiplier
    const computationMultiplier = Math.min(computationTime / 1000, 2) // Max 2x for expensive computations
    const recencyMultiplier = this.calculateRecencyMultiplier(lastAccessed)
    
    return Math.floor(baseTime * accessMultiplier * computationMultiplier * recencyMultiplier)
  }

  /**
   * Intelligent cache eviction
   */
  async evictLeastValuable(): Promise<void> {
    try {
      const cacheKeys = await redisCache.keys('*')
      const entries: Array<{ key: string; score: number }> = []
      
      for (const key of cacheKeys) {
        const entry = await this.getFromCache(key)
        if (entry) {
          const score = this.calculateEvictionScore(entry)
          entries.push({ key, score })
        }
      }
      
      // Sort by score (lower = more likely to evict)
      entries.sort((a, b) => a.score - b.score)
      
      // Evict bottom 10%
      const evictCount = Math.floor(entries.length * 0.1)
      for (let i = 0; i < evictCount; i++) {
        await redisCache.del(entries[i].key)
        this.cacheStats.evictionCount++
      }
    } catch (error) {
      console.error('Error during cache eviction:', error)
    }
  }

  /**
   * Background processing for expensive operations
   */
  async scheduleBackgroundComputation(
    type: string,
    id: string,
    priority: 'low' | 'medium' | 'high' = 'low'
  ): Promise<void> {
    try {
      const jobData = {
        type,
        id,
        priority,
        scheduledAt: new Date(),
        attempts: 0
      }
      
      // Add to background processing queue
      await redisCache.lpush('background:queue', JSON.stringify(jobData))
      
      // Trigger processing if high priority
      if (priority === 'high') {
        // This would trigger immediate processing
        await this.processBackgroundJob(jobData)
      }
    } catch (error) {
      console.error('Error scheduling background computation:', error)
    }
  }

  /**
   * Process background computation jobs
   */
  async processBackgroundJobs(maxJobs: number = 10): Promise<void> {
    try {
      for (let i = 0; i < maxJobs; i++) {
        const jobData = await redisCache.rpop('background:queue')
        if (!jobData) break
        
        const job = JSON.parse(jobData)
        await this.processBackgroundJob(job)
      }
    } catch (error) {
      console.error('Error processing background jobs:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats }
  }

  /**
   * Optimize cache performance
   */
  async optimizeCache(): Promise<void> {
    try {
      // Clean up expired entries
      await this.cleanupExpiredEntries()
      
      // Evict least valuable entries if cache is full
      const cacheSize = await this.getCacheSize()
      if (cacheSize > this.config.maxSize) {
        await this.evictLeastValuable()
      }
      
      // Update cache statistics
      await this.updateCacheStats()
    } catch (error) {
      console.error('Error optimizing cache:', error)
    }
  }

  /**
   * Private helper methods
   */
  private async getFromCache<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cached = await redisCache.get<CacheEntry<T>>(key)
      if (!cached) return null
      
      // Check if expired
      const now = new Date()
      const expiresAt = new Date(cached.timestamp.getTime() + cached.ttl * 1000)
      
      if (now > expiresAt) {
        await redisCache.del(key)
        return null
      }
      
      return cached
    } catch (error) {
      console.error(`Error getting from cache ${key}:`, error)
      return null
    }
  }

  private async setInCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      await redisCache.set(key, entry, entry.ttl)
      this.cacheStats.cacheSize++
    } catch (error) {
      console.error(`Error setting cache ${key}:`, error)
    }
  }

  private async computeAndCache<T>(
    cacheKey: string,
    computeFunction: () => Promise<T>,
    options: any
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await computeFunction()
      const computationTime = Date.now() - startTime
      
      const cacheEntry: CacheEntry<T> = {
        data: result,
        timestamp: new Date(),
        ttl: options.ttl || this.config.defaultTTL,
        accessCount: 1,
        lastAccessed: new Date(),
        computationTime,
        dependencies: options.dependencies || [],
        version: options.version || '1.0'
      }
      
      await this.setInCache(cacheKey, cacheEntry)
      
      return result
    } catch (error) {
      console.error(`Error computing and caching ${cacheKey}:`, error)
      throw error
    }
  }

  private async isCacheValid(
    cacheKey: string,
    dependencies?: string[],
    version?: string
  ): Promise<boolean> {
    try {
      const entry = await this.getFromCache(cacheKey)
      if (!entry) return false
      
      // Check version compatibility
      if (version && entry.version !== version) {
        return false
      }
      
      // Check dependencies
      if (dependencies) {
        for (const dep of dependencies) {
          const depValid = await this.isDependencyValid(dep)
          if (!depValid) return false
        }
      }
      
      return true
    } catch (error) {
      console.error('Error checking cache validity:', error)
      return false
    }
  }

  private async updateAccessStats(cacheKey: string): Promise<void> {
    try {
      const entry = await this.getFromCache(cacheKey)
      if (entry) {
        entry.accessCount++
        entry.lastAccessed = new Date()
        
        // Recalculate TTL if using adaptive policy
        if (this.config.evictionPolicy === 'adaptive') {
          entry.ttl = this.calculateAdaptiveTTL(
            entry.accessCount,
            entry.computationTime,
            entry.lastAccessed
          )
        }
        
        await this.setInCache(cacheKey, entry)
      }
    } catch (error) {
      console.error('Error updating access stats:', error)
    }
  }

  private updateStats(type: 'hit' | 'miss', responseTime: number): void {
    this.cacheStats.totalRequests++
    
    if (type === 'hit') {
      this.cacheStats.hitRate = (this.cacheStats.hitRate * (this.cacheStats.totalRequests - 1) + 1) / this.cacheStats.totalRequests
    } else {
      this.cacheStats.missRate = (this.cacheStats.missRate * (this.cacheStats.totalRequests - 1) + 1) / this.cacheStats.totalRequests
    }
    
    this.cacheStats.averageComputationTime = 
      (this.cacheStats.averageComputationTime * (this.cacheStats.totalRequests - 1) + responseTime) / this.cacheStats.totalRequests
  }

  private hashPrompt(prompt: string): string {
    return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16)
  }

  private async findSimilarAIResponse(
    modelId: string,
    prompt: string,
    threshold: number
  ): Promise<AIModelCache | null> {
    // This would implement semantic similarity search
    // For now, return null (no similar responses found)
    return null
  }

  private async persistAIResponse(cacheKey: string, entry: CacheEntry<AIModelCache>): Promise<void> {
    try {
      await this.prisma.aiResponseCache.create({
        data: {
          cacheKey,
          modelId: entry.data.modelId,
          promptHash: this.hashPrompt(entry.data.prompt),
          response: entry.data.response,
          tokens: entry.data.tokens,
          cost: entry.data.cost,
          computationTime: entry.computationTime,
          createdAt: entry.timestamp
        }
      })
    } catch (error) {
      console.error('Error persisting AI response:', error)
    }
  }

  private async markDependentEntriesInvalid(dependency: string): Promise<void> {
    // This would mark all cache entries that depend on this dependency as invalid
    // Implementation would depend on your specific dependency tracking system
  }

  private async getFrequentlyAccessedDecks(userId: string): Promise<string[]> {
    try {
      // This would query your analytics/usage data
      // For now, return empty array
      return []
    } catch (error) {
      console.error('Error getting frequently accessed decks:', error)
      return []
    }
  }

  private calculateRecencyMultiplier(lastAccessed: Date): number {
    const hoursSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceAccess < 1) return 2.0
    if (hoursSinceAccess < 24) return 1.5
    if (hoursSinceAccess < 168) return 1.0 // 1 week
    return 0.5
  }

  private calculateEvictionScore(entry: CacheEntry<any>): number {
    const ageScore = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60) // Hours
    const accessScore = 1 / (entry.accessCount + 1)
    const computationScore = 1 / (entry.computationTime + 1)
    const recencyScore = (Date.now() - entry.lastAccessed.getTime()) / (1000 * 60 * 60)
    
    // Lower score = more likely to evict
    return ageScore * accessScore * recencyScore / computationScore
  }

  private async processBackgroundJob(job: any): Promise<void> {
    try {
      // Process different types of background jobs
      switch (job.type) {
        case 'deck:analysis':
          // This would trigger deck analysis computation
          break
        case 'ai:precompute':
          // This would precompute AI responses
          break
        default:
          console.warn(`Unknown background job type: ${job.type}`)
      }
    } catch (error) {
      console.error('Error processing background job:', error)
      
      // Retry logic
      if (job.attempts < 3) {
        job.attempts++
        await redisCache.lpush('background:queue', JSON.stringify(job))
      }
    }
  }

  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const keys = await redisCache.keys('*')
      let cleanedCount = 0
      
      for (const key of keys) {
        const entry = await this.getFromCache(key)
        if (!entry) {
          cleanedCount++
        }
      }
      
      console.log(`Cleaned up ${cleanedCount} expired cache entries`)
    } catch (error) {
      console.error('Error cleaning up expired entries:', error)
    }
  }

  private async getCacheSize(): Promise<number> {
    try {
      const keys = await redisCache.keys('*')
      return keys.length
    } catch (error) {
      console.error('Error getting cache size:', error)
      return 0
    }
  }

  private async updateCacheStats(): Promise<void> {
    try {
      this.cacheStats.cacheSize = await this.getCacheSize()
      
      // Store stats for monitoring
      await redisCache.set('cache:stats', this.cacheStats, 60 * 60) // 1 hour TTL
    } catch (error) {
      console.error('Error updating cache stats:', error)
    }
  }

  private async isDependencyValid(dependency: string): Promise<boolean> {
    // This would check if a dependency is still valid
    // Implementation would depend on your specific dependency system
    return true
  }
}