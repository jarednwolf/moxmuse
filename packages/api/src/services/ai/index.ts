// Export all AI services
export { promptRegistry, PromptRegistry } from './prompt-registry'
export { modelRouter, ModelRouter } from './model-router'
export { promptTemplateEngine, PromptTemplateEngine } from './prompt-template-engine'
export { aiTaskClassifier, AITaskClassifier } from './task-classifier'
export { promptVersioning, PromptVersioning } from './prompt-versioning'
export { promptPerformanceTracking, PromptPerformanceTracking } from './prompt-performance-tracking'
export { contextAwarePrompting, ContextAwarePrompting } from './context-aware-prompting'

// Export deck generation services
export { aiResearchEngine, AIResearchEngine } from './research-engine'
export { intelligentDeckAssembler, IntelligentDeckAssembler } from './deck-assembler'
export { aiValidationEngine, AIValidationEngine } from './deck-validator'
export { deckGenerationService, DeckGenerationService } from './deck-generation-service'

// Export deck analysis services
export { 
  deckAnalysisEngine, 
  aiResearchSynergyDetector, 
  intelligentStrategyAnalyzer, 
  aiWeaknessIdentifier, 
  aiPlayPatternAnalyzer,
  DeckAnalysisEngine,
  AIResearchSynergyDetector,
  IntelligentStrategyAnalyzer,
  AIWeaknessIdentifier,
  AIPlayPatternAnalyzer
} from './deck-analysis-engine'

// Export web research services
export {
  webResearchOrchestrator,
  tournamentDataScraper,
  communityInsightAggregator,
  priceResearchEngine,
  metaTrendAnalyzer,
  cardPerformanceResearcher,
  synergyResearchEngine,
  researchSynthesizer,
  WebResearchOrchestrator,
  TournamentDataScraper,
  CommunityInsightAggregator,
  PriceResearchEngine,
  MetaTrendAnalyzer,
  CardPerformanceResearcher,
  SynergyResearchEngine,
  ResearchSynthesizer
} from './web-research-orchestrator'

// Export personalization services
export {
  aiUserStyleProfiler,
  intelligentLearningService,
  researchBackedPersonalization,
  AIUserStyleProfiler,
  IntelligentLearningService,
  ResearchBackedPersonalization
} from './intelligent-personalization'

// Export multi-model system
export {
  taskComplexityClassifier,
  costOptimization,
  fallbackSystem,
  TaskComplexityClassifier,
  CostOptimization,
  FallbackSystem
} from './multi-model-system'

// Export types
export type { PromptTemplate, PromptVariable } from './prompt-registry'
export type { AIModel, TaskComplexity, AITaskType } from './model-router'
export type { TemplateContext } from './prompt-template-engine'
export type { TaskClassification } from './task-classifier'
export type { PromptVersion, ABTestConfig } from './prompt-versioning'
export type { PerformanceMetrics, AggregatedPerformance } from './prompt-performance-tracking'
export type { UserContext, SessionContext } from './context-aware-prompting'

// Export deck generation types
export type { ResearchQuery, ResearchResult } from './research-engine'
export type { DeckAssemblyRequest, AssembledDeck } from './deck-assembler'
export type { ValidationResult, DeckValidationRequest } from './deck-validator'
export type { DeckGenerationRequest, DeckGenerationResponse, GenerationProgress } from './deck-generation-service'

// Export deck analysis types
export type { 
  DeckAnalysisRequest, 
  SynergyAnalysis, 
  StrategyAnalysis, 
  PlayPatternAnalysis, 
  ComprehensiveDeckAnalysis 
} from './deck-analysis-engine'

// Export web research types
export type { 
  WebResearchRequest, 
  TournamentData, 
  CommunityInsight, 
  PriceData, 
  MetaTrend, 
  SynthesizedInsight 
} from './web-research-orchestrator'

// Export personalization types
export type { 
  UserStyleProfile, 
  LearningEvent, 
  PersonalizedRecommendation, 
  FeedbackAnalysis 
} from './intelligent-personalization'

// Export multi-model system types
export type { 
  TaskComplexityClassifierInput, 
  ModelPerformanceMetrics, 
  CostOptimizationConfig, 
  FallbackConfig 
} from './multi-model-system'

// Main AI service orchestrator
import { promptRegistry } from './prompt-registry'
import { modelRouter } from './model-router'
import { promptTemplateEngine } from './prompt-template-engine'
import { aiTaskClassifier } from './task-classifier'
import { promptVersioning } from './prompt-versioning'
import { promptPerformanceTracking } from './prompt-performance-tracking'
import { contextAwarePrompting } from './context-aware-prompting'
import { deckGenerationService } from './deck-generation-service'

