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

// Import AI services
// Services are imported from services/container further below

// Import other services
import { CollectionProxyService } from '../services/collection-proxy'
import { scryfallService } from '../services/scryfall'
// import { openaiService } from '../services/openai'

// Import learning and maintenance services
import { 
  learningEventTracker,
  adaptiveSuggestionsEngine,
  preferenceInferenceEngine,
  collectiveLearningEngine,
  strategyEvolutionDetector,
  intelligentLearningSystem
} from '../services/learning'

import {
  SetMonitorService,
  ProactiveSuggestionsService,
  MultiDeckOptimizerService,
  AutomaticAnalysisService,
  MaintenanceSchedulerService
} from '../services/deck-maintenance'

import { MarketAnalysisService } from '../services/market-analysis'
import { prisma as db } from '@moxmuse/db'

// Replace scattered service imports with container facade
import { services } from '../services/container'

// Use instances from services facade
const { openaiOrchestrator, deckGenerationService, cardRecommendationService, synergyAnalysisService, metaAnalysisService, learning } = services

// Event emitter for real-time updates
const analysisEventEmitter = new EventEmitter()

// Service instances (would be injected in production)
// Use container-provided price service via meta facade when needed; construct market analysis with prisma later when needed
const marketAnalysisService = new MarketAnalysisService(db as any, services.priceTrackingService as any)
const multiDeckOptimizer = new MultiDeckOptimizerService(
  db as any,
  services.priceTrackingService as any,
  services.metaAnalysisService as any,
  new ProactiveSuggestionsService(db as any, services.metaAnalysisService as any, services.priceTrackingService as any, new SetMonitorService(db as any, services.metaAnalysisService as any, services.priceTrackingService as any))
)
const setMonitor = new SetMonitorService(db as any, services.metaAnalysisService as any, services.priceTrackingService as any)
const proactiveSuggestions = new ProactiveSuggestionsService(
  db as any,
  services.metaAnalysisService as any,
  services.priceTrackingService as any,
  setMonitor
)
const automaticAnalysis = new AutomaticAnalysisService(
  db as any,
  proactiveSuggestions as any,
  multiDeckOptimizer as any
)
const maintenanceScheduler = new MaintenanceSchedulerService(
  db as any,
  automaticAnalysis as any,
  setMonitor as any,
  proactiveSuggestions as any,
  multiDeckOptimizer as any
)

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
  userId: z.string().optional(), // Optional override for admin use
  // Use a single suggestionType for current API; keep backward compatible optional array
  suggestionTypes: z.array(z.enum(['cards', 'strategy', 'budget', 'meta'])).optional(),
  suggestionType: z.enum(['cards', 'strategy', 'budget', 'meta']).default('cards'),
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
  deckIds: z.array(z.string()).optional(), // If not provided, optimizes all user decks
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
   * Includes research, validation, and personalization
   */
  generateCompleteDeck: protectedProcedure
    .input(CompleteGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
      const { sessionId, consultationData, commander, constraints } = input

      try {
        console.log('🚀 Starting complete deck generation pipeline for user:', userId)
        console.log('Commander:', commander)
        console.log('Strategy:', consultationData.strategy)
        
        // Get user's collection and preferences
        const proxyService = new CollectionProxyService(ctx.prisma)
        const ownedCardIds = new Set<string>()
        let userProfile = null
        
        // Fetch collection if requested
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

        // Get user learning profile for personalization
        try {
          userProfile = await learning.getUserProfile(userId)
          console.log('👤 Loaded user profile with', ((userProfile as any)?.preferredStrategies?.length || 0), 'preferred strategies')
        } catch (error) {
          console.warn('Failed to load user profile:', error)
        }

        // Build enhanced generation request
        const generationRequest = {
          sessionId,
          consultationData,
          commander,
          constraints: {
            ...constraints,
            ownedCardIds: Array.from(ownedCardIds),
            userProfile,
            maxGenerationTime: constraints?.maxGenerationTime || 30000, // 30 seconds
          },
        }

        // Generate deck using AI orchestrator
        const generationResult: any = await (openaiOrchestrator as any).generateCompleteDeck(generationRequest)
        
        if (!generationResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: generationResult.error || 'Failed to generate deck'
          })
        }

        // Save to database with enhanced metadata
        const generatedDeck = await ctx.prisma.enhancedDeck.create({
          data: {
            userId,
            name: `${commander} Deck`,
            commander,
            format: 'commander',
            strategy: generationResult.strategy,
            analysis: generationResult.analysis,
            personalizationData: {
              userProfile,
              generationContext: consultationData,
              ownedCardsUsed: generationResult.ownedCardsUsed || 0,
              totalCards: generationResult.cards.length,
            },
            statistics: generationResult.statistics,
            marketData: generationResult.marketData,
            metaPosition: generationResult.metaPosition,
            lastOptimized: new Date(),
            userPreferences: {
              strategy: consultationData.strategy,
              budget: constraints?.budget,
              powerLevel: constraints?.powerLevel,
              useCollection: constraints?.useCollection,
            },
          },
        })

        // Save cards with AI insights
        for (const card of generationResult.cards) {
          await ctx.prisma.enhancedDeckCard.create({
            data: {
              deckId: generatedDeck.id,
              cardId: card.cardId,
              quantity: card.quantity,
              category: card.category,
              role: card.role,
              synergyScore: card.synergyScore,
              strategicImportance: card.strategicImportance,
              replaceability: card.replaceability,
              currentPrice: card.currentPrice,
              priceHistory: card.priceHistory,
              alternatives: card.alternatives,
              userRating: null,
              performanceNotes: card.reasoning,
              owned: ownedCardIds.has(card.cardId),
              ownedQuantity: ownedCardIds.has(card.cardId) ? 1 : 0,
            },
          })
        }

        // Record learning event
        await (learningEventTracker as any).trackUserInteraction({
          userId,
          deckId: generatedDeck.id,
          action: 'deck_generated',
          component: 'deck_generation',
          timestamp: new Date(),
          sessionId,
          metadata: {
            commander,
            strategy: consultationData.strategy,
            budget: constraints?.budget,
            powerLevel: constraints?.powerLevel,
            generationTime: generationResult.metadata.responseTime,
            cardsGenerated: generationResult.cards.length,
          },
        })

        console.log('✅ Complete deck generation successful:', generatedDeck.id)
        
        return {
          deckId: generatedDeck.id,
          cards: generationResult.cards,
          statistics: generationResult.statistics,
          analysis: generationResult.analysis,
          metadata: {
            generationTime: generationResult.metadata.responseTime,
            aiModelsUsed: generationResult.metadata.modelsUsed,
            researchSources: generationResult.metadata.researchSources,
            confidence: generationResult.metadata.confidence,
            ownedCardsUsed: generationResult.ownedCardsUsed || 0,
          },
        }

      } catch (error) {
        console.error('❌ Complete deck generation failed:', error)
        
        // Record failure for learning
        await learningEventTracker.trackUserInteraction({
          userId,
          action: 'deck_generation_failed',
          component: 'deck_generation',
          timestamp: new Date(),
          sessionId,
          metadata: {
            commander,
            strategy: consultationData.strategy,
            error: error instanceof Error ? error.message : String(error),
          },
        })

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate complete deck'
        })
      }
    }),

  /**
   * Real-time deck analysis with streaming updates
   * Provides live analysis as it completes
   */
  analyzeDecksRealTime: protectedProcedure
    .input(RealTimeAnalysisInputSchema)
    .subscription(async function* ({ ctx, input }) {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
      const { deckId, analysisTypes, includeResearch, streamUpdates } = input

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

        // Set up analysis pipeline
        const analysisRequest = {
          deckId,
          deck,
          analysisTypes: analysisTypes || ['synergies', 'strategy', 'weaknesses', 'meta', 'budget'],
          includeResearch,
          streamUpdates,
          userId,
        }

        // Start analysis and stream results
        const analysisStream = (openaiOrchestrator as any).analyzeWithStreaming?.(analysisRequest)

        for await (const update of analysisStream) {
          // Emit to event emitter for other subscribers
          analysisEventEmitter.emit(`analysis:${deckId}`, update)
          
          // Yield update to subscriber
          yield {
            type: update.type,
            progress: update.progress,
            data: update.data,
            timestamp: new Date(),
            metadata: update.metadata,
          }

          // Save intermediate results to database
          if (update.type === 'analysis_complete' || update.progress >= 100) {
            await ctx.prisma.enhancedDeck.update({
              where: { id: deckId },
              data: {
                analysis: update.data.analysis,
                statistics: update.data.statistics,
                marketData: update.data.marketData,
                metaPosition: update.data.metaPosition,
              },
            })

            // Record learning event
            await learningEventTracker.trackUserInteraction({
              userId,
              deckId,
              action: 'deck_analyzed',
              component: 'deck_analysis',
              timestamp: new Date(),
              sessionId: 'analysis_stream',
              metadata: {
                analysisTypes,
                includeResearch,
                analysisTime: update.metadata.analysisTime,
                researchSources: update.metadata.researchSources?.length || 0,
              },
            })
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
   * Adapts based on user history and preferences
   */
  getPersonalizedSuggestions: protectedProcedure
    .input(PersonalizedSuggestionsInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = input.userId || (ctx.session as NonNullable<typeof ctx.session>).user.id
      const { deckId, suggestionTypes, maxSuggestions, includeResearch, learningContext } = input

      try {
        console.log('🎯 Getting personalized suggestions for user:', userId)

        // Get user learning profile
        const userProfile = await learning.getUserProfile(userId)
        const learningHistory = await learningEventTracker.getUserLearningStats(userId)
        const preferences = await preferenceInferenceEngine.inferUserPreferences(userId)

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

        // Build suggestion request
        const suggestionRequest: any = {
          userId,
          deckId,
          deckContext,
          userProfile,
          learningHistory,
          preferences,
          suggestionType: (suggestionTypes && suggestionTypes[0]) || 'cards',
          maxSuggestions,
          includeResearch,
          learningContext,
        }

        // Generate personalized suggestions
        const suggestions: any = await (cardRecommendationService as any).generatePersonalizedSuggestions?.({
          ...suggestionRequest,
          suggestionType: suggestionRequest.suggestionType || (suggestionRequest.suggestionTypes?.[0] ?? 'cards')
        })

        // Apply adaptive learning
        const adaptedSuggestions = await (adaptiveSuggestionsEngine as any).generateAdaptiveSuggestions(
          userId,
          deckId || 'general',
          {
            suggestionTypes,
            maxSuggestions,
            includeResearch,
            learningContext,
          }
        )

        // Record suggestion generation event
        await learningEventTracker.trackUserInteraction({
          userId,
          deckId,
          action: 'suggestions_generated',
          component: 'personalized_suggestions',
          timestamp: new Date(),
          sessionId: crypto.randomUUID(),
          metadata: {
            suggestionTypes,
            maxSuggestions,
            includeResearch,
            suggestionsGenerated: adaptedSuggestions.length,
            userProfileConfidence: (userProfile as any)?.preferenceConfidence || 0,
          },
        })

        console.log('✅ Generated', adaptedSuggestions.length, 'personalized suggestions')

        return {
          suggestions: adaptedSuggestions,
          userProfile: {
            preferredStrategies: (userProfile as any)?.preferredStrategies || [],
            complexityPreference: (userProfile as any)?.complexityPreference || 'moderate',
            budgetSensitivity: (userProfile as any)?.budgetSensitivity || 'medium',
            suggestionAcceptanceRate: (userProfile as any)?.suggestionAcceptanceRate || 0,
          },
          metadata: {
            generationTime: Date.now(),
            researchSources: suggestions?.metadata?.researchSources || [],
            confidence: suggestions?.metadata?.confidence || 0.8,
            adaptationsApplied: (adaptedSuggestions as any)?.metadata?.adaptationsApplied || [],
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
   * Feeds into learning system for better future suggestions
   */
  submitSuggestionFeedback: protectedProcedure
    .input(SuggestionFeedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
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

        // Record learning event
        await learningEventTracker.trackSuggestionFeedback({
          userId,
          deckId: deckId || 'general',
          suggestionId,
          suggestionType: 'personalized',
          action: feedback,
          reason,
          alternativeChosen,
          satisfactionRating: satisfactionRating ?? 0,
          timestamp: new Date(),
        })

        // Update user preferences based on feedback
        await preferenceInferenceEngine.inferUserPreferences(userId)

        // Update collective learning if feedback is valuable
        if (satisfactionRating && satisfactionRating >= 4) {
          await collectiveLearningEngine.generateCollectiveInsights()
        }

        // Trigger strategy evolution if pattern detected
        await strategyEvolutionDetector.detectStrategyEvolution(
          userId,
          deckId || 'general',
          { feedback, satisfactionRating },
          null
        )

        console.log('✅ Suggestion feedback recorded and processed')

        return {
          success: true,
          feedbackId: feedbackRecord.id,
          learningImpact: {
            preferencesUpdated: true,
            collectiveLearningContribution: (satisfactionRating ?? 0) >= 4,
            strategyEvolutionTriggered: false, // Would be determined by actual analysis
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
   * Considers cross-deck synergies and resource allocation
   */
  optimizeAllDecks: protectedProcedure
    .input(MultiDeckOptimizationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
      const { deckIds, optimizationGoals, constraints } = input

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

        // Get user collection for cross-deck optimization
        const proxyService = new CollectionProxyService(ctx.prisma)
        let collection = null
        try {
          collection = await proxyService.fetchCollection(userId)
        } catch (error) {
          console.warn('Failed to fetch collection for optimization:', error)
        }

        // Build optimization request
        const optimizationBudget = constraints?.totalBudget

        // Run multi-deck optimization
        const optimizationResult = await multiDeckOptimizer.optimizeUserDecks(
          userId,
          optimizationBudget,
          {
            allowDeckConsolidation: constraints?.allowMajorChanges
          }
        )

        // Apply optimizations to database
        const optimizedDecks: Array<{ deckId: string; changes: number; improvements: any }>= []
        const deckOptimizations: any[] = (optimizationResult as any).deckOptimizations || []
        for (const deckOptimization of deckOptimizations) {
          const { deckId, changes, newStatistics, newAnalysis } = deckOptimization

          // Update deck
          const updatedDeck = await ctx.prisma.enhancedDeck.update({
            where: { id: deckId },
            data: {
              statistics: newStatistics,
              analysis: newAnalysis,
              lastOptimized: new Date(),
            },
          })

          // Apply card changes
          for (const change of changes) {
            if (change.type === 'add') {
              await ctx.prisma.enhancedDeckCard.create({
                data: {
                  deckId,
                  cardId: change.cardId,
                  quantity: change.quantity,
                  category: change.category,
                  role: change.role,
                  synergyScore: change.synergyScore,
                  strategicImportance: change.strategicImportance,
                  replaceability: change.replaceability,
                  currentPrice: change.currentPrice,
                  owned: change.owned,
                  ownedQuantity: change.ownedQuantity,
                },
              })
            } else if (change.type === 'remove') {
              await ctx.prisma.enhancedDeckCard.deleteMany({
                where: {
                  deckId,
                  cardId: change.cardId,
                },
              })
            } else if (change.type === 'modify') {
              await ctx.prisma.enhancedDeckCard.updateMany({
                where: {
                  deckId,
                  cardId: change.cardId,
                },
                data: {
                  quantity: change.quantity,
                  synergyScore: change.synergyScore,
                  strategicImportance: change.strategicImportance,
                },
              })
            }
          }

          optimizedDecks.push({
            deckId,
            changes: changes.length,
            improvements: deckOptimization.improvements,
          })
        }

        // Record learning event
        await learningEventTracker.trackUserInteraction({
          userId,
          action: 'multi_deck_optimization',
          component: 'deck_optimization',
          timestamp: new Date(),
          sessionId: randomUUID(),
          metadata: {
            decksOptimized: userDecks.length,
            optimizationGoals,
            totalChanges: (optimizationResult as any).totalChanges || 0,
            budgetSavings: (optimizationResult as any).budgetSavings || 0,
            powerImprovement: (optimizationResult as any).powerImprovement || 0,
          },
        })

        console.log('✅ Multi-deck optimization completed')

        return {
          optimizedDecks,
          summary: {
            decksOptimized: userDecks.length,
            totalChanges: (optimizationResult as any).totalChanges || 0,
            budgetSavings: (optimizationResult as any).budgetSavings || 0,
            powerImprovement: (optimizationResult as any).powerImprovement || 0,
            consistencyImprovement: (optimizationResult as any).consistencyImprovement || 0,
          },
          recommendations: (optimizationResult as any).recommendations || [],
          metadata: {
            optimizationTime: (optimizationResult as any).metadata?.optimizationTime,
            modelsUsed: (optimizationResult as any).metadata?.modelsUsed,
            confidence: (optimizationResult as any).confidence,
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
   * Provides pricing, trends, and market analysis
   */
  getMarketIntelligence: protectedProcedure
    .input(MarketIntelligenceInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
      const { cardIds, deckId, analysisTypes, timeframe, includeForecasts } = input

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

          targetCardIds = deck.cards.map((card: any) => card.cardId)
        }

        if (targetCardIds.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No cards specified for market analysis'
          })
        }

        console.log('💰 Analyzing', targetCardIds.length, 'cards')

        // Build market intelligence request
        const marketRequest = {
          cardIds: targetCardIds,
          analysisTypes: analysisTypes || ['prices', 'trends', 'reprints', 'alternatives'],
          timeframe,
          includeForecasts,
          userId,
        }

        // Get market intelligence
        const marketIntelligence = await marketAnalysisService.analyzeDeckMarket(
          deckId || 'general',
          userId,
          1000 // Default budget
        )

        // Get price tracking data
        const priceData = await services.priceTrackingService.getCardPrices(targetCardIds)

        // Get meta analysis if requested
        let metaData: any = null
        if (analysisTypes?.includes('trends')) {
          // Fallback to current meta summary; detailed per-card trends not supported here
          metaData = await (services.metaAnalysisService as any).getCurrentMeta()
        }

        // Record market intelligence request
        await learningEventTracker.trackUserInteraction({
          userId,
          deckId,
          action: 'market_intelligence_requested',
          component: 'market_analysis',
          timestamp: new Date(),
          sessionId: randomUUID(),
          metadata: {
            cardCount: targetCardIds.length,
            analysisTypes,
            timeframe,
            includeForecasts,
          },
        })

        console.log('✅ Market intelligence analysis completed')

        return {
          marketData: marketIntelligence,
          priceData: (Array.from(priceData.entries()) as Array<[string, any]>).map(([cardId, data]) => ({
            cardId,
            ...data,
          })),
          metaData,
          summary: {
            totalValue: marketIntelligence.totalValue,
            averagePrice: marketIntelligence.totalValue / targetCardIds.length,
            volatilityScore: 0.5, // Would be calculated from price data
            trendDirection: 'stable',
            reprintRisk: 0.3,
          },
          recommendations: {
            buyNow: [],
            waitForReprint: [],
            alternatives: [],
            budgetOptimizations: marketIntelligence.budgetOptimizations,
          },
          forecasts: includeForecasts ? [] : null,
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

  // Helper procedures for enhanced functionality

  /**
   * Get deck generation progress for streaming updates
   */
  getDeckGenerationProgress: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const { sessionId } = input
      return openaiOrchestrator.getDeckGenerationProgress(sessionId)
    }),

  /**
   * Get user learning insights
   */
  getUserLearningInsights: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = (ctx.session as NonNullable<typeof ctx.session>).user.id
      
      try {
        const userProfile = await learning.getUserProfile(userId)
        const learningHistory = await learningEventTracker.getUserLearningStats(userId)
        const preferences = await preferenceInferenceEngine.inferUserPreferences(userId)
        
        return {
          profile: userProfile,
          learningProgress: {
            totalEvents: (learningHistory as any)?.totalEvents || 0,
            suggestionAcceptanceRate: (userProfile as any)?.suggestionAcceptanceRate || (learningHistory as any)?.suggestionAcceptanceRate || 0,
            preferenceConfidence: (userProfile as any)?.preferenceConfidence || (learningHistory as any)?.averageConfidence || 0,
            strategiesLearned: ((userProfile as any)?.preferredStrategies || []).length,
          },
          preferences,
          insights: await (openaiOrchestrator as any).generateInsights?.(userId),
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
        return openaiOrchestrator.getSystemPerformance()
      } catch (error) {
        console.error('Failed to get system performance:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get system performance'
        })
      }
    }),


})