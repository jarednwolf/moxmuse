import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { formatLegalityValidator, SUPPORTED_FORMATS } from '../services/format-legality-validator'
import { logger } from '../services/core/logging'

// Input schemas
const ValidateDeckInputSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().min(1),
    category: z.string().optional()
  })),
  format: z.enum(SUPPORTED_FORMATS),
  sideboard: z.array(z.object({
    cardId: z.string(),
    quantity: z.number().min(1)
  })).optional()
})

const GetCardLegalityInputSchema = z.object({
  cardId: z.string(),
  formats: z.array(z.enum(SUPPORTED_FORMATS)).optional()
})

const GetBatchCardLegalityInputSchema = z.object({
  cardIds: z.array(z.string()),
  formats: z.array(z.enum(SUPPORTED_FORMATS)).optional()
})

const GetFormatRulesInputSchema = z.object({
  format: z.enum(SUPPORTED_FORMATS)
})

const CreateCustomFormatInputSchema = z.object({
  name: z.string().min(1).max(50),
  deckSize: z.object({
    min: z.number().min(1),
    max: z.number().min(1)
  }),
  sideboardSize: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }),
  cardLimits: z.object({
    default: z.number().min(1),
    exceptions: z.record(z.string(), z.number()).optional()
  }),
  bannedCards: z.array(z.string()),
  restrictedCards: z.array(z.string()),
  specialRules: z.array(z.string()).optional()
})

const UpdateBannedListInputSchema = z.object({
  format: z.enum(SUPPORTED_FORMATS),
  updateType: z.enum(['banned', 'unbanned', 'restricted', 'unrestricted']),
  cards: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    reason: z.string().optional()
  })),
  effectiveDate: z.string(),
  source: z.string()
})

