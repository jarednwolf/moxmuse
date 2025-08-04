import { z } from 'zod'
import { PromptTemplate } from './prompt-registry'

// Versioning types
export const PromptVersionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.string(),
  parentVersion: z.string().optional(),
  changes: z.array(z.object({
    type: z.enum(['content', 'variables', 'system_prompt', 'metadata']),
    description: z.string(),
    diff: z.string().optional(),
  })),
  author: z.string(),
  createdAt: z.date(),
  status: z.enum(['draft', 'testing', 'active', 'deprecated']),
  testResults: z.array(z.any()).optional(),
})

export type PromptVersion = z.infer<typeof PromptVersionSchema>

// A/B Testing types
export const ABTestConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  taskType: z.string(),
  variants: z.array(z.object({
    id: z.string(),
    templateId: z.string(),
    version: z.string(),
    trafficAllocation: z.number().min(0).max(1),
    name: z.string(),
  })),
  metrics: z.array(z.enum([
    'success_rate',
    'response_time',
    'user_satisfaction',
    'cost_per_request',
    'accuracy',
    'relevance',
  ])),
  startDate: z.date(),
  endDate: z.date().optional(),
  minSampleSize: z.number().default(100),
  confidenceLevel: z.number().min(0).max(1).default(0.95),
  status: z.enum(['draft', 'running', 'completed', 'paused']),
  results: z.any().optional(),
})

export type ABTestConfig = z.infer<typeof ABTestConfigSchema>

// Performance tracking types
export const PromptPerformanceDataSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  timestamp: z.date(),
  metrics: z.object({
    successRate: z.number().min(0).max(1),
    averageResponseTime: z.number(),
    userSatisfactionScore: z.number().min(0).max(5),
    costPerRequest: z.number(),
    accuracyScore: z.number().min(0).max(1).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
  }),
  context: z.object({
    taskType: z.string(),
    userSegment: z.string().optional(),
    modelUsed: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
})

export type PromptPerformanceData = z.infer<typeof PromptPerformanceDataSchema>

/**
 * PromptVersioning manages prompt template versions and A/B testing
 * Provides version control, performance tracking, and automated optimization
 */
export class PromptVersioning {
  private versions: Map<string, PromptVersion[]> = new Map()
  private abTests: Map<string, ABTestConfig> = new Map()
  private performanceData: Map<string, PromptPerformanceData[]> = new Map()
  private versioningRules: Map<string, VersioningRule> = new Map()

  constructor() {
    this.initializeVersioningRules()
  }

  /**
   * Create a new version of a prompt template
   */
  createVersion(
    templateId: string,
    changes: Array<{
      type: 'content' | 'variables' | 'system_prompt' | 'metadata'
      description: string
      diff?: string
    }>,
    author: string,
    parentVersion?: string
  ): PromptVersion {
    const versions = this.versions.get(templateId) || []
    const latestVersion = this.getLatestVersion(templateId)
    
    // Generate new version number
    const newVersionNumber = this.generateVersionNumber(
      parentVersion || latestVersion?.version || '0.0.0'
    )

    const newVersion: PromptVersion = {
      id: `${templateId}-${newVersionNumber}`,
      templateId,
      version: newVersionNumber,
      parentVersion: parentVersion || latestVersion?.version,
      changes,
      author,
      createdAt: new Date(),
      status: 'draft',
    }

    versions.push(newVersion)
    this.versions.set(templateId, versions)

    console.log(`📝 Created version ${newVersionNumber} for template ${templateId}`)
    console.log(`Changes: ${changes.map(c => c.description).join(', ')}`)

    return newVersion
  }

  /**
   * Start an A/B test between prompt versions
   */
  startABTest(config: Omit<ABTestConfig, 'id' | 'status' | 'results'>): ABTestConfig {
    const testId = this.generateTestId(config.name)
    
    const abTest: ABTestConfig = {
      ...config,
      id: testId,
      status: 'running',
      results: null,
    }

    // Validate traffic allocation sums to 1
    const totalAllocation = abTest.variants.reduce((sum, v) => sum + v.trafficAllocation, 0)
    if (Math.abs(totalAllocation - 1) > 0.001) {
      throw new Error('Traffic allocation must sum to 1.0')
    }

    // Mark test versions as testing
    for (const variant of abTest.variants) {
      this.updateVersionStatus(variant.templateId, variant.version, 'testing')
    }

    this.abTests.set(testId, abTest)

    console.log(`🧪 Started A/B test: ${config.name}`)
    console.log(`Variants: ${abTest.variants.map(v => `${v.name} (${v.trafficAllocation * 100}%)`).join(', ')}`)

    return abTest
  }

