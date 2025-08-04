import { z } from 'zod'
import { modelRouter, type AIModel, type AITaskType, type TaskComplexity } from './model-router'

// Enhanced multi-model system types
export const TaskComplexityClassifierSchema = z.object({
  prompt: z.string(),
  context: z.record(z.any()),
  constraints: z.record(z.any()).optional(),
  expectedOutputType: z.enum(['json', 'text', 'structured']).optional(),
})

export type TaskComplexityClassifierInput = z.infer<typeof TaskComplexityClassifierSchema>

export const ModelPerformanceMetricsSchema = z.object({
  model: z.string(),
  taskType: z.string(),
  successRate: z.number().min(0).max(1),
  averageResponseTime: z.number(),
  averageCost: z.number(),
  userSatisfactionScore: z.number().min(0).max(10),
  totalRequests: z.number(),
  lastUpdated: z.date(),
})

export type ModelPerformanceMetrics = z.infer<typeof ModelPerformanceMetricsSchema>

export const CostOptimizationConfigSchema = z.object({
  maxDailyCost: z.number().optional(),
  maxCostPerRequest: z.number().optional(),
  prioritizeSpeed: z.boolean().optional().default(false),
  prioritizeCost: z.boolean().optional().default(true),
  allowFallback: z.boolean().optional().default(true),
  budgetAlerts: z.boolean().optional().default(true),
})

export type CostOptimizationConfig = z.infer<typeof CostOptimizationConfigSchema>

export const FallbackConfigSchema = z.object({
  maxRetries: z.number().min(1).max(5).optional().default(3),
  retryDelay: z.number().min(100).max(10000).optional().default(1000), // milliseconds
  escalateOnFailure: z.boolean().optional().default(true),
  fallbackChain: z.array(z.string()).optional().default([]),
  circuitBreakerThreshold: z.number().min(0).max(1).optional().default(0.5), // failure rate threshold
})

export type FallbackConfig = z.infer<typeof FallbackConfigSchema>

/**
 * TaskComplexityClassifier automatically determines required AI model
 */
export class TaskComplexityClassifier {
  private complexityRules: Map<string, ComplexityRule> = new Map()
  private learningData: Map<string, ClassificationHistory> = new Map()

  constructor() {
    this.initializeComplexityRules()
  }

  /**
   * Classify task complexity based on input characteristics
   */
  classifyTaskComplexity(input: TaskComplexityClassifierInput): {
    taskType: AITaskType
    complexity: TaskComplexity
    recommendedModel: AIModel
    confidence: number
    reasoning: string
  } {
    const validatedInput = TaskComplexityClassifierSchema.parse(input)
    console.log(`🎯 Classifying task complexity for prompt: "${validatedInput.prompt.substring(0, 100)}..."`)

    // Analyze prompt characteristics
    const promptAnalysis = this.analyzePrompt(validatedInput.prompt)
    
    // Analyze context requirements
    const contextAnalysis = this.analyzeContext(validatedInput.context)
    
    // Determine task type
    const taskType = this.determineTaskType(promptAnalysis, contextAnalysis)
    
    // Calculate complexity
    const complexity = this.calculateComplexity(promptAnalysis, contextAnalysis, taskType)
    
    // Get model recommendation
    const modelSelection = modelRouter.selectModel(taskType, complexity, {
      estimatedTokens: promptAnalysis.estimatedTokens,
      prioritizeCost: validatedInput.constraints?.prioritizeCost,
      prioritizeSpeed: validatedInput.constraints?.prioritizeSpeed,
    })

    // Calculate confidence
    const confidence = this.calculateClassificationConfidence(promptAnalysis, contextAnalysis)

    // Generate reasoning
    const reasoning = this.generateClassificationReasoning(
      taskType,
      complexity,
      promptAnalysis,
      contextAnalysis
    )

    // Record classification for learning
    this.recordClassification(validatedInput, {
      taskType,
      complexity,
      recommendedModel: modelSelection.model,
      confidence,
    })

    console.log(`✅ Classified as ${taskType} (${complexity}) -> ${modelSelection.model}`)

    return {
      taskType,
      complexity,
      recommendedModel: modelSelection.model,
      confidence,
      reasoning,
    }
  }

