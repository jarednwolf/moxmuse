import { z } from 'zod'

// Core prompt template types
export const PromptVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  required: z.boolean().default(true),
  description: z.string(),
  defaultValue: z.any().optional(),
  validation: z.any().optional(),
})

export type PromptVariable = z.infer<typeof PromptVariableSchema>

export const PromptTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  taskType: z.string(),
  modelType: z.enum(['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus', 'perplexity-sonar']),
  template: z.string(),
  systemPrompt: z.string().optional(),
  variables: z.array(PromptVariableSchema),
  researchContext: z.object({
    researchDepth: z.enum(['shallow', 'moderate', 'deep']).default('moderate'),
    dataSources: z.array(z.string()).default([]),
    timeframe: z.string().optional(),
    confidenceThreshold: z.number().min(0).max(1).default(0.7),
  }).optional(),
  performanceMetrics: z.object({
    successRate: z.number().min(0).max(1).default(0),
    averageResponseTime: z.number().default(0),
    userSatisfactionScore: z.number().min(0).max(5).default(0),
    costPerRequest: z.number().default(0),
    lastUpdated: z.date().default(() => new Date()),
  }).optional(),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
})

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>

export const PromptPerformanceMetricsSchema = z.object({
  templateId: z.string(),
  version: z.string(),
  successRate: z.number().min(0).max(1),
  averageResponseTime: z.number(),
  userSatisfactionScore: z.number().min(0).max(5),
  costPerRequest: z.number(),
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  lastUpdated: z.date(),
})

export type PromptPerformanceMetrics = z.infer<typeof PromptPerformanceMetricsSchema>

/**
 * PromptRegistry manages versioned prompts for different AI tasks
 * Supports A/B testing, performance tracking, and dynamic template selection
 */
export class PromptRegistry {
  private templates: Map<string, PromptTemplate[]> = new Map()
  private performanceMetrics: Map<string, PromptPerformanceMetrics> = new Map()
  private abTestConfigs: Map<string, ABTestConfig> = new Map()

  constructor() {
    this.initializeDefaultTemplates()
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    const taskTemplates = this.templates.get(template.taskType) || []
    
    // Check if template with same ID and version already exists
    const existingIndex = taskTemplates.findIndex(
      t => t.id === template.id && t.version === template.version
    )
    
    if (existingIndex >= 0) {
      taskTemplates[existingIndex] = template
    } else {
      taskTemplates.push(template)
    }
    
    this.templates.set(template.taskType, taskTemplates)
    
    console.log(`📝 Registered prompt template: ${template.id} v${template.version} for ${template.taskType}`)
  }

  /**
   * Get the best performing template for a task type
   */
  getTemplate(taskType: string, version?: string): PromptTemplate | null {
    const taskTemplates = this.templates.get(taskType) || []
    
    if (taskTemplates.length === 0) {
      console.warn(`⚠️ No templates found for task type: ${taskType}`)
      return null
    }

    // If specific version requested, return that
    if (version) {
      const template = taskTemplates.find(t => t.version === version && t.isActive)
      if (!template) {
        console.warn(`⚠️ Template version ${version} not found for ${taskType}`)
        return null
      }
      return template
    }

    // Check if there's an active A/B test
    const abTest = this.abTestConfigs.get(taskType)
    if (abTest && abTest.isActive) {
      return this.selectTemplateForABTest(taskType, abTest)
    }

    // Return the best performing active template
    const activeTemplates = taskTemplates.filter(t => t.isActive)
    if (activeTemplates.length === 0) {
      console.warn(`⚠️ No active templates found for task type: ${taskType}`)
      return null
    }

    // Sort by performance metrics (success rate * user satisfaction)
    const bestTemplate = activeTemplates.sort((a, b) => {
      const scoreA = (a.performanceMetrics?.successRate || 0) * (a.performanceMetrics?.userSatisfactionScore || 0)
      const scoreB = (b.performanceMetrics?.successRate || 0) * (b.performanceMetrics?.userSatisfactionScore || 0)
      return scoreB - scoreA
    })[0]

    return bestTemplate
  }

  /**
   * Get all templates for a task type
   */
  getTemplatesForTask(taskType: string): PromptTemplate[] {
    return this.templates.get(taskType) || []
  }