  /**
   * Select a variant for A/B testing based on traffic allocation
   */
  selectVariantForTest(testId: string, userId?: string): ABTestVariant | null {
    const test = this.abTests.get(testId)
    if (!test || test.status !== 'running') {
      return null
    }

    // Use deterministic selection based on user ID if provided
    let random: number
    if (userId) {
      random = this.hashUserId(userId) % 1000 / 1000
    } else {
      random = Math.random()
    }

    // Select variant based on traffic allocation
    let cumulativeAllocation = 0
    for (const variant of test.variants) {
      cumulativeAllocation += variant.trafficAllocation
      if (random <= cumulativeAllocation) {
        return {
          testId,
          variantId: variant.id,
          templateId: variant.templateId,
          version: variant.version,
          name: variant.name,
        }
      }
    }

    // Fallback to first variant
    const firstVariant = test.variants[0]
    return {
      testId,
      variantId: firstVariant.id,
      templateId: firstVariant.templateId,
      version: firstVariant.version,
      name: firstVariant.name,
    }
  }

  /**
   * Record performance data for a prompt version
   */
  recordPerformance(data: PromptPerformanceData): void {
    const key = `${data.templateId}:${data.version}`
    const existing = this.performanceData.get(key) || []
    existing.push(data)
    this.performanceData.set(key, existing)

    // Update A/B test results if this version is part of a test
    this.updateABTestResults(data)

    console.log(`📊 Recorded performance for ${data.templateId} v${data.version}:`, {
      successRate: data.metrics.successRate,
      responseTime: data.metrics.averageResponseTime,
      satisfaction: data.metrics.userSatisfactionScore,
    })
  }

  /**
   * Analyze A/B test results and determine winner
   */
  analyzeABTest(testId: string): ABTestResults | null {
    const test = this.abTests.get(testId)
    if (!test) {
      return null
    }

    const results: ABTestResults = {
      testId,
      testName: test.name,
      status: test.status,
      variants: [],
      winner: null,
      confidence: 0,
      significantDifference: false,
      recommendations: [],
    }

    // Collect performance data for each variant
    for (const variant of test.variants) {
      const performanceKey = `${variant.templateId}:${variant.version}`
      const performanceData = this.performanceData.get(performanceKey) || []
      
      if (performanceData.length === 0) {
        continue
      }

      const variantResults = this.calculateVariantMetrics(performanceData, test.metrics)
      results.variants.push({
        variantId: variant.id,
        name: variant.name,
        sampleSize: performanceData.length,
        metrics: variantResults,
        trafficAllocation: variant.trafficAllocation,
      })
    }

    // Determine winner if we have enough data
    if (results.variants.length >= 2 && results.variants.every(v => v.sampleSize >= test.minSampleSize)) {
      const winner = this.determineWinner(results.variants, test.metrics, test.confidenceLevel)
      results.winner = winner.winner
      results.confidence = winner.confidence
      results.significantDifference = winner.significant
      results.recommendations = winner.recommendations
    }

    return results
  }

  /**
   * Complete an A/B test and promote the winner
   */
  completeABTest(testId: string): ABTestCompletion {
    const test = this.abTests.get(testId)
    if (!test) {
      throw new Error(`A/B test ${testId} not found`)
    }

    const results = this.analyzeABTest(testId)
    if (!results) {
      throw new Error(`Unable to analyze A/B test ${testId}`)
    }

    // Update test status
    test.status = 'completed'
    test.endDate = new Date()
    test.results = results

    // Promote winner and deprecate losers
    if (results.winner && results.significantDifference) {
      const winnerVariant = test.variants.find(v => v.id === results.winner)
      if (winnerVariant) {
        this.updateVersionStatus(winnerVariant.templateId, winnerVariant.version, 'active')
        
        // Deprecate losing variants
        for (const variant of test.variants) {
          if (variant.id !== results.winner) {
            this.updateVersionStatus(variant.templateId, variant.version, 'deprecated')
          }
        }
      }
    } else {
      // No clear winner, keep all variants as testing
      console.log(`⚠️ A/B test ${testId} completed without a clear winner`)
    }

    console.log(`🏁 Completed A/B test: ${test.name}`)
    if (results.winner) {
      const winnerVariant = test.variants.find(v => v.id === results.winner)
      console.log(`Winner: ${winnerVariant?.name} (confidence: ${(results.confidence * 100).toFixed(1)}%)`)
    }

    return {
      testId,
      results,
      winnerPromoted: !!results.winner && results.significantDifference,
      recommendations: results.recommendations,
    }
  }

  /**
   * Get performance history for a template version
   */
  getPerformanceHistory(templateId: string, version: string): PromptPerformanceData[] {
    const key = `${templateId}:${version}`
    return this.performanceData.get(key) || []
  }

