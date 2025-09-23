/**
 * Timeout Service
 * 
 * Provides timeout handling and graceful degradation for long-running
 * AI operations with configurable timeouts and fallback strategies.
 */

export interface TimeoutConfig {
  defaultTimeoutMs: number
  operationTimeouts: Record<string, number>
  enableGracefulDegradation: boolean
  warningThresholdMs: number
}

export interface TimeoutResult<T> {
  success: boolean
  result?: T
  error?: Error
  timedOut: boolean
  durationMs: number
  operationType: string
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public operationType: string,
    public timeoutMs: number,
    public actualDurationMs: number
  ) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class TimeoutService {
  private static readonly DEFAULT_CONFIG: TimeoutConfig = {
    defaultTimeoutMs: 120000, // 2 minutes
    operationTimeouts: {
      'deck-generation': 180000,    // 3 minutes
      'card-recommendation': 60000, // 1 minute
      'synergy-analysis': 90000,    // 1.5 minutes
      'strategy-analysis': 90000,   // 1.5 minutes
      'vision-parsing': 30000,      // 30 seconds
    },
    enableGracefulDegradation: true,
    warningThresholdMs: 30000 // 30 seconds
  }

  private activeOperations = new Map<string, AbortController>()

  constructor(private config: TimeoutConfig = TimeoutService.DEFAULT_CONFIG) {
    this.config = { ...TimeoutService.DEFAULT_CONFIG, ...config }
  }

  /**
   * Execute operation with timeout
   */
  async executeWithTimeout<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    operationType: string,
    customTimeoutMs?: number,
    operationId?: string
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now()
    const timeoutMs = customTimeoutMs || 
                     this.config.operationTimeouts[operationType] || 
                     this.config.defaultTimeoutMs

    const id = operationId || `${operationType}-${Date.now()}-${Math.random()}`
    const abortController = new AbortController()
    
    // Store active operation for potential cancellation
    this.activeOperations.set(id, abortController)

    console.log(`⏱️ [${operationType}] Starting with ${timeoutMs}ms timeout (ID: ${id})`)

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          abortController.abort()
          reject(new TimeoutError(
            `Operation ${operationType} timed out after ${timeoutMs}ms`,
            operationType,
            timeoutMs,
            Date.now() - startTime
          ))
        }, timeoutMs)

        // Clear timeout if operation completes
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
        })
      })

      // Race between operation and timeout
      const result = await Promise.race([
        operation(abortController.signal),
        timeoutPromise
      ])

      const durationMs = Date.now() - startTime

      // Check if operation took longer than warning threshold
      if (durationMs > this.config.warningThresholdMs) {
        console.warn(`⚠️ [${operationType}] Slow operation: ${durationMs}ms (threshold: ${this.config.warningThresholdMs}ms)`)
      }

      console.log(`✅ [${operationType}] Completed in ${durationMs}ms`)

      return {
        success: true,
        result,
        timedOut: false,
        durationMs,
        operationType
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const isTimeout = error instanceof TimeoutError

      if (isTimeout) {
        console.error(`⏰ [${operationType}] Timed out after ${durationMs}ms`)
      } else {
        console.error(`❌ [${operationType}] Failed after ${durationMs}ms:`, error)
      }

      return {
        success: false,
        error: error as Error,
        timedOut: isTimeout,
        durationMs,
        operationType
      }
    } finally {
      // Clean up
      this.activeOperations.delete(id)
      if (!abortController.signal.aborted) {
        abortController.abort()
      }
    }
  }

  /**
   * Execute with progressive timeout (multiple attempts with increasing timeouts)
   */
  async executeWithProgressiveTimeout<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    operationType: string,
    timeoutSteps: number[] = [30000, 60000, 120000] // 30s, 1m, 2m
  ): Promise<TimeoutResult<T>> {
    let lastResult: TimeoutResult<T> | undefined

    for (let i = 0; i < timeoutSteps.length; i++) {
      const timeoutMs = timeoutSteps[i]
      const attempt = i + 1
      
      console.log(`🔄 [${operationType}] Progressive timeout attempt ${attempt}/${timeoutSteps.length} (${timeoutMs}ms)`)

      const result = await this.executeWithTimeout(
        operation,
        operationType,
        timeoutMs,
        `${operationType}-progressive-${attempt}`
      )

      if (result.success) {
        return result
      }

      lastResult = result

      // If it's not a timeout error, don't retry
      if (!result.timedOut) {
        console.log(`🛑 [${operationType}] Non-timeout error, not retrying`)
        break
      }

      // If this was the last attempt, break
      if (i === timeoutSteps.length - 1) {
        console.log(`🛑 [${operationType}] All progressive timeout attempts exhausted`)
        break
      }

      // Brief pause between attempts
      await this.sleep(1000)
    }

    return lastResult!
  }

  /**
   * Cancel active operation by ID
   */
  cancelOperation(operationId: string): boolean {
    const controller = this.activeOperations.get(operationId)
    if (controller) {
      console.log(`🛑 Cancelling operation: ${operationId}`)
      controller.abort()
      this.activeOperations.delete(operationId)
      return true
    }
    return false
  }

  /**
   * Cancel all active operations
   */
  cancelAllOperations(): number {
    const count = this.activeOperations.size
    console.log(`🛑 Cancelling ${count} active operations`)
    
    for (const [id, controller] of this.activeOperations) {
      controller.abort()
    }
    
    this.activeOperations.clear()
    return count
  }

  /**
   * Get active operations count
   */
  getActiveOperationsCount(): number {
    return this.activeOperations.size
  }

  /**
   * Get active operation IDs
   */
  getActiveOperationIds(): string[] {
    return Array.from(this.activeOperations.keys())
  }

  /**
   * Create timeout-aware fetch wrapper
   */
  createTimeoutFetch(baseTimeoutMs: number = 30000) {
    return async (url: string, options: RequestInit = {}): Promise<Response> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), baseTimeoutMs)

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(
            `Fetch request timed out after ${baseTimeoutMs}ms`,
            'fetch',
            baseTimeoutMs,
            baseTimeoutMs
          )
        }
        throw error
      }
    }
  }

  /**
   * Update timeout configuration
   */
  updateConfig(newConfig: Partial<TimeoutConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🔧 Timeout service configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): TimeoutConfig {
    return { ...this.config }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get timeout for specific operation type
   */
  getTimeoutForOperation(operationType: string): number {
    return this.config.operationTimeouts[operationType] || this.config.defaultTimeoutMs
  }

  /**
   * Set timeout for specific operation type
   */
  setTimeoutForOperation(operationType: string, timeoutMs: number): void {
    this.config.operationTimeouts[operationType] = timeoutMs
    console.log(`🔧 Set timeout for ${operationType}: ${timeoutMs}ms`)
  }
}