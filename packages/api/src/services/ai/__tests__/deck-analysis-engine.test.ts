import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DeckAnalysisEngine,
  AIResearchSynergyDetector,
  IntelligentStrategyAnalyzer,
  AIWeaknessIdentifier,
  AIPlayPatternAnalyzer,
  type DeckAnalysisRequest,
  type SynergyAnalysis,
  type StrategyAnalysis,
  type PlayPatternAnalysis,
  type ComprehensiveDeckAnalysis,
} from '../deck-analysis-engine'
import { aiResearchEngine } from '../research-engine'

// Mock the research engine
vi.mock('../research-engine', () => ({
  aiResearchEngine: {
    performResearch: vi.fn(),
  },
}))

describe('DeckAnalysisEngine', () => {
  let analysisEngine: DeckAnalysisEngine
  let mockResearchEngine: any

  beforeEach(() => {
    analysisEngine = new DeckAnalysisEngine()
    mockResearchEngine = aiResearchEngine as any
    
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup default mock responses
    mockResearchEngine.performResearch.mockResolvedValue({
      sources: ['edhrec', 'mtgtop8'],
      confidence: 0.8,
      data: {
        synergies: [],
        strategies: [],
        weaknesses: [],
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('analyzeDecksComprehensively', () => {
    const mockDeckRequest: DeckAnalysisRequest = {
      deckId: 'test-deck-123',
      cards: [
        { name: 'Sol Ring', quantity: 1, category: 'ramp', cmc: 1, types: ['Artifact'], colors: [] },
        { name: 'Lightning Bolt', quantity: 1, category: 'removal', cmc: 1, types: ['Instant'], colors: ['R'] },
        { name: 'Counterspell', quantity: 1, category: 'interaction', cmc: 2, types: ['Instant'], colors: ['U'] },
      ],
      commander: 'Izzet Commander',
      strategy: 'Spellslinger',
      format: 'commander',
      analysisDepth: 'moderate',
      userId: 'test-user',
    }

    it('should perform comprehensive deck analysis successfully', async () => {
      // Setup mock research responses
      mockResearchEngine.performResearch
        .mockResolvedValueOnce({
          sources: ['edhrec', 'mtgtop8'],
          confidence: 0.9,
          data: { synergies: [{ cardA: 'Sol Ring', cardB: 'Lightning Bolt', strength: 7 }] },
        })
        .mockResolvedValueOnce({
          sources: ['edhrec', 'reddit'],
          confidence: 0.8,
          data: { strategies: ['Spellslinger'], winConditions: ['Burn'] },
        })
        .mockResolvedValueOnce({
          sources: ['reddit', 'mtgtop8'],
          confidence: 0.7,
          data: { playPatterns: ['Early game control'] },
        })

      const result = await analysisEngine.analyzeDecksComprehensively(mockDeckRequest)

      expect(result).toBeDefined()
      expect(result.deckId).toBe('test-deck-123')
      expect(result.synergyAnalysis).toBeDefined()
      expect(result.strategyAnalysis).toBeDefined()
      expect(result.playPatternAnalysis).toBeDefined()
      expect(result.overallConfidence).toBeGreaterThan(0)
      expect(result.overallConfidence).toBeLessThanOrEqual(1)
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.researchSources).toContain('edhrec')
      expect(result.analysisTimestamp).toBeInstanceOf(Date)
    })

    it('should validate input parameters', async () => {
      const invalidRequest = {
        ...mockDeckRequest,
        deckId: '', // Invalid empty deck ID
      }

      await expect(analysisEngine.analyzeDecksComprehensively(invalidRequest))
        .rejects.toThrow()
    })

    it('should handle research engine failures gracefully', async () => {
      mockResearchEngine.performResearch.mockRejectedValue(new Error('Research failed'))

      await expect(analysisEngine.analyzeDecksComprehensively(mockDeckRequest))
        .rejects.toThrow('Research failed')
    })

    it('should generate appropriate recommendations based on analysis', async () => {
      // Setup mock for missed opportunities
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['edhrec'],
        confidence: 0.8,
        data: {
          missedOpportunities: [
            {
              suggestedCard: 'Rhystic Study',
              reasoning: 'Excellent card draw',
              synergyPotential: 9,
            },
          ],
          weaknesses: [
            {
              weakness: 'Vulnerable to board wipes',
              severity: 'major',
              solutions: ['Add protection'],
            },
          ],
        },
      })

      const result = await analysisEngine.analyzeDecksComprehensively(mockDeckRequest)

      expect(result.recommendations).toHaveLength(2)
      expect(result.recommendations[0].type).toBe('add_card')
      expect(result.recommendations[1].type).toBe('strategy_shift')
    })

    it('should calculate confidence scores correctly', async () => {
      const result = await analysisEngine.analyzeDecksComprehensively(mockDeckRequest)

      expect(result.overallConfidence).toBeGreaterThanOrEqual(0)
      expect(result.overallConfidence).toBeLessThanOrEqual(1)
    })

    it('should handle different analysis depths', async () => {
      const shallowRequest = { ...mockDeckRequest, analysisDepth: 'shallow' as const }
      const deepRequest = { ...mockDeckRequest, analysisDepth: 'deep' as const }

      const shallowResult = await analysisEngine.analyzeDecksComprehensively(shallowRequest)
      const deepResult = await analysisEngine.analyzeDecksComprehensively(deepRequest)

      expect(shallowResult.researchDepth).toBe('shallow')
      expect(deepResult.researchDepth).toBe('deep')
    })
  })
})

describe('AIResearchSynergyDetector', () => {
  let synergyDetector: AIResearchSynergyDetector
  let mockResearchEngine: any

  beforeEach(() => {
    synergyDetector = new AIResearchSynergyDetector()
    mockResearchEngine = aiResearchEngine as any
    vi.clearAllMocks()
  })

  describe('detectSynergies', () => {
    const mockCards = [
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Lightning Bolt', quantity: 1 },
      { name: 'Counterspell', quantity: 1 },
    ]

    it('should detect card synergies successfully', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['edhrec', 'mtgtop8'],
        confidence: 0.8,
        data: { synergies: [] },
      })

      const result = await synergyDetector.detectSynergies(mockCards, 'Test Commander', 'Aggro')

      expect(result).toBeDefined()
      expect(result.cardSynergies).toBeInstanceOf(Array)
      expect(result.keyInteractions).toBeInstanceOf(Array)
      expect(result.synergyScore).toBeGreaterThanOrEqual(0)
      expect(result.synergyScore).toBeLessThanOrEqual(10)
      expect(result.missedOpportunities).toBeInstanceOf(Array)
    })

    it('should limit research to avoid rate limits', async () => {
      const manyCards = Array.from({ length: 50 }, (_, i) => ({
        name: `Card ${i}`,
        quantity: 1,
      }))

      await synergyDetector.detectSynergies(manyCards, 'Test Commander')

      // Should only research first 20 cards
      expect(mockResearchEngine.performResearch).toHaveBeenCalledTimes(20)
    })

    it('should calculate synergy scores correctly', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['edhrec'],
        confidence: 0.9,
        data: { synergies: [] },
      })

      const result = await synergyDetector.detectSynergies(mockCards, 'Test Commander')

      expect(typeof result.synergyScore).toBe('number')
      expect(result.synergyScore).toBeGreaterThanOrEqual(0)
      expect(result.synergyScore).toBeLessThanOrEqual(10)
    })

    it('should identify key interactions between cards in deck', async () => {
      const result = await synergyDetector.detectSynergies(mockCards, 'Test Commander')

      expect(result.keyInteractions).toBeInstanceOf(Array)
      result.keyInteractions.forEach(interaction => {
        expect(interaction).toHaveProperty('cards')
        expect(interaction).toHaveProperty('interaction')
        expect(interaction).toHaveProperty('impact')
        expect(['game_winning', 'high_value', 'moderate', 'situational']).toContain(interaction.impact)
      })
    })

    it('should suggest missed opportunities', async () => {
      const result = await synergyDetector.detectSynergies(mockCards, 'Test Commander')

      expect(result.missedOpportunities).toBeInstanceOf(Array)
      result.missedOpportunities.forEach(opportunity => {
        expect(opportunity).toHaveProperty('suggestedCard')
        expect(opportunity).toHaveProperty('reasoning')
        expect(opportunity).toHaveProperty('synergyPotential')
        expect(opportunity.synergyPotential).toBeGreaterThanOrEqual(1)
        expect(opportunity.synergyPotential).toBeLessThanOrEqual(10)
      })
    })
  })
})