  /**
   * Learn from classification feedback
   */
  updateClassificationAccuracy(
    originalInput: TaskComplexityClassifierInput,
    actualPerformance: {
      success: boolean
      actualComplexity?: TaskComplexity
      userFeedback?: number // 1-10 rating
    }
  ): void {
    const key = this.generateClassificationKey(originalInput)
    const history = this.learningData.get(key) || {
      classifications: [],
      successRate: 0,
      totalAttempts: 0,
    }

    history.totalAttempts += 1
    if (actualPerformance.success) {
      history.successRate = ((history.successRate * (history.totalAttempts - 1)) + 1) / history.totalAttempts
    } else {
      history.successRate = (history.successRate * (history.totalAttempts - 1)) / history.totalAttempts
    }

    history.classifications.push({
      timestamp: new Date(),
      success: actualPerformance.success,
      actualComplexity: actualPerformance.actualComplexity,
      userFeedback: actualPerformance.userFeedback,
    })

    this.learningData.set(key, history)

    // Update complexity rules based on learning
    this.updateComplexityRules(originalInput, actualPerformance)
  }

  private analyzePrompt(prompt: string): PromptAnalysis {
    const words = prompt.split(/\s+/)
    const sentences = prompt.split(/[.!?]+/)
    
    // Complexity indicators
    const complexityKeywords = [
      'analyze', 'compare', 'synthesize', 'research', 'optimize', 'strategy',
      'synergy', 'meta', 'tournament', 'competitive', 'advanced'
    ]
    
    const simpleKeywords = [
      'recommend', 'suggest', 'find', 'list', 'show', 'basic', 'simple'
    ]

    const researchKeywords = [
      'research', 'investigate', 'study', 'analyze trends', 'meta analysis',
      'tournament data', 'community discussion', 'price trends'
    ]

    const complexityScore = complexityKeywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword)
    ).length

    const simplicityScore = simpleKeywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword)
    ).length

    const researchScore = researchKeywords.filter(keyword => 
      prompt.toLowerCase().includes(keyword)
    ).length

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      complexityScore,
      simplicityScore,
      researchScore,
      estimatedTokens: Math.ceil(words.length * 1.3), // Rough token estimation
      requiresReasoning: complexityScore > 0,
      requiresResearch: researchScore > 0,
      isSimpleQuery: simplicityScore > complexityScore && words.length < 50,
    }
  }

  private analyzeContext(context: Record<string, any>): ContextAnalysis {
    return {
      hasMultipleDataSources: Array.isArray(context.dataSources) && context.dataSources.length > 1,
      requiresLargeContext: context.contextLength > 4000,
      hasComplexConstraints: Object.keys(context.constraints || {}).length > 3,
      requiresCreativity: context.creative === true,
      hasUserHistory: context.userHistory !== undefined,
      isRealTimeRequest: context.realTime === true,
    }
  }

  private determineTaskType(
    promptAnalysis: PromptAnalysis,
    contextAnalysis: ContextAnalysis
  ): AITaskType {
    // Task type determination logic
    if (promptAnalysis.requiresResearch || contextAnalysis.hasMultipleDataSources) {
      if (promptAnalysis.prompt?.includes('meta')) return 'meta-analysis'
      return 'web-research'
    }

    if (promptAnalysis.prompt?.includes('commander')) return 'commander-selection'
    if (promptAnalysis.prompt?.includes('synergy')) return 'synergy-analysis'
    if (promptAnalysis.prompt?.includes('optimize') || promptAnalysis.prompt?.includes('improve')) return 'deck-optimization'
    if (promptAnalysis.prompt?.includes('recommend') || promptAnalysis.prompt?.includes('suggest')) return 'card-recommendation'
    if (promptAnalysis.prompt?.includes('strategy')) return 'strategy-analysis'
    if (promptAnalysis.prompt?.includes('generate') || promptAnalysis.prompt?.includes('build')) return 'deck-generation'

    return 'card-recommendation' // Default
  }

  private calculateComplexity(
    promptAnalysis: PromptAnalysis,
    contextAnalysis: ContextAnalysis,
    taskType: AITaskType
  ): TaskComplexity {
    let complexityScore = 0

    // Base complexity from task type
    const taskComplexityMap: Record<AITaskType, number> = {
      'commander-selection': 1,
      'card-recommendation': 2,
      'strategy-analysis': 3,
      'synergy-analysis': 4,
      'deck-optimization': 4,
      'deck-generation': 4,
      'performance-analysis': 3,
      'web-research': 5,
      'data-synthesis': 5,
      'meta-analysis': 5,
    }

    complexityScore += taskComplexityMap[taskType] || 2

    // Adjust based on prompt analysis
    complexityScore += promptAnalysis.complexityScore
    complexityScore -= promptAnalysis.simplicityScore
    complexityScore += promptAnalysis.researchScore * 2

    if (promptAnalysis.wordCount > 200) complexityScore += 1
    if (promptAnalysis.requiresReasoning) complexityScore += 1
    if (promptAnalysis.requiresResearch) complexityScore += 2

    // Adjust based on context analysis
    if (contextAnalysis.hasMultipleDataSources) complexityScore += 2
    if (contextAnalysis.requiresLargeContext) complexityScore += 1
    if (contextAnalysis.hasComplexConstraints) complexityScore += 1
    if (contextAnalysis.isRealTimeRequest) complexityScore += 1

    // Map score to complexity level
    if (complexityScore <= 2) return 'low'
    if (complexityScore <= 4) return 'moderate'
    if (complexityScore <= 6) return 'high'
    return 'research'
  }

  private calculateClassificationConfidence(
    promptAnalysis: PromptAnalysis,
    contextAnalysis: ContextAnalysis
  ): number {
    let confidence = 0.5 // Base confidence

    // Boost confidence for clear indicators
    if (promptAnalysis.complexityScore > 2 || promptAnalysis.simplicityScore > 2) {
      confidence += 0.2
    }

    if (promptAnalysis.researchScore > 0) {
      confidence += 0.1
    }

    // Reduce confidence for ambiguous cases
    if (promptAnalysis.complexityScore === promptAnalysis.simplicityScore) {
      confidence -= 0.1
    }

    if (promptAnalysis.wordCount < 10) {
      confidence -= 0.2
    }

    return Math.max(0.1, Math.min(0.95, confidence))
  }

  private generateClassificationReasoning(
    taskType: AITaskType,
    complexity: TaskComplexity,
    promptAnalysis: PromptAnalysis,
    contextAnalysis: ContextAnalysis
  ): string {
    const reasons = []

    reasons.push(`Identified as ${taskType} based on prompt content`)
    reasons.push(`Complexity level: ${complexity}`)

    if (promptAnalysis.requiresResearch) {
      reasons.push('Requires research capabilities')
    }

    if (promptAnalysis.requiresReasoning) {
      reasons.push('Requires complex reasoning')
    }

    if (contextAnalysis.hasMultipleDataSources) {
      reasons.push('Multiple data sources detected')
    }

    if (promptAnalysis.isSimpleQuery) {
      reasons.push('Simple query format detected')
    }

    return reasons.join('. ')
  }

  private recordClassification(
    input: TaskComplexityClassifierInput,
    result: any
  ): void {
    // Record for learning purposes
    const key = this.generateClassificationKey(input)
    // Implementation would store this for machine learning
  }

  private generateClassificationKey(input: TaskComplexityClassifierInput): string {
    // Generate a key for classification tracking
    return `${input.prompt.substring(0, 50)}_${Object.keys(input.context).join('_')}`
  }

  private initializeComplexityRules(): void {
    // Initialize rules for complexity classification
    this.complexityRules.set('research_task', {
      keywords: ['research', 'analyze', 'investigate'],
      complexity: 'research',
      confidence: 0.9,
    })

    this.complexityRules.set('simple_recommendation', {
      keywords: ['recommend', 'suggest', 'find'],
      complexity: 'low',
      confidence: 0.8,
    })

    console.log('✅ Initialized complexity classification rules')
  }

  private updateComplexityRules(
    input: TaskComplexityClassifierInput,
    performance: any
  ): void {
    // Update rules based on performance feedback
    // This would implement machine learning to improve classification
  }
}

