import { performanceMonitor, measureSearchPerformance, measureVirtualizationPerformance } from '../monitor'

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear()
  })

  it('should record metrics', () => {
    performanceMonitor.recordMetric('test-metric', 100)
    
    const metrics = performanceMonitor.getMetrics('test-metric')
    expect(metrics).toHaveLength(1)
    expect(metrics[0].name).toBe('test-metric')
    expect(metrics[0].value).toBe(100)
  })

  it('should calculate average metrics', () => {
    performanceMonitor.recordMetric('test-metric', 100)
    performanceMonitor.recordMetric('test-metric', 200)
    performanceMonitor.recordMetric('test-metric', 300)
    
    const average = performanceMonitor.getAverageMetric('test-metric')
    expect(average).toBe(200)
  })

  it('should measure function execution time', () => {
    const result = performanceMonitor.measureFunction('test-function', () => {
      // Simulate some work
      let sum = 0
      for (let i = 0; i < 1000; i++) {
        sum += i
      }
      return sum
    })

    expect(result).toBe(499500) // Sum of 0 to 999
    
    const metrics = performanceMonitor.getMetrics('function-test-function')
    expect(metrics).toHaveLength(1)
    expect(metrics[0].value).toBeGreaterThan(0)
  })

  it('should measure async function execution time', async () => {
    const result = await performanceMonitor.measureAsyncFunction('test-async', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return 'done'
    })

    expect(result).toBe('done')
    
    const metrics = performanceMonitor.getMetrics('async-function-test-async')
    expect(metrics).toHaveLength(1)
    expect(metrics[0].value).toBeGreaterThanOrEqual(10)
  })

  it('should generate performance summary', () => {
    performanceMonitor.recordMetric('metric1', 100)
    performanceMonitor.recordMetric('metric1', 200)
    performanceMonitor.recordMetric('metric2', 50)
    
    const summary = performanceMonitor.getSummary()
    
    expect(summary.metric1).toBeDefined()
    expect(summary.metric1.count).toBe(2)
    expect(summary.metric1.avg).toBe(150)
    expect(summary.metric1.min).toBe(100)
    expect(summary.metric1.max).toBe(200)
    
    expect(summary.metric2).toBeDefined()
    expect(summary.metric2.count).toBe(1)
    expect(summary.metric2.avg).toBe(50)
  })

  it('should limit metrics to prevent memory leaks', () => {
    // Add more than 100 metrics
    for (let i = 0; i < 150; i++) {
      performanceMonitor.recordMetric('test-metric', i)
    }
    
    const allMetrics = performanceMonitor.getMetrics()
    expect(allMetrics.length).toBeLessThanOrEqual(100)
  })
})

describe('Performance utility functions', () => {
  beforeEach(() => {
    performanceMonitor.clear()
  })

  it('should measure search performance', () => {
    measureSearchPerformance('test query', 25, 150)
    
    const metrics = performanceMonitor.getMetrics('search-performance')
    expect(metrics).toHaveLength(1)
    expect(metrics[0].value).toBe(150)
    expect(metrics[0].metadata?.resultCount).toBe(25)
    expect(metrics[0].metadata?.searchLength).toBe(10)
  })

  it('should measure virtualization performance', () => {
    measureVirtualizationPerformance(1000, 50, 16.7)
    
    const metrics = performanceMonitor.getMetrics('virtualization-performance')
    expect(metrics).toHaveLength(1)
    expect(metrics[0].value).toBe(16.7)
    expect(metrics[0].metadata?.itemCount).toBe(1000)
    expect(metrics[0].metadata?.visibleCount).toBe(50)
    expect(metrics[0].metadata?.efficiency).toBe(0.05)
  })
})