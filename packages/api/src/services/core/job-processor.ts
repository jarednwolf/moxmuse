/**
 * Background Job Processing System
 * 
 * Provides asynchronous job processing with priority queues, retry logic,
 * progress tracking, and failure handling.
 */

import {
  JobProcessor,
  Job,
  JobOptions,
  JobStatus,
  QueueStats,
  JobHandler,
  JobContext,
  Logger,
  MetricsCollector,
  BaseService,
  ServiceHealthStatus
} from './interfaces'

interface JobRecord<T = any> {
  id: string
  type: string
  data: T
  options: Required<JobOptions>
  status: JobStatus['status']
  progress: number
  result?: any
  error?: string
  attempts: number
  createdAt: Date
  processedAt?: Date
  completedAt?: Date
  nextAttemptAt?: Date
}

interface JobHandlerRecord<T = any> {
  handler: JobHandler<T>
  concurrency: number
  activeJobs: Set<string>
}

export class BackgroundJobProcessor implements JobProcessor, BaseService {
  readonly name = 'BackgroundJobProcessor'
  readonly version = '1.0.0'
  private jobs = new Map<string, JobRecord>()
  private handlers = new Map<string, JobHandlerRecord>()
  private queues = new Map<string, JobRecord[]>()
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout
  private logger: Logger
  private metrics?: MetricsCollector

  constructor(logger: Logger, metrics?: MetricsCollector) {
    this.logger = logger.child({ service: 'JobProcessor' })
    this.metrics = metrics
  }

  async initialize(): Promise<void> {
    // Job processor initialization if needed
  }

