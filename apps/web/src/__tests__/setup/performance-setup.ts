import { vi, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest'
import { performanceMonitor } from '../../../../../packages/api/src/services/performance/performance-monitor'

// Performance testing utilities
declare global {
  interface Window {
    __PERFORMANCE_OBSERVER__: PerformanceObserver | null
    __PERFORMANCE_ENTRIES__: PerformanceEntry[]
  }
}

// Mock performance APIs for testing
const mockPerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
}))

const mockPerformanceEntry: PerformanceEntry = {
  name: 'test-metric',
  entryType: 'measure',
  startTime: 0,
  duration: 100,
  toJSON: () => ({}),
}

// Setup performance monitoring for tests
beforeAll(() => {
  // Mock Performance Observer API
  global.PerformanceObserver = mockPerformanceObserver as any
  
  // Mock performance.mark and performance.measure
  global.performance.mark = vi.fn()
  global.performance.measure = vi.fn()
  global.performance.getEntriesByName = vi.fn(() => [mockPerformanceEntry] as PerformanceEntryList)
  global.performance.getEntriesByType = vi.fn(() => [mockPerformanceEntry] as PerformanceEntryList)
  global.performance.clearMarks = vi.fn()
  global.performance.clearMeasures = vi.fn()

  // Mock memory API
  Object.defineProperty(global.performance, 'memory', {
    value: {
      usedJSHeapSize: 1024 * 1024 * 50, // 50MB
      totalJSHeapSize: 1024 * 1024 * 100, // 100MB
      jsHeapSizeLimit: 1024 * 1024 * 1024, // 1GB
    },
    writable: true,
  })

  // Initialize performance monitoring
  window.__PERFORMANCE_ENTRIES__ = []
  
  console.log('📊 Performance testing setup initialized')
})

beforeEach(() => {
  // Clear performance entries before each test
  window.__PERFORMANCE_ENTRIES__ = []
  
  // Reset performance mocks
  vi.clearAllMocks()
  
  // Start performance measurement for test
  performance.mark('test-start')
})

afterEach(() => {
  // End performance measurement for test
  performance.mark('test-end')
  performance.measure('test-duration', 'test-start', 'test-end')
  
  // Record test performance metrics
  const testName = expect.getState().currentTestName || 'unknown-test'
  const duration = 100 + Math.random() * 500 // Mock duration
  
  performanceMonitor.recordMetric({
    metricType: 'response_time',
    value: duration,
    unit: 'ms',
    context: {
      testName,
      testType: 'unit',
    },
  })
})

afterAll(() => {
  // Cleanup performance monitoring
  if (window.__PERFORMANCE_OBSERVER__) {
    window.__PERFORMANCE_OBSERVER__.disconnect()
  }
  
  console.log('📊 Performance testing cleanup completed')
})

// Performance testing utilities
export const performanceUtils = {
  /**
   * Measure execution time of a function
   */
  measureExecutionTime: async <T>(
    fn: () => Promise<T> | T,
    label: string = 'execution'
  ): Promise<{ result: T; duration: number }> => {
    const startTime = performance.now()
    const result = await fn()
    const endTime = performance.now()
    const duration = endTime - startTime
    
    performanceMonitor.recordMetric({
      metricType: 'response_time',
      value: duration,
      unit: 'ms',
      context: { label },
    })
    
    return { result, duration }
  },

  /**
   * Assert that execution time is within acceptable limits
   */
  expectExecutionTime: (duration: number, maxDuration: number, label?: string) => {
    if (duration > maxDuration) {
      throw new Error(
        `Performance assertion failed: ${label || 'Operation'} took ${duration.toFixed(2)}ms, expected < ${maxDuration}ms`
      )
    }
  },

  /**
   * Mock slow network conditions
   */
  mockSlowNetwork: (delay: number = 3000) => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockImplementation(async (...args: Parameters<typeof fetch>) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      return originalFetch(...args)
    })
    
    return () => {
      global.fetch = originalFetch
    }
  },

  /**
   * Mock memory pressure
   */
  mockMemoryPressure: (usedMemory: number = 1024 * 1024 * 500) => {
    Object.defineProperty(global.performance, 'memory', {
      value: {
        usedJSHeapSize: usedMemory,
        totalJSHeapSize: usedMemory * 1.2,
        jsHeapSizeLimit: 1024 * 1024 * 1024,
      },
      writable: true,
    })
  },

  /**
   * Simulate CPU throttling
   */
  simulateCPUThrottling: (factor: number = 2) => {
    const originalSetTimeout = global.setTimeout
    global.setTimeout = vi.fn().mockImplementation((callback: TimerHandler, delay?: number) => {
      return originalSetTimeout(callback, (delay || 0) * factor)
    }) as any
    
    return () => {
      global.setTimeout = originalSetTimeout
    }
  },

  /**
   * Monitor render performance
   */
  monitorRenderPerformance: () => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach(entry => {
        if (entry.entryType === 'paint') {
          performanceMonitor.recordUXMetric({
            userId: 'test-user',
            sessionId: 'test-session',
            metricType: entry.name === 'first-contentful-paint' 
              ? 'first_contentful_paint' 
              : 'largest_contentful_paint',
            value: entry.startTime,
          })
        }
      })
    })
    
    observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] })
    
    return () => observer.disconnect()
  },

  /**
   * Create performance benchmark
   */
  createBenchmark: (name: string, iterations: number = 100) => {
    return {
      run: async (fn: () => Promise<void> | void) => {
        const durations: number[] = []
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now()
          await fn()
          const endTime = performance.now()
          durations.push(endTime - startTime)
        }
        
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
        const minDuration = Math.min(...durations)
        const maxDuration = Math.max(...durations)
        const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
        
        performanceMonitor.recordMetric({
          metricType: 'response_time',
          value: avgDuration,
          unit: 'ms',
          context: {
            benchmark: name,
            iterations,
            min: minDuration,
            max: maxDuration,
            p95: p95Duration,
          },
        })
        
        return {
          average: avgDuration,
          min: minDuration,
          max: maxDuration,
          p95: p95Duration,
          all: durations,
        }
      },
    }
  },
}

// Export performance testing matchers
export const performanceMatchers = {
  toBeWithinPerformanceBudget: (received: number, budget: number) => {
    const pass = received <= budget
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received}ms to exceed performance budget of ${budget}ms`
          : `Expected ${received}ms to be within performance budget of ${budget}ms`,
    }
  },
  
  toHaveGoodMemoryUsage: (received: number, maxMemory: number = 100 * 1024 * 1024) => {
    const pass = received <= maxMemory
    return {
      pass,
      message: () =>
        pass
          ? `Expected memory usage ${received} bytes to exceed ${maxMemory} bytes`
          : `Expected memory usage ${received} bytes to be within ${maxMemory} bytes`,
    }
  },
}

// Extend expect with performance matchers
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWithinPerformanceBudget(budget: number): any
      toHaveGoodMemoryUsage(maxMemory?: number): any
    }
  }
}

console.log('📊 Performance testing utilities loaded')
console.log('Available utilities:')
console.log('  ⏱️  measureExecutionTime() - Measure function execution time')
console.log('  🎯 expectExecutionTime() - Assert execution time limits')
console.log('  🐌 mockSlowNetwork() - Simulate slow network conditions')
console.log('  💾 mockMemoryPressure() - Simulate memory pressure')
console.log('  🔥 simulateCPUThrottling() - Simulate CPU throttling')
console.log('  🎨 monitorRenderPerformance() - Monitor render metrics')
console.log('  📊 createBenchmark() - Create performance benchmarks')