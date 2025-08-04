import { CronJob } from 'cron'
import { enhancedCardDataService } from './enhanced-card-data'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { redisCache } from './redis'
import { db } from '@moxmuse/db'

interface SyncJobStatus {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  cardsProcessed: number
  errors: string[]
  progress: number
}

export class CardDataSyncService {
  private static instance: CardDataSyncService
  private bulkDataJob: CronJob | null = null
  private priceUpdateJob: CronJob | null = null
  private popularityUpdateJob: CronJob | null = null
  private currentSyncJob: SyncJobStatus | null = null

  static getInstance(): CardDataSyncService {
    if (!CardDataSyncService.instance) {
      CardDataSyncService.instance = new CardDataSyncService()
    }
    return CardDataSyncService.instance
  }

  /**
   * Initialize all sync jobs
   */
  initialize(): void {
    logger.info('Initializing card data sync service')

    // Daily bulk data update at 2 AM
    this.bulkDataJob = new CronJob(
      '0 2 * * *',
      () => this.runBulkDataSync(),
      null,
      false,
      'UTC'
    )

    // Price updates every 4 hours
    this.priceUpdateJob = new CronJob(
      '0 */4 * * *',
      () => this.runPriceSync(),
      null,
      false,
      'UTC'
    )

    // Popularity updates daily at 6 AM
    this.popularityUpdateJob = new CronJob(
      '0 6 * * *',
      () => this.runPopularitySync(),
      null,
      false,
      'UTC'
    )

    // Start all jobs
    this.startJobs()
  }

  /**
   * Start all sync jobs
   */
  startJobs(): void {
    try {
      this.bulkDataJob?.start()
      this.priceUpdateJob?.start()
      this.popularityUpdateJob?.start()
      
      logger.info('Card data sync jobs started')
    } catch (error) {
      logger.error('Error starting sync jobs', { error })
    }
  }

  /**
   * Stop all sync jobs
   */
  stopJobs(): void {
    try {
      this.bulkDataJob?.stop()
      this.priceUpdateJob?.stop()
      this.popularityUpdateJob?.stop()
      
      logger.info('Card data sync jobs stopped')
    } catch (error) {
      logger.error('Error stopping sync jobs', { error })
    }
  }

  /**
   * Run bulk data synchronization
   */
  async runBulkDataSync(): Promise<SyncJobStatus> {
    const jobId = `bulk_sync_${Date.now()}`
    const timer = performanceMonitor.startTimer('bulk_data_sync_job')
    
    this.currentSyncJob = {
      id: jobId,
      status: 'running',
      startedAt: new Date(),
      cardsProcessed: 0,
      errors: [],
      progress: 0
    }

    try {
      logger.info('Starting bulk data sync job', { jobId })

      // Update sync status in cache
      await this.updateSyncStatus(this.currentSyncJob)

      // Run the bulk data update
      const result = await enhancedCardDataService.updateFromBulkData()

      // Update job status
      this.currentSyncJob.status = result.success ? 'completed' : 'failed'
      this.currentSyncJob.completedAt = new Date()
      this.currentSyncJob.cardsProcessed = result.cardsUpdated
      this.currentSyncJob.errors = result.errors
      this.currentSyncJob.progress = 100

      await this.updateSyncStatus(this.currentSyncJob)

      // Log completion
      logger.info('Bulk data sync job completed', {
        jobId,
        success: result.success,
        cardsUpdated: result.cardsUpdated,
        errors: result.errors.length
      })

      timer.end({
        success: result.success,
        cards_updated: result.cardsUpdated,
        errors_count: result.errors.length
      })

      return this.currentSyncJob

    } catch (error) {
      logger.error('Bulk data sync job failed', { jobId, error })

      this.currentSyncJob.status = 'failed'
      this.currentSyncJob.completedAt = new Date()
      this.currentSyncJob.errors.push(error.message)

      await this.updateSyncStatus(this.currentSyncJob)
      timer.end({ source: 'error' })

      return this.currentSyncJob
    }
  }