describe('IntelligentStrategyAnalyzer', () => {
  let strategyAnalyzer: IntelligentStrategyAnalyzer
  let mockResearchEngine: any

  beforeEach(() => {
    strategyAnalyzer = new IntelligentStrategyAnalyzer()
    mockResearchEngine = aiResearchEngine as any
    vi.clearAllMocks()
  })

  describe('analyzeStrategy', () => {
    const mockCards = [
      { name: 'Sol Ring', quantity: 1, types: ['Artifact'] },
      { name: 'Lightning Bolt', quantity: 1, types: ['Instant'] },
      { name: 'Counterspell', quantity: 1, types: ['Instant'] },
    ]

    it('should analyze deck strategy successfully', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['edhrec', 'mtgtop8'],
        confidence: 0.8,
        data: { strategies: ['Control'], tier: 'A' },
      })

      const result = await strategyAnalyzer.analyzeStrategy(mockCards, 'Test Commander', 'Control')

      expect(result).toBeDefined()
      expect(result.primaryStrategy).toBeDefined()
      expect(result.secondaryStrategies).toBeInstanceOf(Array)
      expect(result.winConditions).toBeInstanceOf(Array)
      expect(result.gameplan).toBeDefined()
      expect(result.strengths).toBeInstanceOf(Array)
      expect(result.weaknesses).toBeInstanceOf(Array)
      expect(result.metaPosition).toBeDefined()
    })

    it('should detect strategy from card composition', async () => {
      const aggroCards = [
        { name: 'Lightning Bolt', quantity: 4, types: ['Instant'] },
        { name: 'Goblin Guide', quantity: 4, types: ['Creature'] },
        { name: 'Monastery Swiftspear', quantity: 4, types: ['Creature'] },
      ]

      const result = await strategyAnalyzer.analyzeStrategy(aggroCards, 'Aggro Commander')

      expect(result.primaryStrategy).toBeDefined()
      expect(typeof result.primaryStrategy).toBe('string')
    })

    it('should identify win conditions with probabilities', async () => {
      const result = await strategyAnalyzer.analyzeStrategy(mockCards, 'Test Commander')

      expect(result.winConditions).toBeInstanceOf(Array)
      result.winConditions.forEach(winCon => {
        expect(winCon).toHaveProperty('name')
        expect(winCon).toHaveProperty('cards')
        expect(winCon).toHaveProperty('probability')
        expect(winCon.probability).toBeGreaterThanOrEqual(0)
        expect(winCon.probability).toBeLessThanOrEqual(1)
        expect(winCon).toHaveProperty('turnsToWin')
        expect(['simple', 'moderate', 'complex']).toContain(winCon.setupComplexity)
      })
    })

    it('should analyze gameplan phases', async () => {
      const result = await strategyAnalyzer.analyzeStrategy(mockCards, 'Test Commander')

      expect(result.gameplan).toBeDefined()
      expect(result.gameplan).toHaveProperty('earlyGame')
      expect(result.gameplan).toHaveProperty('midGame')
      expect(result.gameplan).toHaveProperty('lateGame')
      expect(result.gameplan).toHaveProperty('keyTurns')
      expect(result.gameplan.keyTurns).toBeInstanceOf(Array)
    })

    it('should identify strengths and weaknesses', async () => {
      const result = await strategyAnalyzer.analyzeStrategy(mockCards, 'Test Commander')

      expect(result.strengths).toBeInstanceOf(Array)
      expect(result.weaknesses).toBeInstanceOf(Array)
      
      result.weaknesses.forEach(weakness => {
        expect(weakness).toHaveProperty('weakness')
        expect(weakness).toHaveProperty('severity')
        expect(['critical', 'major', 'minor']).toContain(weakness.severity)
        expect(weakness).toHaveProperty('solutions')
        expect(weakness.solutions).toBeInstanceOf(Array)
      })
    })

    it('should assess meta position', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['mtgtop8'],
        confidence: 0.9,
        data: { tier: 'A', trend: 'rising', viability: 0.8 },
      })

      const result = await strategyAnalyzer.analyzeStrategy(mockCards, 'Test Commander')

      expect(result.metaPosition).toBeDefined()
      expect(['S', 'A', 'B', 'C', 'D']).toContain(result.metaPosition.tier)
      expect(['rising', 'stable', 'declining']).toContain(result.metaPosition.popularityTrend)
      expect(result.metaPosition.competitiveViability).toBeGreaterThanOrEqual(0)
      expect(result.metaPosition.competitiveViability).toBeLessThanOrEqual(1)
    })
  })
})

