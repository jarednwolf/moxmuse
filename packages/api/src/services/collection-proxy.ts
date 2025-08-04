import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from './redis'
import { MoxfieldService } from './moxfield'
import { CardLookupService } from './card-lookup'

interface CollectionCard {
  cardId: string
  quantity: number
  foilQuantity: number
  condition: string
  language: string
  purchasePrice?: number
  setCode?: string
  collectorNumber?: string
}

interface ExternalCollection {
  cards: CollectionCard[]
  totalValue?: number
  lastUpdated?: Date
  source: 'moxfield' | 'archidekt' | 'manual' | 'csv'
}

// Collection source configuration
interface CollectionSource {
  id: string
  userId: string
  type: 'moxfield' | 'archidekt' | 'manual'
  username?: string // For public profile fetching
  isPublic?: boolean
  lastSynced?: Date
  metadata?: any
}

export class CollectionProxyService {
  private readonly SYNC_INTERVAL = 60 * 60 * 1000 // 1 hour
  private readonly ownershipCache = new Map<string, Map<string, number>>()
  
  constructor(private prisma: PrismaClient) {}

  /**
   * Fetch collection from all connected sources with real-time sync
   */
  async fetchCollection(userId: string, forceSync: boolean = false): Promise<ExternalCollection> {
    console.log('fetchCollection called for user:', userId)
    
    // Check if we need to sync sources
    if (forceSync || await this.shouldSync(userId)) {
      await this.syncAllSources(userId)
    }
    
    // Get all active collection sources for the user
    const sources = await (this.prisma as any).collectionSource.findMany({
      where: { 
        userId,
        isActive: true
      }
    })
    
    console.log('Found active sources:', sources.length)
    
    const allCards: CollectionCard[] = []
    let totalValue = 0
    let lastUpdated: Date | undefined = undefined
    
    // Fetch cards from each source
    for (const source of sources) {
      console.log(`Fetching from source: ${source.type} - ${source.username}`)
      
      try {
        let result: ExternalCollection | null = null
        
        switch (source.type) {
          case 'moxfield':
            // Check if cached
            const cached = await redisCache.get<ExternalCollection>(`collection:${source.id}`)
            if (cached) {
              console.log('Using cached data for:', source.username)
              result = cached
            } else {
              console.log('Fetching fresh data for:', source.username)
              result = await this.fetchFromMoxfieldPublic(source)
              // Cache the result
              await redisCache.set(`collection:${source.id}`, result, 300)
            }
            break
            
          case 'archidekt':
            result = await this.fetchFromArchidekt(source)
            break
            
          case 'manual':
            // For manual sources, fetch from local storage
            result = await this.fetchLocalCollection(userId)
            break
        }
        
        if (result) {
          allCards.push(...result.cards)
          totalValue += result.totalValue || 0
          
          if (!lastUpdated || (result.lastUpdated && result.lastUpdated > lastUpdated)) {
            lastUpdated = result.lastUpdated
          }
        }
      } catch (error: any) {
        console.error(`Error fetching from ${source.type} source ${source.username}:`, error.message || error)
        
        // Check if it's a rate limit/blocking error
        if (error.response?.status === 403) {
          console.log('Moxfield is blocking requests (403). Using cached data if available.')
        }
        
        // Continue with other sources even if one fails
        // If we have cached data, try to use it even if it's stale
        try {
          const cached = await redisCache.get<ExternalCollection>(`collection:${source.id}`)
          if (cached) {
            console.log('Using stale cached data for:', source.username)
            allCards.push(...cached.cards)
            totalValue += cached.totalValue || 0
          } else {
            // Try backup cache
            const backup = await redisCache.get<{ cards: CollectionCard[] }>(`collection:backup:${source.id}`)
            if (backup) {
              console.log('Using backup cached data for:', source.username)
              allCards.push(...backup.cards)
            }
          }
        } catch (cacheError) {
          console.error('Failed to get cached data:', cacheError)
        }
      }
    }
    
    console.log(`Total cards collected: ${allCards.length}`)
    
    return {
      cards: allCards,
      source: 'manual' as const,
      lastUpdated,
      totalValue
    }
  }

