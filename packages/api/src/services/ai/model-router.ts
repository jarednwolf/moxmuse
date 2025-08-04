import { z } from 'zod'

// AI Model Types
export const AIModelSchema = z.enum([
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-haiku',
  'claude-3-sonnet',
  'claude-3-opus',
  'perplexity-sonar',
])

export type AIModel = z.infer<typeof AIModelSchema>

export const TaskComplexitySchema = z.enum(['low', 'moderate', 'high', 'research'])
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>

export const AITaskTypeSchema = z.enum([
  'commander-selection',
  'card-recommendation',
  'deck-optimization',
  'synergy-analysis',
  'meta-analysis',
  'web-research',
  'data-synthesis',
  'strategy-analysis',
  'deck-generation',
  'performance-analysis',
])

export type AITaskType = z.infer<typeof AITaskTypeSchema>

// Model capabilities and costs
interface ModelCapabilities {
  model: AIModel
  maxTokens: number
  costPer1kTokens: {
    input: number
    output: number
  }
  strengths: string[]
  weaknesses: string[]
  optimalFor: TaskComplexity[]
  averageResponseTime: number // milliseconds
  reliability: number // 0-1 score
}

// Task classification rules
interface TaskClassificationRule {
  taskType: AITaskType
  complexity: TaskComplexity
  preferredModels: AIModel[]
  fallbackModels: AIModel[]
  contextRequirements: {
    maxContextLength: number
    requiresResearch: boolean
    requiresReasoning: boolean
    requiresCreativity: boolean
  }
}

/**
 * ModelRouter selects the optimal AI model based on task complexity,
 * cost constraints, and performance requirements
 */
export class ModelRouter {
  private modelCapabilities: Map<AIModel, ModelCapabilities> = new Map()
  private taskRules: Map<AITaskType, TaskClassificationRule> = new Map()
  private performanceHistory: Map<string, ModelPerformanceHistory> = new Map()

  constructor() {
    this.initializeModelCapabilities()
    this.initializeTaskRules()
  }

  /**
   * Select the optimal model for a given task
   */
  selectModel(
    taskType: AITaskType,
    complexity: TaskComplexity,
    constraints?: ModelSelectionConstraints
  ): ModelSelection {
    const rule = this.taskRules.get(taskType)
    if (!rule) {
      console.warn(`⚠️ No classification rule found for task type: ${taskType}`)
      return this.getDefaultModelSelection(complexity)
    }

    // Get candidate models based on task rules and complexity
    const candidateModels = this.getCandidateModels(rule, complexity)
    
    // Apply constraints and performance history
    const filteredModels = this.applyConstraints(candidateModels, constraints)
    
    // Select the best model based on performance and cost
    const selectedModel = this.selectBestModel(filteredModels, taskType, constraints)
    
    const capabilities = this.modelCapabilities.get(selectedModel)!
    
    return {
      model: selectedModel,
      reasoning: this.getSelectionReasoning(selectedModel, taskType, complexity),
      estimatedCost: this.estimateCost(selectedModel, constraints?.estimatedTokens || 1000),
      estimatedResponseTime: capabilities.averageResponseTime,
      fallbackModels: rule.fallbackModels.filter(m => m !== selectedModel),
      confidence: this.getSelectionConfidence(selectedModel, taskType),
    }
  }

  /**
   * Classify a task to determine its complexity
   */
  classifyTask(
    taskType: AITaskType,
    context: TaskContext
  ): TaskComplexity {
    const rule = this.taskRules.get(taskType)
    if (!rule) {
      return 'moderate' // Default complexity
    }

    // Base complexity from task type
    let complexity = rule.complexity

    // Adjust based on context
    if (context.requiresResearch || context.multipleDataSources) {
      complexity = 'research'
    } else if (context.complexReasoning || context.largeContext) {
      complexity = complexity === 'low' ? 'moderate' : 'high'
    } else if (context.simpleQuery && context.standardFormat) {
      complexity = 'low'
    }

    console.log(`🎯 Classified ${taskType} as ${complexity} complexity`)
    return complexity
  }