describe('AIWeaknessIdentifier', () => {
  let weaknessIdentifier: AIWeaknessIdentifier
  let mockResearchEngine: any

  beforeEach(() => {
    weaknessIdentifier = new AIWeaknessIdentifier()
    mockResearchEngine = aiResearchEngine as any
    vi.clearAllMocks()
  })

  describe('identifyWeaknesses', () => {
    const mockCards = [
      { name: 'Sol Ring', quantity: 1 },
      { name: 'Lightning Bolt', quantity: 1 },
    ]

    it('should identify deck weaknesses successfully', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['reddit', 'edhrec'],
        confidence: 0.7,
        data: { weaknesses: ['Board wipe vulnerability'] },
      })

      const result = await weaknessIdentifier.identifyWeaknesses(
        mockCards,
        'Test Commander',
        'Aggro'
      )

      expect(result).toBeInstanceOf(Array)
      result.forEach(weakness => {
        expect(weakness).toHaveProperty('weakness')
        expect(weakness).toHaveProperty('severity')
        expect(['critical', 'major', 'minor']).toContain(weakness.severity)
        expect(weakness).toHaveProperty('solutions')
        expect(weakness.solutions).toBeInstanceOf(Array)
        expect(weakness).toHaveProperty('researchBacking')
      })
    })

    it('should prioritize weaknesses by severity', async () => {
      const result = await weaknessIdentifier.identifyWeaknesses(
        mockCards,
        'Test Commander',
        'Aggro'
      )

      // Should be sorted by severity (critical > major > minor)
      for (let i = 0; i < result.length - 1; i++) {
        const severityOrder = { critical: 3, major: 2, minor: 1 }
        const currentSeverity = severityOrder[result[i].severity]
        const nextSeverity = severityOrder[result[i + 1].severity]
        expect(currentSeverity).toBeGreaterThanOrEqual(nextSeverity)
      }
    })

    it('should identify structural vulnerabilities', async () => {
      const vulnerableCards = [
        { name: 'Artifact Creature', quantity: 1 },
        { name: 'Another Artifact', quantity: 1 },
      ]

      const result = await weaknessIdentifier.identifyWeaknesses(
        vulnerableCards,
        'Artifact Commander',
        'Artifacts'
      )

      expect(result.length).toBeGreaterThan(0)
    })

    it('should research meta counters', async () => {
      await weaknessIdentifier.identifyWeaknesses(mockCards, 'Test Commander', 'Aggro')

      expect(mockResearchEngine.performResearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('common weaknesses'),
        })
      )
      expect(mockResearchEngine.performResearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('meta counters'),
        })
      )
    })
  })
})

