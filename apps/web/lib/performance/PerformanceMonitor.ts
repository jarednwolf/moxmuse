'use client'

import React from 'react'

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  url?: string
  userAgent?: string
}

interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  value: number
  delta: number
  id: string
  navigationType?: string
  rating?: 'good' | 'needs-improvement' | 'poor'
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []
  private isInitialized = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    if (this.isInitialized) return
    
    this.isInitialized = true
    this.setupPerformanceObservers()
    this.setupWebVitals()
    this.setupResourceTiming()
    this.setupNavigationTiming()
  }

  private setupPerformanceObservers() {
    // Long Task Observer
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long-task', entry.duration)
            
            // Log long tasks for debugging
            if (entry.duration > 50) {
              console.warn(`Long task detected: ${entry.duration}ms`)
            }
          }
        })
        
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.push(longTaskObserver)
      } catch (e) {
        console.warn('Long task observer not supported')
      }

      // Layout Shift Observer
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              this.recordMetric('layout-shift', (entry as any).value)
            }
          }
        })
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(layoutShiftObserver)
      } catch (e) {
        console.warn('Layout shift observer not supported')
      }

      // First Input Delay Observer
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('first-input-delay', (entry as any).processingStart - entry.startTime)
          }
        })
        
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)
      } catch (e) {
        console.warn('First input delay observer not supported')
      }
    }
  }

  private setupWebVitals() {
    // Import web-vitals dynamically to avoid SSR issues
    import('web-vitals').then((webVitals) => {
      // Handle different versions of web-vitals
      const { onCLS, onFID, onFCP, onLCP, onTTFB } = webVitals as any
      
      if (onCLS) onCLS(this.onWebVital.bind(this))
      if (onFID) onFID(this.onWebVital.bind(this))
      if (onFCP) onFCP(this.onWebVital.bind(this))
      if (onLCP) onLCP(this.onWebVital.bind(this))
      if (onTTFB) onTTFB(this.onWebVital.bind(this))
    }).catch(() => {
      console.warn('Web vitals not available')
    })
  }

  private onWebVital(metric: WebVitalsMetric) {
    this.recordMetric(`web-vital-${metric.name.toLowerCase()}`, metric.value)
    
    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        event_category: 'Web Vitals',
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_label: metric.id,
        non_interaction: true,
      })
    }
  }

  private setupResourceTiming() {
    if ('PerformanceObserver' in window) {
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resource = entry as PerformanceResourceTiming
            
            // Track slow resources
            if (resource.duration > 1000) {
              this.recordMetric('slow-resource', resource.duration, {
                url: resource.name,
                type: this.getResourceType(resource.name),
              })
            }

            // Track failed resources
            if (resource.transferSize === 0 && resource.decodedBodySize === 0) {
              this.recordMetric('failed-resource', 1, {
                url: resource.name,
                type: this.getResourceType(resource.name),
              })
            }
          }
        })
        
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.push(resourceObserver)
      } catch (e) {
        console.warn('Resource timing observer not supported')
      }
    }
  }

  private setupNavigationTiming() {
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const nav = entry as PerformanceNavigationTiming
            
            // Record key navigation metrics
            this.recordMetric('dns-lookup', nav.domainLookupEnd - nav.domainLookupStart)
            this.recordMetric('tcp-connect', nav.connectEnd - nav.connectStart)
            this.recordMetric('request-response', nav.responseEnd - nav.requestStart)
            this.recordMetric('dom-processing', nav.domComplete - nav.domContentLoadedEventStart)
            this.recordMetric('page-load', nav.loadEventEnd - nav.fetchStart)
          }
        })
        
        navigationObserver.observe({ entryTypes: ['navigation'] })
        this.observers.push(navigationObserver)
      } catch (e) {
        console.warn('Navigation timing observer not supported')
      }
    }
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script'
    if (url.includes('.css')) return 'stylesheet'
    if (url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) return 'image'
    if (url.includes('.woff') || url.includes('.ttf')) return 'font'
    return 'other'
  }

  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (typeof window === 'undefined') return // Skip on server-side

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...metadata,
    }

    this.metrics.push(metric)

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Send to monitoring service
    this.sendToMonitoring(metric)
  }

  private async sendToMonitoring(metric: PerformanceMetric) {
    try {
      // Send to your monitoring endpoint
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/performance/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metric),
        })
      }
    } catch (error) {
      console.warn('Failed to send performance metric:', error)
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name)
  }

  getAverageMetric(name: string): number {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return 0
    
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length
  }

  clearMetrics() {
    this.metrics = []
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.isInitialized = false
  }

  // Measure custom operations
  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now()

    try {
      return await operation()
    } finally {
      const duration = performance.now() - start
      this.recordMetric(name, duration)
    }
  }

  measureSync<T>(name: string, operation: () => T): T {
    const start = performance.now()
    
    try {
      return operation()
    } finally {
      const duration = performance.now() - start
      this.recordMetric(name, duration)
    }
  }

  // Mark and measure
  mark(name: string) {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name)
    }
  }

  measure(name: string, startMark: string, endMark?: string) {
    if ('performance' in window && 'measure' in performance) {
      try {
        performance.measure(name, startMark, endMark)
        const measure = performance.getEntriesByName(name, 'measure')[0]
        if (measure) {
          this.recordMetric(name, measure.duration)
        }
      } catch (error) {
        console.warn('Failed to measure performance:', error)
      }
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const recordMetric = (name: string, value: number, metadata?: Record<string, any>) => {
    performanceMonitor.recordMetric(name, value, metadata)
  }

  const measureAsync = <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    return performanceMonitor.measureAsync(name, operation)
  }

  const measureSync = <T>(name: string, operation: () => T): T => {
    return performanceMonitor.measureSync(name, operation)
  }

  return {
    recordMetric,
    measureAsync,
    measureSync,
    getMetrics: () => performanceMonitor.getMetrics(),
    getAverageMetric: (name: string) => performanceMonitor.getAverageMetric(name),
  }
}

// Performance HOC for components
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceMonitoredComponent(props: P) {
    React.useEffect(() => {
      performanceMonitor.mark(`${componentName}-mount-start`)
      
      return () => {
        performanceMonitor.mark(`${componentName}-mount-end`)
        performanceMonitor.measure(
          `${componentName}-mount-duration`,
          `${componentName}-mount-start`,
          `${componentName}-mount-end`
        )
      }
    }, [])

    return React.createElement(Component, props)
  }
}