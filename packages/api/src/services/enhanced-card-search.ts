import { PrismaClient } from '@moxmuse/db'
import { z } from 'zod'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { redisCache } from './redis'

const SEARCH_CACHE_TTL = 60 * 15 // 15 minutes
const SUGGESTIONS_CACHE_TTL = 60 * 60 * 24 // 24 hours
const SEARCH_ANALYTICS_TTL = 60 * 60 * 24 * 30 // 30 days

// Enhanced search query schema
const EnhancedSearchQuerySchema = z.object({
  // Text search
  text: z.string().optional(),
  name: z.string().optional(),
  oracleText: z.string().optional(),
  typeText: z.string().optional(),
  
  // Numeric ranges
  cmcRange: z.tuple([z.number(), z.number()]).optional(),
  powerRange: z.tuple([z.number(), z.number()]).optional(),
  toughnessRange: z.tuple([z.number(), z.number()]).optional(),
  priceRange: z.tuple([z.number(), z.number()]).optional(),
  
  // Array filters
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  rarities: z.array(z.string()).optional(),
  sets: z.array(z.string()).optional(),
  formats: z.array(z.string()).optional(),
  synergyTags: z.array(z.string()).optional(),
  
  // Boolean filters
  isLegal: z.record(z.boolean()).optional(),
  hasKeywords: z.array(z.string()).optional(),
  producesColors: z.array(z.string()).optional(),
  
  // Advanced filters
  minPopularity: z.number().optional(),
  maxPopularity: z.number().optional(),
  edhrecRankRange: z.tuple([z.number(), z.number()]).optional(),
  
  // Search modifiers
  exactMatch: z.boolean().default(false),
  fuzzySearch: z.boolean().default(true),
  includeReprints: z.boolean().default(false),
  
  // Sorting and pagination
  sortBy: z.enum([
    'name', 'cmc', 'power', 'toughness', 'price', 'popularity', 
    'edhrecRank', 'releaseDate', 'relevance'
  ]).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(500).default(50),
  offset: z.number().min(0).default(0),
  
  // Search context
  userId: z.string().optional(),
  sessionId: z.string().optional()
})

type EnhancedSearchQuery = z.infer<typeof EnhancedSearchQuerySchema>

interface SearchResult {
  id: string
  cardId: string
  name: string
  manaCost: string
  cmc: number
  typeLine: string
  oracleText: string
  power?: string
  toughness?: string
  colors: string[]
  colorIdentity: string[]
  legalities: Record<string, string>
  currentPrice?: number
  popularityScore: number
  edhrecRank?: number
  synergyTags: string[]
  imageUrls: Record<string, string>
  relevanceScore?: number
  lastUpdated: Date
}

interface SearchResults {
  cards: SearchResult[]
  totalCount: number
  hasMore: boolean
  searchTime: number
  suggestions: string[]
  facets: SearchFacets
  query: EnhancedSearchQuery
}

interface SearchFacets {
  colors: Array<{ value: string; count: number }>
  colorIdentity: Array<{ value: string; count: number }>
  types: Array<{ value: string; count: number }>
  rarities: Array<{ value: string; count: number }>
  sets: Array<{ value: string; count: number }>
  cmcDistribution: Array<{ value: number; count: number }>
  priceRanges: Array<{ range: string; count: number }>
}

interface SearchSuggestion {
  type: 'card' | 'keyword' | 'set' | 'type' | 'ability'
  value: string
  display: string
  description?: string
  popularity: number
  category?: string
}

