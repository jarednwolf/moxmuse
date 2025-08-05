/**
 * Network Request Optimization and Batching System
 * Provides intelligent request batching, deduplication, and optimization
 */

export interface RequestBatch {
  id: string
  requests: PendingRequest[]
  timestamp: number
  timeout: NodeJS.Timeout
}

export interface PendingRequest {
  id: string
  url: string
  options: RequestInit
  resolve: (value: Response) => void
  reject: (reason: any) => void
  timestamp: number
  priority: 'low' | 'medium' | 'high'
}

export interface NetworkOptimizationConfig {
  batchSize: number
  batchTimeout: number
  maxConcurrentRequests: number
  enableDeduplication: boolean
  enableRetry: boolean
  maxRetries: number
  retryDelay: number
}

/**
 * Advanced Network Request Manager
 */
export class NetworkRequestManager {
  private config: NetworkOptimizationConfig
  private pendingRequests = new Map<string, PendingRequest>()
  private activeBatches = new Map<string, RequestBatch>()
  private requestQueue: PendingRequest[] = []
  private activeRequests = new Set<string>()
  private requestCache = new Map<string, { response: Response; timestamp: number }>()

  constructor(config: Partial<NetworkOptimizationConfig> = {}) {
    this.config = {
      batchSize: 10,
      batchTimeout: 50, // 50ms
      maxConcurrentRequests: 6,
      enableDeduplication: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }
  }

  /**
   * Optimized fetch with batching and deduplication
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const requestId = this.generateRequestId(url, options)
    
    // Check cache first
    if (this.config.enableDeduplication) {
      const cached = this.getCachedResponse(url, options)
      if (cached) return cached.clone()
      
      // Check if identical request is already pending
      const existing = this.pendingRequests.get(requestId)
      if (existing) {
        return new Promise((resolve, reject) => {
          existing.resolve = resolve
          existing.reject = reject
        })
      }
    }

    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        id: requestId,
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: this.determinePriority(url, options)
      }

      this.pendingRequests.set(requestId, request)
      this.queueRequest(request)
    })
  }

  /**
   * Batch multiple requests together
   */
  async batchFetch(requests: Array<{ url: string; options?: RequestInit }>): Promise<Response[]> {
    const promises = requests.map(({ url, options }) => this.fetch(url, options))
    return Promise.all(promises)
  }

  private queueRequest(request: PendingRequest) {
    this.requestQueue.push(request)
    this.processQueue()
  }

  private async processQueue() {
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return
    }

    // Sort by priority
    this.requestQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    const batch = this.requestQueue.splice(0, this.config.batchSize)
    if (batch.length === 0) return

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const timeout = setTimeout(() => {
      this.executeBatch(batchId)
    }, this.config.batchTimeout)

    this.activeBatches.set(batchId, {
      id: batchId,
      requests: batch,
      timestamp: Date.now(),
      timeout
    })

