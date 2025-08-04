import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from '../redis'
import { IntelligentCacheService } from './intelligent-cache'

interface BackgroundJob {
  id: string
  type: 'deck_analysis' | 'ai_computation' | 'price_update' | 'meta_analysis' | 'collection_sync'
  priority: 'low' | 'medium' | 'high' | 'critical'
  payload: Record<string, any>
  userId?: string
  scheduledFor: Date
  createdAt: Date
  attempts: number
  maxAttempts: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  processingStarted?: Date
  processingCompleted?: Date
  error?: string
  result?: any
}

interface JobProcessor {
  type: string
  handler: (job: BackgroundJob) => Promise<any>
  concurrency: number
  timeout: number
  retryDelay: number
}

interface ProcessorStats {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
  queueLength: number
  activeWorkers: number
}

interface OptimisticUpdate {
  id: string
  type: string
  entityId: string
  optimisticData: any
  rollbackData: any
  timestamp: Date
  applied: boolean
}

export class BackgroundProcessorService {
  private processors = new Map<string, JobProcessor>()
  private activeJobs = new Map<string, BackgroundJob>()
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout
  private stats: ProcessorStats = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    averageProcessingTime: 0,
    queueLength: 0,
    activeWorkers: 0
  }

  constructor(
    private prisma: PrismaClient,
    private cacheService: IntelligentCacheService
  ) {
    this.registerDefaultProcessors()
  }

  /**
   * Start the background processor
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      console.log('Background processor is already running')
      return
    }

    this.isProcessing = true
    console.log('Starting background processor...')

    // Process jobs every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(error => {
        console.error('Error in background processing:', error)
      })
    }, 5000)

    // Initial processing
    await this.processJobs()
  }

  /**
   * Stop the background processor
   */
  async stop(): Promise<void> {
    this.isProcessing = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }

    // Wait for active jobs to complete
    const activeJobIds = Array.from(this.activeJobs.keys())
    if (activeJobIds.length > 0) {
      console.log(`Waiting for ${activeJobIds.length} active jobs to complete...`)
      
      // Give jobs 30 seconds to complete
      const timeout = setTimeout(() => {
        console.log('Forcing shutdown of background processor')
      }, 30000)

      while (this.activeJobs.size > 0 && this.isProcessing) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      clearTimeout(timeout)
    }

    console.log('Background processor stopped')
  }

  /**
   * Queue a background job
   */
  async queueJob(
    type: string,
    payload: Record<string, any>,
    options: {
      priority?: BackgroundJob['priority']
      userId?: string
      delay?: number
      maxAttempts?: number
    } = {}
  ): Promise<string> {
    try {
      const jobId = this.generateJobId()
      const scheduledFor = new Date(Date.now() + (options.delay || 0))

      const job: BackgroundJob = {
        id: jobId,
        type,
        priority: options.priority || 'medium',
        payload,
        userId: options.userId,
        scheduledFor,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: options.maxAttempts || 3,
        status: 'pending'
      }

      // Store job in database for persistence
      await this.storeJob(job)

      // Add to Redis queue for processing
      await this.addToQueue(job)

      this.stats.totalJobs++
      this.stats.queueLength++

      return jobId
    } catch (error) {
      console.error('Error queueing background job:', error)
      throw error
    }
  }

  /**
   * Apply optimistic update with rollback capability
   */
  async applyOptimisticUpdate(
    type: string,
    entityId: string,
    optimisticData: any,
    rollbackData: any
  ): Promise<string> {
    try {
      const updateId = this.generateJobId()
      
      const update: OptimisticUpdate = {
        id: updateId,
        type,
        entityId,
        optimisticData,
        rollbackData,
        timestamp: new Date(),
        applied: false
      }

      // Store optimistic update
      await redisCache.set(`optimistic:${updateId}`, update, 60 * 60) // 1 hour TTL

      // Apply the optimistic update immediately
      await this.applyUpdate(update)
      update.applied = true

      // Update the stored record
      await redisCache.set(`optimistic:${updateId}`, update, 60 * 60)

      return updateId
    } catch (error) {
      console.error('Error applying optimistic update:', error)
      throw error
    }
  }

  /**
   * Rollback optimistic update
   */
  async rollbackOptimisticUpdate(updateId: string): Promise<void> {
    try {
      const update = await redisCache.get<OptimisticUpdate>(`optimistic:${updateId}`)
      if (!update) {
        console.warn(`Optimistic update ${updateId} not found for rollback`)
        return
      }

      if (update.applied) {
        // Apply rollback data
        await this.applyUpdate({
          ...update,
          optimisticData: update.rollbackData
        })
      }

      // Remove the optimistic update record
      await redisCache.del(`optimistic:${updateId}`)
    } catch (error) {
      console.error('Error rolling back optimistic update:', error)
      throw error
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<BackgroundJob | null> {
    try {
      // Check active jobs first
      const activeJob = this.activeJobs.get(jobId)
      if (activeJob) return activeJob

      // Check database
      return await this.getStoredJob(jobId)
    } catch (error) {
      console.error(`Error getting job status for ${jobId}:`, error)
      return null
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Remove from active jobs if processing
      if (this.activeJobs.has(jobId)) {
        const job = this.activeJobs.get(jobId)!
        job.status = 'cancelled'
        this.activeJobs.delete(jobId)
      }

      // Remove from queue
      await this.removeFromQueue(jobId)

      // Update database
      await this.updateJobStatus(jobId, 'cancelled')

      return true
    } catch (error) {
      console.error(`Error cancelling job ${jobId}:`, error)
      return false
    }
  }

  /**
   * Get processor statistics
   */
  getStats(): ProcessorStats {
    return {
      ...this.stats,
      queueLength: this.getQueueLength(),
      activeWorkers: this.activeJobs.size
    }
  }

  /**
   * Register a custom job processor
   */
  registerProcessor(processor: JobProcessor): void {
    this.processors.set(processor.type, processor)
    console.log(`Registered processor for job type: ${processor.type}`)
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    if (!this.isProcessing) return

    try {
      // Get available processors
      const availableProcessors = Array.from(this.processors.values())
        .filter(processor => this.getActiveJobsForType(processor.type) < processor.concurrency)

      if (availableProcessors.length === 0) return

      // Get jobs from queue
      const jobs = await this.getJobsFromQueue(availableProcessors.length)
      
      // Process jobs in parallel
      const processingPromises = jobs.map(job => this.processJob(job))
      await Promise.allSettled(processingPromises)

    } catch (error) {
      console.error('Error processing jobs:', error)
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: BackgroundJob): Promise<void> {
    const processor = this.processors.get(job.type)
    if (!processor) {
      console.error(`No processor found for job type: ${job.type}`)
      await this.failJob(job, `No processor found for job type: ${job.type}`)
      return
    }

    // Check if job is scheduled for future
    if (job.scheduledFor > new Date()) {
      // Re-queue for later
      await this.addToQueue(job)
      return
    }

    const startTime = Date.now()
    
    try {
      // Mark job as processing
      job.status = 'processing'
      job.processingStarted = new Date()
      job.attempts++
      
      this.activeJobs.set(job.id, job)
      await this.updateJobStatus(job.id, 'processing')

      // Set timeout for job processing
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), processor.timeout)
      })

      // Process the job
      const resultPromise = processor.handler(job)
      const result = await Promise.race([resultPromise, timeoutPromise])

      // Job completed successfully
      job.status = 'completed'
      job.processingCompleted = new Date()
      job.result = result

      await this.completeJob(job)

      const processingTime = Date.now() - startTime
      this.updateProcessingStats(processingTime, true)

    } catch (error) {
      const processingTime = Date.now() - startTime
      this.updateProcessingStats(processingTime, false)

      console.error(`Error processing job ${job.id}:`, error)

      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        // Schedule retry with exponential backoff
        const delay = Math.min(processor.retryDelay * Math.pow(2, job.attempts - 1), 300000) // Max 5 minutes
        job.scheduledFor = new Date(Date.now() + delay)
        job.status = 'pending'
        
        await this.addToQueue(job)
        await this.updateJobStatus(job.id, 'pending')
      } else {
        // Max attempts reached, fail the job
        await this.failJob(job, error instanceof Error ? error.message : 'Unknown error')
      }
    } finally {
      this.activeJobs.delete(job.id)
    }
  }

  /**
   * Register default processors
   */
  private registerDefaultProcessors(): void {
    // Deck analysis processor
    this.registerProcessor({
      type: 'deck_analysis',
      handler: async (job) => {
        const { deckId, analysisType } = job.payload
        
        // This would integrate with your deck analysis service
        console.log(`Processing deck analysis for ${deckId}, type: ${analysisType}`)
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        return { deckId, analysisType, completed: true }
      },
      concurrency: 3,
      timeout: 30000, // 30 seconds
      retryDelay: 5000 // 5 seconds
    })

    // AI computation processor
    this.registerProcessor({
      type: 'ai_computation',
      handler: async (job) => {
        const { prompt, modelId, userId } = job.payload
        
        // Check cache first
        const cached = await this.cacheService.getCachedAIResponse(modelId, prompt)
        if (cached) {
          return cached
        }
        
        // This would integrate with your AI service
        console.log(`Processing AI computation for user ${userId}`)
        
        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const result = { response: 'AI generated response', tokens: 100, cost: 0.01 }
        
        // Cache the result
        await this.cacheService.cacheAIResponse(modelId, prompt, result.response, {
          tokens: result.tokens,
          cost: result.cost,
          computationTime: 5000
        })
        
        return result
      },
      concurrency: 2,
      timeout: 60000, // 1 minute
      retryDelay: 10000 // 10 seconds
    })

    // Price update processor
    this.registerProcessor({
      type: 'price_update',
      handler: async (job) => {
        const { cardIds } = job.payload
        
        console.log(`Updating prices for ${cardIds.length} cards`)
        
        // This would integrate with your price service
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        return { updatedCards: cardIds.length }
      },
      concurrency: 5,
      timeout: 15000, // 15 seconds
      retryDelay: 3000 // 3 seconds
    })

    // Collection sync processor
    this.registerProcessor({
      type: 'collection_sync',
      handler: async (job) => {
        const { userId, platform } = job.payload
        
        console.log(`Syncing collection for user ${userId} from ${platform}`)
        
        // This would integrate with collection sync service
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        return { userId, platform, synced: true }
      },
      concurrency: 2,
      timeout: 120000, // 2 minutes
      retryDelay: 30000 // 30 seconds
    })
  }

  /**
   * Helper methods
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  private async storeJob(job: BackgroundJob): Promise<void> {
    try {
      await this.prisma.backgroundJob.create({
        data: {
          id: job.id,
          type: job.type,
          priority: job.priority,
          payload: job.payload,
          userId: job.userId,
          scheduledFor: job.scheduledFor,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          createdAt: job.createdAt
        }
      })
    } catch (error) {
      console.error('Error storing job:', error)
    }
  }

  private async getStoredJob(jobId: string): Promise<BackgroundJob | null> {
    try {
      const job = await this.prisma.backgroundJob.findUnique({
        where: { id: jobId }
      })
      
      if (!job) return null
      
      return {
        id: job.id,
        type: job.type,
        priority: job.priority as BackgroundJob['priority'],
        payload: job.payload as Record<string, any>,
        userId: job.userId,
        scheduledFor: job.scheduledFor,
        createdAt: job.createdAt,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        status: job.status as BackgroundJob['status'],
        processingStarted: job.processingStarted,
        processingCompleted: job.processingCompleted,
        error: job.error,
        result: job.result as any
      }
    } catch (error) {
      console.error('Error getting stored job:', error)
      return null
    }
  }

  private async updateJobStatus(jobId: string, status: BackgroundJob['status'], error?: string, result?: any): Promise<void> {
    try {
      await this.prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status,
          error,
          result,
          processingCompleted: status === 'completed' || status === 'failed' ? new Date() : undefined
        }
      })
    } catch (error) {
      console.error('Error updating job status:', error)
    }
  }

  private async addToQueue(job: BackgroundJob): Promise<void> {
    const queueKey = `queue:${job.priority}`
    await redisCache.lpush(queueKey, JSON.stringify(job))
  }

  private async getJobsFromQueue(maxJobs: number): Promise<BackgroundJob[]> {
    const jobs: BackgroundJob[] = []
    const priorities: BackgroundJob['priority'][] = ['critical', 'high', 'medium', 'low']
    
    for (const priority of priorities) {
      const queueKey = `queue:${priority}`
      
      while (jobs.length < maxJobs) {
        const jobData = await redisCache.rpop(queueKey)
        if (!jobData) break
        
        try {
          const job = JSON.parse(jobData) as BackgroundJob
          jobs.push(job)
        } catch (error) {
          console.error('Error parsing job from queue:', error)
        }
      }
      
      if (jobs.length >= maxJobs) break
    }
    
    return jobs
  }

  private async removeFromQueue(jobId: string): Promise<void> {
    const priorities: BackgroundJob['priority'][] = ['critical', 'high', 'medium', 'low']
    
    for (const priority of priorities) {
      const queueKey = `queue:${priority}`
      const queueItems = await redisCache.lrange(queueKey, 0, -1)
      
      for (let i = 0; i < queueItems.length; i++) {
        try {
          const job = JSON.parse(queueItems[i]) as BackgroundJob
          if (job.id === jobId) {
            await redisCache.lrem(queueKey, 1, queueItems[i])
            return
          }
        } catch (error) {
          console.error('Error parsing job for removal:', error)
        }
      }
    }
  }

  private getQueueLength(): number {
    // This would get the actual queue length from Redis
    // For now, return the tracked value
    return this.stats.queueLength
  }

  private getActiveJobsForType(type: string): number {
    return Array.from(this.activeJobs.values()).filter(job => job.type === type).length
  }

  private async completeJob(job: BackgroundJob): Promise<void> {
    await this.updateJobStatus(job.id, 'completed', undefined, job.result)
    this.stats.completedJobs++
    this.stats.queueLength--
  }

  private async failJob(job: BackgroundJob, error: string): Promise<void> {
    job.status = 'failed'
    job.error = error
    job.processingCompleted = new Date()
    
    await this.updateJobStatus(job.id, 'failed', error)
    this.stats.failedJobs++
    this.stats.queueLength--
  }

  private updateProcessingStats(processingTime: number, success: boolean): void {
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.completedJobs + this.stats.failedJobs - 1) + processingTime) / 
      (this.stats.completedJobs + this.stats.failedJobs)
  }

  private async applyUpdate(update: OptimisticUpdate): Promise<void> {
    // This would apply the optimistic update to your data store
    // Implementation depends on your specific data models
    console.log(`Applying optimistic update ${update.id} for ${update.type}:${update.entityId}`)
  }
}