/**
 * CostOptimization balances AI model usage with performance requirements
 */
export class CostOptimization {
  private dailyCosts: Map<string, DailyCostTracking> = new Map()
  private costAlerts: CostAlert[] = []
  private optimizationConfig: CostOptimizationConfig

  constructor(config: Partial<CostOptimizationConfig> = {}) {
    this.optimizationConfig = CostOptimizationConfigSchema.parse(config)
  }

  /**
   * Optimize model selection based on cost constraints
   */
  optimizeModelSelection(
    taskType: AITaskType,
    complexity: TaskComplexity,
    estimatedTokens: number,
    userBudget?: number
  ): {
    recommendedModel: AIModel
    alternativeModels: AIModel[]
    costEstimate: number
    savingsOpportunity?: number
    reasoning: string
  } {
    console.log(`💰 Optimizing model selection for ${taskType} (${complexity})`)

    // Check daily budget
    const today = new Date().toISOString().split('T')[0]
    const dailyCost = this.dailyCosts.get(today)
    
    if (this.optimizationConfig.maxDailyCost && dailyCost) {
      if (dailyCost.totalCost >= this.optimizationConfig.maxDailyCost) {
        return this.getBudgetExceededResponse(taskType, complexity)
      }
    }

    // Get model options
    const availableModels = modelRouter.getAvailableModels(taskType)
    const modelOptions = availableModels.map(model => {
      const selection = modelRouter.selectModel(taskType, complexity, {
        estimatedTokens,
        prioritizeCost: this.optimizationConfig.prioritizeCost,
        prioritizeSpeed: this.optimizationConfig.prioritizeSpeed,
      })
      
      return {
        model,
        cost: selection.estimatedCost,
        responseTime: selection.estimatedResponseTime,
        confidence: selection.confidence,
      }
    })

    // Sort by cost-effectiveness
    const sortedOptions = modelOptions.sort((a, b) => {
      if (this.optimizationConfig.prioritizeCost) {
        return a.cost - b.cost
      } else if (this.optimizationConfig.prioritizeSpeed) {
        return a.responseTime - b.responseTime
      } else {
        // Balance cost and performance
        const aScore = (a.confidence * 100) - (a.cost * 10) - (a.responseTime / 100)
        const bScore = (b.confidence * 100) - (b.cost * 10) - (b.responseTime / 100)
        return bScore - aScore
      }
    })

    const recommended = sortedOptions[0]
    const alternatives = sortedOptions.slice(1, 4)

    // Calculate savings opportunity
    const mostExpensive = modelOptions.reduce((max, option) => 
      option.cost > max.cost ? option : max
    )
    const savingsOpportunity = mostExpensive.cost - recommended.cost

    // Generate reasoning
    const reasoning = this.generateOptimizationReasoning(
      recommended,
      alternatives,
      savingsOpportunity
    )

    // Track cost
    this.trackCost(today, recommended.cost, taskType)

    return {
      recommendedModel: recommended.model,
      alternativeModels: alternatives.map(alt => alt.model),
      costEstimate: recommended.cost,
      savingsOpportunity: savingsOpportunity > 0 ? savingsOpportunity : undefined,
      reasoning,
    }
  }

