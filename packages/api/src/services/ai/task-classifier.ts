import { z } from 'zod'
import { AITaskType, TaskComplexity, AIModel } from './model-router'

// Task classification types
export const TaskClassificationSchema = z.object({
  taskType: z.string(),
  complexity: z.enum(['low', 'moderate', 'high', 'research']),
  recommendedModel: z.enum([
    'gpt-3.5-turbo',
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'claude-3-haiku',
    'claude-3-sonnet',
    'claude-3-opus',
    'perplexity-sonar',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  fallbackModels: z.array(z.string()),
  estimatedTokens: z.number(),
  requiresResearch: z.boolean(),
})

export type TaskClassification = z.infer<typeof TaskClassificationSchema>

// Input analysis types
interface TaskInput {
  prompt: string
  context?: Record<string, any>
  constraints?: Record<string, any>
  userHistory?: any[]
  expectedOutputType?: 'json' | 'text' | 'structured'
}

interface ClassificationFeatures {
  promptLength: number
  complexityKeywords: string[]
  domainKeywords: string[]
  outputRequirements: string[]
  contextSize: number
  requiresReasoning: boolean
  requiresCreativity: boolean
  requiresResearch: boolean
  isTimesSensitive: boolean
  budgetConstraints: boolean
}

/**
 * AITaskClassifier analyzes tasks and routes them to optimal AI models
 * Uses pattern matching, keyword analysis, and ML-like classification
 */
export class AITaskClassifier {
  private classificationRules: Map<string, ClassificationRule> = new Map()
  private keywordMaps: Map<string, string[]> = new Map()
  private complexityIndicators: Map<string, number> = new Map()
  private modelCapabilities: Map<AIModel, ModelCapability> = new Map()

  constructor() {
    this.initializeClassificationRules()
    this.initializeKeywordMaps()
    this.initializeComplexityIndicators()
    this.initializeModelCapabilities()
  }

  /**
   * Classify a task and recommend the optimal AI model
   */
  classifyTask(input: TaskInput): TaskClassification {
    console.log('🎯 Classifying task:', input.prompt.substring(0, 100) + '...')

    // Extract features from input
    const features = this.extractFeatures(input)
    
    // Determine task type
    const taskType = this.determineTaskType(input, features)
    
    // Calculate complexity
    const complexity = this.calculateComplexity(features, taskType)
    
    // Select optimal model
    const modelSelection = this.selectOptimalModel(taskType, complexity, features)
    
    // Build classification result
    const classification: TaskClassification = {
      taskType,
      complexity,
      recommendedModel: modelSelection.model,
      confidence: modelSelection.confidence,
      reasoning: modelSelection.reasoning,
      fallbackModels: modelSelection.fallbacks,
      estimatedTokens: this.estimateTokenUsage(input, features),
      requiresResearch: features.requiresResearch,
    }

    console.log(`✅ Classified as ${taskType} (${complexity}) -> ${modelSelection.model}`)
    console.log(`Confidence: ${(modelSelection.confidence * 100).toFixed(1)}%`)
    
    return classification
  }

  /**
   * Batch classify multiple tasks for optimization
   */
  classifyBatch(inputs: TaskInput[]): TaskClassification[] {
    console.log(`🎯 Batch classifying ${inputs.length} tasks`)
    
    return inputs.map(input => this.classifyTask(input))
  }

  /**
   * Get task type suggestions based on prompt analysis
   */
  suggestTaskTypes(prompt: string): Array<{ taskType: string; confidence: number }> {
    const features = this.extractFeatures({ prompt })
    const suggestions: Array<{ taskType: string; confidence: number }> = []

    for (const [taskType, rule] of Array.from(this.classificationRules.entries())) {
      const confidence = this.calculateTaskTypeConfidence(features, rule)
      if (confidence > 0.3) {
        suggestions.push({ taskType, confidence })
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Update classification rules based on feedback
   */
  updateClassificationAccuracy(
    input: TaskInput,
    actualTaskType: string,
    actualComplexity: TaskComplexity,
    performanceMetrics: {
      success: boolean
      responseTime: number
      userSatisfaction: number
    }
  ): void {
    const features = this.extractFeatures(input)
    const predictedTaskType = this.determineTaskType(input, features)
    const predictedComplexity = this.calculateComplexity(features, predictedTaskType)

    // Update classification accuracy
    if (predictedTaskType !== actualTaskType) {
      console.log(`📊 Classification correction: ${predictedTaskType} -> ${actualTaskType}`)
      this.adjustClassificationRules(features, actualTaskType, actualComplexity)
    }

    // Update complexity indicators based on performance
    if (performanceMetrics.success && performanceMetrics.responseTime > 10000) {
      // Task took longer than expected, might be more complex
      this.adjustComplexityIndicators(features, 'increase')
    } else if (performanceMetrics.success && performanceMetrics.responseTime < 2000) {
      // Task was faster than expected, might be less complex
      this.adjustComplexityIndicators(features, 'decrease')
    }
  }

  /**
   * Extract features from task input
   */
  private extractFeatures(input: TaskInput): ClassificationFeatures {
    const prompt = input.prompt.toLowerCase()
    const promptLength = input.prompt.length
    const contextSize = input.context ? JSON.stringify(input.context).length : 0

    // Extract keywords
    const complexityKeywords = this.extractKeywords(prompt, 'complexity')
    const domainKeywords = this.extractKeywords(prompt, 'domain')
    const outputRequirements = this.extractKeywords(prompt, 'output')

    // Analyze requirements
    const requiresReasoning = this.checkRequiresReasoning(prompt)
    const requiresCreativity = this.checkRequiresCreativity(prompt)
    const requiresResearch = this.checkRequiresResearch(prompt)
    const isTimesSensitive = this.checkTimeSensitive(prompt)
    const budgetConstraints = this.checkBudgetConstraints(input)

    return {
      promptLength,
      complexityKeywords,
      domainKeywords,
      outputRequirements,
      contextSize,
      requiresReasoning,
      requiresCreativity,
      requiresResearch,
      isTimesSensitive,
      budgetConstraints,
    }
  }

  /**
   * Determine task type from features
   */
  private determineTaskType(input: TaskInput, features: ClassificationFeatures): string {
    let bestMatch = 'general'
    let bestScore = 0

    for (const [taskType, rule] of Array.from(this.classificationRules.entries())) {
      const score = this.calculateTaskTypeConfidence(features, rule)
      if (score > bestScore) {
        bestScore = score
        bestMatch = taskType
      }
    }

    return bestMatch
  }

  /**
   * Calculate task complexity
   */
  private calculateComplexity(features: ClassificationFeatures, taskType: string): TaskComplexity {
    let complexityScore = 0

    // Base complexity from task type
    const rule = this.classificationRules.get(taskType)
    if (rule) {
      complexityScore += rule.baseComplexity
    }

    // Adjust based on features
    complexityScore += features.promptLength / 1000 // Longer prompts are more complex
    complexityScore += features.contextSize / 2000 // More context increases complexity
    complexityScore += features.complexityKeywords.length * 0.5
    
    if (features.requiresReasoning) complexityScore += 1
    if (features.requiresCreativity) complexityScore += 0.5
    if (features.requiresResearch) complexityScore += 2

    // Map score to complexity levels
    if (complexityScore >= 4 || features.requiresResearch) return 'research'
    if (complexityScore >= 2.5) return 'high'
    if (complexityScore >= 1.5) return 'moderate'
    return 'low'
  }

  /**
   * Select optimal model based on task type and complexity
   */
  private selectOptimalModel(
    taskType: string,
    complexity: TaskComplexity,
    features: ClassificationFeatures
  ): ModelSelection {
    const rule = this.classificationRules.get(taskType)
    if (!rule) {
      return this.getDefaultModelSelection(complexity)
    }

    // Get candidate models for this complexity level
    const candidates = rule.modelPreferences[complexity] || rule.modelPreferences['moderate']
    
    // Score each candidate model
    const scoredModels = candidates.map(model => {
      const capability = this.modelCapabilities.get(model)!
      let score = capability.baseScore

      // Adjust score based on features
      if (features.requiresResearch && capability.researchCapability) {
        score += 2
      }
      if (features.requiresReasoning && capability.reasoningCapability) {
        score += 1.5
      }
      if (features.requiresCreativity && capability.creativityCapability) {
        score += 1
      }
      if (features.isTimesSensitive && capability.speed > 0.7) {
        score += 1
      }
      if (features.budgetConstraints && capability.costEfficiency > 0.7) {
        score += 0.5
      }

      return { model, score, capability }
    })

    // Select the highest scoring model
    const bestModel = scoredModels.sort((a, b) => b.score - a.score)[0]
    
    return {
      model: bestModel.model,
      confidence: Math.min(bestModel.score / 10, 1), // Normalize to 0-1
      reasoning: this.buildSelectionReasoning(bestModel, features),
      fallbacks: candidates.filter(m => m !== bestModel.model).slice(0, 2),
    }
  }

  /**
   * Calculate confidence for task type classification
   */
  private calculateTaskTypeConfidence(features: ClassificationFeatures, rule: ClassificationRule): number {
    let confidence = 0

    // Check keyword matches
    const keywordMatches = features.domainKeywords.filter(keyword => 
      rule.keywords.includes(keyword)
    ).length
    confidence += (keywordMatches / rule.keywords.length) * 0.4

    // Check feature requirements
    if (features.requiresResearch === rule.requiresResearch) confidence += 0.2
    if (features.requiresReasoning === rule.requiresReasoning) confidence += 0.2
    if (features.requiresCreativity === rule.requiresCreativity) confidence += 0.2

    return Math.min(confidence, 1)
  }

  /**
   * Extract keywords from prompt
   */
  private extractKeywords(prompt: string, category: string): string[] {
    const keywords = this.keywordMaps.get(category) || []
    return keywords.filter(keyword => prompt.includes(keyword))
  }

  /**
   * Check if task requires reasoning
   */
  private checkRequiresReasoning(prompt: string): boolean {
    const reasoningKeywords = [
      'analyze', 'compare', 'evaluate', 'optimize', 'strategy', 'synergy',
      'weakness', 'strength', 'improve', 'better', 'best', 'why', 'how',
      'explain', 'reason', 'logic', 'because'
    ]
    return reasoningKeywords.some(keyword => prompt.includes(keyword))
  }

  /**
   * Check if task requires creativity
   */
  private checkRequiresCreativity(prompt: string): boolean {
    const creativityKeywords = [
      'create', 'generate', 'build', 'design', 'innovative', 'unique',
      'creative', 'original', 'new', 'fresh', 'alternative'
    ]
    return creativityKeywords.some(keyword => prompt.includes(keyword))
  }

  /**
   * Check if task requires research
   */
  private checkRequiresResearch(prompt: string): boolean {
    const researchKeywords = [
      'research', 'meta', 'tournament', 'competitive', 'current', 'trending',
      'popular', 'statistics', 'data', 'analysis', 'study', 'investigate'
    ]
    return researchKeywords.some(keyword => prompt.includes(keyword))
  }

  /**
   * Check if task is time sensitive
   */
  private checkTimeSensitive(prompt: string): boolean {
    const timeKeywords = [
      'quick', 'fast', 'urgent', 'immediate', 'now', 'asap', 'quickly'
    ]
    return timeKeywords.some(keyword => prompt.includes(keyword))
  }

  /**
   * Check if task has budget constraints
   */
  private checkBudgetConstraints(input: TaskInput): boolean {
    const prompt = input.prompt.toLowerCase()
    const budgetKeywords = ['budget', 'cheap', 'affordable', 'cost', 'price', 'money']
    
    return budgetKeywords.some(keyword => prompt.includes(keyword)) ||
           Boolean(input.constraints && typeof input.constraints.budget !== 'undefined')
  }

  /**
   * Estimate token usage for the task
   */
  private estimateTokenUsage(input: TaskInput, features: ClassificationFeatures): number {
    let tokens = Math.ceil(input.prompt.length / 4) // Rough token estimation

    // Add context tokens
    tokens += Math.ceil(features.contextSize / 4)

    // Adjust based on expected output
    if (features.outputRequirements.includes('detailed')) tokens += 500
    if (features.outputRequirements.includes('comprehensive')) tokens += 1000
    if (features.requiresResearch) tokens += 2000

    return tokens
  }

  /**
   * Build reasoning for model selection
   */
  private buildSelectionReasoning(
    selection: { model: AIModel; score: number; capability: ModelCapability },
    features: ClassificationFeatures
  ): string {
    const reasons: string[] = []

    if (features.requiresResearch && selection.capability.researchCapability) {
      reasons.push('excellent research capabilities')
    }
    if (features.requiresReasoning && selection.capability.reasoningCapability) {
      reasons.push('strong reasoning abilities')
    }
    if (features.requiresCreativity && selection.capability.creativityCapability) {
      reasons.push('creative problem solving')
    }
    if (features.isTimesSensitive && selection.capability.speed > 0.7) {
      reasons.push('fast response time')
    }
    if (features.budgetConstraints && selection.capability.costEfficiency > 0.7) {
      reasons.push('cost effectiveness')
    }

    return `Selected ${selection.model} for: ${reasons.join(', ')}`
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

    return {
      model: modelMap[complexity],
      confidence: 0.7,
      reasoning: `Default selection for ${complexity} complexity task`,
      fallbacks: ['gpt-4o-mini', 'gpt-4'],
    }
  }

  /**
   * Adjust classification rules based on feedback
   */
  private adjustClassificationRules(
    features: ClassificationFeatures,
    correctTaskType: string,
    correctComplexity: TaskComplexity
  ): void {
    // This would implement machine learning-like rule adjustment
    // For now, just log the correction
    console.log(`📚 Learning: Features ${JSON.stringify(features)} -> ${correctTaskType} (${correctComplexity})`)
  }

  /**
   * Adjust complexity indicators
   */
  private adjustComplexityIndicators(features: ClassificationFeatures, direction: 'increase' | 'decrease'): void {
    const adjustment = direction === 'increase' ? 0.1 : -0.1
    
    for (const keyword of features.complexityKeywords) {
      const current = this.complexityIndicators.get(keyword) || 0
      this.complexityIndicators.set(keyword, current + adjustment)
    }
  }

  /**
   * Initialize classification rules
   */
  private initializeClassificationRules(): void {
    // Commander Selection
    this.classificationRules.set('commander-selection', {
      keywords: ['commander', 'legendary', 'lead', 'general', 'suggest', 'recommend'],
      baseComplexity: 1,
      requiresResearch: false,
      requiresReasoning: false,
      requiresCreativity: true,
      modelPreferences: {
        low: ['gpt-4o-mini', 'gpt-3.5-turbo'],
        moderate: ['gpt-4o-mini', 'gpt-4-turbo'],
        high: ['gpt-4o', 'gpt-4-turbo'],
        research: ['claude-3-opus', 'gpt-4o'],
      },
    })

    // Deck Optimization
    this.classificationRules.set('deck-optimization', {
      keywords: ['optimize', 'improve', 'upgrade', 'better', 'fix', 'enhance'],
      baseComplexity: 2.5,
      requiresResearch: true,
      requiresReasoning: true,
      requiresCreativity: true,
      modelPreferences: {
        low: ['gpt-4-turbo', 'gpt-4o-mini'],
        moderate: ['gpt-4o', 'gpt-4-turbo'],
        high: ['gpt-4o', 'claude-3-sonnet'],
        research: ['claude-3-opus', 'gpt-4o'],
      },
    })

    // Synergy Analysis
    this.classificationRules.set('synergy-analysis', {
      keywords: ['synergy', 'combo', 'interaction', 'work together', 'combine'],
      baseComplexity: 2,
      requiresResearch: true,
      requiresReasoning: true,
      requiresCreativity: false,
      modelPreferences: {
        low: ['gpt-4-turbo', 'gpt-4o-mini'],
        moderate: ['gpt-4o', 'claude-3-sonnet'],
        high: ['gpt-4o', 'claude-3-opus'],
        research: ['claude-3-opus', 'gpt-4o'],
      },
    })

    // Web Research
    this.classificationRules.set('web-research', {
      keywords: ['research', 'meta', 'tournament', 'competitive', 'data', 'statistics'],
      baseComplexity: 3,
      requiresResearch: true,
      requiresReasoning: true,
      requiresCreativity: false,
      modelPreferences: {
        low: ['perplexity-sonar', 'claude-3-haiku'],
        moderate: ['perplexity-sonar', 'claude-3-sonnet'],
        high: ['claude-3-opus', 'perplexity-sonar'],
        research: ['perplexity-sonar', 'claude-3-opus'],
      },
    })

    console.log('✅ Initialized classification rules')
  }

  /**
   * Initialize keyword maps
   */
  private initializeKeywordMaps(): void {
    this.keywordMaps.set('complexity', [
      'analyze', 'optimize', 'complex', 'advanced', 'detailed', 'comprehensive',
      'thorough', 'deep', 'extensive', 'sophisticated'
    ])

    this.keywordMaps.set('domain', [
      'commander', 'deck', 'card', 'magic', 'mtg', 'strategy', 'synergy',
      'combo', 'meta', 'tournament', 'competitive', 'casual', 'edh'
    ])

    this.keywordMaps.set('output', [
      'list', 'json', 'detailed', 'comprehensive', 'summary', 'analysis',
      'report', 'structured', 'formatted'
    ])

    console.log('✅ Initialized keyword maps')
  }

  /**
   * Initialize complexity indicators
   */
  private initializeComplexityIndicators(): void {
    // Keywords that indicate higher complexity
    const highComplexityWords = [
      'optimize', 'analyze', 'comprehensive', 'detailed', 'advanced',
      'complex', 'sophisticated', 'thorough', 'extensive'
    ]

    highComplexityWords.forEach(word => {
      this.complexityIndicators.set(word, 1.5)
    })

    // Keywords that indicate lower complexity
    const lowComplexityWords = [
      'simple', 'basic', 'quick', 'easy', 'straightforward', 'brief'
    ]

    lowComplexityWords.forEach(word => {
      this.complexityIndicators.set(word, 0.5)
    })

    console.log('✅ Initialized complexity indicators')
  }

  /**
   * Initialize model capabilities
   */
  private initializeModelCapabilities(): void {
    this.modelCapabilities.set('gpt-3.5-turbo', {
      baseScore: 6,
      speed: 0.9,
      costEfficiency: 0.95,
      reasoningCapability: 0.6,
      creativityCapability: 0.7,
      researchCapability: 0.3,
    })

    this.modelCapabilities.set('gpt-4o-mini', {
      baseScore: 7,
      speed: 0.8,
      costEfficiency: 0.9,
      reasoningCapability: 0.75,
      creativityCapability: 0.8,
      researchCapability: 0.4,
    })

    this.modelCapabilities.set('gpt-4-turbo', {
      baseScore: 8,
      speed: 0.7,
      costEfficiency: 0.6,
      reasoningCapability: 0.9,
      creativityCapability: 0.85,
      researchCapability: 0.6,
    })

    this.modelCapabilities.set('gpt-4o', {
      baseScore: 9,
      speed: 0.75,
      costEfficiency: 0.5,
      reasoningCapability: 0.95,
      creativityCapability: 0.9,
      researchCapability: 0.7,
    })

    this.modelCapabilities.set('claude-3-sonnet', {
      baseScore: 8.5,
      speed: 0.6,
      costEfficiency: 0.4,
      reasoningCapability: 0.9,
      creativityCapability: 0.8,
      researchCapability: 0.8,
    })

    this.modelCapabilities.set('claude-3-opus', {
      baseScore: 9.5,
      speed: 0.4,
      costEfficiency: 0.2,
      reasoningCapability: 0.95,
      creativityCapability: 0.9,
      researchCapability: 0.95,
    })

    this.modelCapabilities.set('perplexity-sonar', {
      baseScore: 7,
      speed: 0.5,
      costEfficiency: 0.7,
      reasoningCapability: 0.6,
      creativityCapability: 0.4,
      researchCapability: 0.95,
    })

    console.log('✅ Initialized model capabilities')
  }
}

// Supporting interfaces
interface ClassificationRule {
  keywords: string[]
  baseComplexity: number
  requiresResearch: boolean
  requiresReasoning: boolean
  requiresCreativity: boolean
  modelPreferences: Record<TaskComplexity, AIModel[]>
}

interface ModelCapability {
  baseScore: number
  speed: number // 0-1, higher is faster
  costEfficiency: number // 0-1, higher is more cost effective
  reasoningCapability: number // 0-1, higher is better reasoning
  creativityCapability: number // 0-1, higher is more creative
  researchCapability: number // 0-1, higher is better at research
}

interface ModelSelection {
  model: AIModel
  confidence: number
  reasoning: string
  fallbacks: AIModel[]
}

// Export singleton instance
export const aiTaskClassifier = new AITaskClassifier()