/**
 * Comprehensive Performance Testing and Benchmarking Suite
 * Provides automated performance testing, benchmarking, and reporting
 */

export interface PerformanceBenchmark {
  name: string
  description: string
  category: 'api' | 'ui' | 'memory' | 'network' | 'database'
  iterations: number
  results: BenchmarkResult[]
  summary: BenchmarkSummary
}

export interface BenchmarkResult {
  iteration: number
  duration: number
  success: boolean
  memoryUsage?: number
  networkTime?: number
  error?: string
  metadata?: Record<string, any>
}

export interface BenchmarkSummary {
  totalIterations: number
  successRate: number
  avgDuration: number
  minDuration: number
  maxDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  standardDeviation: number
}

export interface PerformanceTestSuite {
  name: string
  description: string
  benchmarks: PerformanceBenchmark[]
  startTime: Date
  endTime?: Date
  totalDuration?: number
  overallScore: number
}

/**
 * Performance Testing Framework
 */
export class PerformanceTester {
  private benchmarks: Map<string, PerformanceBenchmark> = new Map()
  private testSuites: PerformanceTestSuite[] = []

  /**
   * Create a new benchmark
   */
  createBenchmark(
    name: string,
    testFunction: () => Promise<any> | any,
    options: {
      description?: string
      category?: 'api' | 'ui' | 'memory' | 'network' | 'database'
      iterations?: number
      warmupIterations?: number
    } = {}
  ): PerformanceBenchmark {
    const {
      description = '',
      category = 'ui',
      iterations = 100,
      warmupIterations = 10
    } = options

    const benchmark: PerformanceBenchmark = {
      name,
      description,
      category,
      iterations,
      results: [],
      summary: {
        totalIterations: 0,
        successRate: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        standardDeviation: 0
      }
    }

    this.benchmarks.set(name, benchmark)
    return benchmark
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark(name: string, testFunction: () => Promise<any> | any): Promise<PerformanceBenchmark> {
    const benchmark = this.benchmarks.get(name)
    if (!benchmark) {
      throw new Error(`Benchmark '${name}' not found`)
    }

    console.log(`🏃 Running benchmark: ${name}`)
    benchmark.results = []

    // Warmup runs
    console.log(`🔥 Warming up (10 iterations)...`)
    for (let i = 0; i < 10; i++) {
      try {
        await testFunction()
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Actual benchmark runs
    for (let i = 0; i < benchmark.iterations; i++) {
      const result = await this.runSingleIteration(testFunction, i)
      benchmark.results.push(result)

      if (i % 10 === 0) {
        console.log(`📊 Progress: ${i}/${benchmark.iterations} iterations`)
      }
    }

    benchmark.summary = this.calculateSummary(benchmark.results)
    console.log(`✅ Benchmark '${name}' completed`)
    
    return benchmark
  }

  /**
   * Run a complete test suite
   */
  async runTestSuite(
    name: string,
    tests: Array<{
      name: string
      testFunction: () => Promise<any> | any
      options?: any
    }>
  ): Promise<PerformanceTestSuite> {
    const suite: PerformanceTestSuite = {
      name,
      description: `Performance test suite: ${name}`,
      benchmarks: [],
      startTime: new Date(),
      overallScore: 0
    }

    console.log(`🚀 Starting test suite: ${name}`)

    for (const test of tests) {
      const benchmark = this.createBenchmark(test.name, test.testFunction, test.options)
      const result = await this.runBenchmark(test.name, test.testFunction)
      suite.benchmarks.push(result)
    }

    suite.endTime = new Date()
    suite.totalDuration = suite.endTime.getTime() - suite.startTime.getTime()
    suite.overallScore = this.calculateOverallScore(suite.benchmarks)

    this.testSuites.push(suite)
    console.log(`🏁 Test suite '${name}' completed with score: ${suite.overallScore}`)

    return suite
  }

  private async runSingleIteration(
    testFunction: () => Promise<any> | any,
    iteration: number
  ): Promise<BenchmarkResult> {
    const startTime = performance.now()
    const startMemory = this.getMemoryUsage()

    try {
      await testFunction()
      const endTime = performance.now()
      const endMemory = this.getMemoryUsage()

      return {
        iteration,
        duration: endTime - startTime,
        success: true,
        memoryUsage: endMemory - startMemory
      }
    } catch (error) {
      const endTime = performance.now()

      return {
        iteration,
        duration: endTime - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private calculateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const successfulResults = results.filter(r => r.success)
    const durations = successfulResults.map(r => r.duration).sort((a, b) => a - b)

    if (durations.length === 0) {
      return {
        totalIterations: results.length,
        successRate: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        standardDeviation: 0
      }
    }

    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length
    const stdDev = Math.sqrt(variance)

    return {
      totalIterations: results.length,
      successRate: (successfulResults.length / results.length) * 100,
      avgDuration: avg,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      p50Duration: durations[Math.floor(durations.length * 0.5)] || 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
      standardDeviation: stdDev
    }
  }

  private calculateOverallScore(benchmarks: PerformanceBenchmark[]): number {
    if (benchmarks.length === 0) return 0

    const scores = benchmarks.map(benchmark => {
      const { successRate, avgDuration } = benchmark.summary
      
      // Score based on success rate and performance
      const successScore = successRate
      const performanceScore = Math.max(0, 100 - (avgDuration / 10)) // Penalize slow operations
      
      return (successScore + performanceScore) / 2
    })

    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  /**
   * Generate performance report
   */
  generateReport(suite: PerformanceTestSuite): string {
    let report = `# Performance Test Report: ${suite.name}\n\n`
    report += `**Overall Score:** ${suite.overallScore.toFixed(2)}/100\n`
    report += `**Duration:** ${suite.totalDuration}ms\n`
    report += `**Benchmarks:** ${suite.benchmarks.length}\n\n`

    suite.benchmarks.forEach(benchmark => {
      report += `## ${benchmark.name}\n`
      report += `**Category:** ${benchmark.category}\n`
      report += `**Success Rate:** ${benchmark.summary.successRate.toFixed(2)}%\n`
      report += `**Average Duration:** ${benchmark.summary.avgDuration.toFixed(2)}ms\n`
      report += `**P95 Duration:** ${benchmark.summary.p95Duration.toFixed(2)}ms\n`
      report += `**Standard Deviation:** ${benchmark.summary.standardDeviation.toFixed(2)}ms\n\n`
    })

    return report
  }

  /**
   * Export results as JSON
   */
  exportResults(suite: PerformanceTestSuite): string {
    return JSON.stringify(suite, null, 2)
  }

  /**
   * Get all test suites
   */
  getTestSuites(): PerformanceTestSuite[] {
    return [...this.testSuites]
  }
}

/**
 * Pre-built performance tests for common scenarios
 */
export class StandardPerformanceTests {
  private tester = new PerformanceTester()

  /**
   * Test API response times
   */
  async testAPIPerformance(endpoints: string[]): Promise<PerformanceTestSuite> {
    const tests = endpoints.map(endpoint => ({
      name: `API: ${endpoint}`,
      testFunction: async () => {
        const response = await fetch(endpoint)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      },
      options: { category: 'api' as const, iterations: 50 }
    }))

    return this.tester.runTestSuite('API Performance', tests)
  }

  /**
   * Test component render performance
   */
  async testComponentPerformance(components: Array<{ name: string; render: () => void }>): Promise<PerformanceTestSuite> {
    const tests = components.map(({ name, render }) => ({
      name: `Component: ${name}`,
      testFunction: render,
      options: { category: 'ui' as const, iterations: 100 }
    }))

    return this.tester.runTestSuite('Component Performance', tests)
  }

  /**
   * Test memory usage patterns
   */
  async testMemoryPerformance(operations: Array<{ name: string; operation: () => void }>): Promise<PerformanceTestSuite> {
    const tests = operations.map(({ name, operation }) => ({
      name: `Memory: ${name}`,
      testFunction: operation,
      options: { category: 'memory' as const, iterations: 50 }
    }))

    return this.tester.runTestSuite('Memory Performance', tests)
  }

  /**
   * Test network optimization
   */
  async testNetworkPerformance(requests: Array<{ name: string; url: string }>): Promise<PerformanceTestSuite> {
    const tests = requests.map(({ name, url }) => ({
      name: `Network: ${name}`,
      testFunction: async () => {
        const start = performance.now()
        await fetch(url)
        return performance.now() - start
      },
      options: { category: 'network' as const, iterations: 30 }
    }))

    return this.tester.runTestSuite('Network Performance', tests)
  }
}

/**
 * Performance monitoring and alerting
 */
export class PerformanceMonitor {
  private thresholds = {
    apiResponseTime: 1000, // 1 second
    componentRenderTime: 16, // 16ms (60fps)
    memoryUsage: 80, // 80% of heap
    networkLatency: 500 // 500ms
  }

  checkPerformanceThresholds(suite: PerformanceTestSuite): Array<{
    type: 'warning' | 'error'
    message: string
    benchmark: string
    value: number
    threshold: number
  }> {
    const alerts: Array<{
      type: 'warning' | 'error'
      message: string
      benchmark: string
      value: number
      threshold: number
    }> = []

    suite.benchmarks.forEach(benchmark => {
      const { avgDuration, successRate } = benchmark.summary

      // Check success rate
      if (successRate < 95) {
        alerts.push({
          type: successRate < 90 ? 'error' : 'warning',
          message: `Low success rate: ${successRate.toFixed(2)}%`,
          benchmark: benchmark.name,
          value: successRate,
          threshold: 95
        })
      }

      // Check performance thresholds by category
      let threshold = 0
      switch (benchmark.category) {
        case 'api':
          threshold = this.thresholds.apiResponseTime
          break
        case 'ui':
          threshold = this.thresholds.componentRenderTime
          break
        case 'network':
          threshold = this.thresholds.networkLatency
          break
        default:
          threshold = 1000
      }

      if (avgDuration > threshold) {
        alerts.push({
          type: avgDuration > threshold * 2 ? 'error' : 'warning',
          message: `Slow performance: ${avgDuration.toFixed(2)}ms`,
          benchmark: benchmark.name,
          value: avgDuration,
          threshold
        })
      }
    })

    return alerts
  }
}

// Global instances
export const performanceTester = new PerformanceTester()
export const standardTests = new StandardPerformanceTests()
export const performanceMonitor = new PerformanceMonitor()

// Utility functions
export const PerformanceTestUtils = {
  // Quick API test
  quickAPITest: async (url: string) => {
    const start = performance.now()
    try {
      const response = await fetch(url)
      const end = performance.now()
      return {
        success: response.ok,
        duration: end - start,
        status: response.status
      }
    } catch (error) {
      return {
        success: false,
        duration: performance.now() - start,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  },

  // Quick render test
  quickRenderTest: (renderFunction: () => void) => {
    const start = performance.now()
    try {
      renderFunction()
      return {
        success: true,
        duration: performance.now() - start
      }
    } catch (error) {
      return {
        success: false,
        duration: performance.now() - start,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  },

  // Format duration
  formatDuration: (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }
}