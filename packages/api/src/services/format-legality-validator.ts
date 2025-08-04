import axios from 'axios'
import { z } from 'zod'
import { prisma } from '@moxmuse/db'
import { redisCache } from './redis'
import { scryfallRateLimiter } from '../utils/rateLimiter'
import { logger } from './core/logging'
// Performance monitoring disabled temporarily
// // Performance monitoring disabled temporarily
// // Performance monitoring disabled temporarily
// import { performanceMonitor } from './core/performance-monitor'

const SCRYFALL_API = process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com'
const CACHE_TTL = 60 * 60 * 24 // 24 hours for legality data
const BANNED_LIST_CACHE_TTL = 60 * 60 * 6 // 6 hours for banned lists

// Format definitions
export const SUPPORTED_FORMATS = [
  'standard',
  'pioneer',
  'modern',
  'legacy',
  'vintage',
  'commander',
  'brawl',
  'historic',
  'alchemy',
  'explorer',
  'timeless',
  'pauper',
  'penny'
] as const

export type SupportedFormat = typeof SUPPORTED_FORMATS[number]

// Legality status types
export type LegalityStatus = 'legal' | 'not_legal' | 'banned' | 'restricted'

// Format legality data schema
const FormatLegalitySchema = z.object({
  format: z.enum(SUPPORTED_FORMATS),
  status: z.enum(['legal', 'not_legal', 'banned', 'restricted']),
  lastUpdated: z.string(),
  source: z.string().default('scryfall')
})

export type FormatLegality = z.infer<typeof FormatLegalitySchema>

// Card legality data schema
const CardLegalityDataSchema = z.object({
  cardId: z.string(),
  name: z.string(),
  legalities: z.record(z.string(), z.enum(['legal', 'not_legal', 'banned', 'restricted'])),
  lastUpdated: z.string(),
  scryfallId: z.string()
})

export type CardLegalityData = z.infer<typeof CardLegalityDataSchema>

// Deck validation result schema
const DeckValidationResultSchema = z.object({
  isValid: z.boolean(),
  format: z.string(),
  violations: z.array(z.object({
    type: z.enum(['banned_card', 'restricted_card', 'illegal_card', 'deck_size', 'sideboard_size', 'card_limit']),
    cardId: z.string().optional(),
    cardName: z.string().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info'])
  })),
  warnings: z.array(z.object({
    type: z.string(),
    message: z.string(),
    cardId: z.string().optional()
  })),
  suggestions: z.array(z.object({
    type: z.string(),
    message: z.string(),
    cardId: z.string().optional(),
    suggestedCards: z.array(z.string()).optional()
  }))
})

export type DeckValidationResult = z.infer<typeof DeckValidationResultSchema>

// Format rules schema
const FormatRulesSchema = z.object({
  format: z.string(),
  deckSize: z.object({
    min: z.number(),
    max: z.number()
  }),
  sideboardSize: z.object({
    min: z.number(),
    max: z.number()
  }),
  cardLimits: z.object({
    default: z.number(),
    exceptions: z.record(z.string(), z.number()).optional()
  }),
  bannedCards: z.array(z.string()),
  restrictedCards: z.array(z.string()),
  specialRules: z.array(z.string()).optional(),
  lastUpdated: z.string()
})

export type FormatRules = z.infer<typeof FormatRulesSchema>

// Banned list update schema
const BannedListUpdateSchema = z.object({
  format: z.string(),
  updateType: z.enum(['banned', 'unbanned', 'restricted', 'unrestricted']),
  cards: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    reason: z.string().optional()
  })),
  effectiveDate: z.string(),
  announcementDate: z.string(),
  source: z.string()
})

export type BannedListUpdate = z.infer<typeof BannedListUpdateSchema>

