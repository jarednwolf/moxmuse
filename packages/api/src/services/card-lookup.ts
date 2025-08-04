import axios from 'axios'
import { scryfallRateLimiter } from '../utils/rateLimiter'
import { redisCache } from './redis'

const SCRYFALL_API = 'https://api.scryfall.com'

export interface CardLookupResult {
  scryfallId: string
  name: string
  setCode?: string
  collectorNumber?: string
}

export class CardLookupService {
  /**
   * Look up a card by name and optionally set/collector number
   */
  static async lookupByName(
    cardName: string, 
    setCode?: string, 
    collectorNumber?: string
  ): Promise<CardLookupResult | null> {
    try {
      // Clean the card name (remove extra spaces, etc)
      const cleanName = cardName.trim()
      
      // Check cache first
      const cacheKey = `lookup:${cleanName}:${setCode || ''}:${collectorNumber || ''}`
      const cached = await redisCache.get<CardLookupResult>(cacheKey)
      if (cached) return cached
      
      // If we have set and collector number, use the more precise endpoint
      if (setCode && collectorNumber) {
        try {
          const response = await scryfallRateLimiter.limit(async () =>
            await axios.get(`${SCRYFALL_API}/cards/${setCode.toLowerCase()}/${collectorNumber}`)
          )
          
          const result: CardLookupResult = {
            scryfallId: response.data.id,
            name: response.data.name,
            setCode: response.data.set,
            collectorNumber: response.data.collector_number
          }
          
          // Cache for 30 days
          await redisCache.set(cacheKey, result, 30 * 24 * 60 * 60)
          return result
        } catch (error) {
          // Fall through to name search if set/number lookup fails
        }
      }
      
      // Otherwise, search by name
      const response = await scryfallRateLimiter.limit(async () =>
        await axios.get(`${SCRYFALL_API}/cards/named`, {
          params: {
            fuzzy: cleanName
          }
        })
      )
      
      const result: CardLookupResult = {
        scryfallId: response.data.id,
        name: response.data.name,
        setCode: response.data.set,
        collectorNumber: response.data.collector_number
      }
      
      // Cache for 30 days
      await redisCache.set(cacheKey, result, 30 * 24 * 60 * 60)
      return result
      
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`Card not found: ${cardName}`)
        return null
      }
      console.error(`Error looking up card "${cardName}":`, error.message)
      return null
    }
  }
  
  /**
   * Batch lookup multiple cards
   * More efficient than individual lookups due to rate limiting
   */
  static async batchLookup(
    cards: Array<{
      name: string
      setCode?: string
      collectorNumber?: string
    }>
  ): Promise<Map<string, CardLookupResult | null>> {
    const results = new Map<string, CardLookupResult | null>()
    
    // Process in batches to respect rate limits
    const batchSize = 5
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (card) => {
          const result = await this.lookupByName(
            card.name,
            card.setCode,
            card.collectorNumber
          )
          return { key: card.name, result }
        })
      )
      
      // Store results
      batchResults.forEach(({ key, result }) => {
        results.set(key, result)
      })
      
      // Add a small delay between batches
      if (i + batchSize < cards.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    return results
  }
} 