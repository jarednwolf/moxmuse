import { performanceMonitor } from './monitor'

/**
 * Advanced Frontend Performance Monitoring
 * Extends the basic performance monitor with comprehensive metrics collection
 */

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType: string
}

export interface ResourceMetric {
  name: string
  type: string
  size: number
  duration: number
  startTime: number
  transferSize: number
  encodedBodySize: number
  decodedBodySize: number
}

export interface NavigationMetric {
  type: 'navigate' | 'reload' | 'back_forward' | 'prerender'
  duration: number
  domContentLoaded: number
  loadComplete: number
  firstPaint: number
  firstContentfulPaint: number
  largestContentfulPaint?: number
}

export interface UserInteractionMetric {
  type: 'click' | 'scroll' | 'input' | 'navigation'
  target: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

export interface MemoryMetric {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

export interface NetworkMetric {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
  timestamp: number
}

/**
 * Advanced Performance Monitor for comprehensive frontend metrics
 */
export class AdvancedFrontendMonitor {
  private webVitalsMetrics: WebVitalsMetric[] = []
  private resourceMetrics: ResourceMetric[] = []
  private navigationMetrics: NavigationMetric[] = []
  private userInteractionMetrics: UserInteractionMetric[] = []
  private memoryMetrics: MemoryMetric[] = []
  private networkMetrics: NetworkMetric[] = []
  private observers: PerformanceObserver[] = []
  private isInitialized = false

  constructor() {
    this.initialize()
  }

  private initialize() {
    if (this.isInitialized || typeof window === 'undefined') return

    this.setupWebVitalsMonitoring()
    this.setupResourceMonitoring()
    this.setupNavigationMonitoring()
    this.setupUserInteractionMonitoring()
    this.setupMemoryMonitoring()
    this.setupNetworkMonitoring()
    this.setupPeriodicReporting()

    this.isInitialized = true
  }

  private setupWebVitalsMonitoring() {
    // Import and setup web-vitals library dynamically
    if (typeof window !== 'undefined') {
      import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
        const handleMetric = (metric: any) => {
          const webVital: WebVitalsMetric = {
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            delta: metric.delta,
            id: metric.id,
            navigationType: metric.navigationType || 'unknown'
          }

          this.webVitalsMetrics.push(webVital)
          this.reportWebVital(webVital)
        }

        onCLS(handleMetric)
        onFID(handleMetric)
        onFCP(handleMetric)
        onLCP(handleMetric)
        onTTFB(handleMetric)
        onINP(handleMetric)
      }).catch(error => {
        console.warn('Failed to load web-vitals:', error)
      })
    }
  }

  private setupResourceMonitoring() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resource = entry as PerformanceResourceTiming
            const metric: ResourceMetric = {
              name: resource.name,
              type: this.getResourceType(resource.name),
              size: resource.transferSize || 0,
              duration: resource.duration,
              startTime: resource.startTime,
              transferSize: resource.transferSize || 0,
              encodedBodySize: resource.encodedBodySize || 0,
              decodedBodySize: resource.decodedBodySize || 0
            }