export class EnhancedCardSearchService {
  private static instance: EnhancedCardSearchService
  private db: PrismaClient

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient()
  }

  static getInstance(db?: PrismaClient): EnhancedCardSearchService {
    if (!EnhancedCardSearchService.instance) {
      EnhancedCardSearchService.instance = new EnhancedCardSearchService(db)
    }
    return EnhancedCardSearchService.instance
  }

  /**
   * Perform advanced card search with full-text search and faceting
   */
  async searchCards(query: EnhancedSearchQuery): Promise<SearchResults> {
    const timer = performanceMonitor.startTimer('enhanced_card_search')
    const startTime = Date.now()
    
    try {
      // Validate and normalize query
      const validatedQuery = EnhancedSearchQuerySchema.parse(query)
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(validatedQuery)
      
      // Check cache first
      const cached = await redisCache.get<SearchResults>(cacheKey)
      if (cached) {
        timer.end({ source: 'cache' })
        return cached
      }

      // Build the search query
      const searchQuery = this.buildSearchQuery(validatedQuery)
      
      // Execute search with count
      const [cards, totalCount] = await Promise.all([
        this.executeSearch(searchQuery, validatedQuery),
        this.executeCount(searchQuery)
      ])

      // Apply relevance scoring
      const scoredCards = this.applyRelevanceScoring(cards, validatedQuery)
      
      // Apply sorting
      const sortedCards = this.applySorting(scoredCards, validatedQuery)
      
      // Apply pagination
      const paginatedCards = this.applyPagination(sortedCards, validatedQuery)
      
      // Generate facets
      const facets = await this.generateFacets(searchQuery, validatedQuery)
      
      // Generate suggestions
      const suggestions = await this.generateSuggestions(validatedQuery, totalCount)
      
      const results: SearchResults = {
        cards: paginatedCards,
        totalCount,
        hasMore: validatedQuery.offset + paginatedCards.length < totalCount,
        searchTime: Date.now() - startTime,
        suggestions,
        facets,
        query: validatedQuery
      }

      // Cache results
      await redisCache.set(cacheKey, results, SEARCH_CACHE_TTL)
      
      // Record analytics
      await this.recordSearchAnalytics(validatedQuery, results)
      
      timer.end({
        result_count: results.cards.length,
        total_count: results.totalCount,
        search_time: results.searchTime
      })
      
      return results

    } catch (error) {
      logger.error('Enhanced card search failed', { query, error })
      timer.end({ source: 'error' })
      throw error
    }
  }

  /**
   * Get intelligent search suggestions with context awareness
   */
  async getSearchSuggestions(
    partialQuery: string,
    context?: {
      userId?: string
      recentSearches?: string[]
      currentDeck?: string[]
    },
    limit = 10
  ): Promise<SearchSuggestion[]> {
    const timer = performanceMonitor.startTimer('search_suggestions')
    
    try {
      const cacheKey = `search_suggestions:${partialQuery}:${JSON.stringify(context)}`
      
      // Check cache
      const cached = await redisCache.get<SearchSuggestion[]>(cacheKey)
      if (cached) {
        timer.end({ source: 'cache' })
        return cached
      }

      const suggestions: SearchSuggestion[] = []
      
      // Card name suggestions with full-text search
      const cardSuggestions = await this.getCardNameSuggestions(partialQuery, limit)
      suggestions.push(...cardSuggestions)
      
      // Keyword and ability suggestions
      const keywordSuggestions = await this.getKeywordSuggestions(partialQuery, limit)
      suggestions.push(...keywordSuggestions)
      
      // Set suggestions
      const setSuggestions = await this.getSetSuggestions(partialQuery, limit)
      suggestions.push(...setSuggestions)
      
      // Type suggestions
      const typeSuggestions = await this.getTypeSuggestions(partialQuery, limit)
      suggestions.push(...typeSuggestions)
      
      // Context-aware suggestions
      if (context) {
        const contextSuggestions = await this.getContextualSuggestions(
          partialQuery, 
          context, 
          limit
        )
        suggestions.push(...contextSuggestions)
      }

      // Sort by relevance and popularity
      const sortedSuggestions = suggestions
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.value.toLowerCase().startsWith(partialQuery.toLowerCase()) ? 1 : 0
          const bExact = b.value.toLowerCase().startsWith(partialQuery.toLowerCase()) ? 1 : 0
          
          if (aExact !== bExact) return bExact - aExact
          
          // Then by popularity
          return b.popularity - a.popularity
        })
        .slice(0, limit)

      // Cache suggestions
      await redisCache.set(cacheKey, sortedSuggestions, SUGGESTIONS_CACHE_TTL)
      
      timer.end({ suggestion_count: sortedSuggestions.length })
      return sortedSuggestions

    } catch (error) {
      logger.error('Search suggestions failed', { partialQuery, error })
      timer.end({ source: 'error' })
      return []
    }
  }

  /**
   * Perform semantic search using card synergy and themes
   */
  async semanticSearch(
    concept: string,
    options: {
      colors?: string[]
      format?: string
      powerLevel?: number
      limit?: number
    } = {}
  ): Promise<SearchResult[]> {
    const timer = performanceMonitor.startTimer('semantic_search')
    
    try {
      // Build semantic query based on concept
      const semanticQuery = await this.buildSemanticQuery(concept, options)
      
      // Execute search
      const results = await this.searchCards(semanticQuery)
      
      timer.end({ result_count: results.cards.length })
      return results.cards

    } catch (error) {
      logger.error('Semantic search failed', { concept, error })
      timer.end({ source: 'error' })
      return []
    }
  }

  /**
   * Find similar cards based on characteristics
   */
  async findSimilarCards(
    cardId: string,
    options: {
      similarity: 'mechanical' | 'thematic' | 'statistical' | 'all'
      limit?: number
      excludeReprints?: boolean
    } = { similarity: 'all', limit: 20 }
  ): Promise<SearchResult[]> {
    const timer = performanceMonitor.startTimer('similar_cards_search')
    
    try {
      // Get the reference card
      const referenceCard = await this.db.enhancedCardData.findUnique({
        where: { cardId }
      })

      if (!referenceCard) {
        throw new Error('Reference card not found')
      }

      // Build similarity query
      const similarityQuery = this.buildSimilarityQuery(referenceCard, options)
      
      // Execute search
      const results = await this.searchCards(similarityQuery)
      
      // Filter out the reference card itself
      const filteredResults = results.cards.filter(card => card.cardId !== cardId)
      
      timer.end({ result_count: filteredResults.length })
      return filteredResults

    } catch (error) {
      logger.error('Similar cards search failed', { cardId, error })
      timer.end({ source: 'error' })
      return []
    }
  }

  /**
   * Advanced filtering with complex boolean logic
   */
  async advancedFilter(filters: {
    include: EnhancedSearchQuery[]
    exclude: EnhancedSearchQuery[]
    operator: 'AND' | 'OR'
  }): Promise<SearchResult[]> {
    const timer = performanceMonitor.startTimer('advanced_filter')
    
    try {
      // Execute include queries
      const includeResults = await Promise.all(
        filters.include.map(query => this.searchCards(query))
      )
      
      // Execute exclude queries
      const excludeResults = await Promise.all(
        filters.exclude.map(query => this.searchCards(query))
      )
      
      // Combine results based on operator
      let finalResults: SearchResult[]
      
      if (filters.operator === 'AND') {
        // Intersection of all include results
        finalResults = includeResults.reduce((acc, result) => {
          if (acc.length === 0) return result.cards
          
          const cardIds = new Set(result.cards.map(c => c.cardId))
          return acc.filter(card => cardIds.has(card.cardId))
        }, [] as SearchResult[])
      } else {
        // Union of all include results
        const cardMap = new Map<string, SearchResult>()
        
        includeResults.forEach(result => {
          result.cards.forEach(card => {
            cardMap.set(card.cardId, card)
          })
        })
        
        finalResults = Array.from(cardMap.values())
      }
      
      // Remove excluded cards
      if (excludeResults.length > 0) {
        const excludedIds = new Set<string>()
        
        excludeResults.forEach(result => {
          result.cards.forEach(card => {
            excludedIds.add(card.cardId)
          })
        })
        
        finalResults = finalResults.filter(card => !excludedIds.has(card.cardId))
      }
      
      timer.end({ result_count: finalResults.length })
      return finalResults

    } catch (error) {
      logger.error('Advanced filter failed', { filters, error })
      timer.end({ source: 'error' })
      return []
    }
  }

  // Private helper methods

  private buildSearchQuery(query: EnhancedSearchQuery): any {
    const where: any = {}
    const orderBy: any[] = []

    // Text search with full-text capabilities
    if (query.text || query.name || query.oracleText || query.typeText) {
      const searchTerms: string[] = []
      
      if (query.text) {
        if (query.exactMatch) {
          searchTerms.push(`"${query.text}"`)
        } else {
          searchTerms.push(query.text)
        }
      }
      
      if (query.name) {
        searchTerms.push(`name:"${query.name}"`)
      }
      
      if (query.oracleText) {
        searchTerms.push(`oracle:"${query.oracleText}"`)
      }
      
      if (query.typeText) {
        searchTerms.push(`type:"${query.typeText}"`)
      }
      
      if (searchTerms.length > 0) {
        const searchQuery = searchTerms.join(' ')
        
        where.OR = [
          {
            name: {
              search: searchQuery
            }
          },
          {
            oracleText: {
              search: searchQuery
            }
          },
          {
            typeLine: {
              search: searchQuery
            }
          }
        ]
      }
    }

    // Numeric range filters
    if (query.cmcRange) {
      const [min, max] = query.cmcRange
      where.cmc = { gte: min, lte: max }
    }

    if (query.powerRange) {
      const [min, max] = query.powerRange
      where.power = {
        in: Array.from({ length: max - min + 1 }, (_, i) => (min + i).toString())
      }
    }

    if (query.toughnessRange) {
      const [min, max] = query.toughnessRange
      where.toughness = {
        in: Array.from({ length: max - min + 1 }, (_, i) => (min + i).toString())
      }
    }

    if (query.priceRange) {
      const [min, max] = query.priceRange
      where.currentPrice = { gte: min, lte: max }
    }

    if (query.edhrecRankRange) {
      const [min, max] = query.edhrecRankRange
      where.edhrecRank = { gte: min, lte: max }
    }

    // Array filters
    if (query.colors && query.colors.length > 0) {
      where.colors = { hasSome: query.colors }
    }

    if (query.colorIdentity && query.colorIdentity.length > 0) {
      where.colorIdentity = { hasSome: query.colorIdentity }
    }

    if (query.synergyTags && query.synergyTags.length > 0) {
      where.synergyTags = { hasSome: query.synergyTags }
    }

    // Popularity filters
    if (query.minPopularity !== undefined) {
      where.popularityScore = { ...where.popularityScore, gte: query.minPopularity }
    }

    if (query.maxPopularity !== undefined) {
      where.popularityScore = { ...where.popularityScore, lte: query.maxPopularity }
    }

    // Format legality
    if (query.isLegal) {
      Object.entries(query.isLegal).forEach(([format, isLegal]) => {
        where.legalities = {
          ...where.legalities,
          path: [format],
          equals: isLegal ? 'legal' : 'banned'
        }
      })
    }

    return where
  }

  private async executeSearch(
    searchQuery: any, 
    query: EnhancedSearchQuery
  ): Promise<SearchResult[]> {
    const results = await this.db.enhancedCardData.findMany({
      where: searchQuery,
      select: {
        cardId: true,
        name: true,
        manaCost: true,
        cmc: true,
        typeLine: true,
        oracleText: true,
        power: true,
        toughness: true,
        colors: true,
        colorIdentity: true,
        legalities: true,
        currentPrice: true,
        popularityScore: true,
        edhrecRank: true,
        synergyTags: true,
        imageUrls: true,
        lastUpdated: true
      },
      take: query.limit + query.offset, // We'll paginate later
      orderBy: this.buildOrderBy(query)
    })

    return results.map(card => ({
      id: card.cardId,
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
      currentPrice: card.currentPrice ? Number(card.currentPrice) : undefined,
      popularityScore: Number(card.popularityScore),
      edhrecRank: card.edhrecRank,
      synergyTags: card.synergyTags,
      imageUrls: card.imageUrls as Record<string, string>,
      lastUpdated: card.lastUpdated
    }))
  }

  private async executeCount(searchQuery: any): Promise<number> {
    return await this.db.enhancedCardData.count({
      where: searchQuery
    })
  }

  private buildOrderBy(query: EnhancedSearchQuery): any[] {
    const orderBy: any[] = []

    if (query.sortBy) {
      switch (query.sortBy) {
        case 'name':
          orderBy.push({ name: query.sortOrder })
          break
        case 'cmc':
          orderBy.push({ cmc: query.sortOrder })
          break
        case 'price':
          orderBy.push({ currentPrice: query.sortOrder })
          break
        case 'popularity':
          orderBy.push({ popularityScore: query.sortOrder })
          break
        case 'edhrecRank':
          orderBy.push({ edhrecRank: query.sortOrder })
          break
        case 'releaseDate':
          orderBy.push({ lastUpdated: query.sortOrder })
          break
        default:
          // Default to popularity
          orderBy.push({ popularityScore: 'desc' })
      }
    } else {
      // Default ordering
      orderBy.push({ popularityScore: 'desc' })
      orderBy.push({ name: 'asc' })
    }

    return orderBy
  }

  private applyRelevanceScoring(
    cards: SearchResult[], 
    query: EnhancedSearchQuery
  ): SearchResult[] {
    if (!query.text && !query.name && !query.oracleText) {
      return cards
    }

    return cards.map(card => {
      let relevanceScore = 0
      const searchTerms = [
        query.text,
        query.name,
        query.oracleText
      ].filter(Boolean).map(term => term!.toLowerCase())

      for (const term of searchTerms) {
        // Exact name match
        if (card.name.toLowerCase() === term) {
          relevanceScore += 100
        }
        // Name starts with term
        else if (card.name.toLowerCase().startsWith(term)) {
          relevanceScore += 50
        }
        // Name contains term
        else if (card.name.toLowerCase().includes(term)) {
          relevanceScore += 25
        }

        // Oracle text contains term
        if (card.oracleText.toLowerCase().includes(term)) {
          relevanceScore += 10
        }

        // Type line contains term
        if (card.typeLine.toLowerCase().includes(term)) {
          relevanceScore += 15
        }
      }

      // Boost popular cards
      relevanceScore += card.popularityScore * 0.1

      // Boost cards with good EDHREC rank
      if (card.edhrecRank) {
        relevanceScore += Math.max(0, (10000 - card.edhrecRank) * 0.001)
      }

      return { ...card, relevanceScore }
    })
  }

  private applySorting(
    cards: SearchResult[], 
    query: EnhancedSearchQuery
  ): SearchResult[] {
    if (query.sortBy === 'relevance' || (!query.sortBy && query.text)) {
      return cards.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    }

    // Already sorted by database query
    return cards
  }

  private applyPagination(
    cards: SearchResult[], 
    query: EnhancedSearchQuery
  ): SearchResult[] {
    return cards.slice(query.offset, query.offset + query.limit)
  }

  private async generateFacets(
    searchQuery: any, 
    query: EnhancedSearchQuery
  ): Promise<SearchFacets> {
    // This would generate faceted search results
    // For now, return empty facets
    return {
      colors: [],
      colorIdentity: [],
      types: [],
      rarities: [],
      sets: [],
      cmcDistribution: [],
      priceRanges: []
    }
  }

  private async generateSuggestions(
    query: EnhancedSearchQuery, 
    totalCount: number
  ): Promise<string[]> {
    const suggestions: string[] = []

    // Suggest refinements based on result count
    if (totalCount === 0) {
      suggestions.push('Try removing some filters')
      suggestions.push('Check your spelling')
      suggestions.push('Use broader search terms')
    } else if (totalCount > 100) {
      suggestions.push('Try adding more specific filters')
      suggestions.push('Filter by color or mana cost')
      suggestions.push('Specify card type')
    }

    return suggestions
  }

  private async getCardNameSuggestions(
    partialQuery: string, 
    limit: number
  ): Promise<SearchSuggestion[]> {
    try {
      const cards = await this.db.enhancedCardData.findMany({
        where: {
          name: {
            contains: partialQuery,
            mode: 'insensitive'
          }
        },
        select: {
          name: true,
          typeLine: true,
          popularityScore: true
        },
        orderBy: {
          popularityScore: 'desc'
        },
        take: limit
      })

      return cards.map(card => ({
        type: 'card' as const,
        value: card.name,
        display: card.name,
        description: card.typeLine,
        popularity: Number(card.popularityScore)
      }))

    } catch (error) {
      logger.error('Card name suggestions failed', { partialQuery, error })
      return []
    }
  }

  private async getKeywordSuggestions(
    partialQuery: string, 
    limit: number
  ): Promise<SearchSuggestion[]> {
    const keywords = [
      'Flying', 'Trample', 'Haste', 'Vigilance', 'Deathtouch', 'Lifelink',
      'First Strike', 'Double Strike', 'Hexproof', 'Indestructible', 'Menace',
      'Flash', 'Defender', 'Reach', 'Shroud', 'Protection', 'Regenerate',
      'Landwalk', 'Unblockable', 'Fear', 'Intimidate', 'Flanking', 'Horsemanship',
      'Storm', 'Cascade', 'Flashback', 'Cycling', 'Madness', 'Threshold',
      'Delve', 'Convoke', 'Affinity', 'Modular', 'Sunburst', 'Bloodthirst'
    ]

    return keywords
      .filter(keyword => 
        keyword.toLowerCase().includes(partialQuery.toLowerCase())
      )
      .slice(0, limit)
      .map(keyword => ({
        type: 'keyword' as const,
        value: keyword,
        display: keyword,
        description: `Cards with ${keyword}`,
        popularity: 100
      }))
  }

  private async getSetSuggestions(
    partialQuery: string, 
    limit: number
  ): Promise<SearchSuggestion[]> {
    // This would query actual set data from the database
    const recentSets = [
      { code: 'ltr', name: 'The Lord of the Rings: Tales of Middle-earth' },
      { code: 'mom', name: 'March of the Machine' },
      { code: 'one', name: 'Phyrexia: All Will Be One' },
      { code: 'bro', name: 'The Brothers\' War' },
      { code: 'dmu', name: 'Dominaria United' },
      { code: 'snc', name: 'Streets of New Capenna' }
    ]

    return recentSets
      .filter(set => 
        set.name.toLowerCase().includes(partialQuery.toLowerCase()) ||
        set.code.toLowerCase().includes(partialQuery.toLowerCase())
      )
      .slice(0, limit)
      .map(set => ({
        type: 'set' as const,
        value: set.code,
        display: set.name,
        description: `Cards from ${set.name}`,
        popularity: 50
      }))
  }

  private async getTypeSuggestions(
    partialQuery: string, 
    limit: number
  ): Promise<SearchSuggestion[]> {
    const types = [
      'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker',
      'Land', 'Tribal', 'Legendary', 'Basic', 'Snow', 'Equipment', 'Aura',
      'Vehicle', 'Battle', 'Saga', 'Adventure', 'Token'
    ]

    return types
      .filter(type => 
        type.toLowerCase().includes(partialQuery.toLowerCase())
      )
      .slice(0, limit)
      .map(type => ({
        type: 'type' as const,
        value: type,
        display: type,
        description: `${type} cards`,
        popularity: 75
      }))
  }

  private async getContextualSuggestions(
    partialQuery: string,
    context: {
      userId?: string
      recentSearches?: string[]
      currentDeck?: string[]
    },
    limit: number
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = []

    // Suggestions based on recent searches
    if (context.recentSearches) {
      const recentMatches = context.recentSearches
        .filter(search => 
          search.toLowerCase().includes(partialQuery.toLowerCase())
        )
        .slice(0, Math.floor(limit / 2))
        .map(search => ({
          type: 'card' as const,
          value: search,
          display: search,
          description: 'Recent search',
          popularity: 80,
          category: 'recent'
        }))
      
      suggestions.push(...recentMatches)
    }

    // Suggestions based on current deck
    if (context.currentDeck) {
      // This would analyze the current deck and suggest synergistic cards
      // For now, return empty array
    }

    return suggestions
  }

  private async buildSemanticQuery(
    concept: string, 
    options: {
      colors?: string[]
      format?: string
      powerLevel?: number
      limit?: number
    }
  ): Promise<EnhancedSearchQuery> {
    // This would use AI/ML to convert concepts to search queries
    // For now, return a basic text search
    return {
      text: concept,
      colors: options.colors,
      formats: options.format ? [options.format] : undefined,
      limit: options.limit || 20
    }
  }

  private buildSimilarityQuery(
    referenceCard: any, 
    options: {
      similarity: 'mechanical' | 'thematic' | 'statistical' | 'all'
      limit?: number
      excludeReprints?: boolean
    }
  ): EnhancedSearchQuery {
    const query: EnhancedSearchQuery = {
      limit: options.limit || 20
    }

    switch (options.similarity) {
      case 'mechanical':
        // Find cards with similar abilities
        if (referenceCard.synergyTags.length > 0) {
          query.synergyTags = referenceCard.synergyTags.slice(0, 3)
        }
        break
        
      case 'thematic':
        // Find cards with similar themes
        query.colorIdentity = referenceCard.colorIdentity
        query.synergyTags = referenceCard.synergyTags
        break
        
      case 'statistical':
        // Find cards with similar stats
        query.cmcRange = [
          Math.max(0, referenceCard.cmc - 1),
          referenceCard.cmc + 1
        ]
        if (referenceCard.power) {
          const power = parseInt(referenceCard.power)
          if (!isNaN(power)) {
            query.powerRange = [Math.max(0, power - 1), power + 1]
          }
        }
        break
        
      case 'all':
        // Combine all similarity types
        query.colorIdentity = referenceCard.colorIdentity
        query.synergyTags = referenceCard.synergyTags.slice(0, 2)
        query.cmcRange = [
          Math.max(0, referenceCard.cmc - 2),
          referenceCard.cmc + 2
        ]
        break
    }

    return query
  }

  private generateCacheKey(query: EnhancedSearchQuery): string {
    // Create a stable cache key from the query
    const keyData = {
      ...query,
      userId: undefined, // Don't include user-specific data in cache key
      sessionId: undefined
    }
    
    return `enhanced_search:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }

  private async recordSearchAnalytics(
    query: EnhancedSearchQuery, 
    results: SearchResults
  ): Promise<void> {
    try {
      if (!query.userId) return

      await this.db.searchAnalytics.create({
        data: {
          userId: query.userId,
          query: JSON.stringify(query),
          resultCount: results.totalCount,
          searchTime: results.searchTime,
          timestamp: new Date(),
          clickThroughRate: 0, // Will be updated when cards are clicked
          averagePosition: 0 // Will be calculated later
        }
      })

    } catch (error) {
      logger.warn('Failed to record search analytics', { error })
    }
  }
}

// Export singleton instance
export const enhancedCardSearchService = EnhancedCardSearchService.getInstance()