  /**
   * Get all collection sources for a user
   */
  private async getCollectionSources(userId: string): Promise<CollectionSource[]> {
    // Get stored collection sources from database
    const dbSources = await (this.prisma as any).collectionSource.findMany({
      where: { 
        userId,
        isActive: true
      }
    })
    
    return dbSources.map((source: any) => ({
      id: source.id,
      userId: source.userId,
      type: source.type as 'moxfield' | 'archidekt' | 'manual',
      username: source.username || undefined,
      isPublic: true, // All sources are public for now
      lastSynced: source.lastSynced || undefined,
      metadata: source.metadata
    }))
  }

  /**
   * Fetch collection from a specific source
   */
  private async fetchFromSource(source: CollectionSource): Promise<ExternalCollection> {
    switch (source.type) {
      case 'moxfield':
        return this.fetchFromMoxfieldPublic(source)
      case 'archidekt':
        return this.fetchFromArchidekt(source)
      case 'manual':
        return this.fetchLocalCollection(source.userId)
      default:
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: `Collection source ${source.type} not implemented`
        })
    }
  }

  /**
   * Fetch from Moxfield public API
   * Uses undocumented endpoints that work for public decks
   */
  private async fetchFromMoxfieldPublic(source: CollectionSource): Promise<ExternalCollection> {
    if (!source.username) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Moxfield deck ID or URL required'
      })
    }

    // Extract deck ID from URL or use as-is
    const deckId = MoxfieldService.extractDeckId(source.username)

    try {
      // Fetch deck using the MoxfieldService
      const data = await MoxfieldService.fetchDeck(deckId)
      
      // Transform Moxfield data to our format
      const cards: CollectionCard[] = []
      
      // Process mainboard
      if (data.mainboard) {
        for (const [cardKey, cardData] of Object.entries(data.mainboard)) {
          const card = cardData as any
          if (card.quantity > 0) {
            // Try to get Scryfall ID from the card object
            let scryfallId = card.card?.id || card.card?.scryfall_id
            
            // If no Scryfall ID, try to look it up by name
            if (!scryfallId && (card.card?.name || cardKey)) {
              const cardName = card.card?.name || cardKey
              console.log(`No Scryfall ID for "${cardName}", looking up...`)
              
              const lookupResult = await CardLookupService.lookupByName(
                cardName,
                card.card?.set,
                card.card?.collector_number
              )
              
              if (lookupResult) {
                scryfallId = lookupResult.scryfallId
                console.log(`Found Scryfall ID for "${cardName}": ${scryfallId}`)
              } else {
                console.warn(`Could not find Scryfall ID for card: ${cardName}`)
                continue
              }
            }
            
            if (!scryfallId) {
              console.warn(`Skipping card without ID: ${cardKey}`)
              continue
            }
            
            cards.push({
              cardId: scryfallId,
              quantity: card.quantity,
              foilQuantity: card.foil_quantity || 0,
              condition: 'NM',
              language: 'en'
            })
          }
        }
      }

      // Process commander (for EDH decks)
      if (data.commanders) {
        for (const [cardKey, cardData] of Object.entries(data.commanders)) {
          const card = cardData as any
          if (card.quantity > 0) {
            // Try to get Scryfall ID from the card object
            let scryfallId = card.card?.id || card.card?.scryfall_id
            
            // If no Scryfall ID, try to look it up by name
            if (!scryfallId && (card.card?.name || cardKey)) {
              const cardName = card.card?.name || cardKey
              console.log(`No Scryfall ID for commander "${cardName}", looking up...`)
              
              const lookupResult = await CardLookupService.lookupByName(
                cardName,
                card.card?.set,
                card.card?.collector_number
              )
              
              if (lookupResult) {
                scryfallId = lookupResult.scryfallId
                console.log(`Found Scryfall ID for "${cardName}": ${scryfallId}`)
              } else {
                console.warn(`Could not find Scryfall ID for commander: ${cardName}`)
                continue
              }
            }
            
            if (!scryfallId) {
              console.warn(`Skipping commander without ID: ${cardKey}`)
              continue
            }
            
            cards.push({
              cardId: scryfallId,
              quantity: card.quantity,
              foilQuantity: card.foil_quantity || 0,
              condition: 'NM',
              language: 'en'
            })
          }
        }
      }

      console.log(`Successfully fetched Moxfield deck: ${data.name} (${cards.length} cards)`)

      return {
        cards,
        source: 'moxfield',
        lastUpdated: new Date(),
        totalValue: data.total_value
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      
      console.error('Moxfield API error:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Moxfield deck'
      })
    }
  }

  /**
   * Transform Moxfield card format to our format
   */
  private transformMoxfieldCards(moxfieldCards: any[]): CollectionCard[] {
    return moxfieldCards.map((card: any) => ({
      cardId: card.scryfall_id || card.id,
      quantity: card.quantity || 1,
      foilQuantity: card.foil_quantity || 0,
      condition: card.condition || 'NM',
      language: card.language || 'en',
      purchasePrice: card.purchase_price,
      setCode: card.set,
      collectorNumber: card.collector_number
    }))
  }

  /**
   * Fetch from Archidekt GraphQL API
   */
  private async fetchFromArchidekt(source: CollectionSource): Promise<ExternalCollection> {
    if (!source.username) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Archidekt username required'
      })
    }

    try {
      // Archidekt GraphQL endpoint
      const query = `
        query GetUserCollection($username: String!) {
          user(username: $username) {
            collection {
              cards {
                card {
                  oracleCard {
                    name
                    scryfallId
                  }
                }
                quantity
                foilQuantity: quantityFoil
                conditions
              }
            }
          }
        }
      `

      const response = await fetch('https://archidekt.com/api/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { username: source.username }
        })
      })

      if (!response.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch collection from Archidekt'
        })
      }

      const data = await response.json() as any
      
      if (!data.data?.user?.collection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Archidekt user not found or collection is private'
        })
      }

      // Transform Archidekt format
      const cards: CollectionCard[] = data.data.user.collection.cards.map((item: any) => ({
        cardId: item.card.oracleCard.scryfallId,
        quantity: item.quantity || 0,
        foilQuantity: item.foilQuantity || 0,
        condition: 'NM', // Archidekt doesn't provide condition in public API
        language: 'en',
      }))

      return {
        cards,
        lastUpdated: new Date(),
        source: 'archidekt'
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error
      
      console.error('Archidekt API error:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Archidekt collection'
      })
    }
  }

  /**
   * Fetch locally stored collection (manual imports)
   */
  private async fetchLocalCollection(userId: string): Promise<ExternalCollection> {
    console.log('fetchLocalCollection - userId:', userId)
    
    const cards = await this.prisma.collectionCard.findMany({
      where: { userId }
    })
    
    console.log('fetchLocalCollection - Found cards:', cards.length)

    return {
      cards: cards.map(card => ({
        cardId: card.cardId,
        quantity: card.quantity,
        foilQuantity: card.foilQuantity,
        condition: card.condition,
        language: card.language,
        purchasePrice: card.purchasePrice?.toNumber()
      })),
      lastUpdated: cards[0]?.updatedAt || new Date(),
      source: 'manual'
    }
  }

  /**
   * Merge multiple collections into one
   */
  private mergeCollections(collections: ExternalCollection[]): ExternalCollection {
    const cardMap = new Map<string, CollectionCard>()
    let totalValue = 0
    let lastUpdated = new Date(0)

    for (const collection of collections) {
      if (collection.totalValue) {
        totalValue += collection.totalValue
      }
      
      if (collection.lastUpdated && collection.lastUpdated > lastUpdated) {
        lastUpdated = collection.lastUpdated
      }

      for (const card of collection.cards) {
        const key = `${card.cardId}-${card.condition}-${card.language}`
        const existing = cardMap.get(key)
        
        if (existing) {
          existing.quantity += card.quantity
          existing.foilQuantity += card.foilQuantity
        } else {
          cardMap.set(key, { ...card })
        }
      }
    }

    return {
      cards: Array.from(cardMap.values()),
      totalValue,
      lastUpdated,
      source: collections.length === 1 ? collections[0]!.source : 'manual'
    }
  }

  /**
   * Check if user owns specific cards
   */
  async checkOwnership(userId: string, cardIds: string[]): Promise<Map<string, number>> {
    const collection = await this.fetchCollection(userId)
    
    const ownership = new Map<string, number>()
    for (const card of collection.cards) {
      if (cardIds.includes(card.cardId)) {
        const current = ownership.get(card.cardId) || 0
        ownership.set(card.cardId, current + card.quantity + card.foilQuantity)
      }
    }
    
    return ownership
  }

  /**
   * Add a new collection source
   */
  async addCollectionSource(userId: string, type: 'moxfield' | 'archidekt', username: string): Promise<void> {
    // In a real implementation, this would store the source configuration
    // For now, we'll just validate that the username exists
    
    if (type === 'moxfield') {
      // Since Moxfield doesn't have a public API, we'll just accept any username
      // The actual collection fetch will fail later if the username is invalid
      console.log(`Adding Moxfield source for user: ${username}`)
      // Note: In the future when Moxfield provides API access, we can add validation here
    } else if (type === 'archidekt') {
      // Validate Archidekt username
      const source: CollectionSource = {
        id: `archidekt-${userId}`,
        userId,
        type: 'archidekt',
        username
      }
      await this.fetchFromArchidekt(source) // This will throw if invalid
    }
    
    // Store the collection source in the database
    await (this.prisma as any).collectionSource.upsert({
      where: {
        userId_type_username: {
          userId,
          type,
          username: username || ''
        }
      },
      update: {
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId,
        type,
        username,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${username}`,
        isActive: true
      }
    })
    
    // Clear cache to force refresh
    await redisCache.del(`collection:${userId}`)
  }

  /**
   * Import collection from CSV/text
   */
  async importCollection(userId: string, cards: CollectionCard[]): Promise<void> {
    // Store cards locally
    for (const card of cards) {
      await this.prisma.collectionCard.upsert({
        where: {
          userId_cardId_condition_language: {
            userId,
            cardId: card.cardId,
            condition: card.condition,
            language: card.language
          }
        },
        update: {
          quantity: card.quantity,
          foilQuantity: card.foilQuantity,
          purchasePrice: card.purchasePrice,
          updatedAt: new Date()
        },
        create: {
          userId,
          cardId: card.cardId,
          quantity: card.quantity,
          foilQuantity: card.foilQuantity,
          condition: card.condition,
          language: card.language,
          purchasePrice: card.purchasePrice
        }
      })
    }
    
    // Create or update manual source
    await (this.prisma as any).collectionSource.upsert({
      where: {
        userId_type_username: {
          userId,
          type: 'manual',
          username: ''
        }
      },
      update: {
        isActive: true,
        lastSynced: new Date(),
        updatedAt: new Date()
      },
      create: {
        userId,
        type: 'manual',
        username: '',
        name: 'Manual Import',
        isActive: true,
        lastSynced: new Date()
      }
    })
    
    // Clear cache
    await redisCache.del(`collection:${userId}`)
  }

  /**
   * Manually sync a specific source and store the data locally
   */
  async syncSource(sourceId: string): Promise<void> {
    const source = await (this.prisma as any).collectionSource.findUnique({
      where: { id: sourceId }
    })
    
    if (!source) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Collection source not found'
      })
    }
    
    console.log(`Syncing source: ${source.type} - ${source.username}`)
    
    try {
      let result: ExternalCollection | null = null
      
      switch (source.type) {
        case 'moxfield':
          result = await this.fetchFromMoxfieldPublic(source)
          break
        case 'archidekt':
          result = await this.fetchFromArchidekt(source)
          break
        case 'manual':
          // Manual sources are already stored locally
          return
      }
      
      if (result) {
        // Store the collection data locally
        await this.storeCollectionLocally(source.userId, result.cards, source.id)
        
        // Update last synced time
        await (this.prisma as any).collectionSource.update({
          where: { id: sourceId },
          data: { 
            lastSynced: new Date(),
            metadata: {
              cardCount: result.cards.length,
              totalValue: result.totalValue
            }
          }
        })
        
        // Cache the result
        await redisCache.set(`collection:${source.id}`, result, 300)
      }
    } catch (error) {
      console.error(`Failed to sync source ${sourceId}:`, error)
      throw error
    }
  }
  
  /**
   * Store collection data locally (minimal storage)
   */
  private async storeCollectionLocally(userId: string, cards: CollectionCard[], sourceId: string): Promise<void> {
    // Store in Redis with longer TTL as backup
    const backupKey = `collection:backup:${sourceId}`
    await redisCache.set(backupKey, { cards }, 86400) // 24 hours
    
    console.log(`Stored ${cards.length} cards locally for source ${sourceId}`)
  }

  /**
   * Real-time ownership tracking
   */
  async trackOwnership(userId: string, cardIds: string[]): Promise<Map<string, number>> {
    // Check cache first
    const cacheKey = `ownership:${userId}`
    let ownership = this.ownershipCache.get(cacheKey)
    
    if (!ownership) {
      const collection = await this.fetchCollection(userId)
      ownership = new Map<string, number>()
      
      for (const card of collection.cards) {
        const current = ownership.get(card.cardId) || 0
        ownership.set(card.cardId, current + card.quantity + card.foilQuantity)
      }
      
      this.ownershipCache.set(cacheKey, ownership)
      
      // Clear cache after 15 minutes
      setTimeout(() => {
        this.ownershipCache.delete(cacheKey)
      }, 15 * 60 * 1000)
    }
    
    const result = new Map<string, number>()
    for (const cardId of cardIds) {
      result.set(cardId, ownership.get(cardId) || 0)
    }
    
    return result
  }

  /**
   * Budget calculator based on unowned cards only
   */
  async calculateBudget(userId: string, cardIds: string[], prices: Map<string, number>): Promise<{
    totalValue: number
    ownedValue: number
    missingValue: number
    missingCards: { cardId: string; quantity: number; price: number }[]
  }> {
    const ownership = await this.trackOwnership(userId, cardIds)
    
    let totalValue = 0
    let ownedValue = 0
    let missingValue = 0
    const missingCards: { cardId: string; quantity: number; price: number }[] = []
    
    for (const cardId of cardIds) {
      const price = prices.get(cardId) || 0
      const owned = ownership.get(cardId) || 0
      const needed = 1 // Assuming 1 copy needed, could be parameterized
      
      totalValue += price * needed
      
      if (owned >= needed) {
        ownedValue += price * needed
      } else {
        const missing = needed - owned
        ownedValue += price * owned
        missingValue += price * missing
        
        if (missing > 0) {
          missingCards.push({
            cardId,
            quantity: missing,
            price
          })
        }
      }
    }
    
    return {
      totalValue,
      ownedValue,
      missingValue,
      missingCards
    }
  }

  /**
   * Collection-aware suggestions prioritizing owned cards
   */
  async getCollectionAwareSuggestions(
    userId: string,
    category: string,
    alternatives: string[]
  ): Promise<{
    owned: string[]
    unowned: string[]
    recommendations: { cardId: string; reason: string; priority: number }[]
  }> {
    const ownership = await this.trackOwnership(userId, alternatives)
    
    const owned: string[] = []
    const unowned: string[] = []
    const recommendations: { cardId: string; reason: string; priority: number }[] = []
    
    for (const cardId of alternatives) {
      const ownedQuantity = ownership.get(cardId) || 0
      
      if (ownedQuantity > 0) {
        owned.push(cardId)
        recommendations.push({
          cardId,
          reason: `You already own ${ownedQuantity} cop${ownedQuantity === 1 ? 'y' : 'ies'}`,
          priority: 10 // Highest priority for owned cards
        })
      } else {
        unowned.push(cardId)
        recommendations.push({
          cardId,
          reason: 'Consider purchasing for deck improvement',
          priority: 5 // Lower priority for unowned cards
        })
      }
    }
    
    // Sort recommendations by priority
    recommendations.sort((a, b) => b.priority - a.priority)
    
    return {
      owned,
      unowned,
      recommendations
    }
  }

  /**
   * Multi-platform sync for Moxfield, Archidekt, EDHREC
   */
  async syncMultiplePlatforms(userId: string, platforms: {
    moxfield?: string[]
    archidekt?: string[]
    edhrec?: string[]
  }): Promise<{
    success: boolean
    syncedSources: string[]
    errors: { platform: string; error: string }[]
  }> {
    const syncedSources: string[] = []
    const errors: { platform: string; error: string }[] = []
    
    // Sync Moxfield sources
    if (platforms.moxfield) {
      for (const deckId of platforms.moxfield) {
        try {
          await this.addCollectionSource(userId, 'moxfield', deckId)
          syncedSources.push(`moxfield:${deckId}`)
        } catch (error: any) {
          errors.push({
            platform: 'moxfield',
            error: error.message || 'Unknown error'
          })
        }
      }
    }
    
    // Sync Archidekt sources
    if (platforms.archidekt) {
      for (const username of platforms.archidekt) {
        try {
          await this.addCollectionSource(userId, 'archidekt', username)
          syncedSources.push(`archidekt:${username}`)
        } catch (error: any) {
          errors.push({
            platform: 'archidekt',
            error: error.message || 'Unknown error'
          })
        }
      }
    }
    
    // EDHREC doesn't have collection sync, but we could sync deck lists
    if (platforms.edhrec) {
      for (const deckUrl of platforms.edhrec) {
        try {
          // This would implement EDHREC deck import
          // For now, just log it
          console.log(`Would sync EDHREC deck: ${deckUrl}`)
          syncedSources.push(`edhrec:${deckUrl}`)
        } catch (error: any) {
          errors.push({
            platform: 'edhrec',
            error: error.message || 'Unknown error'
          })
        }
      }
    }
    
    // Clear cache to force refresh
    await redisCache.del(`collection:${userId}`)
    this.ownershipCache.delete(`ownership:${userId}`)
    
    return {
      success: errors.length === 0,
      syncedSources,
      errors
    }
  }

  /**
   * Check if sources need syncing
   */
  private async shouldSync(userId: string): Promise<boolean> {
    const sources = await (this.prisma as any).collectionSource.findMany({
      where: { userId, isActive: true }
    })
    
    for (const source of sources) {
      if (!source.lastSynced) return true
      
      const timeSinceSync = Date.now() - source.lastSynced.getTime()
      if (timeSinceSync > this.SYNC_INTERVAL) return true
    }
    
    return false
  }

  /**
   * Sync all sources for a user
   */
  private async syncAllSources(userId: string): Promise<void> {
    const sources = await (this.prisma as any).collectionSource.findMany({
      where: { userId, isActive: true }
    })
    
    const syncPromises = sources.map((source: any) => 
      this.syncSource(source.id).catch(error => {
        console.error(`Failed to sync source ${source.id}:`, error)
      })
    )
    
    await Promise.all(syncPromises)
  }
} 