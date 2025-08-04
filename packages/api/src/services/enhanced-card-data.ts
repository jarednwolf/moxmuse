import axios from 'axios'
import { z } from 'zod'
import { db } from '@moxmuse/db'
import { redisCache } from './redis'
import { scryfallRateLimiter } from '../utils/rateLimiter'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'

const SCRYFALL_API = process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com'
const CACHE_TTL = 60 * 60 * 24 * 7 // 7 days for enhanced card data
const BULK_DATA_CACHE_TTL = 60 * 60 * 24 // 24 hours for bulk data
const IMAGE_CACHE_TTL = 60 * 60 * 24 * 30 // 30 days for images

// Enhanced card data schema for validation
const EnhancedCardDataSchema = z.object({
  cardId: z.string().uuid('Invalid card ID format'),
  name: z.string().min(1, 'Card name cannot be empty'),
  manaCost: z.string().optional(),
  cmc: z.number().default(0),
  typeLine: z.string(),
  oracleText: z.string().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  colors: z.array(z.string()),
  colorIdentity: z.array(z.string()),
  legalities: z.record(z.string()),
  rulings: z.array(z.object({
    date: z.string(),
    text: z.string(),
    source: z.string()
  })),
  printings: z.array(z.object({
    setCode: z.string(),
    setName: z.string(),
    collectorNumber: z.string(),
    rarity: z.string(),
    imageUrls: z.record(z.string())
  })),
  relatedCards: z.array(z.object({
    cardId: z.string(),
    relationship: z.enum(['synergy', 'alternative', 'upgrade', 'combo']),
    strength: z.number().min(0).max(1),
    explanation: z.string()
  })),
  edhrecRank: z.number().optional(),
  popularityScore: z.number().default(0),
  synergyTags: z.array(z.string()),
  currentPrice: z.number().optional(),
  priceHistory: z.array(z.object({
    date: z.string(),
    price: z.number(),
    source: z.string()
  })),
  availability: z.object({
    inStock: z.boolean(),
    sources: z.array(z.string()),
    lastChecked: z.string()
  }),
  imageUrls: z.record(z.string()),
  lastUpdated: z.string()
})

type EnhancedCardData = z.infer<typeof EnhancedCardDataSchema>

