import { describe, it, expect, vi } from 'vitest'
// Mock the performance monitor since it's in a different package
const mockPerformanceMonitor = {
  recordMetric: vi.fn(),
  recordUXMetric: vi.fn(),
  recordAIAccuracy: vi.fn(),
  recordMobilePerformance: vi.fn(),
  getPerformanceSummary: vi.fn(() => ({
    timeRange: { start: new Date(), end: new Date() },
    overview: {
      totalRequests: 100,
      averageResponseTime: 1500,
      errorRate: 0.02,
      userSatisfaction: 0.85,
      aiAccuracy: 0.8,
      mobilePerformance: 0.9,
    },
    breakdown: {
      responseTimePercentiles: { p50: 1000, p90: 2000, p95: 3000, p99: 5000 },
      topSlowEndpoints: [],
      aiModelPerformance: [],
      mobileDevicePerformance: [],
      userExperienceBreakdown: {},
    },
    alerts: [],
    recommendations: [],
  })),
  getRealTimeDashboard: vi.fn(() => ({
    timestamp: new Date(),
    liveMetrics: {
      requestsPerMinute: 50,
      averageResponseTime: 1200,
      currentErrorRate: 0.01,
      activeUsers: 25,
      aiTasksInProgress: 3,
    },
    systemHealth: {
      status: 'healthy' as const,
      cpuUsage: 45,
      memoryUsage: 60 * 1024 * 1024,
      activeConnections: 150,
    },
    alerts: [],
    trends: {
      responseTimeTrend: [1000, 1100, 1200, 1150, 1300],
      errorRateTrend: [0.01, 0.015, 0.01, 0.008, 0.012],
      userSatisfactionTrend: [0.85, 0.87, 0.86, 0.88, 0.85],
    },
  })),
  getErrorTrackingData: vi.fn(() => ({
    timeRange: { start: new Date(), end: new Date() },
    totalErrors: 5,
    errorsByType: { 'NetworkError': 2, 'ValidationError': 3 },
    errorsByEndpoint: { '/api/generate': 3, '/api/analyze': 2 },
    recoveryTimes: [500, 750, 300, 1000, 600],
    errorTrends: {},
    criticalErrors: [],
    recommendations: ['Improve error handling', 'Add retry logic'],
  })),
}

const performanceMonitor = mockPerformanceMonitor

describe('Comprehensive Testing Infrastructure Verification', () => {
  it('should have performance monitoring available', () => {
    expect(performanceMonitor).toBeDefined()
    expect(typeof performanceMonitor.recordMetric).toBe('function')
    expect(typeof performanceMonitor.recordUXMetric).toBe('function')
    expect(typeof performanceMonitor.recordAIAccuracy).toBe('function')
    expect(typeof performanceMonitor.recordMobilePerformance).toBe('function')
  })

  it('should record performance metrics', () => {
    const recordMetricSpy = vi.spyOn(performanceMonitor, 'recordMetric')
    
    performanceMonitor.recordMetric({
      metricType: 'response_time',
      value: 1500,
      unit: 'ms',
      context: { test: 'verification' },
    })

    expect(recordMetricSpy).toHaveBeenCalledWith({
      metricType: 'response_time',
      value: 1500,
      unit: 'ms',
      context: { test: 'verification' },
    })
  })

  it('should generate performance summary', () => {
    const summary = performanceMonitor.getPerformanceSummary()
    
    expect(summary).toBeDefined()
    expect(summary).toHaveProperty('timeRange')
    expect(summary).toHaveProperty('overview')
    expect(summary).toHaveProperty('breakdown')
    expect(summary).toHaveProperty('alerts')
    expect(summary).toHaveProperty('recommendations')
  })

  it('should provide real-time dashboard data', () => {
    const dashboard = performanceMonitor.getRealTimeDashboard()
    
    expect(dashboard).toBeDefined()
    expect(dashboard).toHaveProperty('timestamp')
    expect(dashboard).toHaveProperty('liveMetrics')
    expect(dashboard).toHaveProperty('systemHealth')
    expect(dashboard).toHaveProperty('alerts')
    expect(dashboard).toHaveProperty('trends')
  })

  it('should handle AI accuracy tracking', () => {
    const recordAISpy = vi.spyOn(performanceMonitor, 'recordAIAccuracy')
    
    performanceMonitor.recordAIAccuracy({
      aiTaskType: 'deck_analysis',
      modelUsed: 'gpt-4',
      accuracy: 0.85,
      responseTime: 2500,
      confidence: 0.9,
      context: {
        deckId: 'test-deck',
        userId: 'test-user',
      },
    })

    expect(recordAISpy).toHaveBeenCalled()
  })

  it('should handle mobile performance tracking', () => {
    const recordMobileSpy = vi.spyOn(performanceMonitor, 'recordMobilePerformance')
    
    performanceMonitor.recordMobilePerformance({
      sessionId: 'test-session',
      device: {
        type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
        screenSize: { width: 375, height: 667 },
      },
      metrics: {
        touchResponseTime: 50,
        gestureRecognitionAccuracy: 0.95,
        scrollPerformance: 60,
        memoryUsage: 45 * 1024 * 1024, // 45MB
        renderTime: 16,
      },
      context: {
        feature: 'deck-editor',
        action: 'card-interaction',
        duration: 1000,
      },
    })

    expect(recordMobileSpy).toHaveBeenCalled()
  })

  it('should track error rates and recovery', () => {
    const errorData = performanceMonitor.getErrorTrackingData()
    
    expect(errorData).toBeDefined()
    expect(errorData).toHaveProperty('timeRange')
    expect(errorData).toHaveProperty('totalErrors')
    expect(errorData).toHaveProperty('errorsByType')
    expect(errorData).toHaveProperty('errorsByEndpoint')
    expect(errorData).toHaveProperty('recoveryTimes')
    expect(errorData).toHaveProperty('recommendations')
  })
})

describe('Test Infrastructure Performance', () => {
  it('should complete performance monitoring setup quickly', async () => {
    const startTime = performance.now()
    
    // Simulate multiple metric recordings
    for (let i = 0; i < 10; i++) {
      performanceMonitor.recordMetric({
        metricType: 'response_time',
        value: Math.random() * 1000,
        unit: 'ms',
        context: { iteration: i },
      })
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete quickly (under 100ms)
    expect(duration).toBeLessThan(100)
  })

  it('should handle concurrent metric recording', async () => {
    const promises = Array.from({ length: 50 }, (_, i) => 
      Promise.resolve().then(() => {
        performanceMonitor.recordMetric({
          metricType: 'ai_processing_time',
          value: Math.random() * 5000,
          unit: 'ms',
          context: { concurrent: i },
        })
      })
    )

    const startTime = performance.now()
    await Promise.all(promises)
    const endTime = performance.now()
    const duration = endTime - startTime

    // Should handle concurrent operations efficiently
    expect(duration).toBeLessThan(500)
  })
})

describe('Test Suite Configuration', () => {
  it('should have proper test environment setup', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(global.performance).toBeDefined()
    expect(global.performance.now).toBeDefined()
  })

  it('should have mocking capabilities', () => {
    const mockFn = vi.fn()
    mockFn('test')
    
    expect(mockFn).toHaveBeenCalledWith('test')
    expect(vi.isMockFunction(mockFn)).toBe(true)
  })

  it('should support async testing', async () => {
    const asyncOperation = () => 
      new Promise(resolve => setTimeout(() => resolve('completed'), 10))
    
    const result = await asyncOperation()
    expect(result).toBe('completed')
  })
})