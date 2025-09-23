/**
 * Request Queue Service
 * 
 * Implements request queuing system for high-load scenarios with
 * priority handling, rate limiting, and load balancing capabilities.
 */

export interface QueueConfig {
  maxConcurrentRequests: number
  maxQueueSize: number
  defaultPriority: number
  requestTimeoutMs: number
  enablePriorityQueue: boolean
  rateLimitPerMinute: number
}

export interface QueuedRequest<T> {
  id: string
  operation: () => Promise<T>
  priority: number
  operationType: string
  userId?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  resolve: (value: T) => void
  reject: (error: Error) => void
}

export interface QueueStats {
  queueSize: number
  activeRequests: number
  totalProcessed: number
  totalFailed: number
  averageWaitTimeMs: number
  averageProcessingTimeMs: number
  requestsPerMinute: number
}

export class RequestQueueError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'RequestQueueError'
  }
}

export class RequestQueueService {
  private static readonly DEFAULT_CONFIG: QueueConfig = {
    maxConcurrentRequests: 5,
    maxQueueSize: 100,
    defaultPriority: 5,
    requestTimeoutMs: 300000, // 5 minutes
    enablePriorityQueue: true,
    rateLimitPerMinute: 60
  }

  private queue: QueuedRequest<any>[] = []
  private activeRequests = new Map<string, QueuedRequest<any>>()
  private stats = {
    totalProcessed: 0,
    totalFailed: 0,
    waitTimes: [] as number[],
    processingTimes: [] as number[],
    requestTimestamps: [] as Date[]
  }

  private isProcessing = false

  constructor(
    private serviceName: string,
    private config: QueueConfig = RequestQueueService.DEFAULT_CONFIG
  ) {
    this.config = { ...RequestQueueService.DEFAULT_CONFIG, ...config }
    console.log(`🔧 Request queue initialized for ${serviceName}`)
    
    // Start processing loop
    this.startProcessing()
    
    // Clean up old timestamps periodically
    setInterval(() => this.cleanupOldTimestamps(), 60000) // Every minute
  }

  /**
   * Add request to queue
   */
  async enqueue<T>(
    operation: () => Promise<T>,
    operationType: string,
    priority: number = this.config.defaultPriority,
    userId?: string
  ): Promise<T> {
    // Check rate limiting
    if (!this.checkRateLimit(userId)) {
      throw new RequestQueueError(
        `Rate limit exceeded for ${userId || 'anonymous'}`,
        'RATE_LIMIT_EXCEEDED'
      )
    }

    // Check queue capacity
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new RequestQueueError(
        `Queue is full (${this.config.maxQueueSize} requests)`,
        'QUEUE_FULL'
      )
    }

