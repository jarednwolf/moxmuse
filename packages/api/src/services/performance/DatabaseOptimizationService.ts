import { PrismaClient } from '@moxmuse/db'
import { performance } from 'perf_hooks'

/**
 * Advanced Database Query Optimization Service
 * Provides intelligent query optimization, caching, and performance analysis
 */

export interface QueryOptimizationResult {
  originalQuery: string
  optimizedQuery: string
  estimatedImprovement: number
  recommendations: string[]
  indexSuggestions: string[]
}

export interface QueryCacheEntry {
  key: string
  result: any
  timestamp: Date
  ttl: number
  hitCount: number
  lastAccessed: Date
}

export interface DatabaseOptimizationReport {
  timestamp: Date
  slowQueries: Array<{
    query: string
    avgDuration: number
    frequency: number
    optimization: QueryOptimizationResult
  }>
  indexUsage: Array<{
    table: string
    index: string
    usage: number
    efficiency: number
  }>
  cacheStats: {
    hitRate: number
    totalQueries: number
    cacheSize: number
    evictions: number
  }
  recommendations: Array<{
    type: 'index' | 'query' | 'cache' | 'schema'
    priority: 'low' | 'medium' | 'high' | 'critical'
    description: string
    estimatedImpact: string
    implementation: string
  }>
}

/**
 * Intelligent Query Cache with LRU eviction and TTL
 */
export class IntelligentQueryCache {
  private cache = new Map<string, QueryCacheEntry>()
  private maxSize: number
  private defaultTTL: number
  private hitCount = 0
  private missCount = 0

  constructor(maxSize = 1000, defaultTTL = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }

  generateKey(operation: string, args: any): string {
    // Create a deterministic cache key
    const argsString = JSON.stringify(args, Object.keys(args).sort())
    return `${operation}:${Buffer.from(argsString).toString('base64')}`
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.missCount++
      return null
    }

    // Check TTL
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key)
      this.missCount++
      return null
    }

    // Update access stats
    entry.hitCount++
    entry.lastAccessed = new Date()
    this.hitCount++

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.result
  }

  set(key: string, result: any, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const entry: QueryCacheEntry = {
      key,
      result,
      timestamp: new Date(),
      ttl: ttl || this.defaultTTL,
      hitCount: 0,
      lastAccessed: new Date()
    }

    this.cache.set(key, entry)
  }

  invalidate(pattern?: string): number {
    if (!pattern) {
      const size = this.cache.size
      this.cache.clear()
      return size
    }

    let deleted = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        deleted++
      }
    }
    return deleted
  }

  getStats() {
    const totalRequests = this.hitCount + this.missCount
    return {
      hitRate: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
      totalQueries: totalRequests,
      cacheSize: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount
    }
  }

  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    return cleaned
  }
}

/**
 * Query Optimization Engine
 */
export class QueryOptimizationEngine {
  constructor(private prisma: PrismaClient) {}

  analyzeQuery(operation: string, args: any): QueryOptimizationResult {
    const recommendations: string[] = []
    const indexSuggestions: string[] = []
    let estimatedImprovement = 0

    // Analyze different query patterns
    if (operation.includes('findMany')) {
      const analysis = this.analyzeFindManyQuery(operation, args)
      recommendations.push(...analysis.recommendations)
      indexSuggestions.push(...analysis.indexSuggestions)
      estimatedImprovement += analysis.estimatedImprovement
    }

    if (operation.includes('findUnique') || operation.includes('findFirst')) {
      const analysis = this.analyzeFindUniqueQuery(operation, args)
      recommendations.push(...analysis.recommendations)
      indexSuggestions.push(...analysis.indexSuggestions)
      estimatedImprovement += analysis.estimatedImprovement
    }

    if (operation.includes('count')) {
      const analysis = this.analyzeCountQuery(operation, args)
      recommendations.push(...analysis.recommendations)
      indexSuggestions.push(...analysis.indexSuggestions)
      estimatedImprovement += analysis.estimatedImprovement
    }

    return {
      originalQuery: `${operation}(${JSON.stringify(args)})`,
      optimizedQuery: this.generateOptimizedQuery(operation, args, recommendations),
      estimatedImprovement,
      recommendations,
      indexSuggestions
    }
  }