  /**
   * Update performance metrics for a template
   */
  updatePerformanceMetrics(
    templateId: string, 
    version: string, 
    metrics: Partial<PromptPerformanceMetrics>
  ): void {
    const key = `${templateId}:${version}`
    const existing = this.performanceMetrics.get(key)
    
    const updated: PromptPerformanceMetrics = {
      templateId,
      version,
      successRate: metrics.successRate ?? existing?.successRate ?? 0,
      averageResponseTime: metrics.averageResponseTime ?? existing?.averageResponseTime ?? 0,
      userSatisfactionScore: metrics.userSatisfactionScore ?? existing?.userSatisfactionScore ?? 0,
      costPerRequest: metrics.costPerRequest ?? existing?.costPerRequest ?? 0,
      totalRequests: (existing?.totalRequests ?? 0) + (metrics.totalRequests ?? 1),
      successfulRequests: (existing?.successfulRequests ?? 0) + (metrics.successfulRequests ?? 0),
      failedRequests: (existing?.failedRequests ?? 0) + (metrics.failedRequests ?? 0),
      lastUpdated: new Date(),
    }

    // Recalculate success rate
    if (updated.totalRequests > 0) {
      updated.successRate = updated.successfulRequests / updated.totalRequests
    }

    this.performanceMetrics.set(key, updated)
    
    // Update the template's performance metrics
    const taskTemplates = this.templates.get(this.findTaskTypeForTemplate(templateId)) || []
    const template = taskTemplates.find(t => t.id === templateId && t.version === version)
    if (template) {
      template.performanceMetrics = {
        successRate: updated.successRate,
        averageResponseTime: updated.averageResponseTime,
        userSatisfactionScore: updated.userSatisfactionScore,
        costPerRequest: updated.costPerRequest,
        lastUpdated: updated.lastUpdated,
      }
    }

    console.log(`📊 Updated performance metrics for ${templateId} v${version}:`, {
      successRate: updated.successRate,
      userSatisfactionScore: updated.userSatisfactionScore,
      totalRequests: updated.totalRequests,
    })
  }

  /**
   * Start an A/B test between two template versions
   */
  startABTest(config: ABTestConfig): void {
    this.abTestConfigs.set(config.taskType, config)
    console.log(`🧪 Started A/B test for ${config.taskType}: ${config.templateA} vs ${config.templateB}`)
  }

  /**
   * Stop an A/B test and promote the winner
   */
  stopABTest(taskType: string): ABTestResult | null {
    const config = this.abTestConfigs.get(taskType)
    if (!config) {
      console.warn(`⚠️ No A/B test found for task type: ${taskType}`)
      return null
    }

    const metricsA = this.performanceMetrics.get(`${config.templateA}:${config.versionA}`)
    const metricsB = this.performanceMetrics.get(`${config.templateB}:${config.versionB}`)

    if (!metricsA || !metricsB) {
      console.warn(`⚠️ Insufficient metrics data for A/B test: ${taskType}`)
      return null
    }

    // Calculate composite scores
    const scoreA = metricsA.successRate * metricsA.userSatisfactionScore
    const scoreB = metricsB.successRate * metricsB.userSatisfactionScore

    const winner = scoreA > scoreB ? 'A' : 'B'
    const winnerTemplate = winner === 'A' ? config.templateA : config.templateB
    const winnerVersion = winner === 'A' ? config.versionA : config.versionB

    // Deactivate the losing template
    const loserTemplate = winner === 'A' ? config.templateB : config.templateA
    const loserVersion = winner === 'A' ? config.versionB : config.versionA
    this.deactivateTemplate(loserTemplate, loserVersion)

    // Mark test as complete
    config.isActive = false
    config.completedAt = new Date()
    config.winner = winner

    const result: ABTestResult = {
      taskType,
      winner,
      winnerTemplate,
      winnerVersion,
      scoreA,
      scoreB,
      improvement: Math.abs(scoreA - scoreB) / Math.min(scoreA, scoreB),
      completedAt: new Date(),
    }

    console.log(`🏆 A/B test completed for ${taskType}. Winner: Template ${winner} (${winnerTemplate} v${winnerVersion})`)
    
    return result
  }

  /**
   * Get performance metrics for a template
   */
  getPerformanceMetrics(templateId: string, version: string): PromptPerformanceMetrics | null {
    return this.performanceMetrics.get(`${templateId}:${version}`) || null
  }

