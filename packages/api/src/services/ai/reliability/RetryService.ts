/**
 * Retry Service with Exponential Backoff
 * 
 * Implements robust retry logic for AI service calls with configurable
 * exponential backoff, jitter, and failure classification.
 */

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffFactor: number
  jitterMs?: number
  retryableErrors?: string[]
  nonRetryableErrors?: string[]
}

export interface RetryAttempt {
  attemptNumber: number
  error?: Error
  delayMs?: number
  timestamp: Date
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: RetryAttempt[]
  totalDurationMs: number
}

export class RetryService {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    jitterMs: 100,
    retryableErrors: [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'rate_limit_exceeded',
      'server_error',
      'timeout',
      'network_error'
    ],
    nonRetryableErrors: [
      'invalid_api_key',
      'insufficient_quota',
      'model_not_found',
      'invalid_request_error',
      'authentication_error'
    ]
  }

  constructor(private config: RetryConfig = RetryService.DEFAULT_CONFIG) {
    this.config = { ...RetryService.DEFAULT_CONFIG, ...config }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<RetryResult<T>> {
    const startTime = Date.now()
    const attempts: RetryAttempt[] = []
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const attemptStart = Date.now()
      
      try {
        console.log(`🔄 [${operationName}] Attempt ${attempt + 1}/${this.config.maxRetries + 1}`)
        
        const result = await operation()
        
        attempts.push({
          attemptNumber: attempt + 1,
          timestamp: new Date(attemptStart)
        })

        console.log(`✅ [${operationName}] Succeeded on attempt ${attempt + 1}`)
        
        return {
          success: true,
          result,
          attempts,
          totalDurationMs: Date.now() - startTime
        }
      } catch (error) {
        lastError = error as Error
        
        attempts.push({
          attemptNumber: attempt + 1,
          error: lastError,
          timestamp: new Date(attemptStart)
        })

        console.log(`❌ [${operationName}] Attempt ${attempt + 1} failed:`, lastError.message)

        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt === this.config.maxRetries) {
          console.log(`🛑 [${operationName}] Not retrying: ${!this.isRetryableError(lastError) ? 'non-retryable error' : 'max retries reached'}`)
          break
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt)
        attempts[attempts.length - 1].delayMs = delay
        
        console.log(`⏳ [${operationName}] Waiting ${delay}ms before retry...`)
        await this.sleep(delay)
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalDurationMs: Date.now() - startTime
    }
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()
    
    // Check non-retryable errors first (higher priority)
    if (this.config.nonRetryableErrors) {
      for (const nonRetryable of this.config.nonRetryableErrors) {
        if (errorMessage.includes(nonRetryable.toLowerCase()) || 
            errorName.includes(nonRetryable.toLowerCase())) {
          return false
        }
      }
    }

    // Check retryable errors
    if (this.config.retryableErrors) {
      for (const retryable of this.config.retryableErrors) {
        if (errorMessage.includes(retryable.toLowerCase()) || 
            errorName.includes(retryable.toLowerCase())) {
          return true
        }
      }
    }

    // Default: retry on network-related errors
    return errorMessage.includes('network') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('connection') ||
           errorMessage.includes('econnreset') ||
           errorMessage.includes('enotfound') ||
           error.name === 'AbortError'
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffFactor, attemptNumber)
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs)
    
    // Add jitter to prevent thundering herd
    const jitter = this.config.jitterMs ? Math.random() * this.config.jitterMs : 0
    
    return Math.floor(cappedDelay + jitter)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config }
  }
}