  private analyzeFindManyQuery(operation: string, args: any) {
    const recommendations: string[] = []
    const indexSuggestions: string[] = []
    let estimatedImprovement = 0

    // Check for missing WHERE clause
    if (!args.where) {
      recommendations.push('Add WHERE clause to limit results')
      estimatedImprovement += 30
    }

    // Check for missing pagination
    if (!args.take && !args.skip) {
      recommendations.push('Add pagination (take/skip) to limit memory usage')
      estimatedImprovement += 25
    }

    // Check for inefficient ordering
    if (args.orderBy && !this.hasIndexForOrderBy(operation, args.orderBy)) {
      const orderFields = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]
      orderFields.forEach((order: any) => {
        const field = Object.keys(order)[0]
        indexSuggestions.push(`CREATE INDEX ON ${this.getTableName(operation)} (${field})`)
      })
      estimatedImprovement += 40
    }

    // Check for N+1 query potential
    if (args.include || args.select) {
      recommendations.push('Consider using select instead of include for better performance')
      estimatedImprovement += 15
    }

    // Check for complex WHERE conditions
    if (args.where && this.hasComplexWhereConditions(args.where)) {
      recommendations.push('Consider adding composite indexes for complex WHERE conditions')
      estimatedImprovement += 35
    }

    return { recommendations, indexSuggestions, estimatedImprovement }
  }

  private analyzeFindUniqueQuery(operation: string, args: any) {
    const recommendations: string[] = []
    const indexSuggestions: string[] = []
    let estimatedImprovement = 0

    // Check if using non-unique fields
    if (args.where && !this.isUsingUniqueConstraint(operation, args.where)) {
      recommendations.push('Use unique constraints for findUnique operations')
      const fields = Object.keys(args.where)
      indexSuggestions.push(`CREATE UNIQUE INDEX ON ${this.getTableName(operation)} (${fields.join(', ')})`)
      estimatedImprovement += 50
    }

    return { recommendations, indexSuggestions, estimatedImprovement }
  }

  private analyzeCountQuery(operation: string, args: any) {
    const recommendations: string[] = []
    const indexSuggestions: string[] = []
    let estimatedImprovement = 0

    // Count queries can be expensive without proper indexes
    if (args.where) {
      const fields = Object.keys(args.where)
      indexSuggestions.push(`CREATE INDEX ON ${this.getTableName(operation)} (${fields.join(', ')})`)
      estimatedImprovement += 60
    }

    // Suggest using approximate counts for large tables
    recommendations.push('Consider using approximate counts for large datasets')
    estimatedImprovement += 20

    return { recommendations, indexSuggestions, estimatedImprovement }
  }

  private hasIndexForOrderBy(operation: string, orderBy: any): boolean {
    // Simplified check - in production, this would query the database for actual indexes
    return false
  }

  private hasComplexWhereConditions(where: any): boolean {
    // Check for OR conditions, nested conditions, etc.
    return JSON.stringify(where).includes('OR') || 
           Object.keys(where).length > 3 ||
           JSON.stringify(where).includes('contains')
  }

  private isUsingUniqueConstraint(operation: string, where: any): boolean {
    // Check if the WHERE clause uses known unique fields
    const uniqueFields = ['id', 'email', 'username'] // Common unique fields
    return Object.keys(where).some(field => uniqueFields.includes(field))
  }

  private getTableName(operation: string): string {
    // Extract table name from operation
    const match = operation.match(/(\w+)\.(findMany|findUnique|findFirst|count)/)
    return match ? match[1] : 'unknown'
  }

  private generateOptimizedQuery(operation: string, args: any, recommendations: string[]): string {
    // Generate an optimized version of the query based on recommendations
    const optimizedArgs = { ...args }

    // Add pagination if missing
    if (!optimizedArgs.take && recommendations.includes('Add pagination (take/skip) to limit memory usage')) {
      optimizedArgs.take = 100
    }

    // Use select instead of include if recommended
    if (optimizedArgs.include && recommendations.includes('Consider using select instead of include for better performance')) {
      // Convert include to select (simplified)
      delete optimizedArgs.include
      optimizedArgs.select = { id: true, name: true } // Basic fields
    }

    return `${operation}(${JSON.stringify(optimizedArgs)})`
  }
}