  /**
   * Deactivate a template
   */
  private deactivateTemplate(templateId: string, version: string): void {
    const taskType = this.findTaskTypeForTemplate(templateId)
    const taskTemplates = this.templates.get(taskType) || []
    const template = taskTemplates.find(t => t.id === templateId && t.version === version)
    
    if (template) {
      template.isActive = false
      console.log(`🚫 Deactivated template: ${templateId} v${version}`)
    }
  }

  /**
   * Find task type for a template ID
   */
  private findTaskTypeForTemplate(templateId: string): string {
    for (const [taskType, templates] of Array.from(this.templates.entries())) {
      if (templates.some(t => t.id === templateId)) {
        return taskType
      }
    }
    return ''
  }

  /**
   * Select template for A/B test based on traffic split
   */
  private selectTemplateForABTest(taskType: string, config: ABTestConfig): PromptTemplate | null {
    const random = Math.random()
    const useTemplateA = random < config.trafficSplit

    const templateId = useTemplateA ? config.templateA : config.templateB
    const version = useTemplateA ? config.versionA : config.versionB

    const taskTemplates = this.templates.get(taskType) || []
    return taskTemplates.find(t => t.id === templateId && t.version === version) || null
  }

  /**
   * Initialize default templates for common AI tasks
   */
  private initializeDefaultTemplates(): void {
    // Commander Selection Template
    this.registerTemplate({
      id: 'commander-selection',
      name: 'Commander Selection',
      version: '1.0',
      taskType: 'commander-selection',
      modelType: 'gpt-3.5-turbo',
      systemPrompt: `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering commander specialist.

Based on the user's preferences, recommend exactly 5 legendary creatures that can be used as commanders.

CRITICAL REQUIREMENTS:
- ONLY recommend legendary creatures that can legally be commanders
- Each recommendation must be a real Magic: The Gathering legendary creature
- Consider the user's specified preferences for colors, strategy, power level, and budget
- Provide diverse options with different strategies and color combinations

RESPONSE FORMAT: You MUST respond with ONLY a valid JSON array, no other text.`,
      template: `Recommend 5 commanders based on these preferences:

Strategy: {{strategy}}
Colors: {{colors}}
Power Level: Bracket {{powerLevel}} (1=Precon, 2=Focused, 3=Optimized, 4=High Power)
Budget: {{budget}}
Themes: {{themes}}

{{#if avoidStrategies}}
Avoid these strategies: {{avoidStrategies}}
{{/if}}

{{#if petCards}}
Consider including synergy with these cards: {{petCards}}
{{/if}}

Provide exactly 5 diverse commander options with different strategies and color combinations.`,
      variables: [
        {
          name: 'strategy',
          type: 'string',
          required: false,
          description: 'Primary strategy preference',
        },
        {
          name: 'colors',
          type: 'array',
          required: false,
          description: 'Preferred color identity',
        },
        {
          name: 'powerLevel',
          type: 'number',
          required: true,
          description: 'Power level bracket (1-4)',
          defaultValue: 3,
        },
        {
          name: 'budget',
          type: 'number',
          required: false,
          description: 'Budget constraint in USD',
        },
        {
          name: 'themes',
          type: 'array',
          required: false,
          description: 'Preferred themes or mechanics',
        },
        {
          name: 'avoidStrategies',
          type: 'array',
          required: false,
          description: 'Strategies to avoid',
        },
        {
          name: 'petCards',
          type: 'array',
          required: false,
          description: 'Favorite cards to build around',
        },
      ],
      tags: ['commander', 'selection', 'lightweight'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Deck Optimization Template
    this.registerTemplate({
      id: 'deck-optimization',
      name: 'Deck Optimization',
      version: '1.0',
      taskType: 'deck-optimization',
      modelType: 'gpt-4',
      systemPrompt: `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering deck builder specializing in Commander format optimization.

Your task is to analyze a deck and provide specific optimization recommendations based on the deck's strategy, meta position, and user preferences.

Focus on:
- Identifying strategic weaknesses and gaps
- Suggesting specific card replacements with reasoning
- Optimizing mana curve and card synergies
- Considering budget constraints and collection availability
- Adapting to current meta trends

Provide actionable, specific recommendations with clear reasoning.`,
      template: `Analyze and optimize this Commander deck:

Commander: {{commander}}
Strategy: {{strategy}}
Power Level: Bracket {{powerLevel}}
Budget: {{budget}}

Current Deck Composition:
{{#each categories}}
{{name}}: {{actualCount}}/{{targetCount}} cards
{{/each}}

Key Cards:
{{#each keyCards}}
- {{name}} ({{category}})
{{/each}}

{{#if weaknesses}}
Known Weaknesses:
{{#each weaknesses}}
- {{this}}
{{/each}}
{{/if}}

{{#if metaContext}}
Meta Context:
- Popular strategies: {{metaContext.popularStrategies}}
- Common threats: {{metaContext.commonThreats}}
{{/if}}

Provide specific optimization recommendations including:
1. Card replacements with reasoning
2. Mana curve adjustments
3. Strategic improvements
4. Budget alternatives if applicable`,
      variables: [
        {
          name: 'commander',
          type: 'string',
          required: true,
          description: 'Commander card name',
        },
        {
          name: 'strategy',
          type: 'object',
          required: true,
          description: 'Deck strategy information',
        },
        {
          name: 'powerLevel',
          type: 'number',
          required: true,
          description: 'Target power level bracket',
        },
        {
          name: 'budget',
          type: 'number',
          required: false,
          description: 'Budget constraint for upgrades',
        },
        {
          name: 'categories',
          type: 'array',
          required: true,
          description: 'Deck categories with counts',
        },
        {
          name: 'keyCards',
          type: 'array',
          required: true,
          description: 'Important cards in the deck',
        },
        {
          name: 'weaknesses',
          type: 'array',
          required: false,
          description: 'Known deck weaknesses',
        },
        {
          name: 'metaContext',
          type: 'object',
          required: false,
          description: 'Current meta information',
        },
      ],
      researchContext: {
        researchDepth: 'deep',
        dataSources: ['edhrec', 'mtgtop8', 'tournament-results'],
        confidenceThreshold: 0.8,
      },
      tags: ['optimization', 'analysis', 'heavy-duty'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Research Template for Web Research Tasks
    this.registerTemplate({
      id: 'web-research',
      name: 'Web Research and Data Synthesis',
      version: '1.0',
      taskType: 'web-research',
      modelType: 'claude-3-sonnet',
      systemPrompt: `You are MoxMuse's research specialist, expert at synthesizing Magic: The Gathering data from multiple sources.

Your task is to research and analyze MTG data from various sources including:
- Tournament results and meta analysis
- Community discussions and insights
- Card performance data
- Price trends and market analysis

Provide comprehensive, well-sourced analysis with confidence ratings and citations.`,
      template: `Research and analyze: {{researchQuery}}

Focus Areas:
{{#each focusAreas}}
- {{this}}
{{/each}}

Data Sources to Consider:
{{#each dataSources}}
- {{this}}
{{/each}}

{{#if timeframe}}
Timeframe: {{timeframe}}
{{/if}}

{{#if specificCards}}
Specific Cards of Interest:
{{#each specificCards}}
- {{this}}
{{/each}}
{{/if}}

Provide:
1. Comprehensive analysis with data synthesis
2. Key findings with confidence ratings
3. Source citations and data quality assessment
4. Actionable insights and recommendations
5. Identification of data gaps or limitations`,
      variables: [
        {
          name: 'researchQuery',
          type: 'string',
          required: true,
          description: 'Main research question or topic',
        },
        {
          name: 'focusAreas',
          type: 'array',
          required: true,
          description: 'Specific areas to focus research on',
        },
        {
          name: 'dataSources',
          type: 'array',
          required: true,
          description: 'Preferred data sources',
        },
        {
          name: 'timeframe',
          type: 'string',
          required: false,
          description: 'Time period for research',
        },
        {
          name: 'specificCards',
          type: 'array',
          required: false,
          description: 'Specific cards to research',
        },
      ],
      researchContext: {
        researchDepth: 'deep',
        dataSources: ['edhrec', 'mtgtop8', 'reddit', 'discord', 'tournament-db'],
        confidenceThreshold: 0.9,
      },
      tags: ['research', 'analysis', 'data-synthesis'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    console.log('✅ Initialized default prompt templates')
  }
}

// A/B Testing Types
interface ABTestConfig {
  taskType: string
  templateA: string
  versionA: string
  templateB: string
  versionB: string
  trafficSplit: number // 0.5 = 50/50 split
  isActive: boolean
  startedAt: Date
  completedAt?: Date
  winner?: 'A' | 'B'
}

interface ABTestResult {
  taskType: string
  winner: 'A' | 'B'
  winnerTemplate: string
  winnerVersion: string
  scoreA: number
  scoreB: number
  improvement: number
  completedAt: Date
}

// Export singleton instance
export const promptRegistry = new PromptRegistry()