  /**
   * Get all versions for a template
   */
  getVersions(templateId: string): PromptVersion[] {
    return this.versions.get(templateId) || []
  }

  /**
   * Get the latest version of a template
   */
  getLatestVersion(templateId: string): PromptVersion | null {
    const versions = this.versions.get(templateId) || []
    if (versions.length === 0) return null

    return versions
      .filter(v => v.status === 'active')
      .sort((a, b) => this.compareVersions(b.version, a.version))[0] || versions[versions.length - 1]
  }

  /**
   * Get active A/B tests
   */
  getActiveABTests(): ABTestConfig[] {
    return Array.from(this.abTests.values()).filter(test => test.status === 'running')
  }

  /**
   * Suggest version improvements based on performance data
   */
  suggestImprovements(templateId: string): VersionImprovement[] {
    const versions = this.getVersions(templateId)
    const suggestions: VersionImprovement[] = []

    for (const version of versions) {
      const performance = this.getPerformanceHistory(templateId, version.version)
      if (performance.length < 10) continue // Need enough data

      const avgMetrics = this.calculateAverageMetrics(performance)
      
      // Suggest improvements based on performance
      if (avgMetrics.successRate < 0.8) {
        suggestions.push({
          type: 'success_rate',
          description: 'Success rate is below 80%. Consider simplifying the prompt or adding more examples.',
          priority: 'high',
          templateId,
          version: version.version,
        })
      }

      if (avgMetrics.userSatisfactionScore < 3.5) {
        suggestions.push({
          type: 'user_satisfaction',
          description: 'User satisfaction is low. Consider improving response quality or relevance.',
          priority: 'high',
          templateId,
          version: version.version,
        })
      }

      if (avgMetrics.averageResponseTime > 10000) {
        suggestions.push({
          type: 'response_time',
          description: 'Response time is slow. Consider using a faster model or optimizing the prompt.',
          priority: 'medium',
          templateId,
          version: version.version,
        })
      }
    }

    return suggestions
  }

  /**
   * Generate a new version number
   */
  private generateVersionNumber(parentVersion: string): string {
    const [major, minor, patch] = parentVersion.split('.').map(Number)
    
    // For now, increment patch version
    // In a more sophisticated system, this would consider the type of changes
    return `${major}.${minor}.${patch + 1}`
  }

  /**
   * Generate a unique test ID
   */
  private generateTestId(name: string): string {
    const timestamp = Date.now()
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    return `${sanitizedName}-${timestamp}`
  }

  /**
   * Hash user ID for deterministic variant selection
   */
  private hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Update version status
   */
  private updateVersionStatus(templateId: string, version: string, status: PromptVersion['status']): void {
    const versions = this.versions.get(templateId) || []
    const versionObj = versions.find(v => v.version === version)
    
    if (versionObj) {
      versionObj.status = status
      console.log(`📝 Updated ${templateId} v${version} status to ${status}`)
    }
  }

  /**
   * Update A/B test results with new performance data
   */
  private updateABTestResults(data: PromptPerformanceData): void {
    // Find active tests that include this template version
    for (const test of Array.from(this.abTests.values())) {
      if (test.status !== 'running') continue
      
      const variant = test.variants.find(v => 
        v.templateId === data.templateId && v.version === data.version
      )
      
      if (variant) {
        // Check if test should be completed
        const allVariantsHaveEnoughData = test.variants.every(v => {
          const perfKey = `${v.templateId}:${v.version}`
          const perfData = this.performanceData.get(perfKey) || []
          return perfData.length >= test.minSampleSize
        })

        if (allVariantsHaveEnoughData) {
          console.log(`🧪 A/B test ${test.id} has enough data for analysis`)
        }
      }
    }
  }

  /**
   * Calculate variant metrics
   */
  private calculateVariantMetrics(
    performanceData: PromptPerformanceData[],
    metrics: string[]
  ): Record<string, number> {
    const results: Record<string, number> = {}

    for (const metric of metrics) {
      switch (metric) {
        case 'success_rate':
          results.success_rate = performanceData.reduce((sum, d) => sum + d.metrics.successRate, 0) / performanceData.length
          break
        case 'response_time':
          results.response_time = performanceData.reduce((sum, d) => sum + d.metrics.averageResponseTime, 0) / performanceData.length
          break
        case 'user_satisfaction':
          results.user_satisfaction = performanceData.reduce((sum, d) => sum + d.metrics.userSatisfactionScore, 0) / performanceData.length
          break
        case 'cost_per_request':
          results.cost_per_request = performanceData.reduce((sum, d) => sum + d.metrics.costPerRequest, 0) / performanceData.length
          break
        case 'accuracy':
          results.accuracy = performanceData.reduce((sum, d) => sum + (d.metrics.accuracyScore || 0), 0) / performanceData.length
          break
        case 'relevance':
          results.relevance = performanceData.reduce((sum, d) => sum + (d.metrics.relevanceScore || 0), 0) / performanceData.length
          break
      }
    }

    return results
  }

