/**
 * Circuit Breaker Service
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * when AI services are experiencing issues. Provides automatic recovery
 * and graceful degradation.
 */

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeoutMs: number
  monitoringWindowMs: number
  minimumThroughput: number
  errorThresholdPercentage: number
}

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing recovery
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  totalRequests: number
  errorRate: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  nextRetryTime?: Date
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public stats: CircuitBreakerStats) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreakerService {
  private static readonly DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeoutMs: 60000, // 1 minute
    monitoringWindowMs: 300000, // 5 minutes
    minimumThroughput: 10,
    errorThresholdPercentage: 50
  }

  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private nextRetryTime?: Date
  private requestHistory: Array<{ timestamp: Date; success: boolean }> = []

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig = CircuitBreakerService.DEFAULT_CONFIG
  ) {
    this.config = { ...CircuitBreakerService.DEFAULT_CONFIG, ...config }
    console.log(`🔧 Circuit breaker initialized for ${serviceName}`)
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        console.log(`🔄 [${this.serviceName}] Circuit breaker transitioning to HALF_OPEN`)
        this.state = CircuitState.HALF_OPEN
      } else {
        const stats = this.getStats()
        console.log(`🚫 [${this.serviceName}] Circuit breaker is OPEN, failing fast`)
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.serviceName}. Next retry at ${this.nextRetryTime?.toISOString()}`,
          stats
        )
      }
    }

    const startTime = Date.now()
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++
    this.lastSuccessTime = new Date()
    this.addToHistory(true)

    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`✅ [${this.serviceName}] Circuit breaker transitioning to CLOSED after successful test`)
      this.reset()
    }

    console.log(`✅ [${this.serviceName}] Circuit breaker recorded success (${this.successCount} total)`)
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()
    this.addToHistory(false)

    console.log(`❌ [${this.serviceName}] Circuit breaker recorded failure (${this.failureCount}/${this.config.failureThreshold})`)

    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`🔴 [${this.serviceName}] Circuit breaker transitioning to OPEN after failed test`)
      this.trip()
    } else if (this.shouldTrip()) {
      console.log(`🔴 [${this.serviceName}] Circuit breaker tripping due to failure threshold`)
      this.trip()
    }
  }

  /**
   * Check if circuit breaker should trip
   */
  private shouldTrip(): boolean {
    // Simple failure count threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true
    }

    // Advanced: Check error rate within monitoring window
    const recentRequests = this.getRecentRequests()
    if (recentRequests.length >= this.config.minimumThroughput) {
      const errorRate = this.calculateErrorRate(recentRequests)
      return errorRate >= this.config.errorThresholdPercentage
    }

    return false
  }

  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextRetryTime) {
      return true
    }
    return Date.now() >= this.nextRetryTime.getTime()
  }

  /**
   * Trip the circuit breaker (open it)
   */
  private trip(): void {
    this.state = CircuitState.OPEN
    this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeoutMs)
    console.log(`🔴 [${this.serviceName}] Circuit breaker OPEN until ${this.nextRetryTime.toISOString()}`)
  }

  /**
   * Reset the circuit breaker (close it)
   */
  private reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.nextRetryTime = undefined
    console.log(`🟢 [${this.serviceName}] Circuit breaker CLOSED and reset`)
  }

  /**
   * Add request to history for monitoring
   */
  private addToHistory(success: boolean): void {
    const now = new Date()
    this.requestHistory.push({ timestamp: now, success })

    // Clean old entries outside monitoring window
    const cutoff = new Date(now.getTime() - this.config.monitoringWindowMs)
    this.requestHistory = this.requestHistory.filter(entry => entry.timestamp >= cutoff)
  }

  /**
   * Get recent requests within monitoring window
   */
  private getRecentRequests(): Array<{ timestamp: Date; success: boolean }> {
    const cutoff = new Date(Date.now() - this.config.monitoringWindowMs)
    return this.requestHistory.filter(entry => entry.timestamp >= cutoff)
  }

  /**
   * Calculate error rate for given requests
   */
  private calculateErrorRate(requests: Array<{ success: boolean }>): number {
    if (requests.length === 0) return 0
    
    const failures = requests.filter(req => !req.success).length
    return (failures / requests.length) * 100
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const recentRequests = this.getRecentRequests()
    const totalRequests = this.successCount + this.failureCount
    const errorRate = totalRequests > 0 ? (this.failureCount / totalRequests) * 100 : 0

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests,
      errorRate,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime
    }
  }

  /**
   * Force circuit breaker to specific state (for testing)
   */
  forceState(state: CircuitState): void {
    console.log(`🔧 [${this.serviceName}] Circuit breaker forced to ${state}`)
    this.state = state
    if (state === CircuitState.OPEN) {
      this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeoutMs)
    } else if (state === CircuitState.CLOSED) {
      this.reset()
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log(`🔧 [${this.serviceName}] Circuit breaker config updated`)
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.serviceName
  }
}