import axios from 'axios'
import { type ScryfallCard } from '@moxmuse/shared'
import { redisCache } from './redis'
import { scryfallRateLimiter } from '../utils/rateLimiter'

const SCRYFALL_API = process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com'
const CACHE_TTL = 60 * 60 * 24 // 24 hours

interface SearchOptions {
  maxResults?: number
  format?: string
  colors?: string[]
  types?: string[]
  maxPrice?: number
}

export const scryfallService = {
  async getCard(cardId: string): Promise<ScryfallCard | null> {
    try {
      // Validate cardId format (should be UUID)
      if (!cardId || !cardId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.warn(`Invalid Scryfall card ID format: ${cardId}`)
        return null
      }
      
      // Check cache first
      const cached = await redisCache.get<ScryfallCard>(`card:${cardId}`)
      if (cached) return cached

      // Fetch from API with rate limiting
      const response = await scryfallRateLimiter.limit(async () => 
        await axios.get(`${SCRYFALL_API}/cards/${cardId}`)
      )
      const card = response.data as ScryfallCard

      // Cache the result
      await redisCache.set(`card:${cardId}`, card, CACHE_TTL)

      return card
    } catch (error) {
      console.error('Scryfall getCard error:', error)
      return null
    }
  },

  async getCards(cardIds: string[]): Promise<(ScryfallCard | null)[]> {
    // First, check cache for all cards
    const cachedResults = await Promise.all(
      cardIds.map(id => redisCache.get<ScryfallCard>(`card:${id}`))
    )
    
    // Find cards that need to be fetched
    const toFetch: { index: number; id: string }[] = []
    cachedResults.forEach((cached, index) => {
      if (!cached) {
        toFetch.push({ index, id: cardIds[index] })
      }
    })
    
    // Fetch missing cards with rate limiting
    const fetchPromises = toFetch.map(async ({ id }, i) => {
      // Add delay between requests to respect rate limit
      if (i > 0) await this.delay(100)
      return this.getCard(id)
    })
    
    const fetchedCards = await Promise.all(fetchPromises)
    
    // Combine cached and fetched results
    const results = [...cachedResults]
    toFetch.forEach(({ index }, i) => {
      results[index] = fetchedCards[i]
    })
    
    return results
  },

  async search(query: string, options: SearchOptions = {}): Promise<ScryfallCard[]> {
    try {
      // Build search query
      let searchQuery = query
      
      if (options.format) {
        searchQuery += ` f:${options.format}`
      }
      
      if (options.colors && options.colors.length > 0) {
        searchQuery += ` c:${options.colors.join('')}`
      }
      
      if (options.types && options.types.length > 0) {
        options.types.forEach(type => {
          searchQuery += ` t:${type}`
        })
      }
      
      if (options.maxPrice) {
        searchQuery += ` usd<=${options.maxPrice}`
      }

      // Check cache
      const cacheKey = `search:${searchQuery}:${JSON.stringify(options)}`
      const cached = await redisCache.get<ScryfallCard[]>(cacheKey)
      if (cached) return cached

      // Fetch from API with rate limiting
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/search`, {
          params: {
            q: searchQuery,
            order: 'edhrec',
            dir: 'desc',
          },
        })
      )

      let cards = response.data.data as ScryfallCard[]
      
      // Apply max results limit
      if (options.maxResults) {
        cards = cards.slice(0, options.maxResults)
      }

      // Cache the results
      await redisCache.set(cacheKey, cards, CACHE_TTL)

      return cards
    } catch (error) {
      console.error('Scryfall search error:', error)
      return []
    }
  },

  async getRandomCommander(): Promise<ScryfallCard | null> {
    try {
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/random`, {
          params: {
            q: 'is:commander',
          },
        })
      )
      return response.data as ScryfallCard
    } catch (error) {
      console.error('Scryfall getRandomCommander error:', error)
      return null
    }
  },

  async getBulkData(): Promise<string> {
    try {
      // Get bulk data info with rate limiting
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/bulk-data`)
      )
      const bulkData = response.data.data.find((d: any) => d.type === 'default_cards')
      
      if (!bulkData) {
        throw new Error('Default cards bulk data not found')
      }

      return bulkData.download_uri
    } catch (error) {
      console.error('Scryfall getBulkData error:', error)
      throw error
    }
  },

  // Rate limiting helper
  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  },
} 