  /**
   * Update model performance based on actual results
   */
  updateModelPerformance(
    model: AIModel,
    taskType: AITaskType,
    performance: ModelPerformanceUpdate
  ): void {
    const key = `${model}:${taskType}`
    const existing = this.performanceHistory.get(key) || {
      model,
      taskType,
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      averageCost: 0,
      userSatisfactionScore: 0,
      lastUpdated: new Date(),
    }

    // Update metrics
    existing.totalRequests += 1
    if (performance.success) {
      existing.successfulRequests += 1
    }

    // Update running averages
    existing.averageResponseTime = this.updateRunningAverage(
      existing.averageResponseTime,
      performance.responseTime,
      existing.totalRequests
    )

    existing.averageCost = this.updateRunningAverage(
      existing.averageCost,
      performance.cost,
      existing.totalRequests
    )

    if (performance.userSatisfactionScore) {
      existing.userSatisfactionScore = this.updateRunningAverage(
        existing.userSatisfactionScore,
        performance.userSatisfactionScore,
        existing.totalRequests
      )
    }

    existing.lastUpdated = new Date()
    this.performanceHistory.set(key, existing)

    console.log(`📊 Updated performance for ${model} on ${taskType}:`, {
      successRate: existing.successfulRequests / existing.totalRequests,
      avgResponseTime: existing.averageResponseTime,
      avgCost: existing.averageCost,
    })
  }

  /**
   * Get model performance history
   */
  getModelPerformance(model: AIModel, taskType: AITaskType): ModelPerformanceHistory | null {
    return this.performanceHistory.get(`${model}:${taskType}`) || null
  }

  /**
   * Get all available models for a task type
   */
  getAvailableModels(taskType: AITaskType): AIModel[] {
    const rule = this.taskRules.get(taskType)
    return rule ? [...rule.preferredModels, ...rule.fallbackModels] : []
  }

