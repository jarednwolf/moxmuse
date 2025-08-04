// Performance monitoring utilities for the deck building tutor

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initializeObservers()
  }

  private initializeObservers() {
    // Observe paint timing
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric(entry.name, entry.startTime, {
              entryType: entry.entryType
            })
          }
        })
        paintObserver.observe({ entryTypes: ['paint'] })
        this.observers.push(paintObserver)

        // Observe largest contentful paint
        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('largest-contentful-paint', entry.startTime, {
              size: (entry as any).size,
              element: (entry as any).element?.tagName
            })
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)

        // Observe layout shifts
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('cumulative-layout-shift', (entry as any).value, {
              hadRecentInput: (entry as any).hadRecentInput,
              sources: (entry as any).sources?.length || 0
            })
          }
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(clsObserver)
      } catch (error) {
        console.warn('Performance observer not supported:', error)
      }
    }
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      metadata
    })

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }
  }

  // Measure function execution time
  measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    
    this.recordMetric(`function-${name}`, end - start)
    return result
  }

  // Measure async function execution time
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    
    this.recordMetric(`async-function-${name}`, end - start)
    return result
  }

  // Measure component render time
  measureRender(componentName: string, renderFn: () => void) {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    
    this.recordMetric(`render-${componentName}`, end - start)
  }

  // Get metrics by name
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(metric => metric.name === name)
    }
    return [...this.metrics]
  }

  // Get average metric value
  getAverageMetric(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0
    
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0)
    return sum / metrics.length
  }

  // Get performance summary
  getSummary(): Record<string, any> {
    const summary: Record<string, any> = {}
    
    // Group metrics by name
    const groupedMetrics = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = []
      }
      acc[metric.name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>)

    // Calculate statistics for each metric
    Object.entries(groupedMetrics).forEach(([name, values]) => {
      const sorted = values.sort((a, b) => a - b)
      summary[name] = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      }
    })

    return summary
  }

  // Clear all metrics
  clear() {
    this.metrics = []
  }

  // Cleanup observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.metrics = []
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const measureRender = (componentName: string) => {
    return (renderFn: () => void) => {
      performanceMonitor.measureRender(componentName, renderFn)
    }
  }

  const measureFunction = <T>(name: string, fn: () => T): T => {
    return performanceMonitor.measureFunction(name, fn)
  }

  const measureAsyncFunction = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    return performanceMonitor.measureAsyncFunction(name, fn)
  }

  return {
    measureRender,
    measureFunction,
    measureAsyncFunction,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    getSummary: performanceMonitor.getSummary.bind(performanceMonitor)
  }
}

// Utility functions for specific performance measurements
export const measureSearchPerformance = (searchTerm: string, resultCount: number, duration: number) => {
  performanceMonitor.recordMetric('search-performance', duration, {
    searchTerm: searchTerm.length, // Don't store actual search term for privacy
    resultCount,
    searchLength: searchTerm.length
  })
}

export const measureVirtualizationPerformance = (itemCount: number, visibleCount: number, duration: number) => {
  performanceMonitor.recordMetric('virtualization-performance', duration, {
    itemCount,
    visibleCount,
    efficiency: visibleCount / itemCount
  })
}

export const measureCacheHitRate = (cacheKey: string, isHit: boolean) => {
  performanceMonitor.recordMetric('cache-hit-rate', isHit ? 1 : 0, {
    cacheKey: cacheKey.split(':')[0] // Only store cache type, not full key
  })
}

export const measureImageLoadTime = (imageUrl: string, loadTime: number, fromCache: boolean) => {
  performanceMonitor.recordMetric('image-load-time', loadTime, {
    fromCache,
    imageType: imageUrl.includes('scryfall') ? 'card' : 'other'
  })
}

// Development-only performance logging
export const logPerformanceSummary = () => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚀 Performance Summary')
    console.table(performanceMonitor.getSummary())
    console.groupEnd()
  }
}