  /**
   * Track daily costs and generate alerts
   */
  trackCost(date: string, cost: number, taskType: AITaskType): void {
    const existing = this.dailyCosts.get(date) || {
      date,
      totalCost: 0,
      requestCount: 0,
      taskBreakdown: {},
    }

    existing.totalCost += cost
    existing.requestCount += 1
    existing.taskBreakdown[taskType] = (existing.taskBreakdown[taskType] || 0) + cost

    this.dailyCosts.set(date, existing)

    // Check for budget alerts
    if (this.optimizationConfig.budgetAlerts) {
      this.checkBudgetAlerts(existing)
    }
  }

  /**
   * Get cost analytics
   */
  getCostAnalytics(days: number = 30): {
    totalCost: number
    averageDailyCost: number
    costTrend: 'increasing' | 'stable' | 'decreasing'
    topTaskTypes: Array<{ taskType: string; cost: number; percentage: number }>
    recommendations: string[]
  } {
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))
    
    const relevantDays = Array.from(this.dailyCosts.values()).filter(day => {
      const dayDate = new Date(day.date)
      return dayDate >= startDate && dayDate <= endDate
    })

    const totalCost = relevantDays.reduce((sum, day) => sum + day.totalCost, 0)
    const averageDailyCost = totalCost / Math.max(relevantDays.length, 1)

    // Calculate trend
    const recentDays = relevantDays.slice(-7)
    const olderDays = relevantDays.slice(-14, -7)
    const recentAvg = recentDays.reduce((sum, day) => sum + day.totalCost, 0) / Math.max(recentDays.length, 1)
    const olderAvg = olderDays.reduce((sum, day) => sum + day.totalCost, 0) / Math.max(olderDays.length, 1)
    
    let costTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (recentAvg > olderAvg * 1.1) costTrend = 'increasing'
    else if (recentAvg < olderAvg * 0.9) costTrend = 'decreasing'

    // Top task types
    const taskCosts: Record<string, number> = {}
    relevantDays.forEach(day => {
      Object.entries(day.taskBreakdown).forEach(([taskType, cost]) => {
        taskCosts[taskType] = (taskCosts[taskType] || 0) + cost
      })
    })

    const topTaskTypes = Object.entries(taskCosts)
      .map(([taskType, cost]) => ({
        taskType,
        cost,
        percentage: (cost / totalCost) * 100,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)

    // Generate recommendations
    const recommendations = this.generateCostRecommendations(
      totalCost,
      averageDailyCost,
      costTrend,
      topTaskTypes
    )

    return {
      totalCost,
      averageDailyCost,
      costTrend,
      topTaskTypes,
      recommendations,
    }
  }

  private getBudgetExceededResponse(taskType: AITaskType, complexity: TaskComplexity): any {
    return {
      recommendedModel: 'gpt-4o-mini' as AIModel, // Cheapest option
      alternativeModels: [],
      costEstimate: 0.001,
      reasoning: 'Daily budget exceeded, using most cost-effective model',
    }
  }

  private generateOptimizationReasoning(
    recommended: any,
    alternatives: any[],
    savingsOpportunity: number
  ): string {
    let reasoning = `Selected ${recommended.model} for optimal cost-performance balance`
    
    if (savingsOpportunity > 0.01) {
      reasoning += `. Saves $${savingsOpportunity.toFixed(3)} compared to premium options`
    }

    if (this.optimizationConfig.prioritizeCost) {
      reasoning += '. Prioritizing cost efficiency'
    } else if (this.optimizationConfig.prioritizeSpeed) {
      reasoning += '. Prioritizing response speed'
    }

    return reasoning
  }

  private checkBudgetAlerts(dailyCost: DailyCostTracking): void {
    if (!this.optimizationConfig.maxDailyCost) return

    const usagePercentage = dailyCost.totalCost / this.optimizationConfig.maxDailyCost

    if (usagePercentage >= 0.8 && usagePercentage < 0.9) {
      this.costAlerts.push({
        type: 'warning',
        message: `Daily budget 80% used ($${dailyCost.totalCost.toFixed(2)} of $${this.optimizationConfig.maxDailyCost})`,
        timestamp: new Date(),
      })
    } else if (usagePercentage >= 0.9) {
      this.costAlerts.push({
        type: 'critical',
        message: `Daily budget 90% used ($${dailyCost.totalCost.toFixed(2)} of $${this.optimizationConfig.maxDailyCost})`,
        timestamp: new Date(),
      })
    }
  }

  private generateCostRecommendations(
    totalCost: number,
    averageDailyCost: number,
    costTrend: string,
    topTaskTypes: any[]
  ): string[] {
    const recommendations = []

    if (costTrend === 'increasing') {
      recommendations.push('Consider enabling cost prioritization to reduce expenses')
    }

    if (averageDailyCost > 10) {
      recommendations.push('High daily costs detected - review model selection strategy')
    }

    const expensiveTask = topTaskTypes[0]
    if (expensiveTask && expensiveTask.percentage > 50) {
      recommendations.push(`${expensiveTask.taskType} accounts for ${expensiveTask.percentage.toFixed(1)}% of costs - consider optimization`)
    }

    if (recommendations.length === 0) {
      recommendations.push('Cost optimization is performing well')
    }

    return recommendations
  }
}