// Format rotation data schema
const FormatRotationSchema = z.object({
  format: z.string(),
  rotationType: z.enum(['set_rotation', 'annual_rotation', 'manual_update']),
  rotatingOut: z.array(z.object({
    setCode: z.string(),
    setName: z.string(),
    rotationDate: z.string()
  })),
  rotatingIn: z.array(z.object({
    setCode: z.string(),
    setName: z.string(),
    legalDate: z.string()
  })),
  nextRotationDate: z.string().optional(),
  lastUpdated: z.string()
})

export type FormatRotation = z.infer<typeof FormatRotationSchema>

export class FormatLegalityValidator {
  private static instance: FormatLegalityValidator
  private formatRulesCache = new Map<string, FormatRules>()
  private lastBannedListUpdate = new Map<string, Date>()

  static getInstance(): FormatLegalityValidator {
    if (!FormatLegalityValidator.instance) {
      FormatLegalityValidator.instance = new FormatLegalityValidator()
    }
    return FormatLegalityValidator.instance
  }

  /**
   * Validate a deck against format rules
   */
  async validateDeck(
    cards: Array<{ cardId: string; quantity: number; category?: string }>,
    format: SupportedFormat,
    sideboard?: Array<{ cardId: string; quantity: number }>
  ): Promise<DeckValidationResult> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      logger.info('Starting deck validation', { format, cardCount: cards.length })
      
      // Get format rules
      const formatRules = await this.getFormatRules(format)
      if (!formatRules) {
        // timer.end({ source: 'no_rules' })
        return {
          isValid: false,
          format,
          violations: [{
            type: 'illegal_card',
            message: `Format rules not found for ${format}`,
            severity: 'error'
          }],
          warnings: [],
          suggestions: []
        }
      }

      // Get card legality data for all cards
      const allCardIds = [
        ...cards.map(c => c.cardId),
        ...(sideboard || []).map(c => c.cardId)
      ]
      const cardLegalities = await this.getBatchCardLegalities(allCardIds)

      const violations: DeckValidationResult['violations'] = []
      const warnings: DeckValidationResult['warnings'] = []
      const suggestions: DeckValidationResult['suggestions'] = []