  /**
   * Run price data synchronization
   */
  async runPriceSync(): Promise<void> {
    const timer = performanceMonitor.startTimer('price_sync_job')
    
    try {
      logger.info('Starting price sync job')

      // Get cards that need price updates (older than 4 hours)
      const cutoffTime = new Date(Date.now() - 4 * 60 * 60 * 1000)
      
      const cardsToUpdate = await db.enhancedCardData.findMany({
        where: {
          OR: [
            { lastUpdated: { lt: cutoffTime } },
            { currentPrice: null }
          ]
        },
        select: { cardId: true },
        take: 1000 // Limit to prevent overwhelming the system
      })

      logger.info(`Found ${cardsToUpdate.length} cards needing price updates`)

      let updated = 0
      const errors: string[] = []

      // Process in batches
      const batchSize = 50
      for (let i = 0; i < cardsToUpdate.length; i += batchSize) {
        const batch = cardsToUpdate.slice(i, i + batchSize)
        
        try {
          await Promise.all(
            batch.map(async (card, index) => {
              // Add delay to respect rate limits
              if (index > 0) {
                await this.delay(200)
              }
              
              try {
                // Refresh card data (which includes price updates)
                await enhancedCardDataService.getEnhancedCard(card.cardId)
                updated++
              } catch (error) {
                errors.push(`Failed to update ${card.cardId}: ${error.message}`)
              }
            })
          )
        } catch (error) {
          errors.push(`Batch processing error: ${error.message}`)
        }

        // Add delay between batches
        if (i + batchSize < cardsToUpdate.length) {
          await this.delay(1000)
        }
      }

      logger.info('Price sync job completed', { 
        cardsChecked: cardsToUpdate.length,
        cardsUpdated: updated,
        errors: errors.length
      })

      timer.end({
        cards_checked: cardsToUpdate.length,
        cards_updated: updated,
        errors_count: errors.length
      })

    } catch (error) {
      logger.error('Price sync job failed', { error })
      timer.end({ source: 'error' })
    }
  }

  /**
   * Run popularity data synchronization
   */
  async runPopularitySync(): Promise<void> {
    const timer = performanceMonitor.startTimer('popularity_sync_job')
    
    try {
      logger.info('Starting popularity sync job')

      // Get most accessed cards from the last 24 hours
      const popularCards = await this.getPopularCards(100)
      
      logger.info(`Updating popularity for ${popularCards.length} cards`)

      let updated = 0
      const errors: string[] = []

      for (const card of popularCards) {
        try {
          // Update popularity score based on access patterns
          const newScore = await this.calculatePopularityScore(card.cardId)
          
          await db.enhancedCardData.update({
            where: { cardId: card.cardId },
            data: { 
              popularityScore: newScore,
              lastUpdated: new Date()
            }
          })
          
          updated++
        } catch (error) {
          errors.push(`Failed to update popularity for ${card.cardId}: ${error.message}`)
        }
      }

      logger.info('Popularity sync job completed', { 
        cardsUpdated: updated,
        errors: errors.length
      })

      timer.end({
        cards_updated: updated,
        errors_count: errors.length
      })

    } catch (error) {
      logger.error('Popularity sync job failed', { error })
      timer.end({ source: 'error' })
    }
  }

  /**
   * Get current sync job status
   */
  async getSyncStatus(): Promise<SyncJobStatus | null> {
    try {
      const cached = await redisCache.get<SyncJobStatus>('current_sync_job')
      return cached || this.currentSyncJob
    } catch (error) {
      logger.error('Error getting sync status', { error })
      return this.currentSyncJob
    }
  }