  /**
   * Initialize model capabilities
   */
  private initializeModelCapabilities(): void {
    // GPT-3.5 Turbo - Fast and cost-effective
    this.modelCapabilities.set('gpt-3.5-turbo', {
      model: 'gpt-3.5-turbo',
      maxTokens: 4096,
      costPer1kTokens: { input: 0.0015, output: 0.002 },
      strengths: ['Fast response', 'Cost effective', 'Good for simple tasks'],
      weaknesses: ['Limited reasoning', 'Shorter context'],
      optimalFor: ['low'],
      averageResponseTime: 2000,
      reliability: 0.85,
    })

    // GPT-4 - Balanced performance
    this.modelCapabilities.set('gpt-4', {
      model: 'gpt-4',
      maxTokens: 8192,
      costPer1kTokens: { input: 0.03, output: 0.06 },
      strengths: ['Strong reasoning', 'Good context handling', 'Reliable'],
      weaknesses: ['Higher cost', 'Slower response'],
      optimalFor: ['moderate', 'high'],
      averageResponseTime: 8000,
      reliability: 0.95,
    })

    // GPT-4 Turbo - High performance
    this.modelCapabilities.set('gpt-4-turbo', {
      model: 'gpt-4-turbo',
      maxTokens: 128000,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      strengths: ['Large context', 'Fast for GPT-4', 'Strong reasoning'],
      weaknesses: ['Higher cost than 3.5'],
      optimalFor: ['moderate', 'high'],
      averageResponseTime: 5000,
      reliability: 0.93,
    })

    // GPT-4o - Latest optimized model
    this.modelCapabilities.set('gpt-4o', {
      model: 'gpt-4o',
      maxTokens: 128000,
      costPer1kTokens: { input: 0.005, output: 0.015 },
      strengths: ['Best performance', 'Large context', 'Multimodal'],
      weaknesses: ['Premium pricing'],
      optimalFor: ['high', 'research'],
      averageResponseTime: 4000,
      reliability: 0.97,
    })

    // GPT-4o Mini - Optimized for speed and cost
    this.modelCapabilities.set('gpt-4o-mini', {
      model: 'gpt-4o-mini',
      maxTokens: 128000,
      costPer1kTokens: { input: 0.00015, output: 0.0006 },
      strengths: ['Very cost effective', 'Fast', 'Large context'],
      weaknesses: ['Reduced capabilities vs full GPT-4'],
      optimalFor: ['low', 'moderate'],
      averageResponseTime: 2500,
      reliability: 0.88,
    })

    // Claude 3 Haiku - Fast and efficient
    this.modelCapabilities.set('claude-3-haiku', {
      model: 'claude-3-haiku',
      maxTokens: 200000,
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
      strengths: ['Very fast', 'Large context', 'Cost effective'],
      weaknesses: ['Limited reasoning vs larger models'],
      optimalFor: ['low', 'moderate'],
      averageResponseTime: 1500,
      reliability: 0.87,
    })

    // Claude 3 Sonnet - Balanced
    this.modelCapabilities.set('claude-3-sonnet', {
      model: 'claude-3-sonnet',
      maxTokens: 200000,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      strengths: ['Strong reasoning', 'Large context', 'Good analysis'],
      weaknesses: ['Higher cost'],
      optimalFor: ['moderate', 'high'],
      averageResponseTime: 6000,
      reliability: 0.94,
    })

    // Claude 3 Opus - Highest capability
    this.modelCapabilities.set('claude-3-opus', {
      model: 'claude-3-opus',
      maxTokens: 200000,
      costPer1kTokens: { input: 0.015, output: 0.075 },
      strengths: ['Best reasoning', 'Complex analysis', 'Research tasks'],
      weaknesses: ['Highest cost', 'Slower response'],
      optimalFor: ['high', 'research'],
      averageResponseTime: 10000,
      reliability: 0.96,
    })

    // Perplexity - Research specialist
    this.modelCapabilities.set('perplexity-sonar', {
      model: 'perplexity-sonar',
      maxTokens: 4096,
      costPer1kTokens: { input: 0.002, output: 0.002 },
      strengths: ['Web search', 'Real-time data', 'Research'],
      weaknesses: ['Limited reasoning', 'Specialized use'],
      optimalFor: ['research'],
      averageResponseTime: 7000,
      reliability: 0.89,
    })

    console.log('✅ Initialized model capabilities')
  }