      // Validate deck size
      const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0)
      if (totalCards < formatRules.deckSize.min) {
        violations.push({
          type: 'deck_size',
          message: `Deck has ${totalCards} cards, minimum is ${formatRules.deckSize.min}`,
          severity: 'error'
        })
      } else if (totalCards > formatRules.deckSize.max) {
        violations.push({
          type: 'deck_size',
          message: `Deck has ${totalCards} cards, maximum is ${formatRules.deckSize.max}`,
          severity: 'error'
        })
      }

      // Validate sideboard size
      if (sideboard) {
        const sideboardSize = sideboard.reduce((sum, card) => sum + card.quantity, 0)
        if (sideboardSize > formatRules.sideboardSize.max) {
          violations.push({
            type: 'sideboard_size',
            message: `Sideboard has ${sideboardSize} cards, maximum is ${formatRules.sideboardSize.max}`,
            severity: 'error'
          })
        }
      }

      // Validate individual cards
      for (const card of cards) {
        const legality = cardLegalities.get(card.cardId)
        if (!legality) {
          warnings.push({
            type: 'unknown_card',
            message: `Could not verify legality for card`,
            cardId: card.cardId
          })
          continue
        }

        const cardStatus = legality.legalities[format]
        
        // Check if card is banned
        if (cardStatus === 'banned') {
          violations.push({
            type: 'banned_card',
            cardId: card.cardId,
            cardName: legality.name,
            message: `${legality.name} is banned in ${format}`,
            severity: 'error'
          })
        }
        
        // Check if card is restricted
        else if (cardStatus === 'restricted' && card.quantity > 1) {
          violations.push({
            type: 'restricted_card',
            cardId: card.cardId,
            cardName: legality.name,
            message: `${legality.name} is restricted to 1 copy in ${format}`,
            severity: 'error'
          })
        }
        
        // Check if card is not legal
        else if (cardStatus === 'not_legal') {
          violations.push({
            type: 'illegal_card',
            cardId: card.cardId,
            cardName: legality.name,
            message: `${legality.name} is not legal in ${format}`,
            severity: 'error'
          })
        }

        // Check card quantity limits
        const cardLimit = formatRules.cardLimits.exceptions?.[card.cardId] || formatRules.cardLimits.default
        if (card.quantity > cardLimit) {
          violations.push({
            type: 'card_limit',
            cardId: card.cardId,
            cardName: legality.name,
            message: `${legality.name} exceeds limit of ${cardLimit} copies`,
            severity: 'error'
          })
        }
      }

      // Check for format-specific rules
      await this.validateFormatSpecificRules(cards, format, formatRules, violations, warnings, suggestions)

      // Generate suggestions for violations
      await this.generateReplacementSuggestions(violations, format, suggestions)

      const isValid = violations.filter(v => v.severity === 'error').length === 0

      // timer.end() - performance tracking disabled

      return {
        isValid,
        format,
        violations,
        warnings,
        suggestions
      }

    } catch (error: any) {
      logger.error('Error validating deck', error)
      // timer.end({ source: 'error' })
      return {
        isValid: false,
        format,
        violations: [{
          type: 'illegal_card',
          message: `Validation error: ${(error as Error).message}`,
          severity: 'error'
        }],
        warnings: [],
        suggestions: []
      }
    }
  }

  /**
   * Get card legality data for a single card
   */
  async getCardLegality(cardId: string): Promise<CardLegalityData | null> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      // Check cache first
      const cacheKey = `card_legality:${cardId}`
      const cached = await redisCache.get<CardLegalityData>(cacheKey)
      if (cached) {
        // timer.end({ source: 'cache' })
        return cached
      }

      // Fetch from Scryfall
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/${cardId}`)
      )

      const scryfallCard = response.data
      const legalityData: CardLegalityData = {
        cardId,
        name: scryfallCard.name,
        legalities: scryfallCard.legalities || {},
        lastUpdated: new Date().toISOString(),
        scryfallId: scryfallCard.id
      }

      // Cache the result
      await redisCache.set(cacheKey, legalityData, CACHE_TTL)

      // timer.end({ source: 'scryfall' })
      return legalityData

    } catch (error: any) {
      logger.error('Error getting card legality', error)
      // timer.end({ source: 'error' })
      return null
    }
  }

  /**
   * Get card legality data for multiple cards
   */
  async getBatchCardLegalities(cardIds: string[]): Promise<Map<string, CardLegalityData>> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    const results = new Map<string, CardLegalityData>()
    
    try {
      // Check cache for all cards first
      const cachePromises = cardIds.map(async (cardId) => {
        const cached = await redisCache.get<CardLegalityData>(`card_legality:${cardId}`)
        return { cardId, data: cached }
      })
      
      const cacheResults = await Promise.all(cachePromises)
      const toFetch: string[] = []
      
      for (const { cardId, data } of cacheResults) {
        if (data) {
          results.set(cardId, data)
        } else {
          toFetch.push(cardId)
        }
      }

      // Fetch missing cards in batches
      if (toFetch.length > 0) {
        const batchSize = 10
        for (let i = 0; i < toFetch.length; i += batchSize) {
          const batch = toFetch.slice(i, i + batchSize)
          
          const batchResults = await Promise.all(
            batch.map(async (cardId, index) => {
              // Add staggered delay to respect rate limits
              if (index > 0) {
                await this.delay(100)
              }
              return this.getCardLegality(cardId)
            })
          )
          
          batch.forEach((cardId, index) => {
            const data = batchResults[index]
            if (data) {
              results.set(cardId, data)
            }
          })
        }
      }

      // timer.end() - performance tracking disabled
      
      return results

    } catch (error: any) {
      logger.error('Error in batch card legality lookup', error)
      // timer.end({ source: 'error' })
      return results
    }
  }

  /**
   * Get format rules and banned lists
   */
  async getFormatRules(format: SupportedFormat): Promise<FormatRules | null> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      // Check cache first
      const cached = this.formatRulesCache.get(format)
      if (cached && this.isFormatRulesFresh(format)) {
        // timer.end({ source: 'memory_cache' })
        return cached
      }

      // Check Redis cache
      const cacheKey = `format_rules:${format}`
      const redisCached = await redisCache.get<FormatRules>(cacheKey)
      if (redisCached) {
        this.formatRulesCache.set(format, redisCached)
        // timer.end({ source: 'redis_cache' })
        return redisCached
      }

      // Build format rules from known data
      const formatRules = await this.buildFormatRules(format)
      if (!formatRules) {
        // timer.end({ source: 'not_found' })
        return null
      }

      // Cache the rules
      this.formatRulesCache.set(format, formatRules)
      await redisCache.set(cacheKey, formatRules, CACHE_TTL)
      this.lastBannedListUpdate.set(format, new Date())

      // timer.end({ source: 'built' })
      return formatRules

    } catch (error: any) {
      logger.error('Error getting format rules', error)
      // timer.end({ source: 'error' })
      return null
    }
  }

  /**
   * Update banned lists from official sources
   */
  async updateBannedLists(): Promise<{
    success: boolean
    updatedFormats: string[]
    errors: string[]
  }> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      logger.info('Starting banned list update')
      
      const updatedFormats: string[] = []
      const errors: string[] = []

      // Update each supported format
      for (const format of SUPPORTED_FORMATS) {
        try {
          const updated = await this.updateFormatBannedList(format)
          if (updated) {
            updatedFormats.push(format)
          }
        } catch (error: any) {
          errors.push(`Failed to update ${format}: ${(error as Error).message}`)
        }
      }

      logger.info('Banned list update completed', { 
        updatedFormats: updatedFormats.length,
        errors: errors.length 
      })
      
      // timer.end() - performance tracking disabled
      
      return { success: true, updatedFormats, errors }

    } catch (error: any) {
      logger.error('Error in banned list update', error)
      // timer.end({ source: 'error' })
      return { success: false, updatedFormats: [], errors: [(error as Error).message] }
    }
  }

  /**
   * Check for format rotation updates
   */
  async checkFormatRotations(): Promise<FormatRotation[]> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      const rotations: FormatRotation[] = []
      
      // Check formats that have rotation
      const rotatableFormats = ['standard', 'pioneer', 'historic', 'alchemy']
      
      for (const format of rotatableFormats) {
        const rotation = await this.getFormatRotation(format)
        if (rotation) {
          rotations.push(rotation)
        }
      }

      // timer.end({ rotations_found: rotations.length })
      return rotations

    } catch (error: any) {
      logger.error('Error checking format rotations', error)
      // timer.end({ source: 'error' })
      return []
    }
  }

  /**
   * Create custom format with validation rules
   */
  async createCustomFormat(
    name: string,
    rules: Omit<FormatRules, 'format' | 'lastUpdated'>
  ): Promise<FormatRules> {
    const timer = { end: () => {} }; // Performance tracking disabled for now
    
    try {
      const customFormat: FormatRules = {
        format: name,
        ...rules,
        lastUpdated: new Date().toISOString()
      }

      // Validate the custom format rules
      const validatedRules = FormatRulesSchema.parse(customFormat)

      // Cache the custom format
      const cacheKey = `format_rules:${name}`
      await redisCache.set(cacheKey, validatedRules, CACHE_TTL * 7) // Cache custom formats longer
      this.formatRulesCache.set(name, validatedRules)

      logger.info('Custom format created', { name, rules: Object.keys(rules) })
      
      // timer.end({ format: name })
      return validatedRules

    } catch (error: any) {
      logger.error('Error creating custom format', error)
      // timer.end({ source: 'error' })
      throw error
    }
  }

  // Private helper methods

  private async buildFormatRules(format: SupportedFormat): Promise<FormatRules | null> {
    try {
      // Define format-specific rules
      const formatConfigs: Record<SupportedFormat, Partial<FormatRules>> = {
        standard: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        pioneer: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        modern: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        legacy: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        vintage: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        commander: {
          deckSize: { min: 100, max: 100 },
          sideboardSize: { min: 0, max: 0 },
          cardLimits: { 
            default: 1,
            exceptions: {
              // Basic lands can have any number
              'basic_lands': 999
            }
          },
          specialRules: [
            'Must have exactly one legendary creature as commander',
            'All cards must match commander color identity',
            'No duplicate cards except basic lands'
          ]
        },
        brawl: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 0 },
          cardLimits: { default: 1, exceptions: { 'basic_lands': 999 } }
        },
        historic: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        alchemy: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        explorer: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        timeless: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        pauper: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        },
        penny: {
          deckSize: { min: 60, max: 60 },
          sideboardSize: { min: 0, max: 15 },
          cardLimits: { default: 4, exceptions: {} }
        }
      }

      const config = formatConfigs[format]
      if (!config) {
        return null
      }

      // Get current banned/restricted lists
      const bannedCards = await this.getBannedCards(format)
      const restrictedCards = await this.getRestrictedCards(format)

      const formatRules: FormatRules = {
        format,
        deckSize: config.deckSize!,
        sideboardSize: config.sideboardSize!,
        cardLimits: config.cardLimits!,
        bannedCards,
        restrictedCards,
        specialRules: config.specialRules || [],
        lastUpdated: new Date().toISOString()
      }

      return formatRules

    } catch (error: any) {
      logger.error('Error building format rules', error)
      return null
    }
  }

  private async getBannedCards(format: SupportedFormat): Promise<string[]> {
    try {
      // This would integrate with official banned list sources
      // For now, return empty array - in production you'd fetch from:
      // - Wizards of the Coast official announcements
      // - Scryfall banned list data
      // - Format-specific governing bodies
      return []
    } catch (error: any) {
      logger.warn('Failed to get banned cards', error)
      return []
    }
  }

  private async getRestrictedCards(format: SupportedFormat): Promise<string[]> {
    try {
      // Similar to banned cards, this would fetch from official sources
      return []
    } catch (error: any) {
      logger.warn('Failed to get restricted cards', error)
      return []
    }
  }

  private async updateFormatBannedList(format: SupportedFormat): Promise<boolean> {
    try {
      // Check if we need to update
      const lastUpdate = this.lastBannedListUpdate.get(format)
      if (lastUpdate && Date.now() - lastUpdate.getTime() < BANNED_LIST_CACHE_TTL * 1000) {
        return false
      }

      // Fetch latest banned list data
      // This would integrate with official sources
      const bannedCards = await this.getBannedCards(format)
      const restrictedCards = await this.getRestrictedCards(format)

      // Update cached format rules
      const currentRules = this.formatRulesCache.get(format)
      if (currentRules) {
        currentRules.bannedCards = bannedCards
        currentRules.restrictedCards = restrictedCards
        currentRules.lastUpdated = new Date().toISOString()

        // Update caches
        this.formatRulesCache.set(format, currentRules)
        await redisCache.set(`format_rules:${format}`, currentRules, CACHE_TTL)
      }

      this.lastBannedListUpdate.set(format, new Date())
      return true

    } catch (error: any) {
      logger.error('Error updating format banned list', error)
      return false
    }
  }

  private async getFormatRotation(format: string): Promise<FormatRotation | null> {
    try {
      // This would integrate with official rotation schedules
      // For now, return null - in production you'd fetch rotation data
      return null
    } catch (error: any) {
      logger.warn('Failed to get format rotation', error)
      return null
    }
  }

  private async validateFormatSpecificRules(
    cards: Array<{ cardId: string; quantity: number; category?: string }>,
    format: SupportedFormat,
    formatRules: FormatRules,
    violations: DeckValidationResult['violations'],
    warnings: DeckValidationResult['warnings'],
    suggestions: DeckValidationResult['suggestions']
  ): Promise<void> {
    try {
      // Commander-specific validation
      if (format === 'commander') {
        await this.validateCommanderRules(cards, violations, warnings, suggestions)
      }

      // Pauper-specific validation
      if (format === 'pauper') {
        await this.validatePauperRules(cards, violations, warnings)
      }

      // Add more format-specific validations as needed

    } catch (error: any) {
      logger.error('Error in format-specific validation', error)
    }
  }

  private async validateCommanderRules(
    cards: Array<{ cardId: string; quantity: number; category?: string }>,
    violations: DeckValidationResult['violations'],
    warnings: DeckValidationResult['warnings'],
    suggestions: DeckValidationResult['suggestions']
  ): Promise<void> {
    // Find commander
    const commander = cards.find(card => card.category === 'commander')
    if (!commander) {
      violations.push({
        type: 'illegal_card',
        message: 'Commander deck must have exactly one commander',
        severity: 'error'
      })
      return
    }

    // Validate commander is legendary creature
    const commanderLegality = await this.getCardLegality(commander.cardId)
    if (commanderLegality) {
      // This would check if the card is a legendary creature
      // For now, we'll assume it's valid
    }

    // Check for duplicate non-basic lands
    const cardCounts = new Map<string, number>()
    for (const card of cards) {
      if (card.category !== 'commander') {
        cardCounts.set(card.cardId, (cardCounts.get(card.cardId) || 0) + card.quantity)
      }
    }

    // Use Array.from to iterate over Map entries
    for (const entry of Array.from(cardCounts.entries())) {
      const [cardId, count] = entry
      if (count > 1) {
        const cardData = await this.getCardLegality(cardId)
        // Check if it's a basic land (would need card type data)
        violations.push({
          type: 'card_limit',
          cardId,
          cardName: cardData?.name,
          message: `${cardData?.name || 'Card'} appears ${count} times, but Commander allows only 1 copy of non-basic lands`,
          severity: 'error'
        })
      }
    }
  }

  private async validatePauperRules(
    cards: Array<{ cardId: string; quantity: number; category?: string }>,
    violations: DeckValidationResult['violations'],
    warnings: DeckValidationResult['warnings']
  ): Promise<void> {
    // Pauper only allows commons
    for (const card of cards) {
      const cardData = await this.getCardLegality(card.cardId)
      if (cardData) {
        // This would check card rarity - need to integrate with card data
        // For now, we'll skip this validation
      }
    }
  }

  private async generateReplacementSuggestions(
    violations: DeckValidationResult['violations'],
    format: SupportedFormat,
    suggestions: DeckValidationResult['suggestions']
  ): Promise<void> {
    try {
      for (const violation of violations) {
        if (violation.type === 'banned_card' && violation.cardId) {
          // This would use AI/ML to suggest similar legal cards
          suggestions.push({
            type: 'replacement',
            message: `Consider replacing ${violation.cardName} with similar legal alternatives`,
            cardId: violation.cardId,
            suggestedCards: [] // Would be populated with actual suggestions
          })
        }
      }
    } catch (error: any) {
      logger.error('Error generating replacement suggestions', error)
    }
  }

  private isFormatRulesFresh(format: string): boolean {
    const lastUpdate = this.lastBannedListUpdate.get(format)
    if (!lastUpdate) return false
    return Date.now() - lastUpdate.getTime() < BANNED_LIST_CACHE_TTL * 1000
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const formatLegalityValidator = FormatLegalityValidator.getInstance()
