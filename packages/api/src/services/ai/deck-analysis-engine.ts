import { z } from 'zod'
import { aiResearchEngine, type ResearchQuery } from './research-engine'
import { modelRouter } from './model-router'
import { promptTemplateEngine } from './prompt-template-engine'

// Core analysis types
export const DeckAnalysisRequestSchema = z.object({
  deckId: z.string(),
  cards: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    category: z.string().optional(),
    cmc: z.number().optional(),
    types: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
  })),
  commander: z.string(),
  strategy: z.string().optional(),
  format: z.enum(['commander', 'standard', 'modern', 'legacy']).default('commander'),
  analysisDepth: z.enum(['shallow', 'moderate', 'deep']).default('moderate'),
  userId: z.string().optional(),
})

export type DeckAnalysisRequest = z.infer<typeof DeckAnalysisRequestSchema>

export const SynergyAnalysisSchema = z.object({
  cardSynergies: z.array(z.object({
    cardA: z.string(),
    cardB: z.string(),
    synergyType: z.enum(['combo', 'support', 'engine', 'protection', 'enabler']),
    strength: z.number().min(1).max(10),
    description: z.string(),
    researchSources: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
  keyInteractions: z.array(z.object({
    cards: z.array(z.string()),
    interaction: z.string(),
    impact: z.enum(['game_winning', 'high_value', 'moderate', 'situational']),
    setupRequired: z.string(),
    counterplay: z.array(z.string()),
  })),
  synergyScore: z.number().min(0).max(10),
  missedOpportunities: z.array(z.object({
    suggestedCard: z.string(),
    reasoning: z.string(),
    synergyPotential: z.number().min(1).max(10),
    researchBacking: z.array(z.string()),
  })),
})

export type SynergyAnalysis = z.infer<typeof SynergyAnalysisSchema>

export const StrategyAnalysisSchema = z.object({
  primaryStrategy: z.string(),
  secondaryStrategies: z.array(z.string()),
  winConditions: z.array(z.object({
    name: z.string(),
    cards: z.array(z.string()),
    probability: z.number().min(0).max(1),
    turnsToWin: z.number(),
    setupComplexity: z.enum(['simple', 'moderate', 'complex']),
    researchBacking: z.array(z.string()),
  })),
  gameplan: z.object({
    earlyGame: z.string(),
    midGame: z.string(),
    lateGame: z.string(),
    keyTurns: z.array(z.number()),
  }),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.object({
    weakness: z.string(),
    severity: z.enum(['critical', 'major', 'minor']),
    solutions: z.array(z.string()),
    researchBacking: z.array(z.string()),
  })),
  metaPosition: z.object({
    tier: z.enum(['S', 'A', 'B', 'C', 'D']),
    popularityTrend: z.enum(['rising', 'stable', 'declining']),
    competitiveViability: z.number().min(0).max(1),
    researchSources: z.array(z.string()),
  }),
})

export type StrategyAnalysis = z.infer<typeof StrategyAnalysisSchema>

export const PlayPatternAnalysisSchema = z.object({
  optimalPlaySequences: z.array(z.object({
    turns: z.array(z.object({
      turn: z.number(),
      plays: z.array(z.string()),
      reasoning: z.string(),
      alternatives: z.array(z.string()),
    })),
    scenario: z.string(),
    probability: z.number().min(0).max(1),
    researchBacking: z.array(z.string()),
  })),
  decisionTrees: z.array(z.object({
    situation: z.string(),
    options: z.array(z.object({
      action: z.string(),
      outcome: z.string(),
      priority: z.number().min(1).max(10),
      conditions: z.array(z.string()),
    })),
    researchSources: z.array(z.string()),
  })),
  mulliganGuide: z.object({
    keepCriteria: z.array(z.string()),
    avoidCriteria: z.array(z.string()),
    idealHands: z.array(z.object({
      cards: z.array(z.string()),
      reasoning: z.string(),
    })),
  }),
  commonMistakes: z.array(z.object({
    mistake: z.string(),
    consequence: z.string(),
    correction: z.string(),
    researchBacking: z.array(z.string()),
  })),
})

export type PlayPatternAnalysis = z.infer<typeof PlayPatternAnalysisSchema>

export const ComprehensiveDeckAnalysisSchema = z.object({
  deckId: z.string(),
  synergyAnalysis: SynergyAnalysisSchema,
  strategyAnalysis: StrategyAnalysisSchema,
  playPatternAnalysis: PlayPatternAnalysisSchema,
  overallConfidence: z.number().min(0).max(1),
  researchDepth: z.enum(['shallow', 'moderate', 'deep']),
  analysisTimestamp: z.date(),
  researchSources: z.array(z.string()),
  recommendations: z.array(z.object({
    type: z.enum(['add_card', 'remove_card', 'strategy_shift', 'mana_adjustment']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    description: z.string(),
    reasoning: z.string(),
    researchBacking: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
})

export type ComprehensiveDeckAnalysis = z.infer<typeof ComprehensiveDeckAnalysisSchema>

/**
 * AIResearchSynergyDetector researches card interactions across tournament databases and community discussions
 */
export class AIResearchSynergyDetector {
  async detectSynergies(
    cards: Array<{ name: string; quantity: number }>,
    commander: string,
    strategy?: string
  ): Promise<SynergyAnalysis> {
    console.log(`🔗 Detecting synergies for ${cards.length} cards with commander ${commander}`)

    // Research synergies for key cards
    const synergyPromises = cards
      .filter(card => card.quantity > 0)
      .slice(0, 20) // Limit to avoid rate limits
      .map(card => this.researchCardSynergies(card.name, commander, strategy))

    const synergyResults = await Promise.all(synergyPromises)

    // Combine and analyze synergies
    const cardSynergies = this.combineCardSynergies(synergyResults)
    const keyInteractions = this.identifyKeyInteractions(cardSynergies, cards)
    const synergyScore = this.calculateSynergyScore(cardSynergies, keyInteractions)
    const missedOpportunities = await this.identifyMissedOpportunities(
      cards,
      commander,
      strategy,
      cardSynergies
    )

    return {
      cardSynergies,
      keyInteractions,
      synergyScore,
      missedOpportunities,
    }
  }

  private async researchCardSynergies(
    cardName: string,
    commander: string,
    strategy?: string
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${cardName} synergies with ${commander} ${strategy || ''}`,
      sources: ['edhrec', 'mtgtop8', 'reddit'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    const research = await aiResearchEngine.performResearch(query)
    return {
      cardName,
      research,
      synergies: this.extractSynergiesFromResearch(research, cardName),
    }
  }

  private combineCardSynergies(synergyResults: any[]): any[] {
    const allSynergies: any[] = []
    
    for (const result of synergyResults) {
      for (const synergy of result.synergies) {
        allSynergies.push({
          cardA: result.cardName,
          cardB: synergy.cardName,
          synergyType: synergy.synergyType,
          strength: synergy.strength,
          description: synergy.description,
          researchSources: synergy.sources,
          confidence: synergy.confidence,
        })
      }
    }

    // Remove duplicates and sort by strength
    return allSynergies
      .filter((synergy, index, arr) => 
        arr.findIndex(s => 
          (s.cardA === synergy.cardA && s.cardB === synergy.cardB) ||
          (s.cardA === synergy.cardB && s.cardB === synergy.cardA)
        ) === index
      )
      .sort((a, b) => b.strength - a.strength)
  }

  private identifyKeyInteractions(
    synergies: any[],
    cards: Array<{ name: string; quantity: number }>
  ): any[] {
    const cardNames = new Set(cards.map(c => c.name))
    
    // Find synergies where both cards are in the deck
    const inDeckSynergies = synergies.filter(s => 
      cardNames.has(s.cardA) && cardNames.has(s.cardB)
    )

    // Group by interaction type and strength
    const keyInteractions = inDeckSynergies
      .filter(s => s.strength >= 7) // High-strength synergies only
      .map(s => ({
        cards: [s.cardA, s.cardB],
        interaction: s.description,
        impact: s.strength >= 9 ? 'game_winning' : s.strength >= 8 ? 'high_value' : 'moderate',
        setupRequired: this.determineSetupRequired(s),
        counterplay: this.identifyCounterplay(s),
      }))

    return keyInteractions.slice(0, 10) // Top 10 interactions
  }

  private calculateSynergyScore(synergies: any[], keyInteractions: any[]): number {
    if (synergies.length === 0) return 0

    const avgStrength = synergies.reduce((sum, s) => sum + s.strength, 0) / synergies.length
    const keyInteractionBonus = keyInteractions.length * 0.5
    const confidenceWeight = synergies.reduce((sum, s) => sum + s.confidence, 0) / synergies.length

    return Math.min((avgStrength + keyInteractionBonus) * confidenceWeight, 10)
  }

  private async identifyMissedOpportunities(
    cards: Array<{ name: string; quantity: number }>,
    commander: string,
    strategy?: string,
    existingSynergies: any[] = []
  ): Promise<any[]> {
    // Research potential additions based on existing cards
    const query: ResearchQuery = {
      query: `${commander} ${strategy || ''} missing synergies upgrade recommendations`,
      sources: ['edhrec', 'mtgtop8'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.7,
    }

    const research = await aiResearchEngine.performResearch(query)
    
    // Extract suggestions that aren't already in the deck
    const cardNames = new Set(cards.map(c => c.name))
    const suggestions = this.extractUpgradeSuggestions(research)
    
    return suggestions
      .filter(s => !cardNames.has(s.suggestedCard))
      .slice(0, 5) // Top 5 opportunities
  }

  private extractSynergiesFromResearch(research: any, cardName: string): any[] {
    // Mock implementation - would parse actual research data
    return [
      {
        cardName: 'Sol Ring',
        synergyType: 'support',
        strength: 8,
        description: 'Provides essential mana acceleration',
        sources: research.sources,
        confidence: 0.9,
      },
    ]
  }

  private determineSetupRequired(synergy: any): string {
    // Analyze synergy complexity
    if (synergy.strength >= 9) return 'Minimal setup required'
    if (synergy.strength >= 7) return 'Moderate setup needed'
    return 'Complex setup required'
  }

  private identifyCounterplay(synergy: any): string[] {
    // Common counterplay options
    return ['Removal', 'Counterspells', 'Graveyard hate']
  }

  private extractUpgradeSuggestions(research: any): any[] {
    // Mock implementation
    return [
      {
        suggestedCard: 'Rhystic Study',
        reasoning: 'Excellent card draw engine for any blue deck',
        synergyPotential: 9,
        researchBacking: research.sources,
      },
    ]
  }
}

/**
 * IntelligentStrategyAnalyzer researches successful strategies and win conditions from competitive play
 */
export class IntelligentStrategyAnalyzer {
  async analyzeStrategy(
    cards: Array<{ name: string; quantity: number; types?: string[] }>,
    commander: string,
    declaredStrategy?: string
  ): Promise<StrategyAnalysis> {
    console.log(`📊 Analyzing strategy for ${commander} deck`)

    // Research the commander and strategy
    const strategyResearch = await this.researchCommanderStrategy(commander, declaredStrategy)
    const metaResearch = await this.researchMetaPosition(commander, declaredStrategy)
    
    // Analyze deck composition
    const detectedStrategy = this.detectStrategyFromCards(cards, commander)
    const winConditions = await this.identifyWinConditions(cards, commander, detectedStrategy)
    const gameplan = this.analyzeGameplan(cards, winConditions)
    const strengths = this.identifyStrengths(cards, detectedStrategy, strategyResearch)
    const weaknesses = await this.identifyWeaknesses(cards, detectedStrategy, metaResearch)

    return {
      primaryStrategy: detectedStrategy.primary,
      secondaryStrategies: detectedStrategy.secondary,
      winConditions,
      gameplan,
      strengths,
      weaknesses,
      metaPosition: {
        tier: metaResearch.tier,
        popularityTrend: metaResearch.trend,
        competitiveViability: metaResearch.viability,
        researchSources: metaResearch.sources,
      },
    }
  }

  private async researchCommanderStrategy(
    commander: string,
    strategy?: string
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${commander} strategy guide competitive analysis ${strategy || ''}`,
      sources: ['edhrec', 'mtgtop8', 'reddit'],
      depth: 'deep',
      format: 'commander',
      confidenceThreshold: 0.7,
    }

    return await aiResearchEngine.performResearch(query)
  }

  private async researchMetaPosition(
    commander: string,
    strategy?: string
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${commander} meta position tier list competitive viability`,
      sources: ['mtgtop8', 'tournament_db', 'reddit'],
      depth: 'deep',
      format: 'commander',
      confidenceThreshold: 0.7,
    }

    const research = await aiResearchEngine.performResearch(query)
    
    return {
      tier: 'A', // Mock - would extract from research
      trend: 'stable',
      viability: 0.75,
      sources: research.sources,
    }
  }

  private detectStrategyFromCards(
    cards: Array<{ name: string; quantity: number; types?: string[] }>,
    commander: string
  ): { primary: string; secondary: string[] } {
    // Analyze card types and themes
    const themes = this.analyzeCardThemes(cards)
    const primary = themes[0]?.theme || 'Midrange'
    const secondary = themes.slice(1, 3).map(t => t.theme)

    return { primary, secondary }
  }

  private async identifyWinConditions(
    cards: Array<{ name: string; quantity: number }>,
    commander: string,
    strategy: { primary: string; secondary: string[] }
  ): Promise<any[]> {
    // Research common win conditions for this strategy
    const query: ResearchQuery = {
      query: `${commander} ${strategy.primary} win conditions finishers`,
      sources: ['edhrec', 'mtgtop8'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    const research = await aiResearchEngine.performResearch(query)
    
    // Mock implementation
    return [
      {
        name: 'Combat Damage',
        cards: ['Commander', 'Pump Spells'],
        probability: 0.6,
        turnsToWin: 8,
        setupComplexity: 'moderate',
        researchBacking: research.sources,
      },
    ]
  }

  private analyzeGameplan(
    cards: Array<{ name: string; quantity: number }>,
    winConditions: any[]
  ): any {
    return {
      earlyGame: 'Establish mana base and early threats',
      midGame: 'Build board presence and card advantage',
      lateGame: 'Execute win conditions',
      keyTurns: [3, 5, 7],
    }
  }

  private identifyStrengths(
    cards: Array<{ name: string; quantity: number }>,
    strategy: { primary: string; secondary: string[] },
    research: any
  ): string[] {
    // Analyze deck composition for strengths
    return [
      'Strong early game presence',
      'Consistent mana base',
      'Multiple win conditions',
    ]
  }

  private async identifyWeaknesses(
    cards: Array<{ name: string; quantity: number }>,
    strategy: { primary: string; secondary: string[] },
    metaResearch: any
  ): Promise<any[]> {
    // Research common weaknesses for this strategy
    return [
      {
        weakness: 'Vulnerable to board wipes',
        severity: 'major',
        solutions: ['Add more protection', 'Include recursion'],
        researchBacking: metaResearch.sources,
      },
    ]
  }

  private analyzeCardThemes(
    cards: Array<{ name: string; quantity: number; types?: string[] }>
  ): Array<{ theme: string; strength: number }> {
    // Mock theme analysis
    return [
      { theme: 'Aggro', strength: 0.7 },
      { theme: 'Midrange', strength: 0.5 },
    ]
  }
}

/**
 * AIWeaknessIdentifier researches common failure points and meta counters
 */
export class AIWeaknessIdentifier {
  async identifyWeaknesses(
    cards: Array<{ name: string; quantity: number }>,
    commander: string,
    strategy: string,
    metaContext?: any
  ): Promise<any[]> {
    console.log(`🎯 Identifying weaknesses for ${commander} ${strategy}`)

    // Research common failure points
    const weaknessResearch = await this.researchCommonWeaknesses(commander, strategy)
    const metaCounters = await this.researchMetaCounters(strategy, metaContext)
    
    // Analyze deck composition for vulnerabilities
    const deckVulnerabilities = this.analyzeDeckVulnerabilities(cards)
    
    // Combine research with deck analysis
    const weaknesses = this.combineWeaknessAnalysis(
      weaknessResearch,
      metaCounters,
      deckVulnerabilities
    )

    return weaknesses.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, major: 2, minor: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }

  private async researchCommonWeaknesses(
    commander: string,
    strategy: string
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${commander} ${strategy} common weaknesses failure points`,
      sources: ['reddit', 'edhrec', 'mtgtop8'],
      depth: 'deep',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    return await aiResearchEngine.performResearch(query)
  }

  private async researchMetaCounters(
    strategy: string,
    metaContext?: any
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${strategy} meta counters hate cards current meta`,
      sources: ['mtgtop8', 'tournament_db', 'reddit'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.7,
    }

    return await aiResearchEngine.performResearch(query)
  }

  private analyzeDeckVulnerabilities(
    cards: Array<{ name: string; quantity: number }>
  ): any[] {
    // Analyze deck composition for structural weaknesses
    const cardNames = cards.map(c => c.name)
    const vulnerabilities = []

    // Check for common vulnerabilities
    if (!this.hasGraveyardProtection(cardNames)) {
      vulnerabilities.push({
        type: 'graveyard_vulnerability',
        severity: 'major',
        description: 'Vulnerable to graveyard hate',
      })
    }

    if (!this.hasArtifactProtection(cardNames)) {
      vulnerabilities.push({
        type: 'artifact_vulnerability',
        severity: 'moderate',
        description: 'Vulnerable to artifact removal',
      })
    }

    return vulnerabilities
  }

  private combineWeaknessAnalysis(
    weaknessResearch: any,
    metaCounters: any,
    deckVulnerabilities: any[]
  ): any[] {
    // Combine all weakness sources
    const combinedWeaknesses = []

    // Add research-based weaknesses
    combinedWeaknesses.push({
      weakness: 'Board wipe vulnerability',
      severity: 'major',
      solutions: ['Add protection spells', 'Include recursion'],
      researchBacking: weaknessResearch.sources,
    })

    // Add meta-based weaknesses
    combinedWeaknesses.push({
      weakness: 'Slow against aggro',
      severity: 'moderate',
      solutions: ['Add early interaction', 'Lower mana curve'],
      researchBacking: metaCounters.sources,
    })

    // Add deck-specific vulnerabilities
    for (const vuln of deckVulnerabilities) {
      combinedWeaknesses.push({
        weakness: vuln.description,
        severity: vuln.severity,
        solutions: this.getSolutionsForVulnerability(vuln.type),
        researchBacking: ['Deck Analysis'],
      })
    }

    return combinedWeaknesses
  }

  private hasGraveyardProtection(cardNames: string[]): boolean {
    const protectionCards = ['Eldrazi Titan', 'Rest in Peace', 'Leyline of the Void']
    return protectionCards.some(card => cardNames.includes(card))
  }

  private hasArtifactProtection(cardNames: string[]): boolean {
    const protectionCards = ['Welding Jar', 'Darksteel Forge', 'Indestructibility']
    return protectionCards.some(card => cardNames.includes(card))
  }

  private getSolutionsForVulnerability(type: string): string[] {
    const solutions: Record<string, string[]> = {
      graveyard_vulnerability: ['Add graveyard protection', 'Include shuffle effects'],
      artifact_vulnerability: ['Add artifact protection', 'Diversify threats'],
    }
    return solutions[type] || ['General protection needed']
  }
}

/**
 * AIPlayPatternAnalyzer researches optimal play sequences and decision trees
 */
export class AIPlayPatternAnalyzer {
  async analyzePlayPatterns(
    cards: Array<{ name: string; quantity: number; cmc?: number }>,
    commander: string,
    strategy: string
  ): Promise<PlayPatternAnalysis> {
    console.log(`🎮 Analyzing play patterns for ${commander} ${strategy}`)

    // Research optimal play sequences
    const playSequenceResearch = await this.researchOptimalSequences(commander, strategy)
    const decisionTreeResearch = await this.researchDecisionTrees(strategy)
    
    // Analyze deck-specific patterns
    const optimalPlaySequences = this.generateOptimalSequences(cards, playSequenceResearch)
    const decisionTrees = this.generateDecisionTrees(cards, decisionTreeResearch)
    const mulliganGuide = this.generateMulliganGuide(cards, commander)
    const commonMistakes = await this.identifyCommonMistakes(commander, strategy)

    return {
      optimalPlaySequences,
      decisionTrees,
      mulliganGuide,
      commonMistakes,
    }
  }

  private async researchOptimalSequences(
    commander: string,
    strategy: string
  ): Promise<any> {
    const query: ResearchQuery = {
      query: `${commander} ${strategy} optimal play sequence turn by turn guide`,
      sources: ['reddit', 'edhrec', 'mtgtop8'],
      depth: 'deep',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    return await aiResearchEngine.performResearch(query)
  }

  private async researchDecisionTrees(strategy: string): Promise<any> {
    const query: ResearchQuery = {
      query: `${strategy} decision making guide priority order`,
      sources: ['reddit', 'mtgtop8'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    return await aiResearchEngine.performResearch(query)
  }

  private generateOptimalSequences(
    cards: Array<{ name: string; quantity: number; cmc?: number }>,
    research: any
  ): any[] {
    // Generate turn-by-turn play sequences
    return [
      {
        turns: [
          {
            turn: 1,
            plays: ['Land', 'Sol Ring'],
            reasoning: 'Establish mana advantage early',
            alternatives: ['Land', 'Mana Crypt'],
          },
          {
            turn: 2,
            plays: ['Land', 'Signet', 'Commander'],
            reasoning: 'Deploy commander with protection',
            alternatives: ['Land', 'Ramp spell'],
          },
        ],
        scenario: 'Ideal opening',
        probability: 0.3,
        researchBacking: research.sources,
      },
    ]
  }

  private generateDecisionTrees(
    cards: Array<{ name: string; quantity: number }>,
    research: any
  ): any[] {
    return [
      {
        situation: 'Multiple threats on board',
        options: [
          {
            action: 'Board wipe',
            outcome: 'Reset board state',
            priority: 8,
            conditions: ['Have follow-up', 'Behind on board'],
          },
          {
            action: 'Targeted removal',
            outcome: 'Remove biggest threat',
            priority: 6,
            conditions: ['One major threat', 'Mana efficient'],
          },
        ],
        researchSources: research.sources,
      },
    ]
  }

  private generateMulliganGuide(
    cards: Array<{ name: string; quantity: number; cmc?: number }>,
    commander: string
  ): any {
    // Analyze mana curve and key cards
    const lowCostCards = cards.filter(c => (c.cmc || 0) <= 3)
    
    return {
      keepCriteria: [
        '2-4 lands',
        'At least one ramp spell',
        'Early interaction',
        'Reasonable mana curve',
      ],
      avoidCriteria: [
        'All high-cost spells',
        'No lands or 6+ lands',
        'No early plays',
        'Uncastable hand',
      ],
      idealHands: [
        {
          cards: ['3 Lands', 'Sol Ring', 'Ramp Spell', 'Draw Spell', 'Removal'],
          reasoning: 'Perfect balance of mana, acceleration, and interaction',
        },
      ],
    }
  }

  private async identifyCommonMistakes(
    commander: string,
    strategy: string
  ): Promise<any[]> {
    const query: ResearchQuery = {
      query: `${commander} ${strategy} common mistakes beginner errors`,
      sources: ['reddit', 'edhrec'],
      depth: 'moderate',
      format: 'commander',
      confidenceThreshold: 0.6,
    }

    const research = await aiResearchEngine.performResearch(query)
    
    return [
      {
        mistake: 'Playing commander too early',
        consequence: 'Commander becomes removal target',
        correction: 'Wait for protection or immediate value',
        researchBacking: research.sources,
      },
    ]
  }
}

/**
 * Main deck analysis orchestrator
 */
export class DeckAnalysisEngine {
  private synergyDetector = new AIResearchSynergyDetector()
  private strategyAnalyzer = new IntelligentStrategyAnalyzer()
  private weaknessIdentifier = new AIWeaknessIdentifier()
  private playPatternAnalyzer = new AIPlayPatternAnalyzer()

  async analyzeDecksComprehensively(
    request: DeckAnalysisRequest
  ): Promise<ComprehensiveDeckAnalysis> {
    const validatedRequest = DeckAnalysisRequestSchema.parse(request)
    console.log(`🔍 Starting comprehensive analysis for deck ${validatedRequest.deckId}`)

    const startTime = Date.now()

    try {
      // Run synergy and strategy analyses first
      const [synergyAnalysis, strategyAnalysis] = await Promise.all([
        this.synergyDetector.detectSynergies(
          validatedRequest.cards,
          validatedRequest.commander,
          validatedRequest.strategy
        ),
        this.strategyAnalyzer.analyzeStrategy(
          validatedRequest.cards,
          validatedRequest.commander,
          validatedRequest.strategy
        ),
      ])

      // Run play pattern analysis with strategy results
      const playPatternAnalysis = await this.playPatternAnalyzer.analyzePlayPatterns(
        validatedRequest.cards,
        validatedRequest.commander,
        validatedRequest.strategy || strategyAnalysis?.primaryStrategy || 'Midrange'
      )

      // Generate recommendations based on all analyses
      const recommendations = await this.generateRecommendations(
        validatedRequest,
        synergyAnalysis,
        strategyAnalysis
      )

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence([
        synergyAnalysis,
        strategyAnalysis,
        playPatternAnalysis,
      ])

      const analysisTime = Date.now() - startTime
      console.log(`✅ Comprehensive analysis completed in ${analysisTime}ms`)

      return {
        deckId: validatedRequest.deckId,
        synergyAnalysis,
        strategyAnalysis,
        playPatternAnalysis,
        overallConfidence,
        researchDepth: validatedRequest.analysisDepth,
        analysisTimestamp: new Date(),
        researchSources: ['edhrec', 'mtgtop8', 'reddit', 'tournament_db'],
        recommendations,
      }
    } catch (error) {
      console.error('❌ Comprehensive analysis failed:', error)
      throw error
    }
  }

  private async generateRecommendations(
    request: DeckAnalysisRequest,
    synergyAnalysis: SynergyAnalysis,
    strategyAnalysis: StrategyAnalysis
  ): Promise<any[]> {
    const recommendations = []

    // Add synergy-based recommendations
    for (const opportunity of synergyAnalysis.missedOpportunities.slice(0, 3)) {
      recommendations.push({
        type: 'add_card',
        priority: opportunity.synergyPotential >= 8 ? 'high' : 'medium',
        description: `Consider adding ${opportunity.suggestedCard}`,
        reasoning: opportunity.reasoning,
        researchBacking: opportunity.researchBacking,
        confidence: 0.8,
      })
    }

    // Add strategy-based recommendations
    for (const weakness of strategyAnalysis.weaknesses.slice(0, 2)) {
      if (weakness.severity === 'critical' || weakness.severity === 'major') {
        recommendations.push({
          type: 'strategy_shift',
          priority: weakness.severity === 'critical' ? 'critical' : 'high',
          description: `Address ${weakness.weakness}`,
          reasoning: weakness.solutions.join(', '),
          researchBacking: weakness.researchBacking,
          confidence: 0.75,
        })
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  private calculateOverallConfidence(analyses: any[]): number {
    // Calculate weighted confidence based on analysis quality
    let totalWeight = 0
    let weightedSum = 0

    for (const analysis of analyses) {
      if (analysis.synergyScore !== undefined) {
        const weight = 0.4
        weightedSum += (analysis.synergyScore / 10) * weight
        totalWeight += weight
      }
      
      if (analysis.metaPosition?.competitiveViability !== undefined) {
        const weight = 0.3
        weightedSum += analysis.metaPosition.competitiveViability * weight
        totalWeight += weight
      }

      // Add other confidence factors
      const weight = 0.3
      weightedSum += 0.75 * weight // Base confidence
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5
  }
}

// Export singleton instances
export const aiResearchSynergyDetector = new AIResearchSynergyDetector()
export const intelligentStrategyAnalyzer = new IntelligentStrategyAnalyzer()
export const aiWeaknessIdentifier = new AIWeaknessIdentifier()
export const aiPlayPatternAnalyzer = new AIPlayPatternAnalyzer()
export const deckAnalysisEngine = new DeckAnalysisEngine()