/**
 * FallbackSystem gracefully handles AI model failures or rate limits
 */
export class FallbackSystem {
  private circuitBreakers: Map<AIModel, CircuitBreaker> = new Map()
  private fallbackConfig: FallbackConfig

  constructor(config: Partial<FallbackConfig> = {}) {
    this.fallbackConfig = FallbackConfigSchema.parse(config)
    this.initializeCircuitBreakers()
  }

  /**
   * Execute request with fallback handling
   */
  async executeWithFallback<T>(
    primaryModel: AIModel,
    taskType: AITaskType,
    executeFunction: (model: AIModel) => Promise<T>,
    fallbackChain?: AIModel[]
  ): Promise<{
    result: T
    modelUsed: AIModel
    attemptsCount: number
    fallbacksUsed: AIModel[]
  }> {
    const chain = fallbackChain || this.fallbackConfig.fallbackChain.map(m => m as AIModel)
    const modelsToTry = [primaryModel, ...chain]
    const fallbacksUsed: AIModel[] = []
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.fallbackConfig.maxRetries; attempt++) {
      for (const model of modelsToTry) {
        // Check circuit breaker
        const circuitBreaker = this.circuitBreakers.get(model)
        if (circuitBreaker && circuitBreaker.isOpen) {
          console.log(`⚡ Circuit breaker open for ${model}, skipping`)
          continue
        }

        try {
          console.log(`🔄 Attempting ${model} (attempt ${attempt + 1})`)
          const result = await executeFunction(model)
          
          // Record success
          this.recordSuccess(model)
          
          return {
            result,
            modelUsed: model,
            attemptsCount: attempt + 1,
            fallbacksUsed: model !== primaryModel ? [model] : [],
          }
        } catch (error) {
          console.error(`❌ ${model} failed:`, error)
          lastError = error as Error
          
          // Record failure
          this.recordFailure(model)
          
          if (model !== primaryModel) {
            fallbacksUsed.push(model)
          }

          // Wait before retry
          if (attempt < this.fallbackConfig.maxRetries - 1) {
            await this.delay(this.fallbackConfig.retryDelay * (attempt + 1))
          }
        }
      }
    }