  /**
   * Initialize task classification rules
   */
  private initializeTaskRules(): void {
    // Commander Selection - Simple task
    this.taskRules.set('commander-selection', {
      taskType: 'commander-selection',
      complexity: 'low',
      preferredModels: ['gpt-4o-mini', 'gpt-3.5-turbo'],
      fallbackModels: ['gpt-4', 'claude-3-haiku'],
      contextRequirements: {
        maxContextLength: 2000,
        requiresResearch: false,
        requiresReasoning: false,
        requiresCreativity: true,
      },
    })

    // Card Recommendation - Moderate complexity
    this.taskRules.set('card-recommendation', {
      taskType: 'card-recommendation',
      complexity: 'moderate',
      preferredModels: ['gpt-4o-mini', 'gpt-4-turbo'],
      fallbackModels: ['gpt-4', 'claude-3-sonnet'],
      contextRequirements: {
        maxContextLength: 4000,
        requiresResearch: false,
        requiresReasoning: true,
        requiresCreativity: true,
      },
    })

    // Deck Optimization - High complexity
    this.taskRules.set('deck-optimization', {
      taskType: 'deck-optimization',
      complexity: 'high',
      preferredModels: ['gpt-4o', 'gpt-4-turbo', 'claude-3-sonnet'],
      fallbackModels: ['gpt-4', 'claude-3-opus'],
      contextRequirements: {
        maxContextLength: 8000,
        requiresResearch: true,
        requiresReasoning: true,
        requiresCreativity: true,
      },
    })

    // Web Research - Research specialist
    this.taskRules.set('web-research', {
      taskType: 'web-research',
      complexity: 'research',
      preferredModels: ['perplexity-sonar', 'claude-3-opus'],
      fallbackModels: ['claude-3-sonnet', 'gpt-4o'],
      contextRequirements: {
        maxContextLength: 16000,
        requiresResearch: true,
        requiresReasoning: true,
        requiresCreativity: false,
      },
    })

    // Synergy Analysis - High complexity
    this.taskRules.set('synergy-analysis', {
      taskType: 'synergy-analysis',
      complexity: 'high',
      preferredModels: ['gpt-4o', 'claude-3-sonnet'],
      fallbackModels: ['gpt-4-turbo', 'claude-3-opus'],
      contextRequirements: {
        maxContextLength: 12000,
        requiresResearch: true,
        requiresReasoning: true,
        requiresCreativity: false,
      },
    })

    // Meta Analysis - Research task
    this.taskRules.set('meta-analysis', {
      taskType: 'meta-analysis',
      complexity: 'research',
      preferredModels: ['claude-3-opus', 'perplexity-sonar'],
      fallbackModels: ['claude-3-sonnet', 'gpt-4o'],
      contextRequirements: {
        maxContextLength: 20000,
        requiresResearch: true,
        requiresReasoning: true,
        requiresCreativity: false,
      },
    })

    console.log('✅ Initialized task classification rules')
  }

  /**
   * Get candidate models based on task rules and complexity
   */
  private getCandidateModels(rule: TaskClassificationRule, complexity: TaskComplexity): AIModel[] {
    const candidates = [...rule.preferredModels]
    
    // Add fallback models if complexity is higher than expected
    if (complexity === 'high' || complexity === 'research') {
      candidates.push(...rule.fallbackModels)
    }

    return Array.from(new Set(candidates)) // Remove duplicates
  }

  /**
   * Apply constraints to filter models
   */
  private applyConstraints(
    models: AIModel[],
    constraints?: ModelSelectionConstraints
  ): AIModel[] {
    if (!constraints) return models

    return models.filter(model => {
      const capabilities = this.modelCapabilities.get(model)!
      
      // Cost constraint
      if (constraints.maxCostPer1kTokens) {
        const avgCost = (capabilities.costPer1kTokens.input + capabilities.costPer1kTokens.output) / 2
        if (avgCost > constraints.maxCostPer1kTokens) return false
      }

      // Response time constraint
      if (constraints.maxResponseTime && capabilities.averageResponseTime > constraints.maxResponseTime) {
        return false
      }

      // Context length constraint
      if (constraints.minContextLength && capabilities.maxTokens < constraints.minContextLength) {
        return false
      }

      // Reliability constraint
      if (constraints.minReliability && capabilities.reliability < constraints.minReliability) {
        return false
      }

      return true
    })
  }

  /**
   * Select the best model from candidates
   */
  private selectBestModel(
    candidates: AIModel[],
    taskType: AITaskType,
    constraints?: ModelSelectionConstraints
  ): AIModel {
    if (candidates.length === 0) {
      console.warn('⚠️ No candidate models available, using default')
      return 'gpt-4o-mini'
    }

    if (candidates.length === 1) {
      return candidates[0]
    }

    // Score each model based on performance history and capabilities
    const scoredModels = candidates.map(model => {
      const capabilities = this.modelCapabilities.get(model)!
      const performance = this.getModelPerformance(model, taskType)
      
      let score = capabilities.reliability * 100

      // Boost score based on historical performance
      if (performance) {
        const successRate = performance.successfulRequests / performance.totalRequests
        score += successRate * 50
        score += performance.userSatisfactionScore * 10
      }

      // Penalize for cost if budget-conscious
      if (constraints?.prioritizeCost) {
        const avgCost = (capabilities.costPer1kTokens.input + capabilities.costPer1kTokens.output) / 2
        score -= avgCost * 1000 // Convert to penalty points
      }

      // Boost for speed if time-sensitive
      if (constraints?.prioritizeSpeed) {
        score -= capabilities.averageResponseTime / 100 // Convert ms to penalty points
      }

      return { model, score }
    })

    // Return the highest scoring model
    const bestModel = scoredModels.sort((a, b) => b.score - a.score)[0]
    return bestModel.model
  }