describe('AIPlayPatternAnalyzer', () => {
  let playPatternAnalyzer: AIPlayPatternAnalyzer
  let mockResearchEngine: any

  beforeEach(() => {
    playPatternAnalyzer = new AIPlayPatternAnalyzer()
    mockResearchEngine = aiResearchEngine as any
    vi.clearAllMocks()
  })

  describe('analyzePlayPatterns', () => {
    const mockCards = [
      { name: 'Sol Ring', quantity: 1, cmc: 1 },
      { name: 'Lightning Bolt', quantity: 1, cmc: 1 },
      { name: 'Counterspell', quantity: 1, cmc: 2 },
    ]

    it('should analyze play patterns successfully', async () => {
      mockResearchEngine.performResearch.mockResolvedValue({
        sources: ['reddit', 'edhrec'],
        confidence: 0.8,
        data: { playPatterns: [] },
      })

      const result = await playPatternAnalyzer.analyzePlayPatterns(
        mockCards,
        'Test Commander',
        'Control'
      )

      expect(result).toBeDefined()
      expect(result.optimalPlaySequences).toBeInstanceOf(Array)
      expect(result.decisionTrees).toBeInstanceOf(Array)
      expect(result.mulliganGuide).toBeDefined()
      expect(result.commonMistakes).toBeInstanceOf(Array)
    })

    it('should generate optimal play sequences', async () => {
      const result = await playPatternAnalyzer.analyzePlayPatterns(
        mockCards,
        'Test Commander',
        'Control'
      )

      expect(result.optimalPlaySequences).toBeInstanceOf(Array)
      result.optimalPlaySequences.forEach(sequence => {
        expect(sequence).toHaveProperty('turns')
        expect(sequence.turns).toBeInstanceOf(Array)
        expect(sequence).toHaveProperty('scenario')
        expect(sequence).toHaveProperty('probability')
        expect(sequence.probability).toBeGreaterThanOrEqual(0)
        expect(sequence.probability).toBeLessThanOrEqual(1)
        
        sequence.turns.forEach(turn => {
          expect(turn).toHaveProperty('turn')
          expect(turn).toHaveProperty('plays')
          expect(turn.plays).toBeInstanceOf(Array)
          expect(turn).toHaveProperty('reasoning')
        })
      })
    })

    it('should generate decision trees', async () => {
      const result = await playPatternAnalyzer.analyzePlayPatterns(
        mockCards,
        'Test Commander',
        'Control'
      )

      expect(result.decisionTrees).toBeInstanceOf(Array)
      result.decisionTrees.forEach(tree => {
        expect(tree).toHaveProperty('situation')
        expect(tree).toHaveProperty('options')
        expect(tree.options).toBeInstanceOf(Array)
        
        tree.options.forEach(option => {
          expect(option).toHaveProperty('action')
          expect(option).toHaveProperty('outcome')
          expect(option).toHaveProperty('priority')
          expect(option.priority).toBeGreaterThanOrEqual(1)
          expect(option.priority).toBeLessThanOrEqual(10)
        })
      })
    })

    it('should generate mulligan guide', async () => {
      const result = await playPatternAnalyzer.analyzePlayPatterns(
        mockCards,
        'Test Commander',
        'Control'
      )

      expect(result.mulliganGuide).toBeDefined()
      expect(result.mulliganGuide).toHaveProperty('keepCriteria')
      expect(result.mulliganGuide.keepCriteria).toBeInstanceOf(Array)
      expect(result.mulliganGuide).toHaveProperty('avoidCriteria')
      expect(result.mulliganGuide.avoidCriteria).toBeInstanceOf(Array)
      expect(result.mulliganGuide).toHaveProperty('idealHands')
      expect(result.mulliganGuide.idealHands).toBeInstanceOf(Array)
    })

    it('should identify common mistakes', async () => {
      const result = await playPatternAnalyzer.analyzePlayPatterns(
        mockCards,
        'Test Commander',
        'Control'
      )

      expect(result.commonMistakes).toBeInstanceOf(Array)
      result.commonMistakes.forEach(mistake => {
        expect(mistake).toHaveProperty('mistake')
        expect(mistake).toHaveProperty('consequence')
        expect(mistake).toHaveProperty('correction')
        expect(mistake).toHaveProperty('researchBacking')
        expect(mistake.researchBacking).toBeInstanceOf(Array)
      })
    })

    it('should research optimal sequences and decision making', async () => {
      await playPatternAnalyzer.analyzePlayPatterns(mockCards, 'Test Commander', 'Control')

      expect(mockResearchEngine.performResearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('optimal play sequence'),
        })
      )
      expect(mockResearchEngine.performResearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('decision making guide'),
        })
      )
    })
  })
})

