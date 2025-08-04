import { scryfallService } from './scryfall'
import type { ScryfallCard } from '@moxmuse/shared'

interface BatchLookupResult {
  cardId: string
  card: ScryfallCard | null
  error?: string
}

export const scryfallBatchService = {
  /**
   * Batch lookup cards from Scryfall with parallel processing
   * @param cardNames Array of card names to lookup
   * @param options Options for batch processing
   * @returns Array of lookup results
   */
  async batchLookupCards(
    cardNames: string[],
    options: {
      batchSize?: number
      maxRetries?: number
      timeout?: number
    } = {}
  ): Promise<Map<string, ScryfallCard>> {
    const { 
      batchSize = 10, // Process 10 cards at a time
      maxRetries = 2,
      timeout = 5000 // 5 second timeout per card
    } = options

    console.log(`🔍 Batch looking up ${cardNames.length} cards in batches of ${batchSize}`)
    const startTime = Date.now()
    
    const results = new Map<string, ScryfallCard>()
    const failures: string[] = []
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < cardNames.length; i += batchSize) {
      const batch = cardNames.slice(i, i + batchSize)
      const batchStartTime = Date.now()
      
      // Process batch in parallel
      const batchPromises = batch.map(cardName => 
        this.lookupSingleCard(cardName, { maxRetries, timeout })
      )
      
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Process results
      batchResults.forEach((result, index) => {
        const cardName = batch[index]
        if (result.status === 'fulfilled' && result.value) {
          results.set(cardName, result.value)
        } else {
          failures.push(cardName)
          console.warn(`❌ Failed to find card: ${cardName}`)
        }
      })
      
      const batchTime = Date.now() - batchStartTime
      console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cardNames.length / batchSize)} in ${batchTime}ms`)
      
      // Add small delay between batches to respect rate limits
      if (i + batchSize < cardNames.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    const totalTime = Date.now() - startTime
    console.log(`✅ Batch lookup complete in ${totalTime}ms. Found ${results.size}/${cardNames.length} cards`)
    
    if (failures.length > 0) {
      console.log(`⚠️ Failed to find ${failures.length} cards:`, failures.slice(0, 5))
    }
    
    return results
  },

  /**
   * Lookup a single card with retry and timeout
   */
  async lookupSingleCard(
    cardName: string,
    options: {
      maxRetries?: number
      timeout?: number
    } = {}
  ): Promise<ScryfallCard | null> {
    const { maxRetries = 2, timeout = 5000 } = options
    
    // Try multiple search strategies
    const searchStrategies = [
      { query: `"${cardName}"`, exact: true },
      { query: cardName, exact: false },
      { query: cardName.replace(/,.*$/, '').trim(), exact: false }, // Remove anything after comma
      { query: cardName.replace(/\s*\(.*?\)\s*/g, '').trim(), exact: false } // Remove parentheses
    ]
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      for (const strategy of searchStrategies) {
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeout)
          })
          
          // Race between the search and timeout
          const searchPromise = scryfallService.search(strategy.query, { maxResults: 1 })
          const cards = await Promise.race([searchPromise, timeoutPromise]) as ScryfallCard[]
          
          if (cards.length > 0) {
            return cards[0]
          }
        } catch (error) {
          // Continue to next strategy
          if (error instanceof Error && error.message === 'Timeout') {
            console.warn(`⏱️ Timeout searching for: ${cardName} with strategy: ${strategy.query}`)
          }
        }
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)))
      }
    }
    
    return null
  },

  /**
   * Pre-warm the cache with common Commander staples
   */
  async prewarmCache(): Promise<void> {
    const commonStaples = [
      'Sol Ring',
      'Command Tower',
      'Arcane Signet',
      'Cultivate',
      'Kodama\'s Reach',
      'Lightning Greaves',
      'Swiftfoot Boots',
      'Swords to Plowshares',
      'Path to Exile',
      'Counterspell',
      'Beast Within',
      'Chaos Warp',
      'Rhystic Study',
      'Mystic Remora',
      'Smothering Tithe',
      'Dockside Extortionist',
      'Mana Crypt',
      'Mana Vault',
      'Chrome Mox',
      'Mox Diamond'
    ]
    
    console.log('🔥 Pre-warming Scryfall cache with common staples...')
    await this.batchLookupCards(commonStaples, { batchSize: 5 })
  }
}