  async healthCheck(): Promise<ServiceHealthStatus> {
    const stats = await this.getQueueStats()
    return {
      status: 'healthy',
      metrics: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed
      },
      timestamp: new Date()
    }
  }

  async schedule<T = any>(job: Job<T>): Promise<string> {
    const jobId = this.generateJobId()
    const now = new Date()

    const jobRecord: JobRecord<T> = {
      id: jobId,
      type: job.type,
      data: job.data,
      options: {
        delay: 0,
        attempts: 3,
        priority: 0,
        removeOnComplete: true,
        removeOnFail: false,
        timeout: 30000,
        ...job.options
      },
      status: job.options?.delay ? 'delayed' : 'waiting',
      progress: 0,
      attempts: 0,
      createdAt: now,
      nextAttemptAt: job.options?.delay ? new Date(now.getTime() + job.options.delay) : now
    }

    this.jobs.set(jobId, jobRecord)
    this.addToQueue(jobRecord)

    this.logger.debug(`Scheduled job: ${jobId}`, {
      type: job.type,
      delay: jobRecord.options.delay,
      priority: jobRecord.options.priority
    })

    if (this.metrics) {
      this.metrics.increment('jobs.scheduled', 1, { type: job.type })
    }

    return jobId
  }

  process<T = any>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, {
      handler,
      concurrency: 1, // Default concurrency
      activeJobs: new Set()
    })

    if (!this.queues.has(jobType)) {
      this.queues.set(jobType, [])
    }

    this.logger.debug(`Registered job handler: ${jobType}`)

    // Start processing if not already started
    if (!this.isProcessing) {
      this.startProcessing()
    }
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job) {
      return false
    }

    if (job.status === 'active') {
      // Cannot cancel active jobs directly, but mark for cancellation
      this.logger.warn(`Cannot cancel active job: ${jobId}`)
      return false
    }

    if (job.status === 'waiting' || job.status === 'delayed') {
      job.status = 'failed'
      job.error = 'Job cancelled'
      job.completedAt = new Date()

      this.removeFromQueue(job)
      this.logger.debug(`Cancelled job: ${jobId}`)

      if (this.metrics) {
        this.metrics.increment('jobs.cancelled', 1, { type: job.type })
      }

      return true
    }

    return false
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId)
    if (!job) {
      return null
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      processedAt: job.processedAt,
      completedAt: job.completedAt
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    }

    for (const job of Array.from(this.jobs.values())) {
      stats[job.status]++
    }

    return stats
  }

  private startProcessing(): void {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(error => {
        this.logger.error('Error in job processing loop', error)
      })
    }, 1000) // Process every second

    this.logger.info('Started job processing')
  }

  private stopProcessing(): void {
    if (!this.isProcessing) {
      return
    }

    this.isProcessing = false
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }

    this.logger.info('Stopped job processing')
  }

  private async processJobs(): Promise<void> {
    const now = new Date()

    // Move delayed jobs to waiting if their time has come
    for (const job of Array.from(this.jobs.values())) {
      if (job.status === 'delayed' && job.nextAttemptAt && job.nextAttemptAt <= now) {
        job.status = 'waiting'
        this.addToQueue(job)
      }
    }

    // Process jobs from each queue
    for (const [jobType, queue] of Array.from(this.queues.entries())) {
      const handlerRecord = this.handlers.get(jobType)
      if (!handlerRecord) {
        continue
      }

      // Check if we can process more jobs (concurrency limit)
      const canProcess = handlerRecord.activeJobs.size < handlerRecord.concurrency
      if (!canProcess) {
        continue
      }

      // Get next job from queue (priority order)
      const nextJob = this.getNextJob(queue)
      if (!nextJob) {
        continue
      }

      // Process the job
      this.processJob(nextJob, handlerRecord).catch(error => {
        this.logger.error(`Error processing job ${nextJob.id}`, error)
      })
    }
  }

  private async processJob<T = any>(
    job: JobRecord<T>,
    handlerRecord: JobHandlerRecord<T>
  ): Promise<void> {
    job.status = 'active'
    job.processedAt = new Date()
    job.attempts++
    handlerRecord.activeJobs.add(job.id)

    this.logger.debug(`Processing job: ${job.id}`, {
      type: job.type,
      attempt: job.attempts
    })

    if (this.metrics) {
      this.metrics.increment('jobs.started', 1, { type: job.type })
    }

    const jobContext: JobContext = {
      id: job.id,
      updateProgress: async (progress: number) => {
        job.progress = Math.max(0, Math.min(100, progress))
      },
      log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        this.logger[level](`Job ${job.id}: ${message}`)
      }
    }

    try {
      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.options.timeout)
      })

      const jobPromise = handlerRecord.handler(job.data, jobContext)
      const result = await Promise.race([jobPromise, timeoutPromise])

      // Job completed successfully
      job.status = 'completed'
      job.result = result
      job.completedAt = new Date()
      job.progress = 100

      this.logger.debug(`Job completed: ${job.id}`)

      if (this.metrics) {
        this.metrics.increment('jobs.completed', 1, { type: job.type })
        this.metrics.timing('jobs.duration', 
          job.completedAt.getTime() - job.processedAt!.getTime(),
          { type: job.type }
        )
      }

      // Clean up if configured
      if (job.options.removeOnComplete) {
        this.jobs.delete(job.id)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      job.error = errorMessage

      this.logger.error(`Job failed: ${job.id}`, error as Error, {
        attempt: job.attempts,
        maxAttempts: job.options.attempts
      })

      // Retry logic
      if (job.attempts < job.options.attempts) {
        job.status = 'delayed'
        job.nextAttemptAt = new Date(Date.now() + this.getRetryDelay(job.attempts))
        this.logger.debug(`Retrying job: ${job.id}`, {
          nextAttempt: job.nextAttemptAt,
          attempt: job.attempts + 1
        })
      } else {
        job.status = 'failed'
        job.completedAt = new Date()

        if (this.metrics) {
          this.metrics.increment('jobs.failed', 1, { type: job.type })
        }

        // Clean up if configured
        if (job.options.removeOnFail) {
          this.jobs.delete(job.id)
        }
      }
    } finally {
      handlerRecord.activeJobs.delete(job.id)
    }
  }

  private addToQueue(job: JobRecord): void {
    const queue = this.queues.get(job.type)
    if (!queue) {
      this.queues.set(job.type, [job])
      return
    }

    // Insert job in priority order (higher priority first)
    let inserted = false
    for (let i = 0; i < queue.length; i++) {
      if (job.options.priority > queue[i].options.priority) {
        queue.splice(i, 0, job)
        inserted = true
        break
      }
    }

    if (!inserted) {
      queue.push(job)
    }
  }

  private removeFromQueue(job: JobRecord): void {
    const queue = this.queues.get(job.type)
    if (queue) {
      const index = queue.findIndex(j => j.id === job.id)
      if (index !== -1) {
        queue.splice(index, 1)
      }
    }
  }

  private getNextJob(queue: JobRecord[]): JobRecord | null {
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i]
      if (job.status === 'waiting') {
        queue.splice(i, 1)
        return job
      }
    }
    return null
  }

  private getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000)
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    this.stopProcessing()

    // Wait for active jobs to complete (with timeout)
    const activeJobs = Array.from(this.jobs.values()).filter(job => job.status === 'active')
    if (activeJobs.length > 0) {
      this.logger.info(`Waiting for ${activeJobs.length} active jobs to complete`)
      
      const timeout = 30000 // 30 seconds
      const start = Date.now()
      
      while (activeJobs.some(job => job.status === 'active') && Date.now() - start < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    this.logger.info('Job processor shutdown complete')
  }
}

// Import the logger singleton
import { logger } from './logging'

// Export singleton instance
export const jobProcessor = new BackgroundJobProcessor(logger)