export const formatLegalityRouter = createTRPCRouter({
  /**
   * Validate a deck against format rules
   */
  validateDeck: publicProcedure
    .input(ValidateDeckInputSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('Validating deck', { 
          format: input.format, 
          cardCount: input.cards.length,
          hasSideboard: !!input.sideboard
        })

        const result = await formatLegalityValidator.validateDeck(
          input.cards,
          input.format,
          input.sideboard
        )

        logger.info('Deck validation completed', {
          format: input.format,
          isValid: result.isValid,
          violations: result.violations.length,
          warnings: result.warnings.length
        })

        return result
      } catch (error) {
        logger.error('Error in deck validation', error as Error)
        throw error
      }
    }),

  /**
   * Get legality information for a single card
   */
  getCardLegality: publicProcedure
    .input(GetCardLegalityInputSchema)
    .query(async ({ input }) => {
      try {
        const legality = await formatLegalityValidator.getCardLegality(input.cardId)
        
        if (!legality) {
          return null
        }

        // Filter by requested formats if specified
        if (input.formats) {
          const filteredLegalities: Record<string, string> = {}
          for (const format of input.formats) {
            if (legality.legalities[format]) {
              filteredLegalities[format] = legality.legalities[format]
            }
          }
          return {
            ...legality,
            legalities: filteredLegalities
          }
        }

        return legality
      } catch (error) {
        logger.error('Error getting card legality', error as Error)
        throw error
      }
    }),

  /**
   * Get legality information for multiple cards
   */
  getBatchCardLegality: publicProcedure
    .input(GetBatchCardLegalityInputSchema)
    .query(async ({ input }) => {
      try {
        const legalities = await formatLegalityValidator.getBatchCardLegalities(input.cardIds)
        
        const results: Record<string, any> = {}
        
        legalities.forEach((legality, cardId) => {
          if (legality) {
            // Filter by requested formats if specified
            if (input.formats) {
              const filteredLegalities: Record<string, string> = {}
              for (const format of input.formats) {
                if (legality.legalities[format]) {
                  filteredLegalities[format] = legality.legalities[format]
                }
              }
              results[cardId] = {
                ...legality,
                legalities: filteredLegalities
              }
            } else {
              results[cardId] = legality
            }
          } else {
            results[cardId] = null
          }
        })

        return results
      } catch (error) {
        logger.error('Error getting batch card legality', error as Error)
        throw error
      }
    }),

  /**
   * Get format rules and banned lists
   */
  getFormatRules: publicProcedure
    .input(GetFormatRulesInputSchema)
    .query(async ({ input }) => {
      try {
        const rules = await formatLegalityValidator.getFormatRules(input.format)
        return rules
      } catch (error) {
        logger.error('Error getting format rules', error as Error)
        throw error
      }
    }),

  /**
   * Get all supported formats
   */
  getSupportedFormats: publicProcedure
    .query(async () => {
      return {
        formats: SUPPORTED_FORMATS.map(format => ({
          id: format,
          name: format.charAt(0).toUpperCase() + format.slice(1),
          description: getFormatDescription(format)
        }))
      }
    }),

  /**
   * Update banned lists (admin only)
   */
  updateBannedLists: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Check if user has admin permissions
        // This would integrate with your auth system
        const isAdmin = await checkAdminPermissions(ctx.session.user.id)
        if (!isAdmin) {
          throw new Error('Insufficient permissions')
        }

        const result = await formatLegalityValidator.updateBannedLists()
        
        logger.info('Banned lists updated', {
          userId: ctx.session.user.id,
          updatedFormats: result.updatedFormats.length,
          errors: result.errors.length
        })

        return result
      } catch (error) {
        logger.error('Error updating banned lists', error as Error)
        throw error
      }
    }),

  /**
   * Check for format rotations
   */
  checkFormatRotations: publicProcedure
    .query(async () => {
      try {
        const rotations = await formatLegalityValidator.checkFormatRotations()
        return { rotations }
      } catch (error) {
        logger.error('Error checking format rotations', error as Error)
        throw error
      }
    }),

  /**
   * Create custom format (protected)
   */
  createCustomFormat: protectedProcedure
    .input(CreateCustomFormatInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info('Creating custom format', {
          userId: ctx.session.user.id,
          formatName: input.name
        })

        const customFormat = await formatLegalityValidator.createCustomFormat(
          input.name,
          {
            deckSize: input.deckSize,
            sideboardSize: input.sideboardSize,
            cardLimits: input.cardLimits,
            bannedCards: input.bannedCards,
            restrictedCards: input.restrictedCards,
            specialRules: input.specialRules
          }
        )

        logger.info('Custom format created', {
          userId: ctx.session.user.id,
          formatName: input.name
        })

        return customFormat
      } catch (error) {
        logger.error('Error creating custom format', error as Error)
        throw error
      }
    }),

  /**
   * Get format legality statistics
   */
  getFormatStats: publicProcedure
    .input(z.object({
      format: z.enum(SUPPORTED_FORMATS)
    }))
    .query(async ({ input }) => {
      try {
        // This would return statistics about format usage, popular cards, etc.
        // For now, return mock data
        return {
          format: input.format,
          totalDecks: 0,
          popularCards: [],
          recentBans: [],
          upcomingRotations: []
        }
      } catch (error) {
        logger.error('Error getting format stats', error as Error)
        throw error
      }
    }),

  /**
   * Validate card in specific format (quick check)
   */
  validateCard: publicProcedure
    .input(z.object({
      cardId: z.string(),
      format: z.enum(SUPPORTED_FORMATS)
    }))
    .query(async ({ input }) => {
      try {
        const legality = await formatLegalityValidator.getCardLegality(input.cardId)
        
        if (!legality) {
          return {
            isValid: false,
            status: 'not_found' as const,
            message: 'Card not found'
          }
        }

        const status = legality.legalities[input.format] || 'not_legal'
        
        return {
          isValid: status === 'legal',
          status: status as 'legal' | 'not_legal' | 'banned' | 'restricted',
          message: getStatusMessage(status, legality.name, input.format)
        }
      } catch (error) {
        logger.error('Error validating card', error as Error)
        throw error
      }
    })
})

// Helper functions
function getFormatDescription(format: string): string {
  const descriptions: Record<string, string> = {
    standard: 'The most recent sets, rotating annually',
    pioneer: 'Cards from Return to Ravnica forward',
    modern: 'Cards from 8th Edition and Mirrodin forward',
    legacy: 'All cards except those on the banned list',
    vintage: 'All cards with restricted list',
    commander: '100-card singleton format with legendary commander',
    brawl: '60-card singleton format with legendary commander',
    historic: 'Arena-specific format with curated card pool',
    alchemy: 'Arena format with digital-only cards',
    explorer: 'Arena format mirroring Pioneer',
    timeless: 'Arena eternal format',
    pauper: 'Commons-only format',
    penny: 'Budget format with price restrictions'
  }
  
  return descriptions[format] || 'Format description not available'
}

function getStatusMessage(status: string, cardName: string, format: string): string {
  switch (status) {
    case 'legal':
      return `${cardName} is legal in ${format}`
    case 'banned':
      return `${cardName} is banned in ${format}`
    case 'restricted':
      return `${cardName} is restricted to 1 copy in ${format}`
    case 'not_legal':
      return `${cardName} is not legal in ${format}`
    default:
      return `Unknown legality status for ${cardName} in ${format}`
  }
}

async function checkAdminPermissions(userId: string): Promise<boolean> {
  // This would check if the user has admin permissions
  // For now, return false - implement based on your auth system
  return false
}
