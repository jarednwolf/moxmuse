import { 
  CardSearchQuery, 
  EnhancedCardData, 
  SearchResults, 
  SearchHistoryEntry,
  SavedSearch,
  SearchSuggestion,
  SearchAnalytics,
  ScryfallCard
} from '@moxmuse/shared'
import { scryfallService } from './scryfall'
// import { redisCache } from './redis'
import type { PrismaClient } from '@moxmuse/db'

const SEARCH_CACHE_TTL = 60 * 15 // 15 minutes
const SUGGESTIONS_CACHE_TTL = 60 * 60 * 24 // 24 hours

export class CardSearchService {
  private db: PrismaClient | null = null

  constructor(db?: PrismaClient) {
    this.db = db || null
  }

  /**
   * Perform complex card search with advanced filtering and ranking
   */
  async searchCards(
    query: CardSearchQuery,
    userId?: string,
    includeAnalytics = true
  ): Promise<SearchResults> {
    const startTime = Date.now()
    
    try {
      // Generate cache key
      const cacheKey = `card-search:${JSON.stringify(query)}`
      
      // Check cache first
      const cached = null // Redis cache disabled
      if (cached) {
        // Update analytics for cached results
        if (includeAnalytics && userId) {
          await this.recordSearchAnalytics(query, cached, Date.now() - startTime, userId)
        }
        return cached
      }

      // Build Scryfall query
      const scryfallQuery = this.buildScryfallQuery(query)
      
      // Execute search
      const scryfallCards = await scryfallService.search(scryfallQuery, {
        maxResults: query.limit || 100
      })

      // Convert to enhanced card data
      const enhancedCards = await this.enhanceCardData(scryfallCards)
      
      // Apply additional filtering and ranking
      const filteredCards = this.applyAdvancedFiltering(enhancedCards, query)
      const rankedCards = this.applyRelevanceRanking(filteredCards, query)
      
      // Apply sorting
      const sortedCards = this.applySorting(rankedCards, query)
      
      // Apply pagination
      const paginatedCards = this.applyPagination(sortedCards, query)
      
      // Generate search suggestions
      const suggestions = await this.generateSearchSuggestions(query, paginatedCards)
      
      const results: SearchResults = {
        cards: paginatedCards,
        totalCount: filteredCards.length,
        hasMore: (query.offset || 0) + paginatedCards.length < filteredCards.length,
        searchTime: Date.now() - startTime,
        suggestions
      }

      // Cache results
      // Redis cache disabled
      
      // Record analytics
      if (includeAnalytics && userId) {
        await this.recordSearchAnalytics(query, results, results.searchTime, userId)
        await this.recordSearchHistory(query, results, userId)
      }

      return results
    } catch (error) {
      console.error('Card search error:', error)
      throw new Error('Failed to search cards')
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(
    partialQuery: string,
    limit = 10,
    types?: string[]
  ): Promise<SearchSuggestion[]> {
    const cacheKey = `search-suggestions:${partialQuery}:${types?.join(',') || 'all'}`
    
    // Check cache
    // Redis cache disabled - skip cache check

    const suggestions: SearchSuggestion[] = []
    
    // Card name suggestions
    if (!types || types.includes('card')) {
      const cardSuggestions = await this.getCardNameSuggestions(partialQuery, limit)
      suggestions.push(...cardSuggestions)
    }
    
    // Keyword suggestions
    if (!types || types.includes('keyword')) {
      const keywordSuggestions = await this.getKeywordSuggestions(partialQuery, limit)
      suggestions.push(...keywordSuggestions)
    }
    
    // Set suggestions
    if (!types || types.includes('set')) {
      const setSuggestions = await this.getSetSuggestions(partialQuery, limit)
      suggestions.push(...setSuggestions)
    }
    
    // Type suggestions
    if (!types || types.includes('type')) {
      const typeSuggestions = await this.getTypeSuggestions(partialQuery, limit)
      suggestions.push(...typeSuggestions)
    }
    
    // Ability suggestions
    if (!types || types.includes('ability')) {
      const abilitySuggestions = await this.getAbilitySuggestions(partialQuery, limit)
      suggestions.push(...abilitySuggestions)
    }

    // Sort by popularity and relevance
    const sortedSuggestions = suggestions
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, limit)

    // Cache suggestions
    // Redis cache disabled
    
    return sortedSuggestions
  }

  /**
   * Save a search query for later use
   */
  async saveSearch(
    userId: string,
    name: string,
    description: string | undefined,
    query: CardSearchQuery,
    isPublic = false,
    tags?: string[]
  ): Promise<SavedSearch> {
    if (!this.db) {
      throw new Error('Database not available')
    }
    
    const savedSearch = await this.db.savedSearch.create({
      data: {
        userId,
        name,
        description,
        query: JSON.stringify(query),
        isPublic,
        tags: tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        useCount: 0
      }
    })

    return {
      id: savedSearch.id,
      userId: savedSearch.userId,
      name: savedSearch.name,
      description: savedSearch.description || undefined,
      query: JSON.parse(savedSearch.query),
      isPublic: savedSearch.isPublic,
      tags: savedSearch.tags,
      createdAt: savedSearch.createdAt.toISOString(),
      updatedAt: savedSearch.updatedAt.toISOString(),
      lastUsed: savedSearch.lastUsed?.toISOString(),
      useCount: savedSearch.useCount
    }
  }

  /**
   * Get user's saved searches
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    if (!this.db) {
      return []
    }

    const savedSearches = await this.db.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    })

    return savedSearches.map(search => ({
      id: search.id,
      userId: search.userId,
      name: search.name,
      description: search.description || undefined,
      query: JSON.parse(search.query),
      isPublic: search.isPublic,
      tags: search.tags,
      createdAt: search.createdAt.toISOString(),
      updatedAt: search.updatedAt.toISOString(),
      lastUsed: search.lastUsed?.toISOString(),
      useCount: search.useCount
    }))
  }

  /**
   * Get user's search history
   */
  async getSearchHistory(userId: string, limit = 50): Promise<SearchHistoryEntry[]> {
    if (!this.db) {
      return []
    }

    const history = await this.db.searchHistory.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    return history.map(entry => ({
      id: entry.id,
      userId: entry.userId,
      query: JSON.parse(entry.query),
      timestamp: entry.timestamp.toISOString(),
      resultCount: entry.resultCount
    }))
  }

  /**
   * Build Scryfall query string from structured query
   */
  private buildScryfallQuery(query: CardSearchQuery): string {
    const parts: string[] = []

    // Text search
    if (query.text) {
      parts.push(query.text)
    }

    // Name search
    if (query.name) {
      parts.push(`name:"${query.name}"`)
    }

    // Oracle text search
    if (query.oracleText) {
      parts.push(`oracle:"${query.oracleText}"`)
    }

    // Type search
    if (query.typeText) {
      parts.push(`type:"${query.typeText}"`)
    }

    // CMC range
    if (query.cmcRange) {
      const [min, max] = query.cmcRange
      if (min === max) {
        parts.push(`cmc:${min}`)
      } else {
        parts.push(`cmc>=${min} cmc<=${max}`)
      }
    }

    // Power range
    if (query.powerRange) {
      const [min, max] = query.powerRange
      if (min === max) {
        parts.push(`power:${min}`)
      } else {
        parts.push(`power>=${min} power<=${max}`)
      }
    }

    // Toughness range
    if (query.toughnessRange) {
      const [min, max] = query.toughnessRange
      if (min === max) {
        parts.push(`toughness:${min}`)
      } else {
        parts.push(`toughness>=${min} toughness<=${max}`)
      }
    }

    // Colors
    if (query.colors && query.colors.length > 0) {
      parts.push(`c:${query.colors.join('')}`)
    }

    // Color identity
    if (query.colorIdentity && query.colorIdentity.length > 0) {
      parts.push(`id:${query.colorIdentity.join('')}`)
    }

    // Rarities
    if (query.rarities && query.rarities.length > 0) {
      const rarityQuery = query.rarities.map(r => `r:${r}`).join(' OR ')
      parts.push(`(${rarityQuery})`)
    }

    // Sets
    if (query.sets && query.sets.length > 0) {
      const setQuery = query.sets.map(s => `set:${s}`).join(' OR ')
      parts.push(`(${setQuery})`)
    }

    // Format legality
    if (query.isLegal) {
      Object.entries(query.isLegal).forEach(([format, isLegal]) => {
        parts.push(`${isLegal ? '' : '-'}legal:${format}`)
      })
    }

    // Keywords
    if (query.hasKeywords && query.hasKeywords.length > 0) {
      query.hasKeywords.forEach(keyword => {
        parts.push(`keyword:"${keyword}"`)
      })
    }

    // Produces colors
    if (query.producesColors && query.producesColors.length > 0) {
      query.producesColors.forEach(color => {
        parts.push(`produces:${color}`)
      })
    }

    return parts.join(' ')
  }

  /**
   * Enhance Scryfall card data with additional metadata
   */
  private async enhanceCardData(scryfallCards: ScryfallCard[]): Promise<EnhancedCardData[]> {
    return Promise.all(scryfallCards.map(async (card) => {
      // Get enhanced data from database if available
      const enhancedCard = await this.db?.enhancedCard.findUnique({
        where: { scryfallId: card.id }
      })

      return {
        id: card.id,
        name: card.name,
        manaCost: card.mana_cost,
        cmc: card.cmc,
        typeLine: card.type_line,
        oracleText: card.oracle_text,
        power: (card as any).power,
        toughness: (card as any).toughness,
        colors: card.colors,
        colorIdentity: card.color_identity,
        legalities: card.legalities,
        rulings: [], // TODO: Fetch from database
        printings: [], // TODO: Fetch from database
        relatedCards: [], // TODO: Fetch from database
        edhrecRank: enhancedCard?.edhrecRank || undefined,
        popularityScore: enhancedCard?.popularityScore ? Number(enhancedCard.popularityScore) : 0,
        synergyTags: enhancedCard?.synergyTags || [],
        currentPrice: parseFloat(card.prices.usd || '0'),
        priceHistory: [], // TODO: Fetch from database
        availability: {
          inStock: true,
          lowStock: false,
          sources: ['scryfall'],
          lastChecked: new Date().toISOString()
        },
        lastUpdated: new Date().toISOString(),
        imageUrls: card.image_uris || {}
      }
    }))
  }

  /**
   * Apply advanced filtering beyond Scryfall capabilities
   */
  private applyAdvancedFiltering(cards: EnhancedCardData[], query: CardSearchQuery): EnhancedCardData[] {
    return cards.filter(card => {
      // Additional filtering logic can be added here
      // For now, all cards pass through
      return true
    })
  }

  /**
   * Apply relevance ranking based on query
   */
  private applyRelevanceRanking(cards: EnhancedCardData[], query: CardSearchQuery): EnhancedCardData[] {
    if (!query.text && !query.name && !query.oracleText) {
      return cards
    }

    return cards.map(card => {
      let relevanceScore = 0

      // Name matching
      if (query.text || query.name) {
        const searchTerm = (query.text || query.name || '').toLowerCase()
        const cardName = card.name.toLowerCase()
        
        if (cardName === searchTerm) {
          relevanceScore += 100
        } else if (cardName.startsWith(searchTerm)) {
          relevanceScore += 50
        } else if (cardName.includes(searchTerm)) {
          relevanceScore += 25
        }
      }

      // Oracle text matching
      if (query.oracleText) {
        const searchTerm = query.oracleText.toLowerCase()
        const oracleText = card.oracleText.toLowerCase()
        
        if (oracleText.includes(searchTerm)) {
          relevanceScore += 10
        }
      }

      // Popularity boost
      relevanceScore += card.popularityScore * 0.1

      // EDHREC rank boost (lower rank = higher relevance)
      if (card.edhrecRank) {
        relevanceScore += Math.max(0, 10000 - card.edhrecRank) * 0.001
      }

      return { ...card, relevanceScore }
    }).sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
  }

  /**
   * Apply sorting to search results
   */
  private applySorting(cards: EnhancedCardData[], query: CardSearchQuery): EnhancedCardData[] {
    if (!query.sortBy) {
      return cards // Already sorted by relevance
    }

    const sortOrder = query.sortOrder === 'desc' ? -1 : 1

    return [...cards].sort((a, b) => {
      let comparison = 0

      switch (query.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'cmc':
          comparison = a.cmc - b.cmc
          break
        case 'power':
          const powerA = parseInt(a.power || '0')
          const powerB = parseInt(b.power || '0')
          comparison = powerA - powerB
          break
        case 'toughness':
          const toughnessA = parseInt(a.toughness || '0')
          const toughnessB = parseInt(b.toughness || '0')
          comparison = toughnessA - toughnessB
          break
        case 'price':
          comparison = a.currentPrice - b.currentPrice
          break
        case 'releaseDate':
          // TODO: Implement release date sorting
          comparison = 0
          break
        default:
          comparison = 0
      }

      return comparison * sortOrder
    })
  }

  /**
   * Apply pagination to search results
   */
  private applyPagination(cards: EnhancedCardData[], query: CardSearchQuery): EnhancedCardData[] {
    const offset = query.offset || 0
    const limit = query.limit || 50

    return cards.slice(offset, offset + limit)
  }

  /**
   * Generate search suggestions based on query and results
   */
  private async generateSearchSuggestions(
    query: CardSearchQuery,
    results: EnhancedCardData[]
  ): Promise<string[]> {
    const suggestions: string[] = []

    // If few results, suggest broader searches
    if (results.length < 5) {
      if (query.colors && query.colors.length > 1) {
        suggestions.push('Try searching with fewer colors')
      }
      if (query.cmcRange) {
        suggestions.push('Try expanding the mana cost range')
      }
      if (query.rarities && query.rarities.length === 1) {
        suggestions.push('Try including more rarities')
      }
    }

    // If many results, suggest narrower searches
    if (results.length > 50) {
      if (!query.colors || query.colors.length === 0) {
        suggestions.push('Try filtering by color')
      }
      if (!query.cmcRange) {
        suggestions.push('Try filtering by mana cost')
      }
      if (!query.typeText) {
        suggestions.push('Try filtering by card type')
      }
    }

    return suggestions
  }

  /**
   * Get card name suggestions for autocomplete
   */
  private async getCardNameSuggestions(partialQuery: string, limit: number): Promise<SearchSuggestion[]> {
    try {
      const cards = await scryfallService.search(`name:"${partialQuery}"`, { maxResults: limit })
      
      return cards.map(card => ({
        type: 'card' as const,
        value: card.name,
        display: card.name,
        description: card.type_line,
        popularity: (card as any).edhrec_rank ? 10000 - (card as any).edhrec_rank : 0
      }))
    } catch (error) {
      console.error('Error getting card name suggestions:', error)
      return []
    }
  }

  /**
   * Get keyword suggestions
   */
  private async getKeywordSuggestions(partialQuery: string, limit: number): Promise<SearchSuggestion[]> {
    const keywords = [
      'Flying', 'Trample', 'Haste', 'Vigilance', 'Deathtouch', 'Lifelink',
      'First Strike', 'Double Strike', 'Hexproof', 'Indestructible', 'Menace',
      'Flash', 'Defender', 'Reach', 'Shroud', 'Protection', 'Regenerate',
      'Landwalk', 'Unblockable', 'Fear', 'Intimidate', 'Flanking', 'Horsemanship'
    ]

    return keywords
      .filter(keyword => keyword.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, limit)
      .map(keyword => ({
        type: 'keyword' as const,
        value: keyword,
        display: keyword,
        description: `Cards with ${keyword}`,
        popularity: 100 // Static popularity for now
      }))
  }

  /**
   * Get set suggestions
   */
  private async getSetSuggestions(partialQuery: string, limit: number): Promise<SearchSuggestion[]> {
    // This would typically come from a database of sets
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

  /**
   * Get type suggestions
   */
  private async getTypeSuggestions(partialQuery: string, limit: number): Promise<SearchSuggestion[]> {
    const types = [
      'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker',
      'Land', 'Tribal', 'Legendary', 'Basic', 'Snow', 'Equipment', 'Aura',
      'Vehicle', 'Battle', 'Saga'
    ]

    return types
      .filter(type => type.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, limit)
      .map(type => ({
        type: 'type' as const,
        value: type,
        display: type,
        description: `${type} cards`,
        popularity: 75
      }))
  }

  /**
   * Get ability suggestions
   */
  private async getAbilitySuggestions(partialQuery: string, limit: number): Promise<SearchSuggestion[]> {
    const abilities = [
      'Draw a card', 'Destroy target', 'Return to hand', 'Search your library',
      'Put into play', 'Exile target', 'Counter target spell', 'Deal damage',
      'Gain life', 'Create token', 'Sacrifice', 'Discard', 'Mill', 'Scry'
    ]

    return abilities
      .filter(ability => ability.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, limit)
      .map(ability => ({
        type: 'ability' as const,
        value: ability,
        display: ability,
        description: `Cards that ${ability.toLowerCase()}`,
        popularity: 25
      }))
  }

  /**
   * Record search analytics
   */
  private async recordSearchAnalytics(
    query: CardSearchQuery,
    results: SearchResults,
    searchTime: number,
    userId: string
  ): Promise<void> {
    try {
      await this.db?.searchAnalytics.create({
        data: {
          query: JSON.stringify(query),
          resultCount: results.totalCount,
          searchTime,
          userId,
          timestamp: new Date(),
          clickThroughRate: 0, // Will be updated when cards are clicked
          averagePosition: 0 // Will be calculated later
        }
      })
    } catch (error) {
      console.error('Error recording search analytics:', error)
    }
  }

  /**
   * Record search history
   */
  private async recordSearchHistory(
    query: CardSearchQuery,
    results: SearchResults,
    userId: string
  ): Promise<void> {
    try {
      await this.db?.searchHistory.create({
        data: {
          userId,
          query: JSON.stringify(query),
          resultCount: results.totalCount,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error('Error recording search history:', error)
    }
  }
}

export const cardSearchService = new CardSearchService()