describe('Integration Tests', () => {
  let analysisEngine: DeckAnalysisEngine

  beforeEach(() => {
    analysisEngine = new DeckAnalysisEngine()
    vi.clearAllMocks()
  })

  it('should handle large deck analysis efficiently', async () => {
    const largeDeck: DeckAnalysisRequest = {
      deckId: 'large-deck-test',
      cards: Array.from({ length: 100 }, (_, i) => ({
        name: `Card ${i}`,
        quantity: 1,
        category: 'main',
        cmc: Math.floor(i / 10),
        types: ['Creature'],
        colors: ['R'],
      })),
      commander: 'Large Deck Commander',
      strategy: 'Midrange',
      format: 'commander',
      analysisDepth: 'moderate',
    }

    const startTime = Date.now()
    const result = await analysisEngine.analyzeDecksComprehensively(largeDeck)
    const endTime = Date.now()

    expect(result).toBeDefined()
    expect(endTime - startTime).toBeLessThan(30000) // Should complete within 30 seconds
  })

  it('should maintain consistency across multiple analyses', async () => {
    const deckRequest: DeckAnalysisRequest = {
      deckId: 'consistency-test',
      cards: [
        { name: 'Sol Ring', quantity: 1, category: 'ramp', cmc: 1 },
        { name: 'Lightning Bolt', quantity: 1, category: 'removal', cmc: 1 },
      ],
      commander: 'Consistent Commander',
      strategy: 'Aggro',
      format: 'commander',
      analysisDepth: 'moderate',
    }

    const results = await Promise.all([
      analysisEngine.analyzeDecksComprehensively(deckRequest),
      analysisEngine.analyzeDecksComprehensively(deckRequest),
      analysisEngine.analyzeDecksComprehensively(deckRequest),
    ])

    // Results should be consistent (within reasonable variance)
    const confidences = results.map(r => r.overallConfidence)
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    
    confidences.forEach(confidence => {
      expect(Math.abs(confidence - avgConfidence)).toBeLessThan(0.2) // Within 20% variance
    })
  })
})