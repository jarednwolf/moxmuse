import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'
import { 
  ConsultationDataSchema,
  GenerateFullDeckInputSchema,
  type GeneratedDeck,
  type DeckStatistics,
  type CardSynergy,
  type StrategyAnalysis
} from '@moxmuse/shared'

// Import core services
import { openaiService } from '../services/openai'
import { scryfallService } from '../services/scryfall'
import { CollectionProxyService } from '../services/collection-proxy'

// Event emitter for real-time updates
const analysisEventEmitter = new EventEmitter()

// Helper function to get user ID from session
const getUserId = (ctx: any): string => (ctx.session.user as any).id

// Input schemas for enhanced procedures
const CompleteGenerationInputSchema = z.object({
  sessionId: z.string(),
  consultationData: ConsultationDataSchema,
  commander: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    powerLevel: z.number().min(1).max(4).optional(),
    useCollection: z.boolean().optional(),
    prioritizeOwned: z.boolean().optional(),
    maxGenerationTime: z.number().optional(),
  }).optional(),
})

const RealTimeAnalysisInputSchema = z.object({
  deckId: z.string(),
  analysisTypes: z.array(z.enum(['synergies', 'strategy', 'weaknesses', 'meta', 'budget'])).optional(),
  includeResearch: z.boolean().default(true),
  streamUpdates: z.boolean().default(true),
})

const PersonalizedSuggestionsInputSchema = z.object({
  deckId: z.string().optional(),
  userId: z.string().optional(),
  suggestionTypes: z.array(z.enum(['cards', 'strategy', 'budget', 'meta'])).optional(),
  maxSuggestions: z.number().min(1).max(20).default(10),
  includeResearch: z.boolean().default(true),
  learningContext: z.object({
    recentDecks: z.array(z.string()).optional(),
    preferredStrategies: z.array(z.string()).optional(),
    budgetRange: z.object({
      min: z.number(),
      max: z.number(),
    }).optional(),
  }).optional(),
})

const SuggestionFeedbackInputSchema = z.object({
  suggestionId: z.string(),
  deckId: z.string().optional(),
  feedback: z.enum(['accepted', 'rejected', 'modified', 'ignored']),
  reason: z.string().optional(),
  alternativeChosen: z.string().optional(),
  satisfactionRating: z.number().min(1).max(5).optional(),
  context: z.record(z.string(), z.any()).optional(),
})

const MultiDeckOptimizationInputSchema = z.object({
  deckIds: z.array(z.string()).optional(),
  optimizationGoals: z.array(z.enum(['budget', 'power', 'consistency', 'synergy', 'meta'])),
  constraints: z.object({
    totalBudget: z.number().optional(),
    maintainStrategies: z.boolean().default(true),
    allowMajorChanges: z.boolean().default(false),
  }).optional(),
})

const MarketIntelligenceInputSchema = z.object({
  cardIds: z.array(z.string()).optional(),
  deckId: z.string().optional(),
  analysisTypes: z.array(z.enum(['prices', 'trends', 'reprints', 'alternatives'])).optional(),
  timeframe: z.enum(['1d', '7d', '30d', '90d', '1y']).default('30d'),
  includeForecasts: z.boolean().default(true),
})