  /**
   * Get default model selection for unknown tasks
   */
  private getDefaultModelSelection(complexity: TaskComplexity): ModelSelection {
    const modelMap: Record<TaskComplexity, AIModel> = {
      low: 'gpt-4o-mini',
      moderate: 'gpt-4-turbo',
      high: 'gpt-4o',
      research: 'claude-3-opus',
    }

    const model = modelMap[complexity]
    const capabilities = this.modelCapabilities.get(model)!

    return {
      model,
      reasoning: `Default selection for ${complexity} complexity task`,
      estimatedCost: this.estimateCost(model, 1000),
      estimatedResponseTime: capabilities.averageResponseTime,
      fallbackModels: ['gpt-4o-mini', 'gpt-4'],
      confidence: 0.7,
    }
  }

  /**
   * Get reasoning for model selection
   */
  private getSelectionReasoning(
    model: AIModel,
    taskType: AITaskType,
    complexity: TaskComplexity
  ): string {
    const capabilities = this.modelCapabilities.get(model)!
    const performance = this.getModelPerformance(model, taskType)

    let reasoning = `Selected ${model} for ${taskType} (${complexity} complexity) because: `
    reasoning += capabilities.strengths.join(', ')

    if (performance) {
      const successRate = performance.successfulRequests / performance.totalRequests
      reasoning += `. Historical success rate: ${(successRate * 100).toFixed(1)}%`
    }

    return reasoning
  }

  /**
   * Estimate cost for a model and token count
   */
  private estimateCost(model: AIModel, estimatedTokens: number): number {
    const capabilities = this.modelCapabilities.get(model)!
    const avgCostPer1k = (capabilities.costPer1kTokens.input + capabilities.costPer1kTokens.output) / 2
    return (estimatedTokens / 1000) * avgCostPer1k
  }

  /**
   * Get confidence score for model selection
   */
  private getSelectionConfidence(model: AIModel, taskType: AITaskType): number {
    const capabilities = this.modelCapabilities.get(model)!
    const performance = this.getModelPerformance(model, taskType)

    let confidence = capabilities.reliability

    if (performance && performance.totalRequests > 10) {
      const successRate = performance.successfulRequests / performance.totalRequests
      confidence = (confidence + successRate) / 2
    }

    return confidence
  }

  /**
   * Update running average
   */
  private updateRunningAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count
  }
}

// Supporting interfaces
interface ModelSelectionConstraints {
  maxCostPer1kTokens?: number
  maxResponseTime?: number
  minContextLength?: number
  minReliability?: number
  prioritizeCost?: boolean
  prioritizeSpeed?: boolean
  estimatedTokens?: number
}

interface ModelSelection {
  model: AIModel
  reasoning: string
  estimatedCost: number
  estimatedResponseTime: number
  fallbackModels: AIModel[]
  confidence: number
}

interface TaskContext {
  requiresResearch: boolean
  multipleDataSources: boolean
  complexReasoning: boolean
  largeContext: boolean
  simpleQuery: boolean
  standardFormat: boolean
}

interface ModelPerformanceHistory {
  model: AIModel
  taskType: AITaskType
  totalRequests: number
  successfulRequests: number
  averageResponseTime: number
  averageCost: number
  userSatisfactionScore: number
  lastUpdated: Date
}

interface ModelPerformanceUpdate {
  success: boolean
  responseTime: number
  cost: number
  userSatisfactionScore?: number
}

// Export singleton instance
export const modelRouter = new ModelRouter()