import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { 
  RecommendCardInputSchema, 
  CommanderSelectionInputSchema, 
  GenerateFullDeckInputSchema, 
  AnalyzeDeckInputSchema,
  SuggestDeckImprovementsInputSchema,
  ExportDeckInputSchema,
  ConsultationDataSchema,
  type CardRecommendation,
  type GeneratedDeck,
  type DeckStatistics,
  type CardSynergy,
  type StrategyAnalysis,
  type ScryfallCard
} from '@moxmuse/shared'
import { openaiService } from '../services/openai'
import { enhancedOpenAIService } from '../services/openai-enhanced'
import { scryfallService } from '../services/scryfall'
import { affiliateService } from '../services/affiliate'
import { CollectionProxyService } from '../services/collection-proxy'
import { 
  generateTextExport, 
  generateJSONExport, 
  generateMoxfieldExport, 
  generateArchidektExport,
  generatePrintFriendlyExport,
  generateShareableLink,
  type DeckCardWithData
} from '../services/deck-export'
import { TRPCError } from '@trpc/server'
// V3 deck generator removed - not implemented
import { getAIFirstDeckGeneratorV2, type AIFirstRequest } from '../services/deck-generator-ai-first-v2'

export const tutorRouter = createTRPCRouter({
  // AI-First V2 Deck Generation (Dynamic, Strategy-aware)
  generateFullDeckAIFirst: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      userRequest: z.string(),
      commanderName: z.string().optional(),
      constraints: z.object({
        budget: z.number().optional(),
        powerLevel: z.number().min(1).max(10).optional(),
        mustInclude: z.array(z.string()).optional(),
        mustExclude: z.array(z.string()).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { sessionId, userRequest, commanderName, constraints } = input

      try {
        console.log('🤖 Starting AI-First V2 deck generation')
        console.log('User request:', userRequest)
        console.log('Commander:', commanderName || 'AI will decide')
        console.log('Constraints:', constraints)
        
        // Get the AI-First V2 deck generator
        const openaiKey = process.env.OPENAI_API_KEY
        if (!openaiKey) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'OpenAI API key not configured'
          })
        }
        
        const deckGenerator = await getAIFirstDeckGeneratorV2(ctx.prisma, openaiKey)
        
        // Generate the deck using AI-First approach
        const startTime = Date.now()
        const generatedDeck = await deckGenerator.generateDeck({
          userRequest,
          commanderName,
          constraints
        })
        const generationTime = Date.now() - startTime
        
        console.log(`✅ AI-First deck generated in ${generationTime}ms (${(generationTime / 1000).toFixed(1)}s)`)
        console.log(`Commander: ${generatedDeck.commander}`)
        console.log(`Cards: ${generatedDeck.mainboard.length}`)
        console.log(`Strategy: ${generatedDeck.strategy}`)
        
        // Validate we have exactly 99 cards
        if (generatedDeck.mainboard.length !== 99) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Generated ${generatedDeck.mainboard.length} cards but need exactly 99`
          })
        }
        
        // Save the generated deck to database
        const dbDeck = await ctx.prisma.generatedDeck.create({
          data: {
            userId,
            sessionId,
            name: `${generatedDeck.commander} ${generatedDeck.strategy} Deck`,
            commander: generatedDeck.commander,
            format: 'commander',
            strategy: {
              name: generatedDeck.strategy,
              description: generatedDeck.description,
              archetype: 'ai-first',
              themes: [],
              gameplan: 'AI-optimized strategy',
              strengths: [],
              weaknesses: []
            },
            winConditions: [],
            powerLevel: constraints?.powerLevel || 3,
            estimatedBudget: constraints?.budget || 200,
            consultationData: {
              userRequest,
              aiFirstGenerated: true,
              generationTime
            } as any,
            status: 'generated'
          }
        })
        
        // Add cards to the generated deck
        const cardMap = new Map<string, any>();
        
        // Get the card database to look up card IDs
        const { getCardDatabase } = await import('../services/card-database-complete')
        const cardDb = await getCardDatabase(ctx.prisma)
        
        for (const cardName of generatedDeck.mainboard) {
          // For AI-first, we need to look up card IDs from names
          const cardData = await cardDb.getCard(cardName)
          
          if (cardData) {
            const existing = cardMap.get(cardData.id);
            if (existing) {
              existing.quantity += 1;
            } else {
              cardMap.set(cardData.id, {
                deckId: dbDeck.id,
                cardId: cardData.id,
                quantity: 1,
                category: 'main',
                role: 'support',
                reasoning: 'AI-selected for optimal synergy',
                alternatives: [],
                upgradeOptions: [],
                budgetOptions: []
              });
            }
          } else {
            console.warn(`Card not found in database: ${cardName}`)
          }
        }
        
        await ctx.prisma.generatedDeckCard.createMany({
          data: Array.from(cardMap.values())
        })
        
        // Create a regular deck for viewing/editing
        const regularDeck = await ctx.prisma.deck.create({
          data: {
            userId,
            name: dbDeck.name,
            format: 'commander',
            commander: generatedDeck.commander,
            description: generatedDeck.description,
            isPublic: false,
            powerLevel: constraints?.powerLevel || 3,
            budget: constraints?.budget || 200,
            tags: ['ai-generated', 'ai-first-v2', generatedDeck.strategy.toLowerCase()]
          }
        })
        
        // Add cards to the regular deck
        const regularCardMap = new Map<string, any>();
        
        cardMap.forEach((data, cardId) => {
          regularCardMap.set(cardId, {
            deckId: regularDeck.id,
            cardId: cardId,
            quantity: data.quantity,
            boardState: 'mainboard' as const
          });
        })
        
        await ctx.prisma.deckCard.createMany({
          data: Array.from(regularCardMap.values())
        })
        
        console.log('✅ AI-First deck saved with ID:', regularDeck.id)
        
        return { 
          deckId: regularDeck.id, 
          cardCount: generatedDeck.mainboard.length,
          aiFirstGenerated: true,
          generationTime,
          commander: generatedDeck.commander,
          strategy: generatedDeck.strategy,
          validation: generatedDeck.validation
        }
        
      } catch (error: any) {
        console.error('❌ AI-First deck generation error:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI-First deck generation failed: ${error.message || 'Unknown error'}`
        })
      }
    }),

  parseNaturalLanguageVision: protectedProcedure
    .input(z.object({
      visionText: z.string().min(10).max(2000),
      sessionId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { visionText, sessionId } = input

      try {
        console.log('🎯 Parsing natural language vision for user:', userId)
        console.log('Vision text:', visionText.substring(0, 100) + '...')
        
        // Use OpenAI to parse the natural language description into structured data
        const parsedData = await openaiService.parseNaturalLanguageVision({
          visionText,
          userId
        })

        console.log('🎯 Parsed vision data:', parsedData)

        // Save the parsed consultation session
        await ctx.prisma.consultationSession.create({
          data: {
            userId,
            sessionId,
            consultationData: {
              visionText,
              parsedData,
              ...parsedData
            } as any,
            currentStep: 'vision_parsed',
            completed: false
          }
        })

        return {
          success: true,
          parsedData,
          sessionId
        }
      } catch (error) {
        console.error('Error parsing natural language vision:', error)
        
        // Return fallback data to continue the flow
        return {
          success: false,
          parsedData: {
            commander: null,
            theme: 'custom',
            budget: 'moderate',
            powerLevel: 3,
            strategy: 'midrange'
          },
          error: 'Failed to parse vision, proceeding with manual input'
        }
      }
    }),

  // V3 Deck Generation with Personalization
  getCommanderSuggestions: protectedProcedure
    .input(RecommendCardInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { sessionId, prompt, constraints } = input

      try {
        console.log('🤖 Getting commander suggestions for user:', userId)
        
        // Get user's collection for ownership check
        const proxyService = new CollectionProxyService(ctx.prisma)
        let ownedCardIds = new Set<string>()
        
        try {
          const collection = await proxyService.fetchCollection(userId)
          collection.cards.forEach(card => {
            if (card.quantity > 0 || card.foilQuantity > 0) {
              ownedCardIds.add(card.cardId)
            }
          })
        } catch (error) {
          console.warn('Failed to fetch collection for commander suggestions:', error)
        }

        // Get commander suggestions
        const commanders = await openaiService.getCommanderSuggestions({
          prompt,
          constraints,
          deckContext: null,
          ownedCardIds,
        })

        console.log('🤖 Found', commanders.length, 'commander suggestions')

        // Process commander suggestions
        const processedCommanders: any[] = []
        
        for (const commander of commanders) {
          const cardData = await scryfallService.getCard(commander.cardId)
          if (!cardData) {
            console.warn(`⚠️ Could not find card data for commander ID: ${commander.cardId}`)
            continue
          }

          const owned = ownedCardIds.has(commander.cardId)
          
          processedCommanders.push({
            type: 'commander',
            cardId: commander.cardId,
            name: cardData.name,
            typeLine: cardData.type_line,
            setName: cardData.set_name,
            oracleText: cardData.oracle_text,
            imageUrl: cardData.image_uris?.normal || cardData.image_uris?.large,
            price: cardData.prices?.usd || '0.00',
            reasoning: commander.reason,
            confidence: commander.confidence,
            owned,
            colorIdentity: cardData.color_identity || [],
          })

          // Save to database
          await ctx.prisma.recommendation.create({
            data: {
              userId,
              sessionId,
              cardId: commander.cardId,
              reason: commander.reason,
              confidence: commander.confidence,
              owned,
            },
          })
        }

        console.log(`🎯 Processed ${processedCommanders.length} commanders successfully`)

        return processedCommanders
      } catch (error) {
        console.error('Error in getCommanderSuggestions:', error)
        return []
      }
    }),

  recommendAndLink: protectedProcedure
    .input(RecommendCardInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, sessionId, prompt, constraints } = input

      try {
        // First add an assistant message to acknowledge the request
        const assistantResponses = []
        
        // Get user's collection from external platform
        const proxyService = new CollectionProxyService(ctx.prisma)
        let ownedCardIds = new Set<string>()
        
        try {
          const collection = await proxyService.fetchCollection(userId)
          // Create set of owned card IDs
          collection.cards.forEach(card => {
            if (card.quantity > 0 || card.foilQuantity > 0) {
              ownedCardIds.add(card.cardId)
            }
          })
        } catch (error) {
          // If collection fetch fails, continue with empty owned set
          console.warn('Failed to fetch collection for ownership check:', error)
        }

        // Get deck context if provided
        let deckContext = null
        if (deckId) {
          const deck = await ctx.prisma.deck.findUnique({
            where: { id: deckId, userId },
            include: {
              cards: {
                select: { cardId: true, quantity: true },
              },
            },
          })

          if (!deck) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Deck not found',
            })
          }

          deckContext = deck
        }

        // Call OpenAI to get recommendations
        console.log('🤖 Calling OpenAI service with:', {
          prompt: prompt.substring(0, 100) + '...',
          constraints,
          deckContextExists: !!deckContext,
          ownedCardsCount: ownedCardIds.size
        })
        
        const recommendations = await openaiService.getCardRecommendations({
          prompt,
          constraints,
          deckContext,
          ownedCardIds,
        })
        
        console.log('🤖 OpenAI service returned:', recommendations.length, 'recommendations')

        // Process recommendations
        const processedRecommendations: any[] = []
        
        // Add assistant response first
        assistantResponses.push({
          type: 'assistant',
          content: `I've found ${recommendations.length} cards that would work great for your deck! Let me show you each one and explain why it's a good fit.`
        })

        for (const rec of recommendations) {
          // Fetch card details from Scryfall
          const cardData = await scryfallService.getCard(rec.cardId)
          
          if (!cardData) continue

          const owned = ownedCardIds.has(rec.cardId)
          
          // Generate affiliate link if not owned
          let tcgPlayerUrl: string | undefined
          let cardKingdomUrl: string | undefined
          
          if (!owned && process.env.ENABLE_AFFILIATE_LINKS === 'true') {
            // For now, just generate simple URLs - in production these would be real affiliate links
            tcgPlayerUrl = `https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${encodeURIComponent(cardData.name)}`
            cardKingdomUrl = `https://www.cardkingdom.com/catalog/search?search=header&filter[name]=${encodeURIComponent(cardData.name)}`
          }

          processedRecommendations.push({
            type: 'card',
            cardId: rec.cardId,
            name: cardData.name,
            typeLine: cardData.type_line,
            setName: cardData.set_name,
            oracleText: cardData.oracle_text,
            imageUrl: cardData.image_uris?.normal || cardData.image_uris?.large,
            price: cardData.prices?.usd || '0.00',
            priceChange: null, // Would calculate from price history
            reasoning: rec.reason,
            confidence: rec.confidence,
            owned,
            tcgPlayerUrl,
            cardKingdomUrl,
          })

          // Save recommendation to database
          await ctx.prisma.recommendation.create({
            data: {
              userId,
              deckId,
              sessionId,
              cardId: rec.cardId,
              reason: rec.reason,
              confidence: rec.confidence,
              owned,
              affiliateUrl: tcgPlayerUrl || cardKingdomUrl,
            },
          })
        }

        return [...assistantResponses, ...processedRecommendations]
      } catch (error) {
        console.error('Error in recommendAndLink:', error)
        
        // Return error message to display in chat
        return [{
          type: 'error',
          content: 'Sorry, I encountered an error while finding recommendations. Please try again or rephrase your request.'
        }]
      }
    }),

  getChatHistory: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { sessionId, limit } = input

      const recommendations = await ctx.prisma.recommendation.findMany({
        where: {
          userId,
          sessionId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      })

      return recommendations.reverse()
    }),

  trackClick: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      cardId: z.string(),
      affiliateUrl: z.string(),
      affiliatePartner: z.enum(['tcgplayer', 'cardkingdom', 'channelfireball']),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      await ctx.prisma.clickEvent.create({
        data: {
          userId,
          sessionId: input.sessionId,
          cardId: input.cardId,
          affiliateUrl: input.affiliateUrl,
          affiliatePartner: input.affiliatePartner,
        },
      })

      return { success: true }
    }),

  generateFullDeck: protectedProcedure
    .input(GenerateFullDeckInputSchema.extend({
      model: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { sessionId, consultationData, commander, constraints, model } = input

      try {
        console.log('🤖 Generating full deck for user:', userId)
        console.log('Commander:', commander)
        console.log('Consultation data:', JSON.stringify(consultationData, null, 2))
        console.log('Constraints:', JSON.stringify(constraints, null, 2))
        
        // Get user's collection for ownership check if needed
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
            console.log('🤖 Found', ownedCardIds.size, 'owned cards')
          } catch (error) {
            console.warn('Failed to fetch collection for deck generation:', error)
          }
        }

        // Ensure consultation data has valid strategy
        const validatedConsultationData = {
          ...consultationData,
          strategy: consultationData.strategy && 
                   ['aggro', 'control', 'combo', 'midrange', 'tribal', 'value', 'stax'].includes(consultationData.strategy) 
                   ? consultationData.strategy 
                   : 'midrange' // Default to midrange if invalid
        }
        
        // Generate complete deck using OpenAI service
        console.log('🚀 Calling enhanced OpenAI service to generate deck...')
        console.log('Validated consultation data:', JSON.stringify(validatedConsultationData, null, 2))
        console.log('📊 Starting deck generation at:', new Date().toISOString())
        
        let deckCards
        try {
          const generationStartTime = Date.now()
          console.log('⏱️ Starting optimized deck generation...')
          
          // Pre-warm caches before generation
          await enhancedOpenAIService.prewarmForDeckGeneration()
          
          // Use the enhanced service with batch lookups and timeout handling
          deckCards = await enhancedOpenAIService.generateCompleteDeckOptimized({
            consultationData: validatedConsultationData,
            commander,
            constraints,
            model, // Pass the model parameter
          })
          
          const generationTime = Date.now() - generationStartTime
          console.log(`✅ Complete deck generation finished in ${generationTime}ms (${(generationTime / 1000).toFixed(1)}s)`)
        } catch (openAIError: any) {
          console.error('❌ Deck generation service error:', openAIError)
          console.error('Error stack:', openAIError.stack)
          
          // Check if it's a timeout error
          if (openAIError.message?.includes('timeout') || openAIError.message?.includes('timed out')) {
            throw new TRPCError({
              code: 'TIMEOUT',
              message: 'Deck generation took too long. Please try again or try with simpler preferences.',
            })
          }
          
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to generate deck: ${openAIError.message || 'Unknown error'}`,
          })
        }

        console.log('🤖 Generated deck with', deckCards.length, 'cards')
        console.log('Sample cards:', deckCards.slice(0, 3).map(c => ({ 
          cardId: c.cardId, 
          category: c.category, 
          role: c.role 
        })))

        // Validate deck has correct number of cards
        if (deckCards.length !== 99) {
          console.error(`❌ Invalid deck size: ${deckCards.length} cards (expected 99)`)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Generated deck has ${deckCards.length} cards, but needs exactly 99 cards`,
          })
        }

        // Create the generated deck in database
        let generatedDeck
        try {
          generatedDeck = await ctx.prisma.generatedDeck.create({
            data: {
              userId,
              sessionId,
              name: `${commander} Deck`,
              commander,
              format: 'commander',
              strategy: {
                name: validatedConsultationData.strategy || 'Custom Strategy',
                description: 'AI-generated deck strategy',
                archetype: validatedConsultationData.strategy || 'midrange',
                themes: consultationData.themes || [],
                gameplan: 'Execute the strategy and win',
                strengths: [],
                weaknesses: []
              },
              winConditions: consultationData.winConditions ? [{
                type: consultationData.winConditions.primary,
                description: `Win through ${consultationData.winConditions.primary} strategy`,
                keyCards: [],
                probability: 0.7
              }] : [],
              powerLevel: constraints?.powerLevel || consultationData.powerLevel || 3,
              estimatedBudget: constraints?.budget || consultationData.budget,
              consultationData: validatedConsultationData as any,
              status: 'generated'
            },
            include: {
              cards: true
            }
          })
        } catch (dbError: any) {
          console.error('❌ Database error creating generatedDeck:', dbError)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to save deck to database: ${dbError.message || 'Unknown error'}`,
          })
        }

        // Check if deck already has cards (to handle duplicate calls)
        const existingCards = await ctx.prisma.generatedDeckCard.findMany({
          where: { deckId: generatedDeck.id },
          take: 1
        })

        if (existingCards.length > 0) {
          console.log('🔄 Deck already has cards, returning existing deck')
          // Find associated regular deck
          const regularDeck = await ctx.prisma.deck.findFirst({
            where: {
              userId,
              name: generatedDeck.name,
              commander: generatedDeck.commander
            }
          })
          
          if (regularDeck) {
            return { deckId: regularDeck.id, cardCount: 100 }
          }
        }

        // Add cards to the generated deck using createMany for better performance
        console.log('💾 Inserting', deckCards.length, 'cards into generated deck')
        try {
          await ctx.prisma.generatedDeckCard.createMany({
            data: deckCards.map(card => ({
              deckId: generatedDeck.id,
              cardId: card.cardId,
              quantity: card.quantity,
              category: card.category,
              role: card.role,
              reasoning: card.reasoning,
              alternatives: card.alternatives || [],
              upgradeOptions: card.upgradeOptions || [],
              budgetOptions: card.budgetOptions || []
            })),
            skipDuplicates: true // This prevents unique constraint errors
          })
        } catch (dbError: any) {
          console.error('❌ Database error creating generatedDeckCards:', dbError)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to save deck cards: ${dbError.message || 'Unknown error'}`,
          })
        }

        // Save consultation session to database
        try {
          await ctx.prisma.consultationSession.create({
            data: {
              userId,
              sessionId,
              consultationData: validatedConsultationData as any,
              currentStep: 'complete',
              completed: true,
              generatedDeckId: generatedDeck.id
            },
          })
        } catch (sessionError: any) {
          console.warn('⚠️ Failed to save consultation session:', sessionError)
          // Don't fail the whole operation if session save fails
        }

        console.log('🤖 Saved generated deck with ID:', generatedDeck.id)
        
        // Create a regular deck from the generated deck so it can be viewed/edited
        console.log('📦 Creating regular deck from generated deck...')
        let regularDeck
        try {
          regularDeck = await ctx.prisma.deck.create({
            data: {
              userId,
              name: generatedDeck.name,
              format: generatedDeck.format,
              commander: generatedDeck.commander,
              description: `AI-generated ${validatedConsultationData.strategy || 'custom'} deck with ${generatedDeck.commander}`,
              isPublic: false,
              powerLevel: generatedDeck.powerLevel,
              budget: generatedDeck.estimatedBudget,
              tags: [
                'ai-generated',
                validatedConsultationData.strategy || 'custom',
                `bracket-${generatedDeck.powerLevel}`
              ].filter(Boolean)
            }
          })
        } catch (dbError: any) {
          console.error('❌ Database error creating regular deck:', dbError)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create deck: ${dbError.message || 'Unknown error'}`,
          })
        }
        
        // Add cards to the regular deck
        console.log('💾 Adding cards to regular deck...')
        const deckCardData = deckCards.map(card => ({
          deckId: regularDeck.id,
          cardId: card.cardId,
          quantity: card.quantity,
          category: card.category,
          boardState: 'mainboard' as const
        }))
        
        try {
          await ctx.prisma.deckCard.createMany({
            data: deckCardData,
            skipDuplicates: true
          })
        } catch (dbError: any) {
          console.error('❌ Database error creating deckCards:', dbError)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to add cards to deck: ${dbError.message || 'Unknown error'}`,
          })
        }
        
        console.log('✅ Regular deck created with ID:', regularDeck.id)
        
        // Return only the deck ID to avoid payload size issues
        // The client can fetch the full deck details separately
        return { deckId: regularDeck.id, cardCount: deckCards.length }
      } catch (error: any) {
        console.error('❌ Error in generateFullDeck:', error)
        
        // If it's already a TRPCError, re-throw it
        if (error.code && error.message) {
          throw error
        }
        
        // Otherwise, throw a generic error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate deck: ${error.message || 'Unknown error occurred'}`,
        })
      }
    }),

  analyzeDeck: protectedProcedure
    .input(AnalyzeDeckInputSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId } = input

      try {
        console.log('🔍 Analyzing deck:', deckId, 'for user:', userId)

        // Get the generated deck with cards
        const deck = await ctx.prisma.generatedDeck.findUnique({
          where: { 
            id: deckId,
            userId // Ensure user owns the deck
          },
          include: {
            cards: true,
            analysis: true
          }
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          })
        }

        // Check if analysis already exists and is recent (within 1 hour)
        if (deck.analysis && 
            new Date().getTime() - deck.analysis.analyzedAt.getTime() < 3600000) {
          console.log('🔍 Using cached analysis')
          return {
            statistics: deck.analysis.statistics as DeckStatistics,
            synergies: deck.analysis.synergies as CardSynergy[],
            weaknesses: deck.analysis.weaknesses,
            strategyDescription: deck.analysis.strategyDescription,
            winConditionAnalysis: deck.analysis.winConditionAnalysis,
            playPatternDescription: deck.analysis.playPatternDescription
          }
        }

        // Calculate deck statistics
        const statistics = await calculateDeckStatistics(deck.cards, ctx.prisma)
        
        // Get card details for synergy analysis
        const cardDetails = await Promise.all(
          deck.cards.map(async (card) => {
            const scryfallCard = await scryfallService.getCard(card.cardId)
            return scryfallCard
          })
        )
        
        // Analyze card synergies using AI
        const synergies = await openaiService.analyzeDeckSynergies(cardDetails.filter((card): card is ScryfallCard => card !== null))
        
        // Generate strategy analysis
        const deckForAnalysis: GeneratedDeck = {
          id: deck.id,
          name: deck.name,
          commander: deck.commander,
          format: deck.format as 'commander',
          strategy: deck.strategy as any,
          winConditions: deck.winConditions as any,
          powerLevel: deck.powerLevel || 3,
          estimatedBudget: Number(deck.estimatedBudget) || 0,
          cards: deck.cards.map(card => ({
            cardId: card.cardId,
            quantity: card.quantity,
            category: card.category,
            role: card.role || 'support',
            reasoning: card.reasoning || '',
            alternatives: card.alternatives,
            upgradeOptions: card.upgradeOptions,
            budgetOptions: card.budgetOptions
          })),
          categories: [],
          statistics,
          synergies,
          weaknesses: [],
          generatedAt: deck.createdAt,
          consultationData: deck.consultationData as any
        }
        
        const strategyAnalysis = await openaiService.suggestDeckStrategy(deckForAnalysis)

        // Save or update analysis
        const analysisData = {
          statistics: statistics as any,
          synergies: synergies as any,
          weaknesses: strategyAnalysis.strategy.weaknesses || [],
          strategyDescription: strategyAnalysis.strategy.description,
          winConditionAnalysis: strategyAnalysis.winConditions.map(wc => wc.description).join('; '),
          playPatternDescription: strategyAnalysis.playPattern,
          analyzedAt: new Date()
        }

        if (deck.analysis) {
          await ctx.prisma.deckAnalysis.update({
            where: { id: deck.analysis.id },
            data: analysisData
          })
        } else {
          await ctx.prisma.deckAnalysis.create({
            data: {
              deckId: deck.id,
              ...analysisData
            }
          })
        }

        console.log('🔍 Analysis complete for deck:', deckId)
        return {
          statistics,
          synergies,
          weaknesses: strategyAnalysis.strategy.weaknesses || [],
          strategyDescription: strategyAnalysis.strategy.description,
          winConditionAnalysis: strategyAnalysis.winConditions.map(wc => wc.description).join('; '),
          playPatternDescription: strategyAnalysis.playPattern
        }
      } catch (error) {
        console.error('Error in analyzeDeck:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze deck. Please try again.'
        })
      }
    }),

  suggestDeckImprovements: protectedProcedure
    .input(SuggestDeckImprovementsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, focusArea } = input

      try {
        console.log('💡 Suggesting improvements for deck:', deckId, 'focus:', focusArea)

        // Get the generated deck with cards and analysis
        const deck = await ctx.prisma.generatedDeck.findUnique({
          where: { 
            id: deckId,
            userId
          },
          include: {
            cards: true,
            analysis: true
          }
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          })
        }

        // Get user's collection for ownership check
        const proxyService = new CollectionProxyService(ctx.prisma)
        let ownedCardIds = new Set<string>()
        
        try {
          const collection = await proxyService.fetchCollection(userId)
          collection.cards.forEach(card => {
            if (card.quantity > 0 || card.foilQuantity > 0) {
              ownedCardIds.add(card.cardId)
            }
          })
        } catch (error) {
          console.warn('Failed to fetch collection for improvements:', error)
        }

        // Generate improvement suggestions using AI
        const deckForImprovements: GeneratedDeck = {
          id: deck.id,
          name: deck.name,
          commander: deck.commander,
          format: deck.format as 'commander',
          strategy: deck.strategy as any,
          winConditions: deck.winConditions as any,
          powerLevel: deck.powerLevel || 3,
          estimatedBudget: Number(deck.estimatedBudget) || 0,
          cards: deck.cards.map(card => ({
            cardId: card.cardId,
            quantity: card.quantity,
            category: card.category,
            role: card.role || 'support',
            reasoning: card.reasoning || '',
            alternatives: card.alternatives,
            upgradeOptions: card.upgradeOptions,
            budgetOptions: card.budgetOptions
          })),
          categories: [],
          statistics: deck.analysis?.statistics as DeckStatistics || {} as DeckStatistics,
          synergies: deck.analysis?.synergies as CardSynergy[] || [],
          weaknesses: deck.analysis?.weaknesses || [],
          generatedAt: deck.createdAt,
          consultationData: deck.consultationData as any
        }
        
        const improvements = await openaiService.suggestDeckImprovements({
          deck: deckForImprovements,
          focusArea,
          ownedCardIds
        })

        console.log('💡 Generated', improvements.length, 'improvement suggestions')
        return improvements
      } catch (error) {
        console.error('Error in suggestDeckImprovements:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate improvement suggestions. Please try again.'
        })
      }
    }),

  generateShareableLink: protectedProcedure
    .input(z.object({
      deckId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId } = input

      try {
        console.log('🔗 Generating shareable link for deck:', deckId)

        // Get the generated deck with cards
        const deck = await ctx.prisma.generatedDeck.findUnique({
          where: { 
            id: deckId,
            userId
          },
          include: {
            cards: true
          }
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          })
        }

        // Get card details for the shareable link
        const cardDetails = await Promise.all(
          deck.cards.map(async (card) => {
            const scryfallCard = await scryfallService.getCard(card.cardId)
            return {
              ...card,
              cardData: scryfallCard
            }
          })
        )

        // Generate shareable link data
        const shareData = generateShareableLink(deck, cardDetails)

        console.log('🔗 Shareable link generated:', shareData.url)
        return shareData
      } catch (error) {
        console.error('Error in generateShareableLink:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate shareable link. Please try again.'
        })
      }
    }),

  exportDeck: protectedProcedure
    .input(ExportDeckInputSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, format } = input

      try {
        console.log('📤 Exporting deck:', deckId, 'format:', format)

        // Get the generated deck with cards
        const deck = await ctx.prisma.generatedDeck.findUnique({
          where: { 
            id: deckId,
            userId
          },
          include: {
            cards: true
          }
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found or access denied'
          })
        }

        // Get card details for export
        const cardDetails = await Promise.all(
          deck.cards.map(async (card) => {
            const scryfallCard = await scryfallService.getCard(card.cardId)
            return {
              ...card,
              cardData: scryfallCard
            }
          })
        )

        // Generate export based on format
        let exportResult: any

        switch (format) {
          case 'text':
            exportResult = generateTextExport(deck, cardDetails)
            break
          case 'json':
            exportResult = generateJSONExport(deck, cardDetails)
            break
          case 'moxfield':
            exportResult = generateMoxfieldExport(deck, cardDetails)
            break
          case 'archidekt':
            exportResult = generateArchidektExport(deck, cardDetails)
            break
          case 'print':
            exportResult = generatePrintFriendlyExport(deck, cardDetails)
            break
          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unsupported export format'
            })
        }

        // Update deck status to exported
        await ctx.prisma.generatedDeck.update({
          where: { id: deckId },
          data: { status: 'exported' }
        })

        console.log('📤 Export complete for deck:', deckId)
        return exportResult
      } catch (error) {
        console.error('Error in exportDeck:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export deck. Please try again.'
        })
      }
    }),

  saveConsultationSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      consultationData: ConsultationDataSchema,
      currentStep: z.string(),
      completed: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { sessionId, consultationData, currentStep, completed } = input

      try {
        console.log('💾 Saving consultation session:', sessionId, 'step:', currentStep)

        // Upsert consultation session
        const session = await ctx.prisma.consultationSession.upsert({
          where: { sessionId },
          update: {
            consultationData: consultationData as any,
            currentStep,
            completed,
            updatedAt: new Date()
          },
          create: {
            userId,
            sessionId,
            consultationData: consultationData as any,
            currentStep,
            completed
          }
        })

        console.log('💾 Consultation session saved:', session.id)
        return { success: true, sessionId: session.sessionId }
      } catch (error) {
        console.error('Error in saveConsultationSession:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save consultation session. Please try again.'
        })
      }
    }),

  // Collection Integration Endpoints
  getCollectionOwnership: protectedProcedure
    .input(z.object({
      cardIds: z.array(z.string())
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { cardIds } = input

      try {
        const proxyService = new CollectionProxyService(ctx.prisma)
        const ownership = await proxyService.trackOwnership(userId, cardIds)
        
        return Object.fromEntries(ownership)
      } catch (error) {
        console.error('Error getting collection ownership:', error)
        return {}
      }
    }),

  calculateDeckBudget: protectedProcedure
    .input(z.object({
      deckId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId } = input

      try {
        // Get deck cards
        const deck = await ctx.prisma.generatedDeck.findUnique({
          where: { id: deckId, userId },
          include: { cards: true }
        })

        if (!deck) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deck not found'
          })
        }

        // Get card prices
        const cardIds = deck.cards.map(c => c.cardId)
        const prices = new Map<string, number>()
        
        for (const cardId of cardIds) {
          const card = await scryfallService.getCard(cardId)
          if (card?.prices?.usd) {
            prices.set(cardId, parseFloat(card.prices.usd))
          }
        }

        // Calculate budget with collection awareness
        const proxyService = new CollectionProxyService(ctx.prisma)
        const budget = await proxyService.calculateBudget(userId, cardIds, prices)

        return budget
      } catch (error) {
        console.error('Error calculating deck budget:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate deck budget'
        })
      }
    }),

  getCollectionAwareSuggestions: protectedProcedure
    .input(z.object({
      category: z.string(),
      alternatives: z.array(z.string())
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { category, alternatives } = input

      try {
        const proxyService = new CollectionProxyService(ctx.prisma)
        const suggestions = await proxyService.getCollectionAwareSuggestions(
          userId,
          category,
          alternatives
        )

        return suggestions
      } catch (error) {
        console.error('Error getting collection-aware suggestions:', error)
        return {
          owned: [],
          unowned: alternatives,
          recommendations: alternatives.map(cardId => ({
            cardId,
            reason: 'Unable to check ownership',
            priority: 5
          }))
        }
      }
    }),

  syncCollectionSources: protectedProcedure
    .input(z.object({
      platforms: z.object({
        moxfield: z.array(z.string()).optional(),
        archidekt: z.array(z.string()).optional(),
        edhrec: z.array(z.string()).optional()
      })
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { platforms } = input

      try {
        const proxyService = new CollectionProxyService(ctx.prisma)
        const result = await proxyService.syncMultiplePlatforms(userId, platforms)

        return result
      } catch (error) {
        console.error('Error syncing collection sources:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sync collection sources'
        })
      }
    }),

  getMarketIntelligence: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      budget: z.number().optional()
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, budget } = input

      try {
        const { MarketAnalysisService } = await import('../services/market-analysis')
        const { PriceTrackingService } = await import('../services/price-tracking')
        
        const priceService = new PriceTrackingService(ctx.prisma)
        const marketService = new MarketAnalysisService(ctx.prisma, priceService)
        
        const intelligence = await marketService.analyzeDeckMarket(deckId, userId, budget)
        return intelligence
      } catch (error) {
        console.error('Error getting market intelligence:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get market intelligence'
        })
      }
    }),

  getMetaAnalysis: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      format: z.string().default('commander')
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id
      const { deckId, format } = input

      try {
        const { MetaAnalysisService } = await import('../services/meta-analysis')
        const metaService = new MetaAnalysisService(ctx.prisma)
        
        const analysis = await metaService.analyzeDeckMeta(deckId, format)
        return analysis
      } catch (error) {
        console.error('Error getting meta analysis:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get meta analysis'
        })
      }
    }),

  getPopularityTrends: protectedProcedure
    .input(z.object({
      format: z.string().default('commander'),
      timeframe: z.enum(['week', 'month', 'quarter']).default('month')
    }))
    .query(async ({ ctx, input }) => {
      const { format, timeframe } = input

      try {
        const { MetaAnalysisService } = await import('../services/meta-analysis')
        const metaService = new MetaAnalysisService(ctx.prisma)
        
        const trends = await metaService.getPopularityTrends(format, timeframe)
        return trends
      } catch (error) {
        console.error('Error getting popularity trends:', error)
        return []
      }
    }),

  assessCompetitiveViability: protectedProcedure
    .input(z.object({
      deckId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const { deckId } = input

      try {
        const { MetaAnalysisService } = await import('../services/meta-analysis')
        const metaService = new MetaAnalysisService(ctx.prisma)
        
        const viability = await metaService.assessCompetitiveViability(deckId)
        return viability
      } catch (error) {
        console.error('Error assessing competitive viability:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to assess competitive viability'
        })
      }
    }),
}) 