/**
 * AIServiceOrchestrator coordinates all AI services for optimal prompt management
 * Provides a unified interface for AI-powered features
 */
export class AIServiceOrchestrator {
  constructor() {
    console.log('🤖 Initializing AI Service Orchestrator...')
  }

  /**
   * Execute an AI task with full orchestration
   */
  async executeAITask(request: AITaskRequest): Promise<AITaskResponse> {
    const startTime = Date.now()
    console.log(`🎯 Executing AI task: ${request.taskType}`)

    try {
      // 1. Classify the task
      const classification = aiTaskClassifier.classifyTask({
        prompt: request.prompt,
        context: request.context,
        constraints: request.constraints,
        expectedOutputType: request.expectedOutputType,
      })

      console.log(`📋 Task classified as: ${classification.taskType} (${classification.complexity})`)
      console.log(`🤖 Recommended model: ${classification.recommendedModel}`)

      // 2. Get the appropriate prompt template
      const template = promptRegistry.getTemplate(classification.taskType)
      if (!template) {
        throw new Error(`No template found for task type: ${classification.taskType}`)
      }

      // 3. Adapt prompt based on user context (if provided)
      let adaptedPrompt = template
      let enhancedVariables = request.variables || {}

      if (request.userId && request.sessionId) {
        const adaptation = contextAwarePrompting.adaptPrompt(
          template,
          request.variables || {},
          request.userId,
          request.sessionId
        )
        adaptedPrompt = adaptation.adaptedTemplate
        enhancedVariables = adaptation.enhancedVariables
      }

      // 4. Inject variables into the template
      const injectionResult = promptTemplateEngine.injectVariables(
        adaptedPrompt,
        enhancedVariables,
        request.templateContext
      )

      if (!injectionResult.success) {
        throw new Error(`Template injection failed: ${injectionResult.errors.join(', ')}`)
      }

      // 5. Select optimal model
      const modelSelection = modelRouter.selectModel(
        classification.taskType as any,
        classification.complexity,
        {
          estimatedTokens: classification.estimatedTokens,
          maxResponseTime: request.constraints?.maxResponseTime,
          maxCostPer1kTokens: request.constraints?.maxCost,
          prioritizeCost: request.constraints?.prioritizeCost,
          prioritizeSpeed: request.constraints?.prioritizeSpeed,
        }
      )

      console.log(`⚡ Selected model: ${modelSelection.model} (confidence: ${(modelSelection.confidence * 100).toFixed(1)}%)`)

      // 6. Execute the AI request (this would call the actual AI service)
      const aiResponse = await this.callAIService({
        model: modelSelection.model,
        systemPrompt: injectionResult.systemPrompt,
        userPrompt: injectionResult.injectedPrompt,
        maxTokens: request.constraints?.maxTokens,
        temperature: request.constraints?.temperature,
      })

      const endTime = Date.now()
      const responseTime = endTime - startTime

      // 7. Record performance metrics
      const performanceMetrics = {
        templateId: template.id,
        version: template.version,
        sessionId: request.sessionId || 'anonymous',
        userId: request.userId,
        timestamp: new Date(),
        success: aiResponse.success,
        responseTime,
        tokenUsage: aiResponse.tokenUsage,
        cost: aiResponse.cost,
        taskType: classification.taskType,
        modelUsed: modelSelection.model,
        inputComplexity: classification.complexity,
        outputLength: aiResponse.content?.length || 0,
      }

      promptPerformanceTracking.recordMetrics(performanceMetrics)

      // 8. Update model performance
      modelRouter.updateModelPerformance(
        modelSelection.model,
        classification.taskType as any,
        {
          success: aiResponse.success,
          responseTime,
          cost: aiResponse.cost,
        }
      )

      // 9. Build response
      const response: AITaskResponse = {
        success: aiResponse.success,
        content: aiResponse.content || null,
        metadata: {
          taskType: classification.taskType,
          complexity: classification.complexity,
          modelUsed: modelSelection.model,
          templateId: template.id,
          templateVersion: template.version,
          responseTime,
          tokenUsage: aiResponse.tokenUsage,
          cost: aiResponse.cost,
          adaptationsApplied: request.userId ? ['context-aware'] : [],
        },
        error: aiResponse.error,
      }

      console.log(`✅ AI task completed successfully in ${responseTime}ms`)
      return response

    } catch (error) {
      const endTime = Date.now()
      const responseTime = endTime - startTime

      console.error('❌ AI task failed:', error)

      // Record failure metrics if we have enough context
      if (request.sessionId) {
        promptPerformanceTracking.recordMetrics({
          templateId: 'unknown',
          version: '1.0',
          sessionId: request.sessionId,
          userId: request.userId,
          timestamp: new Date(),
          success: false,
          responseTime,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          taskType: request.taskType || 'unknown',
          modelUsed: 'unknown',
          inputComplexity: 'moderate',
          outputLength: 0,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      }

      return {
        success: false,
        content: null,
        metadata: {
          taskType: request.taskType || 'unknown',
          complexity: 'moderate',
          modelUsed: 'unknown',
          templateId: 'unknown',
          templateVersion: '1.0',
          responseTime,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          adaptationsApplied: [],
        },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Get AI insights and recommendations for a user
   */
  async getAIInsights(userId: string): Promise<AIInsights> {
    console.log(`🔍 Getting AI insights for user ${userId}`)

    const personalizedRecommendations = contextAwarePrompting.getPersonalizedRecommendations(userId)
    
    // Get performance data for user's recent templates
    const recentTemplates = this.getUserRecentTemplates(userId)
    const performanceInsights = recentTemplates.map(template => {
      const performance = promptPerformanceTracking.getAggregatedPerformance(template.id, template.version)
      const recommendations = promptPerformanceTracking.getPerformanceRecommendations(template.id, template.version)
      
      return {
        templateId: template.id,
        templateName: template.name,
        performance,
        recommendations,
      }
    })

    // Get active A/B tests that might affect the user
    const activeTests = promptVersioning.getActiveABTests()

    return {
      personalizedRecommendations,
      performanceInsights,
      activeTests: activeTests.map(test => ({
        testId: test.id,
        testName: test.name,
        description: test.description,
        isParticipating: this.isUserInTest(userId, test.id),
      })),
      systemHealth: {
        totalTemplates: Array.from(promptRegistry.getTemplatesForTask('commander-selection')).length,
        activeTests: activeTests.length,
        avgResponseTime: this.getSystemAverageResponseTime(),
        successRate: this.getSystemSuccessRate(),
      },
    }
  }

  /**
   * Start an A/B test for prompt optimization
   */
  async startPromptABTest(config: {
    name: string
    description: string
    taskType: string
    templateA: { id: string; version: string; name: string }
    templateB: { id: string; version: string; name: string }
    trafficSplit?: number
    duration?: number // days
    metrics?: string[]
  }): Promise<string> {
    console.log(`🧪 Starting A/B test: ${config.name}`)

    const testConfig = {
      name: config.name,
      description: config.description,
      taskType: config.taskType,
      variants: [
        {
          id: 'A',
          templateId: config.templateA.id,
          version: config.templateA.version,
          trafficAllocation: config.trafficSplit || 0.5,
          name: config.templateA.name,
        },
        {
          id: 'B',
          templateId: config.templateB.id,
          version: config.templateB.version,
          trafficAllocation: 1 - (config.trafficSplit || 0.5),
          name: config.templateB.name,
        },
      ],
      metrics: (config.metrics || ['success_rate', 'user_satisfaction', 'response_time']) as ('success_rate' | 'response_time' | 'user_satisfaction' | 'cost_per_request' | 'accuracy' | 'relevance')[],
      startDate: new Date(),
      endDate: config.duration ? new Date(Date.now() + config.duration * 24 * 60 * 60 * 1000) : undefined,
      minSampleSize: 100,
      confidenceLevel: 0.95,
    }

    const test = promptVersioning.startABTest(testConfig)
    
    console.log(`✅ Started A/B test with ID: ${test.id}`)
    return test.id
  }

  /**
   * Generate a complete deck using the AI pipeline
   */
  async generateCompleteDeck(request: any): Promise<any> {
    console.log(`🏗️ Generating complete deck via AI orchestrator`)
    
    return await deckGenerationService.generateDeck(request)
  }

  /**
   * Get deck generation progress
   */
  getDeckGenerationProgress(sessionId: string): any {
    return deckGenerationService.getGenerationProgress(sessionId)
  }

  /**
   * Get deck generation performance metrics
   */
  getDeckGenerationMetrics(): any {
    return deckGenerationService.getPerformanceMetrics()
  }

  /**
   * Get system performance overview
   */
  getSystemPerformance(): SystemPerformance {
    // This would aggregate performance across all templates and models
    return {
      totalRequests: this.getTotalRequests(),
      averageResponseTime: this.getSystemAverageResponseTime(),
      successRate: this.getSystemSuccessRate(),
      costEfficiency: this.getSystemCostEfficiency(),
      activeTemplates: this.getActiveTemplateCount(),
      activeTests: promptVersioning.getActiveABTests().length,
      topPerformingModels: this.getTopPerformingModels(),
      recentAlerts: promptPerformanceTracking.getActiveAlerts().length,
    }
  }

  /**
   * Call the actual AI service (placeholder)
   */
  private async callAIService(request: {
    model: string
    systemPrompt?: string
    userPrompt: string
    maxTokens?: number
    temperature?: number
  }): Promise<{
    success: boolean
    content?: string
    tokenUsage: { input: number; output: number; total: number }
    cost: number
    error?: string
  }> {
    // This would integrate with the actual OpenAI service
    // For now, return a mock response
    return {
      success: true,
      content: 'Mock AI response',
      tokenUsage: { input: 100, output: 50, total: 150 },
      cost: 0.001,
    }
  }

  /**
   * Get user's recent templates (placeholder)
   */
  private getUserRecentTemplates(userId: string): Array<{ id: string; version: string; name: string }> {
    // This would query the user's recent template usage
    return [
      { id: 'commander-selection', version: '1.0', name: 'Commander Selection' },
      { id: 'deck-optimization', version: '1.0', name: 'Deck Optimization' },
    ]
  }

  /**
   * Check if user is in A/B test (placeholder)
   */
  private isUserInTest(userId: string, testId: string): boolean {
    // This would check if the user is part of the test
    return Math.random() > 0.5 // Mock implementation
  }

  /**
   * Get system metrics (placeholders)
   */
  private getTotalRequests(): number { return 10000 }
  private getSystemAverageResponseTime(): number { return 3500 }
  private getSystemSuccessRate(): number { return 0.95 }
  private getSystemCostEfficiency(): number { return 0.85 }
  private getActiveTemplateCount(): number { return 15 }
  private getTopPerformingModels(): string[] { return ['gpt-4o', 'claude-3-sonnet', 'gpt-4-turbo'] }
}

// Request/Response interfaces
interface AITaskRequest {
  taskType?: string
  prompt: string
  variables?: Record<string, any>
  context?: Record<string, any>
  constraints?: {
    maxTokens?: number
    maxResponseTime?: number
    maxCost?: number
    temperature?: number
    prioritizeCost?: boolean
    prioritizeSpeed?: boolean
  }
  templateContext?: any
  userId?: string
  sessionId?: string
  expectedOutputType?: 'json' | 'text' | 'structured'
}

interface AITaskResponse {
  success: boolean
  content: string | null
  metadata: {
    taskType: string
    complexity: string
    modelUsed: string
    templateId: string
    templateVersion: string
    responseTime: number
    tokenUsage: { input: number; output: number; total: number }
    cost: number
    adaptationsApplied: string[]
  }
  error?: string
}

interface AIInsights {
  personalizedRecommendations: any[]
  performanceInsights: any[]
  activeTests: Array<{
    testId: string
    testName: string
    description: string
    isParticipating: boolean
  }>
  systemHealth: {
    totalTemplates: number
    activeTests: number
    avgResponseTime: number
    successRate: number
  }
}

interface SystemPerformance {
  totalRequests: number
  averageResponseTime: number
  successRate: number
  costEfficiency: number
  activeTemplates: number
  activeTests: number
  topPerformingModels: string[]
  recentAlerts: number
}

// Export singleton instance
export const aiServiceOrchestrator = new AIServiceOrchestrator()

console.log('🤖 AI Service Orchestrator initialized successfully')
console.log('Available services:')
console.log('  📝 Prompt Registry - Versioned prompt templates')
console.log('  🎯 Model Router - Optimal model selection')
console.log('  🔧 Template Engine - Dynamic variable injection')
console.log('  🎲 Task Classifier - Intelligent task routing')
console.log('  📊 Performance Tracking - Real-time metrics')
console.log('  🧪 Prompt Versioning - A/B testing capabilities')
console.log('  🎨 Context-Aware Prompting - Personalized interactions')
console.log('  🔍 Research Engine - Deep web research and data synthesis')
console.log('  🏗️ Deck Assembler - Intelligent 100-card deck construction')
console.log('  ✅ Deck Validator - Format compliance and meta analysis')
console.log('  🚀 Deck Generation Service - Complete generation pipeline')