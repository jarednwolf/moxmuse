/**
 * Advanced Memory Management and Garbage Collection Optimization
 * Provides intelligent memory monitoring, leak detection, and optimization
 */

export interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  usagePercentage: number
  timestamp: number
}

export interface MemoryLeak {
  id: string
  type: 'listener' | 'timer' | 'reference' | 'cache' | 'component'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: Date
  size?: number
  stackTrace?: string
}

export interface MemoryOptimizationConfig {
  maxHeapUsage: number // Percentage
  gcThreshold: number // Percentage
  leakDetectionInterval: number // ms
  enableAutoCleanup: boolean
  enableWeakReferences: boolean
  cacheMaxSize: number // bytes
}

/**
 * Memory monitoring and optimization service
 */
export class MemoryManager {
  private config: MemoryOptimizationConfig
  private memoryHistory: MemoryStats[] = []
  private detectedLeaks: MemoryLeak[] = []
  private cleanupTasks: Set<() => void> = new Set()
  private weakRefs: Set<WeakRef<any>> = new Set()
  private timers: Set<NodeJS.Timeout> = new Set()
  private listeners: Map<EventTarget, Map<string, EventListener>> = new Map()
  private monitoringInterval?: NodeJS.Timeout

  constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    this.config = {
      maxHeapUsage: 80,
      gcThreshold: 70,
      leakDetectionInterval: 30000, // 30 seconds
      enableAutoCleanup: true,
      enableWeakReferences: true,
      cacheMaxSize: 50 * 1024 * 1024, // 50MB
      ...config
    }