    // If batch is full, execute immediately
    if (batch.length >= this.config.batchSize) {
      clearTimeout(timeout)
      this.executeBatch(batchId)
    }
  }

  private async executeBatch(batchId: string) {
    const batch = this.activeBatches.get(batchId)
    if (!batch) return

    this.activeBatches.delete(batchId)
    clearTimeout(batch.timeout)

    // Group requests by domain for connection reuse
    const requestsByDomain = new Map<string, PendingRequest[]>()
    
    batch.requests.forEach(request => {
      const domain = new URL(request.url).hostname
      if (!requestsByDomain.has(domain)) {
        requestsByDomain.set(domain, [])
      }
      requestsByDomain.get(domain)!.push(request)
    })

    // Execute requests by domain
    const domainPromises = Array.from(requestsByDomain.entries()).map(
      ([domain, requests]) => this.executeRequestsForDomain(domain, requests)
    )

    await Promise.all(domainPromises)
    
    // Process remaining queue
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 10)
    }
  }

  private async executeRequestsForDomain(domain: string, requests: PendingRequest[]) {
    const promises = requests.map(request => this.executeRequest(request))
    await Promise.allSettled(promises)
  }

  private async executeRequest(request: PendingRequest, retryCount = 0): Promise<void> {
    this.activeRequests.add(request.id)

    try {
      const response = await fetch(request.url, {
        ...request.options,
        // Add performance optimizations
        keepalive: true,
        cache: 'default'
      })

      // Cache successful responses
      if (response.ok && this.config.enableDeduplication) {
        this.cacheResponse(request.url, request.options, response.clone())
      }

      this.pendingRequests.delete(request.id)
      this.activeRequests.delete(request.id)
      request.resolve(response)

    } catch (error) {
      if (this.config.enableRetry && retryCount < this.config.maxRetries) {
        // Exponential backoff retry
        const delay = this.config.retryDelay * Math.pow(2, retryCount)
        setTimeout(() => {
          this.executeRequest(request, retryCount + 1)
        }, delay)
      } else {
        this.pendingRequests.delete(request.id)
        this.activeRequests.delete(request.id)
        request.reject(error)
      }
    }
  }

  private generateRequestId(url: string, options: RequestInit): string {
    const key = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || '')}`
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '')
  }

  private determinePriority(url: string, options: RequestInit): 'low' | 'medium' | 'high' {
    // API calls are high priority
    if (url.includes('/api/')) return 'high'
    
    // POST/PUT/DELETE are medium priority
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      return 'medium'
    }
    
    // Everything else is low priority
    return 'low'
  }

  private getCachedResponse(url: string, options: RequestInit) {
    const key = this.generateRequestId(url, options)
    const cached = this.requestCache.get(key)
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.response
    }
    
    if (cached) {
      this.requestCache.delete(key)
    }
    
    return null
  }

  private cacheResponse(url: string, options: RequestInit, response: Response) {
    const key = this.generateRequestId(url, options)
    this.requestCache.set(key, {
      response,
      timestamp: Date.now()
    })

    // Limit cache size
    if (this.requestCache.size > 100) {
      const oldestKey = this.requestCache.keys().next().value
      if (oldestKey) {
        this.requestCache.delete(oldestKey)
      }
    }
  }

  /**
   * Get network statistics
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      activeBatches: this.activeBatches.size,
      queuedRequests: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      cachedResponses: this.requestCache.size
    }
  }

  /**
   * Clear all caches and pending requests
   */
  clear() {
    this.pendingRequests.clear()
    this.activeBatches.forEach(batch => clearTimeout(batch.timeout))
    this.activeBatches.clear()
    this.requestQueue = []
    this.requestCache.clear()
  }
}

// Global network manager
export const networkManager = new NetworkRequestManager()

// Optimized fetch function
export const optimizedFetch = (url: string, options?: RequestInit) => {
  return networkManager.fetch(url, options)
}

// Batch fetch function
export const batchFetch = (requests: Array<{ url: string; options?: RequestInit }>) => {
  return networkManager.batchFetch(requests)
}

/**
 * React hook for network optimization
 */
export function useNetworkOptimization() {
  const fetch = (url: string, options?: RequestInit) => {
    return networkManager.fetch(url, options)
  }

  const batchFetch = (requests: Array<{ url: string; options?: RequestInit }>) => {
    return networkManager.batchFetch(requests)
  }

  return {
    fetch,
    batchFetch,
    getStats: () => networkManager.getStats(),
    clear: () => networkManager.clear()
  }
}

/**
 * Network performance utilities
 */
export const NetworkUtils = {
  // Preload critical resources
  preloadResource: (url: string, as: 'script' | 'style' | 'image' | 'fetch' = 'fetch') => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    document.head.appendChild(link)
  },

  // Prefetch resources for next navigation
  prefetchResource: (url: string) => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)
  },

  // Check network connection quality
  getConnectionInfo: () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }
    return null
  },

  // Adaptive loading based on connection
  shouldLoadHighQuality: () => {
    const connection = NetworkUtils.getConnectionInfo()
    if (!connection) return true
    
    return connection.effectiveType === '4g' && 
           connection.downlink > 1.5 && 
           !connection.saveData
  }
}