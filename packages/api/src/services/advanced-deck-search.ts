import { PrismaClient } from '@moxmuse/db'
import { 
  DeckSearchQuery, 
  DeckSearchResult, 
  SearchableDeck, 
  DeckSearchFilters,
  SavedDeckSearch,
  DeckSearchSuggestion,
  AutocompleteResult,
  DeckSearchHistory,
  SearchAnalytics,
  FilterOption,
  FilterRange
} from '@moxmuse/shared/deck-search-types'

export class AdvancedDeckSearchService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Perform advanced deck search with complex filtering and sorting
   */
  async searchDecks(query: DeckSearchQuery, userId?: string): Promise<DeckSearchResult> {
    const startTime = Date.now()
    
    // Build the Prisma query
    const whereClause = this.buildWhereClause(query, userId)
    const orderByClause = this.buildOrderByClause(query)
    
    // Execute search with pagination
    const [decks, totalCount] = await Promise.all([
      this.prisma.deck.findMany({
        where: whereClause,
        orderBy: orderByClause,
        take: query.limit || 20,
        skip: query.offset || 0,
        include: {
          user: {
            select: {
              name: true,
              image: true
            }
          },
          folderItems: {
            include: {
              folder: {
                select: {
                  name: true
                }
              }
            }
          },
          cards: {
            select: {
              cardId: true,
              quantity: true,
              isCommander: true
            }
          },
          _count: {
            select: {
              cards: true
            }
          }
        }
      }),
      this.prisma.deck.count({ where: whereClause })
    ])

    // Transform to searchable decks
    const searchableDecks: SearchableDeck[] = decks.map(deck => ({
      id: deck.id,
      name: deck.name,
      description: deck.description || undefined,
      commander: deck.commander || undefined,
      format: deck.format,
      archetype: this.extractArchetype(deck.tags),
      colors: this.extractColors(deck.cards),
      colorIdentity: this.extractColorIdentity(deck.cards),
      powerLevel: deck.powerLevel || undefined,
      budget: deck.budget ? Number(deck.budget) : undefined,
      cardCount: deck._count.cards,
      tags: deck.tags,
      isPublic: deck.isPublic,
      userId: deck.userId,
      userName: deck.user.name || undefined,
      userAvatar: deck.user.image || undefined,
      folderId: deck.folderItems[0]?.folder?.name || undefined,
      folderName: deck.folderItems[0]?.folder?.name || undefined,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      relevanceScore: this.calculateRelevanceScore(deck, query)
    }))

    // Get available filters
    const filters = await this.getAvailableFilters(userId)
    
    const searchTime = Date.now() - startTime

    // Log search for analytics
    if (userId) {
      await this.logSearch(userId, query, totalCount)
    }

    return {
      decks: searchableDecks,
      totalCount,
      hasMore: (query.offset || 0) + searchableDecks.length < totalCount,
      filters,
      query,
      searchTime
    }
  }

  /**
   * Get autocomplete suggestions for search
   */
  async getAutocompleteSuggestions(
    input: string, 
    userId?: string
  ): Promise<AutocompleteResult> {
    const suggestions: DeckSearchSuggestion[] = []
    
    // Search for matching deck names
    const deckSuggestions = await this.prisma.deck.findMany({
      where: {
        OR: [
          { name: { contains: input, mode: 'insensitive' } },
          { commander: { contains: input, mode: 'insensitive' } },
          { description: { contains: input, mode: 'insensitive' } }
        ],
        ...(userId ? {} : { isPublic: true })
      },
      select: {
        name: true,
        commander: true
      },
      take: 5
    })

    // Add deck suggestions
    deckSuggestions.forEach(deck => {
      if (deck.name.toLowerCase().includes(input.toLowerCase())) {
        suggestions.push({
          type: 'deck',
          value: deck.name,
          label: deck.name,
          icon: 'deck'
        })
      }
      if (deck.commander?.toLowerCase().includes(input.toLowerCase())) {
        suggestions.push({
          type: 'commander',
          value: deck.commander,
          label: deck.commander,
          icon: 'commander'
        })
      }
    })

    // Search for matching archetypes and tags
    const tagSuggestions = await this.prisma.deck.findMany({
      where: {
        tags: {
          hasSome: [input]
        },
        ...(userId ? {} : { isPublic: true })
      },
      select: {
        tags: true
      },
      take: 10
    })

    // Extract matching tags
    const matchingTags = new Set<string>()
    tagSuggestions.forEach(deck => {
      if (deck.tags && Array.isArray(deck.tags)) {
        deck.tags.forEach(tag => {
          if (tag.toLowerCase().includes(input.toLowerCase())) {
            matchingTags.add(tag)
          }
        })
      }
    })

    matchingTags.forEach(tag => {
      suggestions.push({
        type: 'tag',
        value: tag,
        label: `#${tag}`,
        icon: 'tag'
      })
    })

    // Get recent searches
    const recentSearches = userId ? await this.getRecentSearches(userId, 5) : []
    
    // Get popular searches
    const popularSearches = await this.getPopularSearches(5)

    return {
      suggestions: suggestions.slice(0, 10),
      recentSearches,
      popularSearches
    }
  }

  /**
   * Save a search query for later use
   */
  async saveSearch(
    userId: string, 
    name: string, 
    query: DeckSearchQuery,
    isPublic: boolean = false
  ): Promise<SavedDeckSearch> {
    const savedSearch = await this.prisma.savedDeckSearch.create({
      data: {
        userId,
        name,
        query: query as any,
        isPublic
      }
    })

    return {
      id: savedSearch.id,
      userId: savedSearch.userId,
      name: savedSearch.name,
      query: savedSearch.query as DeckSearchQuery,
      isPublic: savedSearch.isPublic,
      usageCount: savedSearch.usageCount,
      createdAt: savedSearch.createdAt,
      updatedAt: savedSearch.updatedAt
    }
  }

  /**
   * Get saved searches for a user
   */
  async getSavedSearches(userId: string): Promise<SavedDeckSearch[]> {
    const searches = await this.prisma.savedDeckSearch.findMany({
      where: {
        OR: [
          { userId },
          { isPublic: true }
        ]
      },
      orderBy: [
        { usageCount: 'desc' },
        { updatedAt: 'desc' }
      ]
    })

    return searches.map(search => ({
      id: search.id,
      userId: search.userId,
      name: search.name,
      query: search.query as DeckSearchQuery,
      isPublic: search.isPublic,
      usageCount: search.usageCount,
      createdAt: search.createdAt,
      updatedAt: search.updatedAt
    }))
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(userId?: string): Promise<SearchAnalytics> {
    // This would be implemented with proper analytics tracking
    // For now, return mock data
    return {
      totalSearches: 0,
      popularQueries: [],
      popularFilters: [],
      averageResultCount: 0,
      averageSearchTime: 0,
      noResultQueries: []
    }
  }

  /**
   * Build Prisma where clause from search query
   */
  private buildWhereClause(query: DeckSearchQuery, userId?: string): any {
    const conditions: any[] = []

    // Text search across multiple fields
    if (query.text) {
      conditions.push({
        OR: [
          { name: { contains: query.text, mode: 'insensitive' } },
          { description: { contains: query.text, mode: 'insensitive' } },
          { commander: { contains: query.text, mode: 'insensitive' } },
          { tags: { hasSome: [query.text] } }
        ]
      })
    }

    // Specific field searches
    if (query.name) {
      conditions.push({
        name: { contains: query.name, mode: 'insensitive' }
      })
    }

    if (query.description) {
      conditions.push({
        description: { contains: query.description, mode: 'insensitive' }
      })
    }

    if (query.commander) {
      conditions.push({
        commander: { contains: query.commander, mode: 'insensitive' }
      })
    }

    // Format filters
    if (query.formats && query.formats.length > 0) {
      conditions.push({
        format: { in: query.formats }
      })
    }

    // Power level range
    if (query.powerLevelRange) {
      conditions.push({
        powerLevel: {
          gte: query.powerLevelRange[0],
          lte: query.powerLevelRange[1]
        }
      })
    }

    // Budget range
    if (query.budgetRange) {
      conditions.push({
        budget: {
          gte: query.budgetRange[0],
          lte: query.budgetRange[1]
        }
      })
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      conditions.push({
        tags: { hassome: query.tags }
      })
    }

    // Date filters
    if (query.createdAfter) {
      conditions.push({
        createdAt: { gte: query.createdAfter }
      })
    }

    if (query.createdBefore) {
      conditions.push({
        createdAt: { lte: query.createdBefore }
      })
    }

    if (query.updatedAfter) {
      conditions.push({
        updatedAt: { gte: query.updatedAfter }
      })
    }

    if (query.updatedBefore) {
      conditions.push({
        updatedAt: { lte: query.updatedBefore }
      })
    }

    // User filter
    if (query.userId) {
      conditions.push({
        userId: query.userId
      })
    }

    // Public filter
    if (query.isPublic !== undefined) {
      conditions.push({
        isPublic: query.isPublic
      })
    } else if (!userId) {
      // If no user is logged in, only show public decks
      conditions.push({
        isPublic: true
      })
    }

    // Folder filter
    if (query.folderId) {
      conditions.push({
        folderItems: {
          some: {
            folderId: query.folderId
          }
        }
      })
    }

    return conditions.length > 0 ? { AND: conditions } : {}
  }

  /**
   * Build Prisma orderBy clause from search query
   */
  private buildOrderByClause(query: DeckSearchQuery): any {
    const sortBy = query.sortBy || 'updatedAt'
    const sortOrder = query.sortOrder || 'desc'

    switch (sortBy) {
      case 'name':
        return { name: sortOrder }
      case 'createdAt':
        return { createdAt: sortOrder }
      case 'updatedAt':
        return { updatedAt: sortOrder }
      case 'powerLevel':
        return { powerLevel: sortOrder }
      case 'budget':
        return { budget: sortOrder }
      case 'commander':
        return { commander: sortOrder }
      case 'format':
        return { format: sortOrder }
      case 'relevance':
        // For relevance, we'll sort by updatedAt for now
        // In a real implementation, this would use search scores
        return { updatedAt: 'desc' }
      default:
        return { updatedAt: 'desc' }
    }
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(deck: any, query: DeckSearchQuery): number {
    let score = 0

    if (query.text) {
      const searchText = query.text.toLowerCase()
      
      // Exact name match gets highest score
      if (deck.name.toLowerCase() === searchText) {
        score += 100
      } else if (deck.name.toLowerCase().includes(searchText)) {
        score += 50
      }

      // Commander match
      if (deck.commander?.toLowerCase().includes(searchText)) {
        score += 30
      }

      // Description match
      if (deck.description?.toLowerCase().includes(searchText)) {
        score += 20
      }

      // Tag match
      if (deck.tags.some((tag: string) => tag.toLowerCase().includes(searchText))) {
        score += 10
      }
    }

    // Boost score for recently updated decks
    const daysSinceUpdate = (Date.now() - deck.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUpdate < 7) {
      score += 10
    } else if (daysSinceUpdate < 30) {
      score += 5
    }

    return score
  }

  /**
   * Extract archetype from tags
   */
  private extractArchetype(tags: string[]): string | undefined {
    const archetypeKeywords = [
      'aggro', 'control', 'combo', 'midrange', 'ramp', 'tribal', 
      'voltron', 'aristocrats', 'tokens', 'graveyard', 'artifacts',
      'enchantments', 'spellslinger', 'lands', 'group-hug', 'stax'
    ]

    for (const tag of tags) {
      const lowerTag = tag.toLowerCase()
      if (archetypeKeywords.includes(lowerTag)) {
        return tag
      }
    }

    return undefined
  }

  /**
   * Extract colors from deck cards (simplified)
   */
  private extractColors(cards: any[]): string[] {
    // This would need to be implemented with actual card data
    // For now, return empty array
    return []
  }

  /**
   * Extract color identity from deck cards (simplified)
   */
  private extractColorIdentity(cards: any[]): string[] {
    // This would need to be implemented with actual card data
    // For now, return empty array
    return []
  }

  /**
   * Get available filters based on current data
   */
  private async getAvailableFilters(userId?: string): Promise<DeckSearchFilters> {
    const whereClause = userId ? {} : { isPublic: true }

    // Get format counts
    const formatCounts = await this.prisma.deck.groupBy({
      by: ['format'],
      where: whereClause,
      _count: true
    })

    // Get tag counts
    const tagCounts = await this.prisma.$queryRaw<Array<{tag: string, count: bigint}>>`
      SELECT unnest(tags) as tag, COUNT(*) as count
      FROM "Deck"
      ${userId ? '' : 'WHERE "isPublic" = true'}
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 50
    `

    // Get power level range
    const powerLevelStats = await this.prisma.deck.aggregate({
      where: {
        ...whereClause,
        powerLevel: { not: null }
      },
      _min: { powerLevel: true },
      _max: { powerLevel: true }
    })

    // Get budget range
    const budgetStats = await this.prisma.deck.aggregate({
      where: {
        ...whereClause,
        budget: { not: null }
      },
      _min: { budget: true },
      _max: { budget: true }
    })

    return {
      formats: formatCounts.map(f => ({
        value: f.format,
        label: f.format.charAt(0).toUpperCase() + f.format.slice(1),
        count: f._count
      })),
      archetypes: [], // Would be populated from actual archetype data
      colors: [
        { value: 'W', label: 'White', count: 0 },
        { value: 'U', label: 'Blue', count: 0 },
        { value: 'B', label: 'Black', count: 0 },
        { value: 'R', label: 'Red', count: 0 },
        { value: 'G', label: 'Green', count: 0 }
      ],
      powerLevels: {
        min: powerLevelStats._min.powerLevel || 1,
        max: powerLevelStats._max.powerLevel || 10,
        step: 1
      },
      budgets: {
        min: Number(budgetStats._min.budget) || 0,
        max: Number(budgetStats._max.budget) || 1000,
        step: 10
      },
      tags: tagCounts.map(t => ({
        value: t.tag,
        label: t.tag,
        count: Number(t.count)
      })),
      users: [] // Would be populated if needed
    }
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    userId: string, 
    query: DeckSearchQuery, 
    resultCount: number
  ): Promise<void> {
    try {
      await this.prisma.deckSearchHistory.create({
        data: {
          userId,
          query: query as any,
          resultCount,
          searchedAt: new Date()
        }
      })
    } catch (error) {
      // Log error but don't fail the search
      console.error('Failed to log search:', error)
    }
  }

  /**
   * Get recent searches for a user
   */
  private async getRecentSearches(userId: string, limit: number): Promise<SavedDeckSearch[]> {
    try {
      const searches = await this.prisma.savedDeckSearch.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit
      })

      return searches.map(search => ({
        id: search.id,
        userId: search.userId,
        name: search.name,
        query: search.query as DeckSearchQuery,
        isPublic: search.isPublic,
        usageCount: search.usageCount,
        createdAt: search.createdAt,
        updatedAt: search.updatedAt
      }))
    } catch (error) {
      console.error('Failed to get recent searches:', error)
      return []
    }
  }

  /**
   * Get popular searches
   */
  private async getPopularSearches(limit: number): Promise<SavedDeckSearch[]> {
    try {
      const searches = await this.prisma.savedDeckSearch.findMany({
        where: { isPublic: true },
        orderBy: { usageCount: 'desc' },
        take: limit
      })

      return searches.map(search => ({
        id: search.id,
        userId: search.userId,
        name: search.name,
        query: search.query as DeckSearchQuery,
        isPublic: search.isPublic,
        usageCount: search.usageCount,
        createdAt: search.createdAt,
        updatedAt: search.updatedAt
      }))
    } catch (error) {
      console.error('Failed to get popular searches:', error)
      return []
    }
  }
}