    // All models failed
    throw new Error(`All models failed after ${this.fallbackConfig.maxRetries} attempts. Last error: ${lastError?.message}`)
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    overallHealth: 'healthy' | 'degraded' | 'critical'
    modelStatus: Array<{
      model: AIModel
      status: 'healthy' | 'degraded' | 'circuit_open'
      successRate: number
      lastFailure?: Date
    }>
    recommendations: string[]
  } {
    const modelStatuses = Array.from(this.circuitBreakers.entries()).map(([model, breaker]) => ({
      model,
      status: breaker.isOpen ? 'circuit_open' as const : 
              breaker.successRate < 0.8 ? 'degraded' as const : 'healthy' as const,
      successRate: breaker.successRate,
      lastFailure: breaker.lastFailure,
    }))

    const healthyModels = modelStatuses.filter(s => s.status === 'healthy').length
    const totalModels = modelStatuses.length

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (healthyModels < totalModels * 0.5) {
      overallHealth = 'critical'
    } else if (healthyModels < totalModels * 0.8) {
      overallHealth = 'degraded'
    }

    const recommendations = this.generateHealthRecommendations(modelStatuses, overallHealth)

    return {
      overallHealth,
      modelStatus: modelStatuses,
      recommendations,
    }
  }

  private initializeCircuitBreakers(): void {
    const models: AIModel[] = [
      'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
      'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'perplexity-sonar'
    ]

    models.forEach(model => {
      this.circuitBreakers.set(model, {
        model,
        isOpen: false,
        failureCount: 0,
        successCount: 0,
        successRate: 1.0,
        lastFailure: undefined,
        lastSuccess: undefined,
        openedAt: undefined,
      })
    })

    console.log('✅ Initialized circuit breakers for all models')
  }

  private recordSuccess(model: AIModel): void {
    const breaker = this.circuitBreakers.get(model)
    if (!breaker) return

    breaker.successCount += 1
    breaker.lastSuccess = new Date()
    breaker.successRate = breaker.successCount / (breaker.successCount + breaker.failureCount)

    // Close circuit breaker if it was open and success rate improves
    if (breaker.isOpen && breaker.successRate > this.fallbackConfig.circuitBreakerThreshold) {
      breaker.isOpen = false
      breaker.openedAt = undefined
      console.log(`✅ Circuit breaker closed for ${model}`)
    }
  }

  private recordFailure(model: AIModel): void {
    const breaker = this.circuitBreakers.get(model)
    if (!breaker) return

    breaker.failureCount += 1
    breaker.lastFailure = new Date()
    breaker.successRate = breaker.successCount / (breaker.successCount + breaker.failureCount)

    // Open circuit breaker if failure rate exceeds threshold
    if (!breaker.isOpen && breaker.successRate < this.fallbackConfig.circuitBreakerThreshold) {
      breaker.isOpen = true
      breaker.openedAt = new Date()
      console.log(`⚡ Circuit breaker opened for ${model} (success rate: ${(breaker.successRate * 100).toFixed(1)}%)`)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private generateHealthRecommendations(
    modelStatuses: any[],
    overallHealth: string
  ): string[] {
    const recommendations = []

    if (overallHealth === 'critical') {
      recommendations.push('System health is critical - multiple models failing')
      recommendations.push('Consider reducing request volume or checking API status')
    }

    const openCircuits = modelStatuses.filter(s => s.status === 'circuit_open')
    if (openCircuits.length > 0) {
      recommendations.push(`Circuit breakers open for: ${openCircuits.map(s => s.model).join(', ')}`)
    }

    const degradedModels = modelStatuses.filter(s => s.status === 'degraded')
    if (degradedModels.length > 0) {
      recommendations.push(`Degraded performance: ${degradedModels.map(s => s.model).join(', ')}`)
    }

    if (recommendations.length === 0) {
      recommendations.push('All systems operating normally')
    }

    return recommendations
  }
}

// Supporting interfaces
interface PromptAnalysis {
  wordCount: number
  sentenceCount: number
  complexityScore: number
  simplicityScore: number
  researchScore: number
  estimatedTokens: number
  requiresReasoning: boolean
  requiresResearch: boolean
  isSimpleQuery: boolean
  prompt?: string
}

interface ContextAnalysis {
  hasMultipleDataSources: boolean
  requiresLargeContext: boolean
  hasComplexConstraints: boolean
  requiresCreativity: boolean
  hasUserHistory: boolean
  isRealTimeRequest: boolean
}

interface ComplexityRule {
  keywords: string[]
  complexity: TaskComplexity
  confidence: number
}

interface ClassificationHistory {
  classifications: Array<{
    timestamp: Date
    success: boolean
    actualComplexity?: TaskComplexity
    userFeedback?: number
  }>
  successRate: number
  totalAttempts: number
}

interface DailyCostTracking {
  date: string
  totalCost: number
  requestCount: number
  taskBreakdown: Record<string, number>
}

interface CostAlert {
  type: 'warning' | 'critical'
  message: string
  timestamp: Date
}

interface CircuitBreaker {
  model: AIModel
  isOpen: boolean
  failureCount: number
  successCount: number
  successRate: number
  lastFailure?: Date
  lastSuccess?: Date
  openedAt?: Date
}

// Export singleton instances
export const taskComplexityClassifier = new TaskComplexityClassifier()
export const costOptimization = new CostOptimization()
export const fallbackSystem = new FallbackSystem()