    const requestId = `${operationType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        operation,
        priority,
        operationType,
        userId,
        createdAt: new Date(),
        resolve,
        reject
      }

      // Add to queue
      this.queue.push(queuedRequest)
      
      // Sort by priority if enabled
      if (this.config.enablePriorityQueue) {
        this.queue.sort((a, b) => b.priority - a.priority)
      }

      console.log(`📥 [${this.serviceName}] Queued request ${requestId} (priority: ${priority}, queue size: ${this.queue.length})`)

      // Set timeout for request
      setTimeout(() => {
        this.timeoutRequest(requestId)
      }, this.config.requestTimeoutMs)
    })
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.isProcessing) return
    
    this.isProcessing = true
    console.log(`🚀 [${this.serviceName}] Started request processing`)
    
    // Process queue continuously
    setImmediate(() => this.processQueue())
  }

  /**
   * Process requests from queue
   */
  private async processQueue(): Promise<void> {
    while (this.isProcessing) {
      try {
        // Check if we can process more requests
        if (this.activeRequests.size >= this.config.maxConcurrentRequests || this.queue.length === 0) {
          await this.sleep(100) // Brief pause
          continue
        }

        // Get next request from queue
        const request = this.queue.shift()
        if (!request) continue

        // Move to active requests
        this.activeRequests.set(request.id, request)
        request.startedAt = new Date()

        // Calculate wait time
        const waitTime = request.startedAt.getTime() - request.createdAt.getTime()
        this.stats.waitTimes.push(waitTime)

        console.log(`🔄 [${this.serviceName}] Processing request ${request.id} (waited: ${waitTime}ms, active: ${this.activeRequests.size})`)

        // Process request asynchronously
        this.processRequest(request).catch(error => {
          console.error(`❌ [${this.serviceName}] Unexpected error processing request ${request.id}:`, error)
        })
      } catch (error) {
        console.error(`❌ [${this.serviceName}] Error in processing loop:`, error)
        await this.sleep(1000) // Longer pause on error
      }
    }
  }

  /**
   * Process individual request
   */
  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.operation()
      
      request.completedAt = new Date()
      const processingTime = request.completedAt.getTime() - request.startedAt!.getTime()
      this.stats.processingTimes.push(processingTime)
      this.stats.totalProcessed++

      console.log(`✅ [${this.serviceName}] Completed request ${request.id} (processed: ${processingTime}ms)`)
      
      request.resolve(result)
    } catch (error) {
      this.stats.totalFailed++
      console.error(`❌ [${this.serviceName}] Request ${request.id} failed:`, error)
      request.reject(error as Error)
    } finally {
      // Remove from active requests
      this.activeRequests.delete(request.id)
      
      // Record request timestamp for rate limiting
      this.stats.requestTimestamps.push(new Date())
    }
  }

  /**
   * Timeout a request
   */
  private timeoutRequest(requestId: string): void {
    // Check if request is still in queue
    const queueIndex = this.queue.findIndex(req => req.id === requestId)
    if (queueIndex !== -1) {
      const request = this.queue.splice(queueIndex, 1)[0]
      console.log(`⏰ [${this.serviceName}] Request ${requestId} timed out in queue`)
      request.reject(new RequestQueueError(
        `Request timed out after ${this.config.requestTimeoutMs}ms in queue`,
        'REQUEST_TIMEOUT'
      ))
      return
    }

    // Check if request is active
    const activeRequest = this.activeRequests.get(requestId)
    if (activeRequest) {
      console.log(`⏰ [${this.serviceName}] Active request ${requestId} timed out`)
      activeRequest.reject(new RequestQueueError(
        `Request timed out after ${this.config.requestTimeoutMs}ms during processing`,
        'REQUEST_TIMEOUT'
      ))
      this.activeRequests.delete(requestId)
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(userId?: string): boolean {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    
    // Count requests in the last minute
    const recentRequests = this.stats.requestTimestamps.filter(
      timestamp => timestamp >= oneMinuteAgo
    ).length

    return recentRequests < this.config.rateLimitPerMinute
  }

  /**
   * Clean up old timestamps
   */
  private cleanupOldTimestamps(): void {
    const oneHourAgo = new Date(Date.now() - 3600000)
    
    this.stats.requestTimestamps = this.stats.requestTimestamps.filter(
      timestamp => timestamp >= oneHourAgo
    )
    
    // Keep only recent wait and processing times for accurate averages
    const maxSamples = 1000
    if (this.stats.waitTimes.length > maxSamples) {
      this.stats.waitTimes = this.stats.waitTimes.slice(-maxSamples)
    }
    if (this.stats.processingTimes.length > maxSamples) {
      this.stats.processingTimes = this.stats.processingTimes.slice(-maxSamples)
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    
    const requestsPerMinute = this.stats.requestTimestamps.filter(
      timestamp => timestamp >= oneMinuteAgo
    ).length

    const averageWaitTimeMs = this.stats.waitTimes.length > 0
      ? this.stats.waitTimes.reduce((sum, time) => sum + time, 0) / this.stats.waitTimes.length
      : 0

    const averageProcessingTimeMs = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((sum, time) => sum + time, 0) / this.stats.processingTimes.length
      : 0

    return {
      queueSize: this.queue.length,
      activeRequests: this.activeRequests.size,
      totalProcessed: this.stats.totalProcessed,
      totalFailed: this.stats.totalFailed,
      averageWaitTimeMs,
      averageProcessingTimeMs,
      requestsPerMinute
    }
  }

  /**
   * Clear queue (emergency use)
   */
  clearQueue(): number {
    const count = this.queue.length
    
    // Reject all queued requests
    for (const request of this.queue) {
      request.reject(new RequestQueueError('Queue cleared', 'QUEUE_CLEARED'))
    }
    
    this.queue = []
    console.log(`🧹 [${this.serviceName}] Cleared ${count} queued requests`)
    
    return count
  }

  /**
   * Stop processing (graceful shutdown)
   */
  async stop(): Promise<void> {
    console.log(`🛑 [${this.serviceName}] Stopping request queue...`)
    this.isProcessing = false
    
    // Wait for active requests to complete (with timeout)
    const maxWaitTime = 30000 // 30 seconds
    const startTime = Date.now()
    
    while (this.activeRequests.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await this.sleep(1000)
    }
    
    // Force reject remaining active requests
    for (const [id, request] of this.activeRequests) {
      request.reject(new RequestQueueError('Service shutting down', 'SERVICE_SHUTDOWN'))
    }
    
    this.activeRequests.clear()
    this.clearQueue()
    
    console.log(`✅ [${this.serviceName}] Request queue stopped`)
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log(`🔧 [${this.serviceName}] Queue configuration updated`)
  }

  /**
   * Get current configuration
   */
  getConfig(): QueueConfig {
    return { ...this.config }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}