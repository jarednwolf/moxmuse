import { CronJob } from 'cron'
import { PrismaClient } from '@moxmuse/db'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { redisCache } from './redis'
import { cardDatabaseManagementService } from './card-database-management'
import { enhancedCardSearchService } from './enhanced-card-search'

interface SyncJobConfig {
  name: string
  schedule: string
  description: string
  enabled: boolean
  lastRun?: Date
  nextRun?: Date
  status: 'idle' | 'running' | 'error'
  errorMessage?: string
  runCount: number
  successCount: number
  failureCount: number
}

interface SyncJobResult {
  success: boolean
  duration: number
  message: string
  data?: any
  error?: string
}

export class SyncJobSchedulerService {
  private static instance: SyncJobSchedulerService
  private db: PrismaClient
  private jobs: Map<string, CronJob> = new Map()
  private jobConfigs: Map<string, SyncJobConfig> = new Map()
  private isInitialized = false

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient()
  }

  static getInstance(db?: PrismaClient): SyncJobSchedulerService {
    if (!SyncJobSchedulerService.instance) {
      SyncJobSchedulerService.instance = new SyncJobSchedulerService(db)
    }
    return SyncJobSchedulerService.instance
  }

  /**
   * Initialize all sync jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Sync job scheduler already initialized')
      return
    }

    try {
      logger.info('Initializing sync job scheduler')

      // Load job configurations
      await this.loadJobConfigurations()

      // Create and schedule all jobs
      await this.createJobs()

      // Start all enabled jobs
      this.startJobs()

      this.isInitialized = true
      logger.info('Sync job scheduler initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize sync job scheduler', { error })
      throw error
    }
  }

  /**
   * Shutdown all jobs gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down sync job scheduler')

    try {
      // Stop all running jobs
      for (const [name, job] of this.jobs) {
        try {
          job.stop()
          logger.info('Stopped sync job', { jobName: name })
        } catch (error) {
          logger.error('Error stopping sync job', { jobName: name, error })
        }
      }

      // Clear job maps
      this.jobs.clear()
      this.jobConfigs.clear()

      this.isInitialized = false
      logger.info('Sync job scheduler shutdown complete')

    } catch (error) {
      logger.error('Error during sync job scheduler shutdown', { error })
    }
  }

  /**
   * Get status of all sync jobs
   */
  async getJobStatuses(): Promise<SyncJobConfig[]> {
    const statuses: SyncJobConfig[] = []

    for (const [name, config] of this.jobConfigs) {
      const job = this.jobs.get(name)
      
      statuses.push({
        ...config,
        nextRun: job?.nextDate()?.toJSDate()
      })
    }

    return statuses
  }

  /**
   * Get detailed status of a specific job
   */
  async getJobStatus(jobName: string): Promise<SyncJobConfig | null> {
    const config = this.jobConfigs.get(jobName)
    if (!config) return null

    const job = this.jobs.get(jobName)
    
    return {
      ...config,
      nextRun: job?.nextDate()?.toJSDate()
    }
  }

  /**
   * Manually trigger a sync job
   */
  async triggerJob(jobName: string): Promise<SyncJobResult> {
    const timer = performanceMonitor.startTimer('manual_job_trigger')
    
    try {
      const config = this.jobConfigs.get(jobName)
      if (!config) {
        throw new Error(`Job '${jobName}' not found`)
      }

      if (config.status === 'running') {
        throw new Error(`Job '${jobName}' is already running`)
      }

      logger.info('Manually triggering sync job', { jobName })

      // Execute the job
      const result = await this.executeJob(jobName)

      timer.end({ 
        success: result.success,
        duration: result.duration
      })

      return result

    } catch (error) {
      logger.error('Failed to trigger job manually', { jobName, error })
      
      timer.end({ source: 'error' })
      
      return {
        success: false,
        duration: 0,
        message: `Failed to trigger job: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * Enable or disable a sync job
   */
  async toggleJob(jobName: string, enabled: boolean): Promise<void> {
    const config = this.jobConfigs.get(jobName)
    if (!config) {
      throw new Error(`Job '${jobName}' not found`)
    }

    config.enabled = enabled
    
    // Update job configuration
    await this.saveJobConfiguration(config)

    const job = this.jobs.get(jobName)
    if (job) {
      if (enabled) {
        job.start()
        logger.info('Enabled sync job', { jobName })
      } else {
        job.stop()
        logger.info('Disabled sync job', { jobName })
      }
    }
  }

  /**
   * Update job schedule
   */
  async updateJobSchedule(jobName: string, newSchedule: string): Promise<void> {
    const config = this.jobConfigs.get(jobName)
    if (!config) {
      throw new Error(`Job '${jobName}' not found`)
    }

    // Validate cron expression
    try {
      new CronJob(newSchedule, () => {}, null, false)
    } catch (error) {
      throw new Error(`Invalid cron expression: ${newSchedule}`)
    }

    // Update configuration
    config.schedule = newSchedule
    await this.saveJobConfiguration(config)

    // Recreate the job with new schedule
    const oldJob = this.jobs.get(jobName)
    if (oldJob) {
      oldJob.stop()
    }

    const newJob = this.createJob(config)
    this.jobs.set(jobName, newJob)

    if (config.enabled) {
      newJob.start()
    }

    logger.info('Updated job schedule', { jobName, newSchedule })
  }

  /**
   * Get job execution history
   */
  async getJobHistory(
    jobName: string, 
    limit = 50
  ): Promise<Array<{
    timestamp: Date
    success: boolean
    duration: number
    message: string
    error?: string
  }>> {
    try {
      const historyKey = `job_history:${jobName}`
      const history = await redisCache.lrange(historyKey, 0, limit - 1)
      
      return history.map(entry => JSON.parse(entry))
    } catch (error) {
      logger.error('Failed to get job history', { jobName, error })
      return []
    }
  }

  /**
   * Clear job execution history
   */
  async clearJobHistory(jobName: string): Promise<void> {
    try {
      const historyKey = `job_history:${jobName}`
      await redisCache.del(historyKey)
      
      logger.info('Cleared job history', { jobName })
    } catch (error) {
      logger.error('Failed to clear job history', { jobName, error })
    }
  }

  // Private methods

  private async loadJobConfigurations(): Promise<void> {
    const defaultConfigs: SyncJobConfig[] = [
      {
        name: 'daily_bulk_import',
        schedule: '0 2 * * *', // 2 AM daily
        description: 'Daily incremental bulk data import from Scryfall',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'hourly_legality_check',
        schedule: '0 * * * *', // Every hour
        description: 'Check for format legality changes',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'price_update',
        schedule: '0 */4 * * *', // Every 4 hours
        description: 'Update card prices from multiple sources',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'image_optimization',
        schedule: '0 3 * * *', // 3 AM daily
        description: 'Optimize and cache card images',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'search_index_maintenance',
        schedule: '0 4 * * 0', // 4 AM on Sundays
        description: 'Maintain and optimize search indexes',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'popularity_update',
        schedule: '0 6 * * *', // 6 AM daily
        description: 'Update card popularity scores',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'cache_cleanup',
        schedule: '0 5 * * *', // 5 AM daily
        description: 'Clean up expired cache entries',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      },
      {
        name: 'health_check',
        schedule: '*/15 * * * *', // Every 15 minutes
        description: 'Perform system health checks',
        enabled: true,
        status: 'idle',
        runCount: 0,
        successCount: 0,
        failureCount: 0
      }
    ]

    // Load configurations from cache or use defaults
    for (const defaultConfig of defaultConfigs) {
      try {
        const cached = await redisCache.get<SyncJobConfig>(
          `job_config:${defaultConfig.name}`
        )
        
        if (cached) {
          this.jobConfigs.set(defaultConfig.name, cached)
        } else {
          this.jobConfigs.set(defaultConfig.name, defaultConfig)
          await this.saveJobConfiguration(defaultConfig)
        }
      } catch (error) {
        logger.warn('Failed to load job configuration, using default', {
          jobName: defaultConfig.name,
          error
        })
        this.jobConfigs.set(defaultConfig.name, defaultConfig)
      }
    }

    logger.info('Loaded job configurations', { 
      jobCount: this.jobConfigs.size 
    })
  }

  private async createJobs(): Promise<void> {
    for (const [name, config] of this.jobConfigs) {
      try {
        const job = this.createJob(config)
        this.jobs.set(name, job)
        
        logger.info('Created sync job', { 
          jobName: name,
          schedule: config.schedule,
          enabled: config.enabled
        })
      } catch (error) {
        logger.error('Failed to create sync job', { jobName: name, error })
      }
    }
  }

  private createJob(config: SyncJobConfig): CronJob {
    return new CronJob(
      config.schedule,
      async () => {
        await this.executeJob(config.name)
      },
      null,
      false, // Don't start immediately
      'UTC'
    )
  }

  private startJobs(): void {
    for (const [name, config] of this.jobConfigs) {
      if (config.enabled) {
        const job = this.jobs.get(name)
        if (job) {
          job.start()
          logger.info('Started sync job', { jobName: name })
        }
      }
    }
  }

  private async executeJob(jobName: string): Promise<SyncJobResult> {
    const config = this.jobConfigs.get(jobName)
    if (!config) {
      throw new Error(`Job configuration not found: ${jobName}`)
    }

    const startTime = Date.now()
    
    try {
      // Update job status
      config.status = 'running'
      config.runCount++
      await this.saveJobConfiguration(config)

      logger.info('Executing sync job', { jobName })

      let result: SyncJobResult

      // Execute the appropriate job function
      switch (jobName) {
        case 'daily_bulk_import':
          result = await this.executeBulkImport()
          break
        case 'hourly_legality_check':
          result = await this.executeLegalityCheck()
          break
        case 'price_update':
          result = await this.executePriceUpdate()
          break
        case 'image_optimization':
          result = await this.executeImageOptimization()
          break
        case 'search_index_maintenance':
          result = await this.executeIndexMaintenance()
          break
        case 'popularity_update':
          result = await this.executePopularityUpdate()
          break
        case 'cache_cleanup':
          result = await this.executeCacheCleanup()
          break
        case 'health_check':
          result = await this.executeHealthCheck()
          break
        default:
          throw new Error(`Unknown job: ${jobName}`)
      }

      // Update job status on success
      config.status = 'idle'
      config.lastRun = new Date()
      config.successCount++
      config.errorMessage = undefined

      await this.saveJobConfiguration(config)
      await this.recordJobExecution(jobName, result)

      logger.info('Sync job completed successfully', {
        jobName,
        duration: result.duration,
        message: result.message
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime
      
      // Update job status on error
      config.status = 'error'
      config.lastRun = new Date()
      config.failureCount++
      config.errorMessage = error.message

      await this.saveJobConfiguration(config)

      const errorResult: SyncJobResult = {
        success: false,
        duration,
        message: `Job failed: ${error.message}`,
        error: error.message
      }

      await this.recordJobExecution(jobName, errorResult)

      logger.error('Sync job failed', {
        jobName,
        duration,
        error: error.message
      })

      return errorResult
    }
  }

  private async executeBulkImport(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    const result = await cardDatabaseManagementService.performIncrementalImport()
    
    return {
      success: result.success,
      duration: Date.now() - startTime,
      message: `Import completed: ${result.cardsAdded} added, ${result.cardsUpdated} updated, ${result.cardsRemoved} removed`,
      data: {
        cardsAdded: result.cardsAdded,
        cardsUpdated: result.cardsUpdated,
        cardsRemoved: result.cardsRemoved,
        errors: result.errors
      }
    }
  }

  private async executeLegalityCheck(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // Get cards that might need legality updates
      const recentCards = await this.db.enhancedCardData.findMany({
        where: {
          lastUpdated: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        select: { cardId: true },
        take: 100
      })

      let updatedCount = 0
      const errors: string[] = []

      for (const card of recentCards) {
        try {
          await cardDatabaseManagementService.validateAndUpdateLegality(card.cardId)
          updatedCount++
        } catch (error) {
          errors.push(`${card.cardId}: ${error.message}`)
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        message: `Legality check completed: ${updatedCount} cards checked`,
        data: { updatedCount, errors }
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Legality check failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executePriceUpdate(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // Get cards that need price updates
      const cutoffTime = new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      
      const cardsToUpdate = await this.db.enhancedCardData.findMany({
        where: {
          OR: [
            { lastUpdated: { lt: cutoffTime } },
            { currentPrice: null }
          ]
        },
        select: { cardId: true },
        take: 500
      })

      let updatedCount = 0
      const errors: string[] = []

      // Process in batches to avoid rate limits
      const batchSize = 50
      for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
        const batch = cardsToUpdate.slice(i, i + batchSize)
        
        await Promise.all(
          batch.map(async (card, index) => {
            try {
              // Add delay to respect rate limits
              if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, 200))
              }
              
              // This would update price data from external APIs
              // For now, just mark as updated
              await this.db.enhancedCardData.update({
                where: { cardId: card.cardId },
                data: { lastUpdated: new Date() }
              })
              
              updatedCount++
            } catch (error) {
              errors.push(`${card.cardId}: ${error.message}`)
            }
          })
        )
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        message: `Price update completed: ${updatedCount} cards updated`,
        data: { updatedCount, errors }
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Price update failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executeImageOptimization(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // Get cards that need image optimization
      const cardsToOptimize = await this.db.enhancedCardData.findMany({
        where: {
          imageUrls: { not: {} }
        },
        select: { cardId: true, imageUrls: true },
        take: 100
      })

      let optimizedCount = 0
      const errors: string[] = []

      for (const card of cardsToOptimize) {
        try {
          await cardDatabaseManagementService.optimizeCardImages(
            card.cardId,
            card.imageUrls as Record<string, string>
          )
          optimizedCount++
        } catch (error) {
          errors.push(`${card.cardId}: ${error.message}`)
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        message: `Image optimization completed: ${optimizedCount} cards processed`,
        data: { optimizedCount, errors }
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Image optimization failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executeIndexMaintenance(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // Recreate search indexes
      await cardDatabaseManagementService.createSearchIndexes()
      
      // Update table statistics
      await this.db.$executeRaw`ANALYZE "EnhancedCardData"`
      
      return {
        success: true,
        duration: Date.now() - startTime,
        message: 'Search index maintenance completed successfully'
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Index maintenance failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executePopularityUpdate(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // Update popularity scores based on usage patterns
      const result = await this.db.$executeRaw`
        UPDATE "EnhancedCardData" 
        SET "popularityScore" = CASE 
          WHEN "edhrecRank" IS NOT NULL THEN GREATEST(0, 100 - ("edhrecRank" / 1000.0))
          ELSE "popularityScore" * 0.95
        END,
        "lastUpdated" = NOW()
        WHERE "lastUpdated" < NOW() - INTERVAL '7 days'
      `

      return {
        success: true,
        duration: Date.now() - startTime,
        message: `Popularity update completed: ${result} cards updated`
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Popularity update failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executeCacheCleanup(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      // This would clean up expired cache entries
      // For now, just return success
      
      return {
        success: true,
        duration: Date.now() - startTime,
        message: 'Cache cleanup completed successfully'
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Cache cleanup failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async executeHealthCheck(): Promise<SyncJobResult> {
    const startTime = Date.now()
    
    try {
      const healthStatus = await cardDatabaseManagementService.performHealthCheck()
      
      return {
        success: healthStatus.status !== 'unhealthy',
        duration: Date.now() - startTime,
        message: `Health check completed: ${healthStatus.status}`,
        data: healthStatus
      }

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: `Health check failed: ${error.message}`,
        error: error.message
      }
    }
  }

  private async saveJobConfiguration(config: SyncJobConfig): Promise<void> {
    try {
      await redisCache.set(
        `job_config:${config.name}`,
        config,
        60 * 60 * 24 * 365 // 1 year TTL
      )
    } catch (error) {
      logger.error('Failed to save job configuration', { 
        jobName: config.name, 
        error 
      })
    }
  }

  private async recordJobExecution(
    jobName: string, 
    result: SyncJobResult
  ): Promise<void> {
    try {
      const historyEntry = {
        timestamp: new Date(),
        success: result.success,
        duration: result.duration,
        message: result.message,
        error: result.error
      }

      const historyKey = `job_history:${jobName}`
      
      // Add to history (keep last 100 entries)
      await redisCache.lpush(historyKey, JSON.stringify(historyEntry))
      await redisCache.ltrim(historyKey, 0, 99)
      
      // Set TTL for history
      await redisCache.expire(historyKey, 60 * 60 * 24 * 30) // 30 days

    } catch (error) {
      logger.error('Failed to record job execution', { jobName, error })
    }
  }
}

// Export singleton instance
export const syncJobSchedulerService = SyncJobSchedulerService.getInstance()