  /**
   * Manually trigger a sync job
   */
  async triggerSync(type: 'bulk' | 'price' | 'popularity'): Promise<SyncJobStatus | void> {
    logger.info('Manually triggering sync job', { type })

    switch (type) {
      case 'bulk':
        return await this.runBulkDataSync()
      case 'price':
        await this.runPriceSync()
        break
      case 'popularity':
        await this.runPopularitySync()
        break
      default:
        throw new Error(`Unknown sync type: ${type}`)
    }
  }

  /**
   * Schedule card data refresh for specific cards
   */
  async scheduleCardRefresh(cardIds: string[], priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    try {
      const refreshJob = {
        id: `refresh_${Date.now()}`,
        cardIds,
        priority,
        scheduledAt: new Date(),
        status: 'pending'
      }

      // Add to refresh queue
      await redisCache.set(
        `refresh_job:${refreshJob.id}`,
        refreshJob,
        60 * 60 * 24 // 24 hours TTL
      )

      // Add to priority queue
      const queueKey = `refresh_queue:${priority}`
      await redisCache.lpush(queueKey, refreshJob.id)

      logger.info('Card refresh scheduled', {
        jobId: refreshJob.id,
        cardCount: cardIds.length,
        priority
      })

    } catch (error) {
      logger.error('Error scheduling card refresh', { cardIds: cardIds.length, error })
    }
  }

  /**
   * Process refresh queue
   */
  async processRefreshQueue(): Promise<void> {
    const priorities = ['high', 'normal', 'low']
    
    for (const priority of priorities) {
      try {
        const queueKey = `refresh_queue:${priority}`
        const jobId = await redisCache.rpop(queueKey)
        
        if (!jobId) continue

        const job = await redisCache.get(`refresh_job:${jobId}`)
        if (!job) continue

        logger.info('Processing refresh job', { jobId, priority })

        // Process the job
        await this.processRefreshJob(job)

        // Clean up
        await redisCache.del(`refresh_job:${jobId}`)

      } catch (error) {
        logger.error('Error processing refresh queue', { priority, error })
      }
    }
  }

  // Private helper methods

  private async updateSyncStatus(status: SyncJobStatus): Promise<void> {
    try {
      await redisCache.set('current_sync_job', status, 60 * 60 * 24) // 24 hours TTL
    } catch (error) {
      logger.error('Error updating sync status', { error })
    }
  }

  private async getPopularCards(limit: number): Promise<Array<{ cardId: string; accessCount: number }>> {
    try {
      // This would query actual access logs
      // For now, return mock data based on database queries
      const popularCards = await db.enhancedCardData.findMany({
        orderBy: { popularityScore: 'desc' },
        take: limit,
        select: { cardId: true, popularityScore: true }
      })

      return popularCards.map(card => ({
        cardId: card.cardId,
        accessCount: Number(card.popularityScore)
      }))

    } catch (error) {
      logger.error('Error getting popular cards', { error })
      return []
    }
  }

  private async calculatePopularityScore(cardId: string): Promise<number> {
    try {
      // This would calculate based on:
      // - API access frequency
      // - Deck inclusion rates
      // - Search frequency
      // - Community engagement
      
      // For now, return a mock calculation
      const baseScore = Math.random() * 100
      const timeDecay = 0.95 // Slight decay over time
      
      return Math.max(0, baseScore * timeDecay)

    } catch (error) {
      logger.error('Error calculating popularity score', { cardId, error })
      return 0
    }
  }

  private async processRefreshJob(job: any): Promise<void> {
    try {
      const { cardIds } = job
      
      for (const cardId of cardIds) {
        try {
          await enhancedCardDataService.getEnhancedCard(cardId)
        } catch (error) {
          logger.warn('Failed to refresh card in job', { cardId, error: error.message })
        }
      }

      logger.info('Refresh job completed', { 
        jobId: job.id, 
        cardCount: cardIds.length 
      })

    } catch (error) {
      logger.error('Error processing refresh job', { jobId: job.id, error })
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const cardDataSyncService = CardDataSyncService.getInstance()