/**
 * Main Database Optimization Service
 */
export class DatabaseOptimizationService {
  private queryCache: IntelligentQueryCache
  private optimizationEngine: QueryOptimizationEngine
  private queryMetrics = new Map<string, { count: number, totalDuration: number, lastSeen: Date }>()

  constructor(private prisma: PrismaClient) {
    this.queryCache = new IntelligentQueryCache(2000, 600000) // 10 minutes TTL
    this.optimizationEngine = new QueryOptimizationEngine(prisma)
    this.setupQueryInterception()
    this.startPeriodicCleanup()
  }

  private setupQueryInterception() {
    // Intercept Prisma queries for caching and optimization
    this.prisma.$use(async (params: any, next: any) => {
      const operation = `${params.model}.${params.action}`
      const cacheKey = this.queryCache.generateKey(operation, params.args)
      
      // Try cache first for read operations
      if (this.isCacheableOperation(params.action)) {
        const cached = this.queryCache.get(cacheKey)
        if (cached) {
          this.recordQueryMetric(operation, 0) // Cache hit = 0ms
          return cached
        }
      }

      // Execute query with timing
      const start = performance.now()
      try {
        const result = await next(params)
        const duration = performance.now() - start

        // Record metrics
        this.recordQueryMetric(operation, duration)

        // Cache result if appropriate
        if (this.isCacheableOperation(params.action) && this.shouldCacheResult(result, duration)) {
          const ttl = this.calculateTTL(params.action, duration)
          this.queryCache.set(cacheKey, result, ttl)
        }

        // Analyze for optimization if slow
        if (duration > 500) { // 500ms threshold
          const optimization = this.optimizationEngine.analyzeQuery(operation, params.args)
          console.warn(`Slow query detected: ${operation} (${duration.toFixed(2)}ms)`)
          console.warn(`Optimization suggestions:`, optimization.recommendations)
        }

        return result
      } catch (error) {
        const duration = performance.now() - start
        this.recordQueryMetric(operation, duration)
        throw error
      }
    })
  }

  private isCacheableOperation(action: string): boolean {
    // Only cache read operations
    return ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate'].includes(action)
  }

  private shouldCacheResult(result: any, duration: number): boolean {
    // Cache if query took significant time or result is not too large
    const resultSize = JSON.stringify(result).length
    return duration > 100 || (resultSize < 100000 && duration > 50) // 100KB limit
  }

  private calculateTTL(action: string, duration: number): number {
    // Longer TTL for slower queries (they're more expensive to recompute)
    const baseTTL = 300000 // 5 minutes
    const durationMultiplier = Math.min(duration / 1000, 5) // Max 5x multiplier
    return baseTTL * (1 + durationMultiplier)
  }

  private recordQueryMetric(operation: string, duration: number) {
    const existing = this.queryMetrics.get(operation)
    if (existing) {
      existing.count++
      existing.totalDuration += duration
      existing.lastSeen = new Date()
    } else {
      this.queryMetrics.set(operation, {
        count: 1,
        totalDuration: duration,
        lastSeen: new Date()
      })
    }
  }