            this.resourceMetrics.push(metric)
            this.analyzeResourcePerformance(metric)
          }
        }
      })

      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)
    } catch (error) {
      console.warn('Resource monitoring not supported:', error)
    }
  }

  private setupNavigationMonitoring() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const nav = entry as PerformanceNavigationTiming
            const metric: NavigationMetric = {
              type: nav.type as any,
              duration: nav.duration,
              domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
              loadComplete: nav.loadEventEnd - nav.loadEventStart,
              firstPaint: 0,
              firstContentfulPaint: 0
            }

            // Get paint timings
            const paintEntries = performance.getEntriesByType('paint')
            for (const paint of paintEntries) {
              if (paint.name === 'first-paint') {
                metric.firstPaint = paint.startTime
              } else if (paint.name === 'first-contentful-paint') {
                metric.firstContentfulPaint = paint.startTime
              }
            }

            this.navigationMetrics.push(metric)
            this.analyzeNavigationPerformance(metric)
          }
        }
      })

      navigationObserver.observe({ entryTypes: ['navigation'] })
      this.observers.push(navigationObserver)
    } catch (error) {
      console.warn('Navigation monitoring not supported:', error)
    }
  }

  private setupUserInteractionMonitoring() {
    if (typeof window === 'undefined') return

    // Monitor clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const metric: UserInteractionMetric = {
        type: 'click',
        target: this.getElementSelector(target),
        duration: 0,
        timestamp: performance.now(),
        metadata: {
          x: event.clientX,
          y: event.clientY,
          button: event.button
        }
      }

      this.userInteractionMetrics.push(metric)
    }, { passive: true })

    // Monitor scroll performance
    let scrollStart = 0
    document.addEventListener('scroll', () => {
      if (scrollStart === 0) {
        scrollStart = performance.now()
      }
    }, { passive: true })

    document.addEventListener('scrollend', () => {
      if (scrollStart > 0) {
        const metric: UserInteractionMetric = {
          type: 'scroll',
          target: 'document',
          duration: performance.now() - scrollStart,
          timestamp: scrollStart,
          metadata: {
            scrollY: window.scrollY,
            scrollX: window.scrollX
          }
        }

        this.userInteractionMetrics.push(metric)
        scrollStart = 0
      }
    }, { passive: true })

    // Monitor input performance
    document.addEventListener('input', (event) => {
      const target = event.target as HTMLElement
      const metric: UserInteractionMetric = {
        type: 'input',
        target: this.getElementSelector(target),
        duration: 0,
        timestamp: performance.now(),
        metadata: {
          inputType: (event as InputEvent).inputType,
          isComposing: (event as InputEvent).isComposing
        }
      }

      this.userInteractionMetrics.push(metric)
    }, { passive: true })
  }

  private setupMemoryMonitoring() {
    if (typeof window === 'undefined' || !('memory' in performance)) return

    // Collect memory metrics every 30 seconds
    setInterval(() => {
      const memory = (performance as any).memory
      if (memory) {
        const metric: MemoryMetric = {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          timestamp: performance.now()
        }

        this.memoryMetrics.push(metric)
        this.analyzeMemoryUsage(metric)
      }
    }, 30000)
  }

  private setupNetworkMonitoring() {
    if (typeof window === 'undefined' || !('connection' in navigator)) return

    const connection = (navigator as any).connection
    if (connection) {
      const collectNetworkMetric = () => {
        const metric: NetworkMetric = {
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
          timestamp: performance.now()
        }

        this.networkMetrics.push(metric)
      }

      // Initial collection
      collectNetworkMetric()

      // Monitor network changes
      connection.addEventListener('change', collectNetworkMetric)
    }
  }

  private setupPeriodicReporting() {
    // Send metrics to backend every 60 seconds
    setInterval(() => {
      this.sendMetricsToBackend()
    }, 60000)

    // Send metrics before page unload
    window.addEventListener('beforeunload', () => {
      this.sendMetricsToBackend()
    })
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script'
    if (url.includes('.css')) return 'stylesheet'
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image'
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font'
    if (url.includes('/api/')) return 'api'
    return 'other'
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`
    if (element.className) return `.${element.className.split(' ')[0]}`
    return element.tagName.toLowerCase()
  }

  private reportWebVital(metric: WebVitalsMetric) {
    performanceMonitor.recordMetric(`web-vital-${metric.name.toLowerCase()}`, metric.value, {
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType
    })

    // Log poor web vitals
    if (metric.rating === 'poor') {
      console.warn(`Poor Web Vital: ${metric.name} = ${metric.value}`)
    }
  }

  private analyzeResourcePerformance(metric: ResourceMetric) {
    // Flag slow resources
    if (metric.duration > 1000) {
      performanceMonitor.recordMetric('slow-resource', metric.duration, {
        name: metric.name,
        type: metric.type,
        size: metric.size
      })
    }

    // Flag large resources
    if (metric.size > 1024 * 1024) { // 1MB
      performanceMonitor.recordMetric('large-resource', metric.size, {
        name: metric.name,
        type: metric.type,
        duration: metric.duration
      })
    }
  }

  private analyzeNavigationPerformance(metric: NavigationMetric) {
    // Flag slow page loads
    if (metric.duration > 3000) {
      performanceMonitor.recordMetric('slow-navigation', metric.duration, {
        type: metric.type,
        domContentLoaded: metric.domContentLoaded,
        loadComplete: metric.loadComplete
      })
    }

    // Flag slow DOM content loaded
    if (metric.domContentLoaded > 1500) {
      performanceMonitor.recordMetric('slow-dom-content-loaded', metric.domContentLoaded, {
        type: metric.type,
        totalDuration: metric.duration
      })
    }
  }

  private analyzeMemoryUsage(metric: MemoryMetric) {
    const usagePercentage = (metric.usedJSHeapSize / metric.jsHeapSizeLimit) * 100

    // Flag high memory usage
    if (usagePercentage > 80) {
      performanceMonitor.recordMetric('high-memory-usage', usagePercentage, {
        usedJSHeapSize: metric.usedJSHeapSize,
        totalJSHeapSize: metric.totalJSHeapSize,
        jsHeapSizeLimit: metric.jsHeapSizeLimit
      })
    }
  }

  private async sendMetricsToBackend() {
    if (this.webVitalsMetrics.length === 0 && this.resourceMetrics.length === 0) return

    try {
      const payload = {
        webVitals: this.webVitalsMetrics.slice(),
        resources: this.resourceMetrics.slice(),
        navigation: this.navigationMetrics.slice(),
        userInteractions: this.userInteractionMetrics.slice(),
        memory: this.memoryMetrics.slice(),
        network: this.networkMetrics.slice(),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }

      // Send to backend API
      await fetch('/api/performance/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      // Clear sent metrics
      this.webVitalsMetrics = []
      this.resourceMetrics = []
      this.navigationMetrics = []
      this.userInteractionMetrics = []
      this.memoryMetrics = []
      this.networkMetrics = []

      console.log('📊 Performance metrics sent to backend')
    } catch (error) {
      console.error('Failed to send performance metrics:', error)
    }
  }

  // Public API methods
  measureComponentRender<T>(componentName: string, renderFn: () => T): T {
    const start = performance.now()
    const result = renderFn()
    const duration = performance.now() - start

    performanceMonitor.recordMetric(`component-render-${componentName}`, duration, {
      componentName,
      renderType: 'sync'
    })

    return result
  }

  async measureAsyncComponentRender<T>(componentName: string, renderFn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await renderFn()
    const duration = performance.now() - start

    performanceMonitor.recordMetric(`component-render-${componentName}`, duration, {
      componentName,
      renderType: 'async'
    })

    return result
  }

  measureAPICall<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    
    return fn()
      .then(result => {
        const duration = performance.now() - start
        performanceMonitor.recordMetric('api-call', duration, {
          endpoint,
          success: true
        })
        return result
      })
      .catch(error => {
        const duration = performance.now() - start
        performanceMonitor.recordMetric('api-call', duration, {
          endpoint,
          success: false,
          error: error.message
        })
        throw error
      })
  }

  getPerformanceSummary() {
    return {
      webVitals: this.webVitalsMetrics.slice(-10),
      resources: this.resourceMetrics.slice(-50),
      navigation: this.navigationMetrics.slice(-5),
      userInteractions: this.userInteractionMetrics.slice(-100),
      memory: this.memoryMetrics.slice(-10),
      network: this.networkMetrics.slice(-10),
      basicMetrics: performanceMonitor.getSummary()
    }
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.sendMetricsToBackend() // Final send
  }
}

// Export singleton instance
export const advancedPerformanceMonitor = new AdvancedFrontendMonitor()

// React hook for advanced performance monitoring
export function useAdvancedPerformanceMonitor() {
  const measureComponentRender = <T>(componentName: string, renderFn: () => T): T => {
    return advancedPerformanceMonitor.measureComponentRender(componentName, renderFn)
  }

  const measureAsyncComponentRender = async <T>(componentName: string, renderFn: () => Promise<T>): Promise<T> => {
    return advancedPerformanceMonitor.measureAsyncComponentRender(componentName, renderFn)
  }

  const measureAPICall = <T>(endpoint: string, fn: () => Promise<T>): Promise<T> => {
    return advancedPerformanceMonitor.measureAPICall(endpoint, fn)
  }

  return {
    measureComponentRender,
    measureAsyncComponentRender,
    measureAPICall,
    getPerformanceSummary: advancedPerformanceMonitor.getPerformanceSummary.bind(advancedPerformanceMonitor)
  }
}

// Utility functions for specific measurements
export const measureDeckGenerationPerformance = (
  operation: string,
  cardCount: number,
  duration: number,
  success: boolean
) => {
  performanceMonitor.recordMetric('deck-generation-performance', duration, {
    operation,
    cardCount,
    success,
    cardsPerSecond: success ? cardCount / (duration / 1000) : 0
  })
}

export const measureSearchPerformance = (
  searchTerm: string,
  resultCount: number,
  duration: number,
  filters?: Record<string, any>
) => {
  performanceMonitor.recordMetric('search-performance', duration, {
    searchTermLength: searchTerm.length,
    resultCount,
    hasFilters: !!filters,
    filterCount: filters ? Object.keys(filters).length : 0,
    resultsPerSecond: resultCount / (duration / 1000)
  })
}

export const measureImageLoadPerformance = (
  imageUrl: string,
  loadTime: number,
  fromCache: boolean,
  imageSize?: number
) => {
  performanceMonitor.recordMetric('image-load-performance', loadTime, {
    imageType: imageUrl.includes('scryfall') ? 'card' : 'other',
    fromCache,
    imageSize,
    loadSpeed: imageSize ? imageSize / (loadTime / 1000) : 0
  })
}