// Helper functions for deck analysis and export

async function calculateDeckStatistics(cards: any[], prisma: any): Promise<DeckStatistics> {
  // Get card details from Scryfall
  const cardDetails = await Promise.all(
    cards.map(async (card) => {
      const scryfallCard = await scryfallService.getCard(card.cardId)
      return {
        ...card,
        cardData: scryfallCard
      }
    })
  )

  // Calculate mana curve
  const manaCurve = [0, 0, 0, 0, 0, 0, 0, 0] // [0, 1, 2, 3, 4, 5, 6, 7+]
  let totalCMC = 0
  let nonlandCards = 0

  // Calculate color distribution
  const colorDistribution = {
    white: 0,
    blue: 0,
    black: 0,
    red: 0,
    green: 0,
    colorless: 0,
    multicolor: 0,
    devotion: {} as Record<string, number>
  }

  // Calculate type distribution
  const typeDistribution = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    artifact: 0,
    enchantment: 0,
    planeswalker: 0,
    land: 0,
    other: 0
  }

  // Calculate rarity distribution
  const rarityDistribution = {
    common: 0,
    uncommon: 0,
    rare: 0,
    mythic: 0
  }

  let totalValue = 0
  let landCount = 0

  for (const card of cardDetails) {
    if (!card.cardData) continue

    const quantity = card.quantity || 1
    const cmc = card.cardData.cmc || 0
    const isLand = card.cardData.type_line.toLowerCase().includes('land')

    // Mana curve
    if (!isLand) {
      const cmcIndex = Math.min(cmc, 7)
      manaCurve[cmcIndex] += quantity
      totalCMC += cmc * quantity
      nonlandCards += quantity
    } else {
      landCount += quantity
    }

    // Color distribution
    const colors = card.cardData.colors || []
    const colorIdentity = card.cardData.color_identity || []
    
    if (colors.length === 0) {
      colorDistribution.colorless += quantity
    } else if (colors.length > 1) {
      colorDistribution.multicolor += quantity
    } else {
      colors.forEach((color: string) => {
        switch (color) {
          case 'W': colorDistribution.white += quantity; break
          case 'U': colorDistribution.blue += quantity; break
          case 'B': colorDistribution.black += quantity; break
          case 'R': colorDistribution.red += quantity; break
          case 'G': colorDistribution.green += quantity; break
        }
      })
    }

    // Calculate devotion
    colorIdentity.forEach((color: string) => {
      colorDistribution.devotion[color] = (colorDistribution.devotion[color] || 0) + quantity
    })

    // Type distribution
    const typeLine = card.cardData.type_line.toLowerCase()
    if (typeLine.includes('creature')) {
      typeDistribution.creature += quantity
    } else if (typeLine.includes('instant')) {
      typeDistribution.instant += quantity
    } else if (typeLine.includes('sorcery')) {
      typeDistribution.sorcery += quantity
    } else if (typeLine.includes('artifact')) {
      typeDistribution.artifact += quantity
    } else if (typeLine.includes('enchantment')) {
      typeDistribution.enchantment += quantity
    } else if (typeLine.includes('planeswalker')) {
      typeDistribution.planeswalker += quantity
    } else if (typeLine.includes('land')) {
      typeDistribution.land += quantity
    } else {
      typeDistribution.other += quantity
    }

    // Rarity distribution
    const rarity = card.cardData.rarity
    switch (rarity) {
      case 'common': rarityDistribution.common += quantity; break
      case 'uncommon': rarityDistribution.uncommon += quantity; break
      case 'rare': rarityDistribution.rare += quantity; break
      case 'mythic': rarityDistribution.mythic += quantity; break
    }

    // Total value
    const price = parseFloat(card.cardData.prices?.usd || '0')
    totalValue += price * quantity
  }

  const averageCMC = nonlandCards > 0 ? totalCMC / nonlandCards : 0
  const peakCMC = manaCurve.indexOf(Math.max(...manaCurve))
  const landRatio = landCount / (landCount + nonlandCards)

  return {
    manaCurve: {
      distribution: manaCurve,
      peakCMC,
      averageCMC,
      landRatio
    },
    colorDistribution,
    typeDistribution,
    rarityDistribution,
    averageCMC,
    totalValue,
    landCount,
    nonlandCount: nonlandCards
  }
}

// Export functions are now imported from the deck-export service