export const enhancedTutorRouter = createTRPCRouter({
  /**
   * Generate a complete 100-card deck with full AI pipeline
   */
  generateCompleteDeck: protectedProcedure
    .input(CompleteGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx)
      const { sessionId, consultationData, commander, constraints } = input

      try {
        console.log('🚀 Starting complete deck generation pipeline for user:', userId)
        
        // Get user's collection if requested
        const proxyService = new CollectionProxyService(ctx.prisma)
        let ownedCardIds = new Set<string>()
        
        if (constraints?.useCollection) {
          try {
            const collection = await proxyService.fetchCollection(userId)
            collection.cards.forEach(card => {
              if (card.quantity > 0 || card.foilQuantity > 0) {
                ownedCardIds.add(card.cardId)
              }
            })
            console.log('📦 Found', ownedCardIds.size, 'owned cards')
          } catch (error) {
            console.warn('Failed to fetch collection:', error)
          }
        }

        // Generate deck using existing OpenAI service
        const deckCards = await openaiService.generateCompleteDeck({
          consultationData,
          commander,
          constraints,
        })

        // Create enhanced deck in database
        const enhancedDeck = await ctx.prisma.enhancedDeck.create({
          data: {
            userId,
            name: `${commander} Deck`,
            commander,
            format: 'commander',
            strategy: {
              name: consultationData.strategy || 'Custom Strategy',
              description: 'AI-generated deck strategy',
              archetype: consultationData.strategy || 'midrange',
              themes: consultationData.themes || [],
              gameplan: 'Execute the strategy and win',
              strengths: [],
              weaknesses: []
            },
            analysis: {
              synergies: [],
              weaknesses: [],
              strategyDescription: 'Generated deck with AI assistance',
              confidence: 0.8,
            },
            personalizationData: {
              ownedCardsUsed: Array.from(ownedCardIds).filter(cardId => 
                deckCards.some(card => card.cardId === cardId)
              ).length,
              totalCards: deckCards.length,
              generationContext: consultationData,
            },
            statistics: {
              manaCurve: { distribution: [0,0,0,0,0,0,0,0], peakCMC: 3, averageCMC: 3.5, landRatio: 0.37 },
              colorDistribution: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, multicolor: 0, devotion: {} },
              typeDistribution: { creature: 0, instant: 0, sorcery: 0, artifact: 0, enchantment: 0, planeswalker: 0, land: 37, other: 0 },
              rarityDistribution: { common: 0, uncommon: 0, rare: 0, mythic: 0 },
              averageCMC: 3.5,
              totalValue: 0,
              landCount: 37,
              nonlandCount: 63,
            },
            userPreferences: {
              strategy: consultationData.strategy,
              budget: constraints?.budget,
              powerLevel: constraints?.powerLevel,
              useCollection: constraints?.useCollection,
            },
            lastOptimized: new Date(),
          },
        })

        // Save cards
        for (const card of deckCards) {
          await ctx.prisma.enhancedDeckCard.create({
            data: {
              deckId: enhancedDeck.id,
              cardId: card.cardId,
              quantity: card.quantity,
              category: card.category,
              role: card.role || 'support',
              synergyScore: 0.7,
              strategicImportance: 0.8,
              replaceability: 0.5,
              currentPrice: 0,
              owned: ownedCardIds.has(card.cardId),
              ownedQuantity: ownedCardIds.has(card.cardId) ? 1 : 0,
              performanceNotes: card.reasoning,
            },
          })
        }

        console.log('✅ Complete deck generation successful:', enhancedDeck.id)
        
        return {
          deckId: enhancedDeck.id,
          cards: deckCards,
          statistics: enhancedDeck.statistics,
          analysis: enhancedDeck.analysis,
          metadata: {
            generationTime: 5000,
            aiModelsUsed: ['gpt-4'],
            researchSources: ['scryfall', 'edhrec'],
            confidence: 0.8,
            ownedCardsUsed: Array.from(ownedCardIds).filter(cardId => 
              deckCards.some(card => card.cardId === cardId)
            ).length,
          },
        }

      } catch (error) {
        console.error('❌ Complete deck generation failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate complete deck'
        })
      }
    }),

  /**
   * Real-time deck analysis with streaming updates
   */
  analyzeDecksRealTime: protectedProcedure
    .input(RealTimeAnalysisInputSchema)
    .subscription(async function* ({ ctx, input }) {
      const userId = getUserId(ctx)
      const { deckId, analysisTypes, includeResearch } = input

      try {
        console.log('🔍 Starting real-time deck analysis for:', deckId)

        // Verify deck ownership
        const deck = await ctx.prisma.enhancedDeck.findUnique({
          where: { id: deckId, userId },
          include: { cards: true },
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          })
        }

        // Simulate streaming analysis
        const analysisSteps = [
          { type: 'synergy_analysis', progress: 25, data: { synergies: [] } },
          { type: 'strategy_analysis', progress: 50, data: { strategy: 'Analyzing strategy...' } },
          { type: 'weakness_analysis', progress: 75, data: { weaknesses: [] } },
          { type: 'analysis_complete', progress: 100, data: { 
            analysis: { synergies: [], weaknesses: [], confidence: 0.8 },
            statistics: deck.statistics,
          }},
        ]

        for (const update of analysisSteps) {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          yield {
            type: update.type,
            progress: update.progress,
            data: update.data,
            timestamp: new Date(),
            metadata: {
              analysisTime: 1000,
              confidence: 0.8,
            },
          }
        }

        console.log('✅ Real-time deck analysis completed for:', deckId)

      } catch (error) {
        console.error('❌ Real-time deck analysis failed:', error)
        
        yield {
          type: 'error',
          progress: 0,
          data: null,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }),

  /**
   * Get personalized suggestions with learning integration
   */
  getPersonalizedSuggestions: protectedProcedure
    .input(PersonalizedSuggestionsInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = input.userId || getUserId(ctx)
      const { deckId, suggestionTypes, maxSuggestions } = input

      try {
        console.log('🎯 Getting personalized suggestions for user:', userId)

        // Get deck context if provided
        let deckContext = null
        if (deckId) {
          deckContext = await ctx.prisma.enhancedDeck.findUnique({
            where: { id: deckId, userId },
            include: { cards: true },
          })

          if (!deckContext) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Deck not found or access denied'
            })
          }
        }

        // Generate mock personalized suggestions
        const suggestions = Array.from({ length: Math.min(maxSuggestions, 5) }, (_, i) => ({
          id: `suggestion-${i}`,
          type: suggestionTypes?.[0] || 'cards',
          title: `Suggestion ${i + 1}`,
          description: `This is a personalized suggestion based on your deck building history`,
          confidence: 0.8,
          reasoning: 'Based on your preference for aggressive strategies',
          cardId: `card-${i}`,
          cardName: `Suggested Card ${i + 1}`,
          category: 'improvement',
          impact: 'medium',
          cost: 10.99,
        }))

        console.log('✅ Generated', suggestions.length, 'personalized suggestions')

        return {
          suggestions,
          userProfile: {
            preferredStrategies: ['aggro', 'midrange'],
            complexityPreference: 'moderate',
            budgetSensitivity: 0.7,
            suggestionAcceptanceRate: 0.6,
          },
          metadata: {
            generationTime: Date.now(),
            researchSources: ['edhrec', 'scryfall'],
            confidence: 0.8,
            adaptationsApplied: ['user-history', 'deck-context'],
          },
        }

      } catch (error) {
        console.error('❌ Failed to get personalized suggestions:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate personalized suggestions'
        })
      }
    }),

  /**
   * Submit feedback on suggestions for continuous improvement
   */
  submitSuggestionFeedback: protectedProcedure
    .input(SuggestionFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx)
      const { suggestionId, deckId, feedback, reason, alternativeChosen, satisfactionRating, context } = input

      try {
        console.log('📝 Recording suggestion feedback:', feedback, 'for suggestion:', suggestionId)

        // Save feedback to database
        const feedbackRecord = await ctx.prisma.suggestionFeedback.create({
          data: {
            userId,
            suggestionId,
            deckId,
            feedback,
            reason,
            alternativeChosen,
            satisfactionRating,
            context: context || {},
          },
        })

        console.log('✅ Suggestion feedback recorded and processed')

        return {
          success: true,
          feedbackId: feedbackRecord.id,
          learningImpact: {
            preferencesUpdated: true,
            collectiveLearningContribution: satisfactionRating ? satisfactionRating >= 4 : false,
            strategyEvolutionTriggered: false,
          },
        }

      } catch (error) {
        console.error('❌ Failed to submit suggestion feedback:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to submit feedback'
        })
      }
    }),

  /**
   * Optimize all user decks for portfolio management
   */
  optimizeAllDecks: protectedProcedure
    .input(MultiDeckOptimizationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = getUserId(ctx)
      const { deckIds, optimizationGoals } = input

      try {
        console.log('🔧 Starting multi-deck optimization for user:', userId)

        // Get user's decks
        const userDecks = await ctx.prisma.enhancedDeck.findMany({
          where: {
            userId,
            ...(deckIds ? { id: { in: deckIds } } : {}),
          },
          include: { cards: true },
        })

        if (userDecks.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No decks found for optimization'
          })
        }

        console.log('🔧 Optimizing', userDecks.length, 'decks')

        // Mock optimization results
        const optimizedDecks = userDecks.map((deck: any) => ({
          deckId: deck.id,
          changes: Math.floor(Math.random() * 5) + 1,
          improvements: {
            budgetSavings: Math.floor(Math.random() * 50),
            powerIncrease: Math.floor(Math.random() * 10),
            consistencyImprovement: Math.floor(Math.random() * 15),
          },
        }))

        console.log('✅ Multi-deck optimization completed')

        return {
          optimizedDecks,
          summary: {
            decksOptimized: userDecks.length,
            totalChanges: optimizedDecks.reduce((sum, deck) => sum + deck.changes, 0),
            budgetSavings: optimizedDecks.reduce((sum, deck) => sum + deck.improvements.budgetSavings, 0),
            powerImprovement: optimizedDecks.reduce((sum, deck) => sum + deck.improvements.powerIncrease, 0),
            consistencyImprovement: optimizedDecks.reduce((sum, deck) => sum + deck.improvements.consistencyImprovement, 0),
          },
          recommendations: [
            'Consider consolidating similar strategies across decks',
            'Some cards could be shared between decks to reduce costs',
            'Focus budget on high-impact upgrades first',
          ],
          metadata: {
            optimizationTime: 3000,
            modelsUsed: ['gpt-4'],
            confidence: 0.8,
          },
        }

      } catch (error) {
        console.error('❌ Multi-deck optimization failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to optimize decks'
        })
      }
    }),

  /**
   * Get real-time market intelligence data
   */
  getMarketIntelligence: protectedProcedure
    .input(MarketIntelligenceInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = getUserId(ctx)
      const { cardIds, deckId, analysisTypes, timeframe } = input

      try {
        console.log('💰 Getting market intelligence for user:', userId)

        let targetCardIds = cardIds || []

        // If deckId provided, get cards from deck
        if (deckId && targetCardIds.length === 0) {
          const deck = await ctx.prisma.enhancedDeck.findUnique({
            where: { id: deckId, userId },
            include: { cards: true },
          })

          if (!deck) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Deck not found or access denied'
            })
          }

          targetCardIds = deck.cards.map(card => card.cardId)
        }

        if (targetCardIds.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No cards specified for market analysis'
          })
        }

        console.log('💰 Analyzing', targetCardIds.length, 'cards')

        // Mock market intelligence data
        const mockMarketData = {
          totalValue: targetCardIds.length * 15.99,
          ownedValue: targetCardIds.length * 8.99,
          missingValue: targetCardIds.length * 7.00,
          budgetBreakdown: {
            lands: targetCardIds.length * 5.99,
            ramp: targetCardIds.length * 2.99,
            draw: targetCardIds.length * 3.99,
            removal: targetCardIds.length * 1.99,
            threats: targetCardIds.length * 1.01,
            utility: targetCardIds.length * 0.01,
          },
          upgradeRecommendations: [],
          budgetOptimizations: [],
          priceAlerts: [],
        }

        console.log('✅ Market intelligence analysis completed')

        return {
          marketData: mockMarketData,
          priceData: targetCardIds.map(cardId => ({
            cardId,
            currentPrice: 15.99,
            trend: 'stable',
            volatility: 0.1,
          })),
          metaData: null,
          summary: {
            totalValue: mockMarketData.totalValue,
            averagePrice: 15.99,
            volatilityScore: 0.3,
            trendDirection: 'stable',
            reprintRisk: 0.2,
          },
          recommendations: {
            buyNow: [],
            waitForReprint: [],
            alternatives: [],
            budgetOptimizations: [],
          },
          forecasts: null,
          metadata: {
            analysisTime: Date.now(),
            dataSources: ['scryfall', 'edhrec'],
            confidence: 0.8,
            lastUpdated: new Date(),
          },
        }

      } catch (error) {
        console.error('❌ Market intelligence analysis failed:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get market intelligence'
        })
      }
    }),

  /**
   * Get deck generation progress for streaming updates
   */
  getDeckGenerationProgress: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const { sessionId } = input
      
      // Mock progress data
      return {
        sessionId,
        progress: 100,
        status: 'completed',
        currentStep: 'deck_generated',
        estimatedTimeRemaining: 0,
        cardsGenerated: 100,
      }
    }),

  /**
   * Get user learning insights
   */
  getUserLearningInsights: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = getUserId(ctx)
      
      try {
        // Mock learning insights
        return {
          profile: {
            preferredStrategies: ['aggro', 'midrange'],
            complexityPreference: 'moderate',
            budgetSensitivity: 0.7,
            suggestionAcceptanceRate: 0.6,
            preferenceConfidence: 0.8,
          },
          learningProgress: {
            totalEvents: 150,
            suggestionAcceptanceRate: 0.6,
            preferenceConfidence: 0.8,
            strategiesLearned: 3,
          },
          preferences: {
            favoriteCardTypes: ['creature', 'instant'],
            avoidedStrategies: ['stax', 'combo'],
            budgetRange: { min: 50, max: 200 },
          },
          insights: [
            'You tend to prefer aggressive strategies with efficient creatures',
            'Your deck building has become more consistent over time',
            'Consider exploring control strategies to expand your skills',
          ],
        }
      } catch (error) {
        console.error('Failed to get user learning insights:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get learning insights'
        })
      }
    }),

  /**
   * Get system performance metrics
   */
  getSystemPerformance: protectedProcedure
    .query(async () => {
      try {
        // Mock system performance data
        return {
          totalRequests: 10000,
          averageResponseTime: 2500,
          successRate: 0.95,
          costEfficiency: 0.85,
          activeTemplates: 15,
          activeTests: 3,
          topPerformingModels: ['gpt-4', 'claude-3-sonnet', 'gpt-4-turbo'],
          recentAlerts: 1,
        }
      } catch (error) {
        console.error('Failed to get system performance:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get system performance'
        })
      }
    }),
})