// Card search query schema
const CardSearchQuerySchema = z.object({
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  cmcRange: z.tuple([z.number(), z.number()]).optional(),
  powerRange: z.tuple([z.number(), z.number()]).optional(),
  toughnessRange: z.tuple([z.number(), z.number()]).optional(),
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  sets: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  isLegal: z.record(z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  sortBy: z.enum(['name', 'cmc', 'power', 'toughness', 'releaseDate', 'price']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().optional(),
  offset: z.number().optional()
})

type CardSearchQuery = z.infer<typeof CardSearchQuerySchema>

interface CardDataVersion {
  version: string
  timestamp: Date
  changes: string[]
  dataHash: string
}

interface BulkDataInfo {
  downloadUri: string
  updatedAt: string
  size: number
  contentType: string
}

export class EnhancedCardDataService {
  private static instance: EnhancedCardDataService
  private bulkDataVersion: string | null = null
  private lastBulkUpdate: Date | null = null

  static getInstance(): EnhancedCardDataService {
    if (!EnhancedCardDataService.instance) {
      EnhancedCardDataService.instance = new EnhancedCardDataService()
    }
    return EnhancedCardDataService.instance
  }

  /**
   * Get enhanced card data by ID with caching and validation
   */
  async getEnhancedCard(cardId: string): Promise<EnhancedCardData | null> {
    const timer = performanceMonitor.startTimer('enhanced_card_lookup')
    
    try {
      // Validate card ID format
      if (!this.isValidCardId(cardId)) {
        logger.warn('Invalid card ID format', { cardId })
        return null
      }

      // Check database cache first
      const cached = await this.getCachedCardData(cardId)
      if (cached && this.isDataFresh(cached.lastUpdated)) {
        timer.end({ source: 'database_cache' })
        return cached
      }

      // Check Redis cache
      const redisCached = await redisCache.get<EnhancedCardData>(`enhanced_card:${cardId}`)
      if (redisCached && this.isDataFresh(redisCached.lastUpdated)) {
        timer.end({ source: 'redis_cache' })
        return redisCached
      }

      // Fetch from Scryfall and enrich
      const enrichedCard = await this.fetchAndEnrichCard(cardId)
      if (!enrichedCard) {
        timer.end({ source: 'not_found' })
        return null
      }

      // Validate data integrity
      const validatedCard = await this.validateCardData(enrichedCard)
      if (!validatedCard) {
        logger.error('Card data validation failed', { cardId })
        timer.end({ source: 'validation_failed' })
        return null
      }

      // Cache the enriched data
      await this.cacheCardData(validatedCard)
      
      timer.end({ source: 'scryfall_enriched' })
      return validatedCard

    } catch (error) {
      logger.error('Error getting enhanced card data', { cardId, error })
      timer.end({ source: 'error' })
      return null
    }
  }

  /**
   * Batch get enhanced card data with optimized caching
   */
  async getEnhancedCards(cardIds: string[]): Promise<Map<string, EnhancedCardData | null>> {
    const timer = performanceMonitor.startTimer('enhanced_cards_batch_lookup')
    const results = new Map<string, EnhancedCardData | null>()
    
    try {
      // Filter valid card IDs
      const validCardIds = cardIds.filter(id => this.isValidCardId(id))
      
      // Check database cache for all cards
      const cachedCards = await this.getBatchCachedCardData(validCardIds)
      const toFetch: string[] = []
      
      for (const cardId of validCardIds) {
        const cached = cachedCards.get(cardId)
        if (cached && this.isDataFresh(cached.lastUpdated)) {
          results.set(cardId, cached)
        } else {
          toFetch.push(cardId)
        }
      }

      // Fetch missing cards in batches to respect rate limits
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
              return this.getEnhancedCard(cardId)
            })
          )
          
          batch.forEach((cardId, index) => {
            results.set(cardId, batchResults[index])
          })
        }
      }

      timer.end({ 
        total_cards: cardIds.length,
        cached_cards: results.size - toFetch.length,
        fetched_cards: toFetch.length
      })
      
      return results

    } catch (error) {
      logger.error('Error in batch card lookup', { cardIds: cardIds.length, error })
      timer.end({ source: 'error' })
      return results
    }
  }

  /**
   * Advanced card search with complex queries
   */
  async searchCards(query: CardSearchQuery): Promise<{
    cards: EnhancedCardData[]
    totalCount: number
    hasMore: boolean
  }> {
    const timer = performanceMonitor.startTimer('enhanced_card_search')
    
    try {
      // Validate search query
      const validatedQuery = CardSearchQuerySchema.parse(query)
      
      // Build cache key for search results
      const cacheKey = `card_search:${this.hashQuery(validatedQuery)}`
      
      // Check cache first
      const cached = await redisCache.get<{
        cards: EnhancedCardData[]
        totalCount: number
        hasMore: boolean
      }>(cacheKey)
      
      if (cached) {
        timer.end({ source: 'cache' })
        return cached
      }

      // Build Scryfall search query
      const scryfallQuery = this.buildScryfallQuery(validatedQuery)
      
      // Execute search with rate limiting
      const searchResults = await scryfallRateLimiter.limit(async () => {
        const response = await axios.get(`${SCRYFALL_API}/cards/search`, {
          params: {
            q: scryfallQuery,
            order: this.getSortOrder(validatedQuery.sortBy),
            dir: validatedQuery.sortOrder || 'desc',
            page: Math.floor((validatedQuery.offset || 0) / 175) + 1
          }
        })
        return response.data
      })

      // Enrich search results
      const enrichedCards = await Promise.all(
        searchResults.data.map(async (card: any) => {
          const enriched = await this.enrichScryfallCard(card)
          return enriched
        })
      )

      // Apply client-side filtering for complex queries
      const filteredCards = this.applyAdvancedFilters(enrichedCards, validatedQuery)
      
      // Apply pagination
      const limit = validatedQuery.limit || 50
      const offset = validatedQuery.offset || 0
      const paginatedCards = filteredCards.slice(offset, offset + limit)
      
      const result = {
        cards: paginatedCards,
        totalCount: filteredCards.length,
        hasMore: offset + limit < filteredCards.length
      }

      // Cache results for 1 hour
      await redisCache.set(cacheKey, result, 60 * 60)
      
      timer.end({ 
        query_complexity: Object.keys(validatedQuery).length,
        results_count: result.cards.length,
        total_count: result.totalCount
      })
      
      return result

    } catch (error) {
      logger.error('Error in card search', { query, error })
      timer.end({ source: 'error' })
      return { cards: [], totalCount: 0, hasMore: false }
    }
  }

  /**
   * Update card data from bulk data download
   */
  async updateFromBulkData(): Promise<{
    success: boolean
    cardsUpdated: number
    errors: string[]
  }> {
    const timer = performanceMonitor.startTimer('bulk_data_update')
    
    try {
      logger.info('Starting bulk card data update')
      
      // Get bulk data info
      const bulkDataInfo = await this.getBulkDataInfo()
      
      // Check if we need to update
      if (this.bulkDataVersion === bulkDataInfo.downloadUri && 
          this.lastBulkUpdate && 
          Date.now() - this.lastBulkUpdate.getTime() < BULK_DATA_CACHE_TTL * 1000) {
        logger.info('Bulk data is up to date')
        timer.end({ source: 'up_to_date' })
        return { success: true, cardsUpdated: 0, errors: [] }
      }

      // Download and process bulk data
      const response = await axios.get(bulkDataInfo.downloadUri, {
        responseType: 'stream',
        timeout: 300000 // 5 minutes
      })

      let cardsUpdated = 0
      const errors: string[] = []
      const batchSize = 1000
      let batch: any[] = []

      // Process streaming JSON data
      response.data.on('data', async (chunk: Buffer) => {
        const lines = chunk.toString().split('\n')
        
        for (const line of lines) {
          if (!line.trim()) continue
          
          try {
            const cardData = JSON.parse(line)
            batch.push(cardData)
            
            if (batch.length >= batchSize) {
              const processed = await this.processBulkDataBatch(batch)
              cardsUpdated += processed.updated
              errors.push(...processed.errors)
              batch = []
            }
          } catch (error) {
            errors.push(`Failed to parse card data: ${error}`)
          }
        }
      })

      // Process remaining batch
      if (batch.length > 0) {
        const processed = await this.processBulkDataBatch(batch)
        cardsUpdated += processed.updated
        errors.push(...processed.errors)
      }

      // Update version tracking
      this.bulkDataVersion = bulkDataInfo.downloadUri
      this.lastBulkUpdate = new Date()

      logger.info('Bulk card data update completed', { 
        cardsUpdated, 
        errors: errors.length 
      })
      
      timer.end({ 
        cards_updated: cardsUpdated,
        errors_count: errors.length
      })
      
      return { success: true, cardsUpdated, errors }

    } catch (error) {
      logger.error('Error in bulk data update', { error })
      timer.end({ source: 'error' })
      return { success: false, cardsUpdated: 0, errors: [error.message] }
    }
  }

  /**
   * Validate card data integrity
   */
  async validateCardData(cardData: any): Promise<EnhancedCardData | null> {
    try {
      // Schema validation
      const validated = EnhancedCardDataSchema.parse(cardData)
      
      // Business logic validation
      if (!this.validateBusinessRules(validated)) {
        return null
      }
      
      // Data consistency checks
      if (!this.validateDataConsistency(validated)) {
        return null
      }
      
      return validated
      
    } catch (error) {
      logger.warn('Card data validation failed', { 
        cardId: cardData?.cardId, 
        error: error.message 
      })
      return null
    }
  }

  /**
   * Track card data changes and versions
   */
  async trackCardDataVersion(cardId: string, oldData: EnhancedCardData | null, newData: EnhancedCardData): Promise<void> {
    try {
      const changes: string[] = []
      
      if (!oldData) {
        changes.push('Initial card data creation')
      } else {
        // Track specific changes
        if (oldData.name !== newData.name) {
          changes.push(`Name changed: ${oldData.name} → ${newData.name}`)
        }
        if (oldData.oracleText !== newData.oracleText) {
          changes.push('Oracle text updated')
        }
        if (oldData.currentPrice !== newData.currentPrice) {
          changes.push(`Price changed: ${oldData.currentPrice} → ${newData.currentPrice}`)
        }
        if (JSON.stringify(oldData.legalities) !== JSON.stringify(newData.legalities)) {
          changes.push('Legalities updated')
        }
      }

      if (changes.length > 0) {
        const version: CardDataVersion = {
          version: this.generateVersionId(),
          timestamp: new Date(),
          changes,
          dataHash: this.hashCardData(newData)
        }

        // Store version history
        await redisCache.set(
          `card_version:${cardId}:${version.version}`,
          version,
          60 * 60 * 24 * 365 // Keep versions for 1 year
        )

        // Update latest version pointer
        await redisCache.set(`card_latest_version:${cardId}`, version.version, 60 * 60 * 24 * 365)
        
        logger.info('Card data version tracked', { 
          cardId, 
          version: version.version, 
          changes: changes.length 
        })
      }
      
    } catch (error) {
      logger.error('Error tracking card data version', { cardId, error })
    }
  }

  /**
   * Optimize and cache card images
   */
  async optimizeCardImages(cardId: string, imageUrls: Record<string, string>): Promise<Record<string, string>> {
    const optimizedUrls: Record<string, string> = {}
    
    try {
      for (const [size, url] of Object.entries(imageUrls)) {
        const cacheKey = `card_image:${cardId}:${size}`
        
        // Check if we have a cached optimized version
        const cached = await redisCache.get<string>(cacheKey)
        if (cached) {
          optimizedUrls[size] = cached
          continue
        }

        // For now, use original URLs but cache them
        // In production, you might want to:
        // 1. Download and resize images
        // 2. Convert to WebP format
        // 3. Upload to CDN
        // 4. Generate optimized URLs
        
        optimizedUrls[size] = url
        await redisCache.set(cacheKey, url, IMAGE_CACHE_TTL)
      }
      
      return optimizedUrls
      
    } catch (error) {
      logger.error('Error optimizing card images', { cardId, error })
      return imageUrls // Fallback to original URLs
    }
  }

  // Private helper methods

  private async fetchAndEnrichCard(cardId: string): Promise<EnhancedCardData | null> {
    try {
      // Fetch base card data from Scryfall
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/${cardId}`)
      )
      
      const scryfallCard = response.data
      
      // Enrich with additional data
      return await this.enrichScryfallCard(scryfallCard)
      
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('Card not found', { cardId })
        return null
      }
      throw error
    }
  }

  private async enrichScryfallCard(scryfallCard: any): Promise<EnhancedCardData> {
    const cardId = scryfallCard.id
    
    // Get community data (EDHREC rank, popularity)
    const communityData = await this.getCommunityData(cardId)
    
    // Get market data (current price, price history)
    const marketData = await this.getMarketData(cardId)
    
    // Get synergy data
    const synergyData = await this.getSynergyData(cardId)
    
    // Optimize images
    const optimizedImages = await this.optimizeCardImages(cardId, scryfallCard.image_uris || {})
    
    // Build enhanced card data
    const enhancedCard: EnhancedCardData = {
      cardId: scryfallCard.id,
      name: scryfallCard.name,
      manaCost: scryfallCard.mana_cost || '',
      cmc: scryfallCard.cmc || 0,
      typeLine: scryfallCard.type_line,
      oracleText: scryfallCard.oracle_text || '',
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      colors: scryfallCard.colors || [],
      colorIdentity: scryfallCard.color_identity || [],
      legalities: scryfallCard.legalities || {},
      rulings: await this.getRulings(cardId),
      printings: await this.getPrintings(cardId),
      relatedCards: synergyData.relatedCards,
      edhrecRank: communityData.edhrecRank,
      popularityScore: communityData.popularityScore,
      synergyTags: synergyData.tags,
      currentPrice: marketData.currentPrice,
      priceHistory: marketData.priceHistory,
      availability: marketData.availability,
      imageUrls: optimizedImages,
      lastUpdated: new Date().toISOString()
    }
    
    return enhancedCard
  }

  private async getCommunityData(cardId: string): Promise<{
    edhrecRank?: number
    popularityScore: number
  }> {
    try {
      // This would integrate with EDHREC API or similar
      // For now, return mock data
      return {
        edhrecRank: Math.floor(Math.random() * 10000),
        popularityScore: Math.random() * 100
      }
    } catch (error) {
      logger.warn('Failed to get community data', { cardId, error })
      return { popularityScore: 0 }
    }
  }

  private async getMarketData(cardId: string): Promise<{
    currentPrice?: number
    priceHistory: Array<{ date: string; price: number; source: string }>
    availability: { inStock: boolean; sources: string[]; lastChecked: string }
  }> {
    try {
      // This would integrate with TCGPlayer, Card Kingdom APIs
      // For now, return mock data
      return {
        currentPrice: Math.random() * 50,
        priceHistory: [],
        availability: {
          inStock: Math.random() > 0.3,
          sources: ['tcgplayer', 'cardkingdom'],
          lastChecked: new Date().toISOString()
        }
      }
    } catch (error) {
      logger.warn('Failed to get market data', { cardId, error })
      return {
        priceHistory: [],
        availability: {
          inStock: false,
          sources: [],
          lastChecked: new Date().toISOString()
        }
      }
    }
  }

  private async getSynergyData(cardId: string): Promise<{
    relatedCards: Array<{
      cardId: string
      relationship: 'synergy' | 'alternative' | 'upgrade' | 'combo'
      strength: number
      explanation: string
    }>
    tags: string[]
  }> {
    try {
      // This would use AI/ML models to determine synergies
      // For now, return empty data
      return {
        relatedCards: [],
        tags: []
      }
    } catch (error) {
      logger.warn('Failed to get synergy data', { cardId, error })
      return { relatedCards: [], tags: [] }
    }
  }

  private async getRulings(cardId: string): Promise<Array<{
    date: string
    text: string
    source: string
  }>> {
    try {
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/${cardId}/rulings`)
      )
      
      return response.data.data.map((ruling: any) => ({
        date: ruling.published_at,
        text: ruling.comment,
        source: ruling.source
      }))
    } catch (error) {
      logger.warn('Failed to get rulings', { cardId, error })
      return []
    }
  }

  private async getPrintings(cardId: string): Promise<Array<{
    setCode: string
    setName: string
    collectorNumber: string
    rarity: string
    imageUrls: Record<string, string>
  }>> {
    try {
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/search`, {
          params: { q: `oracleid:${cardId}` }
        })
      )
      
      return response.data.data.map((printing: any) => ({
        setCode: printing.set,
        setName: printing.set_name,
        collectorNumber: printing.collector_number,
        rarity: printing.rarity,
        imageUrls: printing.image_uris || {}
      }))
    } catch (error) {
      logger.warn('Failed to get printings', { cardId, error })
      return []
    }
  }

  private async getCachedCardData(cardId: string): Promise<EnhancedCardData | null> {
    try {
      const cached = await db.enhancedCardData.findUnique({
        where: { cardId }
      })
      
      if (!cached) return null
      
      return {
        cardId: cached.cardId,
        name: cached.name,
        manaCost: cached.manaCost || '',
        cmc: cached.cmc,
        typeLine: cached.typeLine,
        oracleText: cached.oracleText || '',
        power: cached.power,
        toughness: cached.toughness,
        colors: cached.colors,
        colorIdentity: cached.colorIdentity,
        legalities: cached.legalities as Record<string, string>,
        rulings: cached.rulings as any[],
        printings: cached.printings as any[],
        relatedCards: cached.relatedCards as any[],
        edhrecRank: cached.edhrecRank,
        popularityScore: Number(cached.popularityScore),
        synergyTags: cached.synergyTags,
        currentPrice: cached.currentPrice ? Number(cached.currentPrice) : undefined,
        priceHistory: cached.priceHistory as any[],
        availability: cached.availability as any,
        imageUrls: cached.imageUrls as Record<string, string>,
        lastUpdated: cached.lastUpdated.toISOString()
      }
    } catch (error) {
      logger.error('Error getting cached card data', { cardId, error })
      return null
    }
  }

  private async getBatchCachedCardData(cardIds: string[]): Promise<Map<string, EnhancedCardData | null>> {
    const results = new Map<string, EnhancedCardData | null>()
    
    try {
      const cached = await db.enhancedCardData.findMany({
        where: { cardId: { in: cardIds } }
      })
      
      for (const card of cached) {
        results.set(card.cardId, {
          cardId: card.cardId,
          name: card.name,
          manaCost: card.manaCost || '',
          cmc: card.cmc,
          typeLine: card.typeLine,
          oracleText: card.oracleText || '',
          power: card.power,
          toughness: card.toughness,
          colors: card.colors,
          colorIdentity: card.colorIdentity,
          legalities: card.legalities as Record<string, string>,
          rulings: card.rulings as any[],
          printings: card.printings as any[],
          relatedCards: card.relatedCards as any[],
          edhrecRank: card.edhrecRank,
          popularityScore: Number(card.popularityScore),
          synergyTags: card.synergyTags,
          currentPrice: card.currentPrice ? Number(card.currentPrice) : undefined,
          priceHistory: card.priceHistory as any[],
          availability: card.availability as any,
          imageUrls: card.imageUrls as Record<string, string>,
          lastUpdated: card.lastUpdated.toISOString()
        })
      }
      
      // Set null for missing cards
      for (const cardId of cardIds) {
        if (!results.has(cardId)) {
          results.set(cardId, null)
        }
      }
      
    } catch (error) {
      logger.error('Error getting batch cached card data', { cardIds: cardIds.length, error })
    }
    
    return results
  }

  private async cacheCardData(cardData: EnhancedCardData): Promise<void> {
    try {
      // Get existing data for version tracking
      const existing = await this.getCachedCardData(cardData.cardId)
      
      // Cache in database
      await db.enhancedCardData.upsert({
        where: { cardId: cardData.cardId },
        create: {
          cardId: cardData.cardId,
          name: cardData.name,
          manaCost: cardData.manaCost,
          cmc: cardData.cmc,
          typeLine: cardData.typeLine,
          oracleText: cardData.oracleText,
          power: cardData.power,
          toughness: cardData.toughness,
          colors: cardData.colors,
          colorIdentity: cardData.colorIdentity,
          legalities: cardData.legalities,
          rulings: cardData.rulings,
          printings: cardData.printings,
          relatedCards: cardData.relatedCards,
          edhrecRank: cardData.edhrecRank,
          popularityScore: cardData.popularityScore,
          synergyTags: cardData.synergyTags,
          currentPrice: cardData.currentPrice,
          priceHistory: cardData.priceHistory,
          availability: cardData.availability,
          imageUrls: cardData.imageUrls,
          lastUpdated: new Date(cardData.lastUpdated)
        },
        update: {
          name: cardData.name,
          manaCost: cardData.manaCost,
          cmc: cardData.cmc,
          typeLine: cardData.typeLine,
          oracleText: cardData.oracleText,
          power: cardData.power,
          toughness: cardData.toughness,
          colors: cardData.colors,
          colorIdentity: cardData.colorIdentity,
          legalities: cardData.legalities,
          rulings: cardData.rulings,
          printings: cardData.printings,
          relatedCards: cardData.relatedCards,
          edhrecRank: cardData.edhrecRank,
          popularityScore: cardData.popularityScore,
          synergyTags: cardData.synergyTags,
          currentPrice: cardData.currentPrice,
          priceHistory: cardData.priceHistory,
          availability: cardData.availability,
          imageUrls: cardData.imageUrls,
          lastUpdated: new Date(cardData.lastUpdated)
        }
      })
      
      // Cache in Redis
      await redisCache.set(`enhanced_card:${cardData.cardId}`, cardData, CACHE_TTL)
      
      // Track version changes
      await this.trackCardDataVersion(cardData.cardId, existing, cardData)
      
    } catch (error) {
      logger.error('Error caching card data', { cardId: cardData.cardId, error })
    }
  }

  private async getBulkDataInfo(): Promise<BulkDataInfo> {
    const response = await scryfallRateLimiter.limit(async () =>
      await axios.get(`${SCRYFALL_API}/bulk-data`)
    )
    
    const bulkData = response.data.data.find((d: any) => d.type === 'default_cards')
    
    if (!bulkData) {
      throw new Error('Default cards bulk data not found')
    }
    
    return {
      downloadUri: bulkData.download_uri,
      updatedAt: bulkData.updated_at,
      size: bulkData.size,
      contentType: bulkData.content_type
    }
  }

  private async processBulkDataBatch(batch: any[]): Promise<{
    updated: number
    errors: string[]
  }> {
    let updated = 0
    const errors: string[] = []
    
    try {
      for (const cardData of batch) {
        try {
          const enriched = await this.enrichScryfallCard(cardData)
          const validated = await this.validateCardData(enriched)
          
          if (validated) {
            await this.cacheCardData(validated)
            updated++
          }
        } catch (error) {
          errors.push(`Failed to process card ${cardData.id}: ${error.message}`)
        }
      }
    } catch (error) {
      errors.push(`Batch processing error: ${error.message}`)
    }
    
    return { updated, errors }
  }

  private buildScryfallQuery(query: CardSearchQuery): string {
    const parts: string[] = []
    
    if (query.text) parts.push(query.text)
    if (query.name) parts.push(`name:"${query.name}"`)
    if (query.oracleText) parts.push(`oracle:"${query.oracleText}"`)
    if (query.typeText) parts.push(`type:"${query.typeText}"`)
    
    if (query.cmcRange) {
      const [min, max] = query.cmcRange
      parts.push(`cmc>=${min} cmc<=${max}`)
    }
    
    if (query.colors && query.colors.length > 0) {
      parts.push(`c:${query.colors.join('')}`)
    }
    
    if (query.colorIdentity && query.colorIdentity.length > 0) {
      parts.push(`id:${query.colorIdentity.join('')}`)
    }
    
    if (query.formats && query.formats.length > 0) {
      query.formats.forEach(format => {
        parts.push(`legal:${format}`)
      })
    }
    
    return parts.join(' ')
  }

  private applyAdvancedFilters(cards: EnhancedCardData[], query: CardSearchQuery): EnhancedCardData[] {
    let filtered = [...cards]
    
    // Apply power/toughness filters
    if (query.powerRange) {
      const [min, max] = query.powerRange
      filtered = filtered.filter(card => {
        const power = parseInt(card.power || '0')
        return !isNaN(power) && power >= min && power <= max
      })
    }
    
    if (query.toughnessRange) {
      const [min, max] = query.toughnessRange
      filtered = filtered.filter(card => {
        const toughness = parseInt(card.toughness || '0')
        return !isNaN(toughness) && toughness >= min && toughness <= max
      })
    }
    
    // Apply rarity filters
    if (query.rarities && query.rarities.length > 0) {
      filtered = filtered.filter(card => {
        // Get rarity from printings
        const rarities = card.printings.map(p => p.rarity)
        return query.rarities!.some(r => rarities.includes(r))
      })
    }
    
    return filtered
  }

  private getSortOrder(sortBy?: string): string {
    switch (sortBy) {
      case 'name': return 'name'
      case 'cmc': return 'cmc'
      case 'releaseDate': return 'released'
      case 'price': return 'usd'
      default: return 'edhrec'
    }
  }

  private isValidCardId(cardId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cardId)
  }

  private isDataFresh(lastUpdated: string): boolean {
    const updateTime = new Date(lastUpdated).getTime()
    const now = Date.now()
    return (now - updateTime) < (CACHE_TTL * 1000)
  }

  private validateBusinessRules(cardData: EnhancedCardData): boolean {
    // Validate CMC matches mana cost
    if (cardData.manaCost && cardData.cmc !== undefined) {
      // Basic validation - in production you'd parse mana cost properly
      const manaCostNumbers = (cardData.manaCost.match(/\d+/g) || []).map(Number)
      const totalMana = manaCostNumbers.reduce((sum, num) => sum + num, 0)
      
      // Allow some flexibility for hybrid mana, etc.
      if (Math.abs(totalMana - cardData.cmc) > 2) {
        logger.warn('CMC mismatch', { 
          cardId: cardData.cardId, 
          manaCost: cardData.manaCost, 
          cmc: cardData.cmc 
        })
        return false
      }
    }
    
    return true
  }

  private validateDataConsistency(cardData: EnhancedCardData): boolean {
    // Validate color identity includes all colors
    if (cardData.colors.length > 0) {
      const hasAllColors = cardData.colors.every(color => 
        cardData.colorIdentity.includes(color)
      )
      
      if (!hasAllColors) {
        logger.warn('Color identity inconsistency', { 
          cardId: cardData.cardId, 
          colors: cardData.colors, 
          colorIdentity: cardData.colorIdentity 
        })
        return false
      }
    }
    
    return true
  }

  private hashQuery(query: CardSearchQuery): string {
    return Buffer.from(JSON.stringify(query)).toString('base64')
  }

  private hashCardData(cardData: EnhancedCardData): string {
    const hashData = {
      name: cardData.name,
      oracleText: cardData.oracleText,
      legalities: cardData.legalities,
      currentPrice: cardData.currentPrice
    }
    return Buffer.from(JSON.stringify(hashData)).toString('base64')
  }

  private generateVersionId(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const enhancedCardDataService = EnhancedCardDataService.getInstance()