  private startPeriodicCleanup() {
    // Clean up cache and metrics every 10 minutes
    setInterval(() => {
      const cleaned = this.queryCache.cleanup()
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`)

      // Clean old metrics (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      for (const [operation, metrics] of this.queryMetrics.entries()) {
        if (metrics.lastSeen < oneHourAgo) {
          this.queryMetrics.delete(operation)
        }
      }
    }, 10 * 60 * 1000)
  }

  // Public API methods
  async generateOptimizationReport(): Promise<DatabaseOptimizationReport> {
    const now = new Date()
    
    // Analyze slow queries
    const slowQueries = Array.from(this.queryMetrics.entries())
      .filter(([_, metrics]) => metrics.totalDuration / metrics.count > 500)
      .map(([operation, metrics]) => ({
        query: operation,
        avgDuration: metrics.totalDuration / metrics.count,
        frequency: metrics.count,
        optimization: this.optimizationEngine.analyzeQuery(operation, {})
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 10)

    // Get cache stats
    const cacheStats = this.queryCache.getStats()

    // Generate recommendations
    const recommendations = await this.generateOptimizationRecommendations(slowQueries, cacheStats)

    return {
      timestamp: now,
      slowQueries,
      indexUsage: [], // Would require database-specific queries
      cacheStats: {
        ...cacheStats,
        evictions: 0 // Would track this in production
      },
      recommendations
    }
  }

  private async generateOptimizationRecommendations(
    slowQueries: any[], 
    cacheStats: any
  ): Promise<DatabaseOptimizationReport['recommendations']> {
    const recommendations: DatabaseOptimizationReport['recommendations'] = []

    // Cache optimization recommendations
    if (cacheStats.hitRate < 60) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        description: `Cache hit rate is ${cacheStats.hitRate.toFixed(1)}%. Consider increasing cache size or TTL.`,
        estimatedImpact: '20-40% faster query response times',
        implementation: 'Increase cache size in DatabaseOptimizationService constructor'
      })
    }

    // Index recommendations based on slow queries
    if (slowQueries.length > 5) {
      recommendations.push({
        type: 'index',
        priority: 'critical',
        description: `${slowQueries.length} slow queries detected. Review and add missing indexes.`,
        estimatedImpact: '50-80% faster query execution',
        implementation: 'Run suggested CREATE INDEX statements from query analysis'
      })
    }

    // Query optimization recommendations
    const findManyQueries = slowQueries.filter(q => q.query.includes('findMany'))
    if (findManyQueries.length > 3) {
      recommendations.push({
        type: 'query',
        priority: 'high',
        description: 'Multiple slow findMany queries. Consider adding pagination and WHERE clauses.',
        estimatedImpact: '30-60% reduction in memory usage and response time',
        implementation: 'Add take/skip parameters and specific WHERE conditions'
      })
    }

    // Schema optimization recommendations
    const countQueries = slowQueries.filter(q => q.query.includes('count'))
    if (countQueries.length > 2) {
      recommendations.push({
        type: 'schema',
        priority: 'medium',
        description: 'Multiple slow count queries. Consider denormalizing counts or using approximate counts.',
        estimatedImpact: '70-90% faster count operations',
        implementation: 'Add counter fields to parent tables or use database-specific approximate count functions'
      })
    }

    return recommendations
  }

  // Cache management methods
  invalidateCache(pattern?: string): number {
    return this.queryCache.invalidate(pattern)
  }

  getCacheStats() {
    return this.queryCache.getStats()
  }

  getQueryMetrics() {
    return Array.from(this.queryMetrics.entries()).map(([operation, metrics]) => ({
      operation,
      count: metrics.count,
      avgDuration: metrics.totalDuration / metrics.count,
      totalDuration: metrics.totalDuration,
      lastSeen: metrics.lastSeen
    }))
  }

  // Batch operations for better performance
  async batchCreate<T>(model: string, data: T[], batchSize = 100): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      const batchResults = await (this.prisma as any)[model].createMany({
        data: batch,
        skipDuplicates: true
      })
      results.push(...batchResults)
    }
    
    return results
  }

  async batchUpdate<T>(model: string, updates: Array<{ where: any, data: any }>): Promise<number> {
    let totalUpdated = 0
    
    for (const update of updates) {
      const result = await (this.prisma as any)[model].updateMany(update)
      totalUpdated += result.count
    }
    
    return totalUpdated
  }

  // Connection pool optimization
  async optimizeConnectionPool(): Promise<{
    currentConnections: number
    maxConnections: number
    recommendations: string[]
  }> {
    // This would require database-specific queries in production
    return {
      currentConnections: 0,
      maxConnections: 0,
      recommendations: [
        'Monitor connection pool usage during peak hours',
        'Consider increasing pool size if utilization > 80%',
        'Implement connection pooling at application level'
      ]
    }
  }
}

// Export factory function
export const createDatabaseOptimizationService = (prisma: PrismaClient) => {
  return new DatabaseOptimizationService(prisma)
}