    this.startMonitoring()
    this.setupGlobalErrorHandling()
  }

  private startMonitoring() {
    if (typeof window === 'undefined') return

    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats()
      this.detectMemoryLeaks()
      this.performAutoCleanup()
    }, this.config.leakDetectionInterval)

    // Monitor page visibility for cleanup
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performAggressiveCleanup()
      }
    })

    // Cleanup before page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
  }

  private setupGlobalErrorHandling() {
    if (typeof window === 'undefined') return

    // Monitor for potential memory leaks in error handling
    window.addEventListener('error', (event) => {
      this.trackPotentialLeak({
        type: 'reference',
        description: `Uncaught error: ${event.message}`,
        severity: 'medium',
        stackTrace: event.error?.stack
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.trackPotentialLeak({
        type: 'reference',
        description: `Unhandled promise rejection: ${event.reason}`,
        severity: 'medium'
      })
    })
  }

  private collectMemoryStats() {
    if (typeof window === 'undefined' || !('memory' in performance)) return

    const memory = (performance as any).memory
    if (!memory) return

    const stats: MemoryStats = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      timestamp: Date.now()
    }

    this.memoryHistory.push(stats)

    // Keep only last 100 measurements
    if (this.memoryHistory.length > 100) {
      this.memoryHistory.shift()
    }

    // Check for memory pressure
    if (stats.usagePercentage > this.config.maxHeapUsage) {
      this.handleMemoryPressure(stats)
    }

    // Suggest garbage collection if needed
    if (stats.usagePercentage > this.config.gcThreshold) {
      this.suggestGarbageCollection()
    }
  }

  private detectMemoryLeaks() {
    const currentStats = this.getCurrentMemoryStats()
    if (!currentStats) return

    // Check for consistent memory growth
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10)
      const growth = recent[recent.length - 1].usedJSHeapSize - recent[0].usedJSHeapSize
      const avgGrowth = growth / recent.length

      if (avgGrowth > 1024 * 1024) { // 1MB average growth
        this.trackPotentialLeak({
          type: 'reference',
          description: `Consistent memory growth detected: ${(avgGrowth / 1024 / 1024).toFixed(2)}MB average`,
          severity: 'high',
          size: growth
        })
      }
    }

    // Check for timer leaks
    if (this.timers.size > 50) {
      this.trackPotentialLeak({
        type: 'timer',
        description: `High number of active timers: ${this.timers.size}`,
        severity: 'medium'
      })
    }

    // Check for listener leaks
    let totalListeners = 0
    this.listeners.forEach(listenerMap => {
      totalListeners += listenerMap.size
    })

    if (totalListeners > 100) {
      this.trackPotentialLeak({
        type: 'listener',
        description: `High number of event listeners: ${totalListeners}`,
        severity: 'medium'
      })
    }
  }

  private handleMemoryPressure(stats: MemoryStats) {
    console.warn(`🚨 Memory pressure detected: ${stats.usagePercentage.toFixed(2)}% heap usage`)

    // Perform immediate cleanup
    this.performAggressiveCleanup()

    // Clear weak references
    this.cleanupWeakReferences()

    // Suggest garbage collection
    this.suggestGarbageCollection()

    // Track as potential leak
    this.trackPotentialLeak({
      type: 'reference',
      description: `High memory usage: ${stats.usagePercentage.toFixed(2)}%`,
      severity: stats.usagePercentage > 90 ? 'critical' : 'high',
      size: stats.usedJSHeapSize
    })
  }

  private suggestGarbageCollection() {
    if (typeof window !== 'undefined' && 'gc' in window) {
      // Force garbage collection if available (Chrome DevTools)
      try {
        (window as any).gc()
        console.log('🗑️ Forced garbage collection')
      } catch (error) {
        // GC not available
      }
    }

    // Create pressure for garbage collection
    this.createGCPressure()
  }

  private createGCPressure() {
    // Create temporary objects to trigger GC
    const temp: any[] = []
    for (let i = 0; i < 1000; i++) {
      temp.push(new Array(1000).fill(Math.random()))
    }
    // Let them go out of scope
  }

  private trackPotentialLeak(leak: Omit<MemoryLeak, 'id' | 'detectedAt'>) {
    const memoryLeak: MemoryLeak = {
      id: `leak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      detectedAt: new Date(),
      ...leak
    }

    this.detectedLeaks.push(memoryLeak)

    // Keep only last 50 leaks
    if (this.detectedLeaks.length > 50) {
      this.detectedLeaks.shift()
    }

    console.warn(`🔍 Potential memory leak detected:`, memoryLeak)
  }

  private performAutoCleanup() {
    if (!this.config.enableAutoCleanup) return

    // Run registered cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.error('Cleanup task failed:', error)
      }
    })

    // Clean up weak references
    this.cleanupWeakReferences()

    // Clean up old memory history
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-50)
    }
  }

  private performAggressiveCleanup() {
    console.log('🧹 Performing aggressive memory cleanup')

    // Clear all cleanup tasks
    this.performAutoCleanup()

    // Clear timers that haven't been properly cleaned up
    this.clearOrphanedTimers()

    // Remove event listeners
    this.removeOrphanedListeners()

    // Clear weak references
    this.cleanupWeakReferences()

    // Clear caches if available
    this.clearCaches()
  }

  private clearOrphanedTimers() {
    let cleared = 0
    this.timers.forEach(timer => {
      clearTimeout(timer)
      clearInterval(timer)
      cleared++
    })
    this.timers.clear()

    if (cleared > 0) {
      console.log(`🕐 Cleared ${cleared} orphaned timers`)
    }
  }

  private removeOrphanedListeners() {
    let removed = 0
    this.listeners.forEach((listenerMap, target) => {
      listenerMap.forEach((listener, event) => {
        try {
          target.removeEventListener(event, listener)
          removed++
        } catch (error) {
          // Target might be disposed
        }
      })
    })
    this.listeners.clear()

    if (removed > 0) {
      console.log(`👂 Removed ${removed} orphaned event listeners`)
    }
  }

  private cleanupWeakReferences() {
    let cleaned = 0
    const validRefs = new Set<WeakRef<any>>()

    this.weakRefs.forEach(ref => {
      if (ref.deref() !== undefined) {
        validRefs.add(ref)
      } else {
        cleaned++
      }
    })

    this.weakRefs = validRefs

    if (cleaned > 0) {
      console.log(`🔗 Cleaned up ${cleaned} weak references`)
    }
  }

  private clearCaches() {
    // Clear various browser caches if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('temp') || name.includes('cache')) {
            caches.delete(name)
          }
        })
      })
    }

    // Clear session storage of temporary data
    if (typeof sessionStorage !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (key.includes('temp') || key.includes('cache'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key))
    }
  }

  // Public API methods

  /**
   * Register a cleanup task to be run during memory cleanup
   */
  registerCleanupTask(task: () => void): () => void {
    this.cleanupTasks.add(task)
    return () => this.cleanupTasks.delete(task)
  }

  /**
   * Create a managed timer that will be automatically cleaned up
   */
  createManagedTimer(callback: () => void, delay: number, isInterval = false): NodeJS.Timeout {
    const timer = isInterval 
      ? setInterval(callback, delay)
      : setTimeout(() => {
          callback()
          this.timers.delete(timer)
        }, delay)

    this.timers.add(timer)
    return timer
  }

  /**
   * Add a managed event listener that will be automatically cleaned up
   */
  addManagedEventListener<K extends keyof WindowEventMap>(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    target.addEventListener(type, listener, options)

    if (!this.listeners.has(target)) {
      this.listeners.set(target, new Map())
    }
    this.listeners.get(target)!.set(type, listener)

    return () => {
      target.removeEventListener(type, listener)
      const listenerMap = this.listeners.get(target)
      if (listenerMap) {
        listenerMap.delete(type)
        if (listenerMap.size === 0) {
          this.listeners.delete(target)
        }
      }
    }
  }

  /**
   * Create a weak reference that will be automatically tracked
   */
  createWeakReference<T extends object>(target: T): WeakRef<T> {
    if (!this.config.enableWeakReferences) {
      throw new Error('Weak references are disabled')
    }

    const ref = new WeakRef(target)
    this.weakRefs.add(ref)
    return ref
  }

  /**
   * Get current memory statistics
   */
  getCurrentMemoryStats(): MemoryStats | null {
    if (typeof window === 'undefined' || !('memory' in performance)) return null

    const memory = (performance as any).memory
    if (!memory) return null

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      timestamp: Date.now()
    }
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory]
  }

  /**
   * Get detected memory leaks
   */
  getDetectedLeaks(): MemoryLeak[] {
    return [...this.detectedLeaks]
  }

  /**
   * Get memory management statistics
   */
  getStats() {
    return {
      memoryHistory: this.memoryHistory.length,
      detectedLeaks: this.detectedLeaks.length,
      activeTimers: this.timers.size,
      activeListeners: Array.from(this.listeners.values()).reduce((total, map) => total + map.size, 0),
      weakReferences: this.weakRefs.size,
      cleanupTasks: this.cleanupTasks.size
    }
  }

  /**
   * Force memory cleanup
   */
  forceCleanup() {
    this.performAggressiveCleanup()
  }

  /**
   * Cleanup and destroy the memory manager
   */
  cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    this.performAggressiveCleanup()
    this.cleanupTasks.clear()
    this.weakRefs.clear()
    this.memoryHistory = []
    this.detectedLeaks = []
  }
}

/**
 * React hook for memory management
 */
export function useMemoryManager(config?: Partial<MemoryOptimizationConfig>) {
  const manager = new MemoryManager(config)

  const registerCleanup = (task: () => void) => {
    return manager.registerCleanupTask(task)
  }

  const createTimer = (callback: () => void, delay: number, isInterval = false) => {
    return manager.createManagedTimer(callback, delay, isInterval)
  }

  const addEventListener = <K extends keyof WindowEventMap>(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    return manager.addManagedEventListener(target, type, listener, options)
  }

  const createWeakRef = <T extends object>(target: T) => {
    return manager.createWeakReference(target)
  }

  return {
    registerCleanup,
    createTimer,
    addEventListener,
    createWeakRef,
    getCurrentStats: () => manager.getCurrentMemoryStats(),
    getHistory: () => manager.getMemoryHistory(),
    getLeaks: () => manager.getDetectedLeaks(),
    getStats: () => manager.getStats(),
    forceCleanup: () => manager.forceCleanup(),
    cleanup: () => manager.cleanup()
  }
}

/**
 * Memory-aware cache implementation
 */
export class MemoryAwareCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number; accessCount: number }>()
  private maxSize: number
  private maxMemory: number
  private ttl: number

  constructor(options: {
    maxSize?: number
    maxMemory?: number // bytes
    ttl?: number // ms
  } = {}) {
    this.maxSize = options.maxSize || 1000
    this.maxMemory = options.maxMemory || 10 * 1024 * 1024 // 10MB
    this.ttl = options.ttl || 5 * 60 * 1000 // 5 minutes
  }

  set(key: K, value: V): void {
    // Check memory pressure
    if (this.getMemoryUsage() > this.maxMemory) {
      this.evictLRU()
    }

    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0
    })
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    entry.accessCount++
    return entry.value
  }

  private evictLRU(): void {
    let lruKey: K | undefined
    let lruTime = Date.now()

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < lruTime) {
        lruTime = entry.timestamp
        lruKey = key
      }
    })

    if (lruKey !== undefined) {
      this.cache.delete(lruKey)
    }
  }

  private getMemoryUsage(): number {
    // Rough estimation of memory usage
    let size = 0
    this.cache.forEach((entry, key) => {
      size += this.estimateSize(key) + this.estimateSize(entry.value)
    })
    return size
  }

  private estimateSize(obj: any): number {
    const str = JSON.stringify(obj)
    return str.length * 2 // Rough estimate for UTF-16
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Global memory manager instance
export const globalMemoryManager = new MemoryManager()

// Utility functions
export const MemoryUtils = {
  // Format bytes to human readable
  formatBytes: (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  },

  // Check if memory pressure exists
  hasMemoryPressure: (): boolean => {
    const stats = globalMemoryManager.getCurrentMemoryStats()
    return stats ? stats.usagePercentage > 80 : false
  },

  // Get memory pressure level
  getMemoryPressureLevel: (): 'low' | 'medium' | 'high' | 'critical' => {
    const stats = globalMemoryManager.getCurrentMemoryStats()
    if (!stats) return 'low'

    if (stats.usagePercentage > 95) return 'critical'
    if (stats.usagePercentage > 85) return 'high'
    if (stats.usagePercentage > 70) return 'medium'
    return 'low'
  }
}