  /**
   * Determine the winner of an A/B test
   */
  private determineWinner(
    variants: ABTestVariantResults[],
    metrics: string[],
    confidenceLevel: number
  ): WinnerAnalysis {
    // Simple winner determination based on primary metric (first in list)
    const primaryMetric = metrics[0]
    
    if (!primaryMetric || variants.length < 2) {
      return {
        winner: null,
        confidence: 0,
        significant: false,
        recommendations: ['Insufficient data for winner determination'],
      }
    }

    // Sort variants by primary metric (higher is better for most metrics)
    const sortedVariants = variants.sort((a, b) => {
      const aValue = a.metrics[primaryMetric] || 0
      const bValue = b.metrics[primaryMetric] || 0
      
      // For response_time and cost_per_request, lower is better
      if (primaryMetric === 'response_time' || primaryMetric === 'cost_per_request') {
        return aValue - bValue
      }
      return bValue - aValue
    })

    const winner = sortedVariants[0]
    const runnerUp = sortedVariants[1]

    // Calculate improvement percentage
    const winnerValue = winner.metrics[primaryMetric] || 0
    const runnerUpValue = runnerUp.metrics[primaryMetric] || 0
    
    let improvement = 0
    if (runnerUpValue !== 0) {
      improvement = Math.abs(winnerValue - runnerUpValue) / runnerUpValue
    }

    // Simple significance test (in production, use proper statistical tests)
    const significant = improvement > 0.05 && winner.sampleSize >= 100 && runnerUp.sampleSize >= 100

    const recommendations: string[] = []
    if (significant) {
      recommendations.push(`Promote ${winner.name} as it shows ${(improvement * 100).toFixed(1)}% improvement in ${primaryMetric}`)
    } else {
      recommendations.push('Continue testing - no statistically significant difference found')
    }

    return {
      winner: winner.variantId,
      confidence: significant ? confidenceLevel : 0.5,
      significant,
      recommendations,
    }
  }

  /**
   * Calculate average metrics from performance data
   */
  private calculateAverageMetrics(performanceData: PromptPerformanceData[]): {
    successRate: number
    averageResponseTime: number
    userSatisfactionScore: number
    costPerRequest: number
  } {
    const count = performanceData.length
    
    return {
      successRate: performanceData.reduce((sum, d) => sum + d.metrics.successRate, 0) / count,
      averageResponseTime: performanceData.reduce((sum, d) => sum + d.metrics.averageResponseTime, 0) / count,
      userSatisfactionScore: performanceData.reduce((sum, d) => sum + d.metrics.userSatisfactionScore, 0) / count,
      costPerRequest: performanceData.reduce((sum, d) => sum + d.metrics.costPerRequest, 0) / count,
    }
  }

  /**
   * Compare version numbers
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0
      const bPart = bParts[i] || 0
      
      if (aPart !== bPart) {
        return aPart - bPart
      }
    }
    
    return 0
  }

  /**
   * Initialize versioning rules
   */
  private initializeVersioningRules(): void {
    // Rules for automatic version management
    this.versioningRules.set('auto-deprecate', {
      condition: 'performance_below_threshold',
      threshold: 0.6,
      action: 'deprecate',
    })

    this.versioningRules.set('auto-promote', {
      condition: 'significant_improvement',
      threshold: 0.1,
      action: 'promote',
    })

    console.log('✅ Initialized versioning rules')
  }
}

// Supporting interfaces
interface ABTestVariant {
  testId: string
  variantId: string
  templateId: string
  version: string
  name: string
}

interface ABTestResults {
  testId: string
  testName: string
  status: string
  variants: ABTestVariantResults[]
  winner: string | null
  confidence: number
  significantDifference: boolean
  recommendations: string[]
}

interface ABTestVariantResults {
  variantId: string
  name: string
  sampleSize: number
  metrics: Record<string, number>
  trafficAllocation: number
}

interface ABTestCompletion {
  testId: string
  results: ABTestResults
  winnerPromoted: boolean
  recommendations: string[]
}

interface WinnerAnalysis {
  winner: string | null
  confidence: number
  significant: boolean
  recommendations: string[]
}

interface VersionImprovement {
  type: string
  description: string
  priority: 'low' | 'medium' | 'high'
  templateId: string
  version: string
}

interface VersioningRule {
  condition: string
  threshold: number
  action: string
}

// Export singleton instance
export const promptVersioning = new PromptVersioning()