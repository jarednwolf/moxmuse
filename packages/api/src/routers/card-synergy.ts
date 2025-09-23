import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { 
  cardSynergyDetectionService,
  SynergyAnalysisRequestSchema,
  type ComprehensiveSynergyAnalysis,
  type CardSynergy,
  type RelatedCard,
  type ComboDetection,
  type UpgradePath
} from '../services/card-synergy-detection'
import { db as prisma } from '@repo/db'

export const cardSynergyRouter = createTRPCRouter({
  /**
   * Analyze card synergies for a deck
   */
  analyzeSynergies: protectedProcedure
    .input(SynergyAnalysisRequestSchema)
    .mutation(async ({ input, ctx }) => {
      console.log(`🔗 Analyzing synergies for user ${ctx.session.user.id}`)

      try {
        // Add user context to the request
        const requestWithUser = {
          ...input,
          userId: ctx.session.user.id,
        }

        // Perform comprehensive synergy analysis
        const analysis = await cardSynergyDetectionService.analyzeSynergies(requestWithUser)

        // Cache the analysis results if deck ID is provided
        if (input.cards.length > 0 && (prisma as any)?.aIAnalysisCache?.create) {
          await (prisma as any).aIAnalysisCache.create({
            data: {
              deckId: `synergy-${Date.now()}`, // Temporary ID for synergy analysis
              analysisVersion: 1,
              synergyAnalysis: analysis as any,
              confidenceScore: analysis.analysisMetadata.confidenceScore,
              analysisDuration: 0, // Would be calculated from actual timing
              modelVersion: analysis.analysisMetadata.modelVersion,
            },
          })
        }

        return {
          success: true,
          data: analysis,
        }
      } catch (error) {
        console.error('❌ Synergy analysis failed:', error)
        throw new Error(`Synergy analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get related card suggestions for a specific card
   */
  getRelatedCards: publicProcedure
    .input(z.object({
      cardName: z.string(),
      commander: z.string().optional(),
      strategy: z.string().optional(),
      format: z.enum(['commander', 'standard', 'modern', 'legacy']).default('commander'),
      limit: z.number().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      console.log(`💡 Getting related cards for ${input.cardName}`)

      try {
        // Create a minimal request for related card analysis
        const request = {
          cards: [{ 
            cardId: input.cardName.toLowerCase().replace(/\s+/g, '-'),
            cardName: input.cardName, 
            quantity: 1 
          }],
          commander: input.commander || 'Generic Commander',
          strategy: input.strategy,
          format: input.format,
          analysisDepth: 'shallow' as const,
        }

        const analysis = await cardSynergyDetectionService.analyzeSynergies(request)
        
        return {
          success: true,
          data: analysis.relatedCardSuggestions.slice(0, input.limit),
        }
      } catch (error) {
        console.error('❌ Related cards lookup failed:', error)
        throw new Error(`Related cards lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Detect combos in a deck
   */
  detectCombos: protectedProcedure
    .input(z.object({
      cards: z.array(z.object({
        cardId: z.string(),
        cardName: z.string(),
        quantity: z.number(),
      })),
      commander: z.string(),
      strategy: z.string().optional(),
      format: z.enum(['commander', 'standard', 'modern', 'legacy']).default('commander'),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`⚡ Detecting combos for user ${ctx.session.user.id}`)

      try {
        const request = {
          ...input,
          analysisDepth: 'deep' as const,
          userId: ctx.session.user.id,
        }

        const analysis = await cardSynergyDetectionService.analyzeSynergies(request)
        
        return {
          success: true,
          data: {
            combos: analysis.comboDetections,
            synergyScore: analysis.synergyScore,
            confidence: analysis.analysisMetadata.confidenceScore,
          },
        }
      } catch (error) {
        console.error('❌ Combo detection failed:', error)
        throw new Error(`Combo detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get upgrade recommendations for specific cards
   */
  getUpgradeRecommendations: protectedProcedure
    .input(z.object({
      cards: z.array(z.object({
        cardId: z.string(),
        cardName: z.string(),
        quantity: z.number(),
      })),
      commander: z.string(),
      strategy: z.string().optional(),
      budgetConstraints: z.object({
        maxBudget: z.number().optional(),
        ownedCards: z.array(z.string()).optional(),
        prioritizeBudget: z.boolean().default(false),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`📈 Getting upgrade recommendations for user ${ctx.session.user.id}`)

      try {
        const request = {
          ...input,
          format: 'commander' as const,
          analysisDepth: 'moderate' as const,
          userId: ctx.session.user.id,
        }

        const analysis = await cardSynergyDetectionService.analyzeSynergies(request)
        
        return {
          success: true,
          data: {
            upgradePaths: analysis.upgradePaths,
            relatedCards: analysis.relatedCardSuggestions,
            confidence: analysis.analysisMetadata.confidenceScore,
          },
        }
      } catch (error) {
        console.error('❌ Upgrade recommendations failed:', error)
        throw new Error(`Upgrade recommendations failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get synergy strength between two specific cards
   */
  getSynergyStrength: publicProcedure
    .input(z.object({
      cardA: z.string(),
      cardB: z.string(),
      commander: z.string().optional(),
      strategy: z.string().optional(),
    }))
    .query(async ({ input }) => {
      console.log(`🎯 Checking synergy between ${input.cardA} and ${input.cardB}`)

      try {
        const request = {
          cards: [
            { cardId: input.cardA.toLowerCase().replace(/\s+/g, '-'), cardName: input.cardA, quantity: 1 },
            { cardId: input.cardB.toLowerCase().replace(/\s+/g, '-'), cardName: input.cardB, quantity: 1 },
          ],
          commander: input.commander || 'Generic Commander',
          strategy: input.strategy,
          format: 'commander' as const,
          analysisDepth: 'shallow' as const,
        }

        const analysis = await cardSynergyDetectionService.analyzeSynergies(request)
        
        // Find synergy between the two specific cards
        const synergy = analysis.cardSynergies.find(s => 
          (s.cardA === input.cardA && s.cardB === input.cardB) ||
          (s.cardA === input.cardB && s.cardB === input.cardA)
        )

        return {
          success: true,
          data: {
            synergy: synergy || null,
            hasSynergy: !!synergy,
            strength: synergy?.strength || 0,
            explanation: synergy?.explanation || 'No significant synergy detected',
          },
        }
      } catch (error) {
        console.error('❌ Synergy strength check failed:', error)
        throw new Error(`Synergy strength check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get cached synergy analysis
   */
  getCachedAnalysis: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      analysisVersion: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      console.log(`📋 Getting cached synergy analysis for deck ${input.deckId}`)

      try {
        const cachedAnalysis = (prisma as any)?.aIAnalysisCache?.findFirst ? await (prisma as any).aIAnalysisCache.findFirst({
          where: {
            deckId: input.deckId,
            analysisVersion: input.analysisVersion,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }) : null

        if (!cachedAnalysis) {
          return {
            success: false,
            data: null,
            message: 'No cached analysis found',
          }
        }

        return {
          success: true,
          data: {
            synergyAnalysis: cachedAnalysis.synergyAnalysis,
            confidenceScore: cachedAnalysis.confidenceScore,
            analysisVersion: cachedAnalysis.analysisVersion,
            createdAt: cachedAnalysis.createdAt,
            modelVersion: cachedAnalysis.modelVersion,
          },
        }
      } catch (error) {
        console.error('❌ Failed to get cached analysis:', error)
        throw new Error(`Failed to get cached analysis: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Provide feedback on synergy suggestions
   */
  provideFeedback: protectedProcedure
    .input(z.object({
      suggestionId: z.string(),
      deckId: z.string().optional(),
      feedback: z.enum(['accepted', 'rejected', 'modified', 'ignored']),
      reason: z.string().optional(),
      alternativeChosen: z.string().optional(),
      satisfactionRating: z.number().min(1).max(5).optional(),
      context: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log(`📝 Recording synergy feedback from user ${ctx.session.user.id}`)

      try {
        if ((prisma as any)?.suggestionFeedback?.create) {
          await (prisma as any).suggestionFeedback.create({
          data: {
            userId: ctx.session.user.id,
            suggestionId: input.suggestionId,
            deckId: input.deckId,
            feedback: input.feedback,
            reason: input.reason,
            alternativeChosen: input.alternativeChosen,
            satisfactionRating: input.satisfactionRating,
            context: input.context,
          },
          })
        }

        return {
          success: true,
          message: 'Feedback recorded successfully',
        }
      } catch (error) {
        console.error('❌ Failed to record feedback:', error)
        throw new Error(`Failed to record feedback: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),

  /**
   * Get synergy statistics for a user
   */
  getSynergyStats: protectedProcedure
    .query(async ({ ctx }) => {
      console.log(`📊 Getting synergy statistics for user ${ctx.session.user.id}`)

      try {
        // Get feedback statistics
        const feedbackStats = (prisma as any)?.suggestionFeedback?.groupBy ? await (prisma as any).suggestionFeedback.groupBy({
          by: ['feedback'],
          where: {
            userId: ctx.session.user.id,
          },
          _count: {
            feedback: true,
          },
        }) : []

        // Get recent analyses
        const recentAnalyses = (prisma as any)?.aIAnalysisCache?.count ? await (prisma as any).aIAnalysisCache.count({
          where: {
            deck: {
              userId: ctx.session.user.id,
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }) : 0

        const feedbackSummary = (feedbackStats || []).reduce((acc: Record<string, number>, stat: any) => {
          acc[stat.feedback] = stat._count.feedback
          return acc
        }, {} as Record<string, number>)

        return {
          success: true,
          data: {
            feedbackSummary,
            recentAnalyses,
            totalFeedback: (feedbackStats || []).reduce((sum: number, stat: any) => sum + (stat?._count?.feedback || 0), 0),
            acceptanceRate: feedbackSummary.accepted && Object.values(feedbackSummary).length > 0 ? 
              (feedbackSummary.accepted / Object.values(feedbackSummary as Record<string, number>).reduce((a: number, b: number) => a + b, 0)) * 100 : 0,
          },
        }
      } catch (error) {
        console.error('❌ Failed to get synergy stats:', error)
        throw new Error(`Failed to get synergy stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }),
})

console.log('🔗 Card Synergy Router initialized')
console.log('Available endpoints:')
console.log('  🔍 analyzeSynergies - Comprehensive synergy analysis')
console.log('  💡 getRelatedCards - Related card suggestions')
console.log('  ⚡ detectCombos - Combo detection')
console.log('  📈 getUpgradeRecommendations - Upgrade paths')
console.log('  🎯 getSynergyStrength - Two-card synergy check')
console.log('  📋 getCachedAnalysis - Cached analysis retrieval')
console.log('  📝 provideFeedback - Suggestion feedback')
console.log('  📊 getSynergyStats - User synergy statistics')
