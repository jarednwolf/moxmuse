import { TRPCError } from '@trpc/server'
import { moxfieldRateLimiter } from '../utils/rateLimiter'
import axios from 'axios'

interface MoxfieldDeckListItem {
  publicId: string
  name: string
  format: string
  updatedAt: string
  mainboardCount?: number
  sideboardCount?: number
}

interface MoxfieldDeckListResponse {
  totalItems: number
  pageNumber: number
  pageSize: number
  data: MoxfieldDeckListItem[]
}

interface MoxfieldDeck {
  id: string
  name: string
  format: string
  total_value?: number
  mainboard?: Record<string, {
    quantity: number
    foil_quantity?: number
    card: { 
      name: string
      id?: string  // Scryfall ID might be here
      scryfall_id?: string  // Or here
    }
  }>
  commanders?: Record<string, {
    quantity: number
    foil_quantity?: number
    card: { 
      name: string
      id?: string
      scryfall_id?: string
    }
  }>
  sideboard?: Record<string, {
    quantity: number
    foil_quantity?: number
    card: { 
      name: string
      id?: string
      scryfall_id?: string
    }
  }>
}

export class MoxfieldService {
  /**
   * List all public decks for a user
   */
  static async listUserDecks(username: string, page = 1, pageSize = 100): Promise<MoxfieldDeckListItem[]> {
    const url = `https://api2.moxfield.com/v2/users/${encodeURIComponent(username)}/decks?pageNumber=${page}&pageSize=${pageSize}`
    
    try {
      const response = await moxfieldRateLimiter.limit(async () => 
        await axios.get(url, {
          headers: {
            'User-Agent': 'MoxMuse/1.0 (+https://moxmuse.com)',
            'Accept': 'application/json',
          },
        })
      )

      const data = response.data as MoxfieldDeckListResponse
      const decks = data.data

      // Fetch additional pages if needed
      const totalPages = Math.ceil(data.totalItems / pageSize)
      if (page < totalPages) {
        const moreDecks = await this.listUserDecks(username, page + 1, pageSize)
        decks.push(...moreDecks)
      }

      return decks
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Moxfield user not found'
          })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch user decks: ${error.response?.status || error.message}`
        })
      }
      throw error
    }
  }

  /**
   * Fetch a single deck by ID
   */
  static async fetchDeck(deckId: string): Promise<MoxfieldDeck> {
    const url = `https://api2.moxfield.com/v2/decks/all/${deckId}`
    
    try {
      const response = await moxfieldRateLimiter.limit(async () => 
        await axios.get(url, {
          headers: {
            'User-Agent': 'MoxMuse/1.0 (+https://moxmuse.com)',
            'Accept': 'application/json',
          },
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        })
      )
      
      // Check if we got blocked by Cloudflare
      if (response.status === 403) {
        console.log('Moxfield blocked request with 403')
        if (typeof response.data === 'string' && response.data.includes('Cloudflare')) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Moxfield is temporarily blocking requests. Please try again later.'
          })
        }
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied to Moxfield deck'
        })
      }
      
      if (response.status === 404) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Moxfield deck not found or is private'
        })
      }
      
      // Debug: Log the actual response structure
      console.log('Moxfield deck response structure:', {
        hasMainboard: !!response.data.mainboard,
        mainboardKeys: response.data.mainboard ? Object.keys(response.data.mainboard).slice(0, 3) : [],
        sampleCard: response.data.mainboard ? Object.entries(response.data.mainboard)[0] : null
      })
      
      return response.data as MoxfieldDeck
    } catch (error) {
      if (error instanceof TRPCError) throw error
      
      console.error('Moxfield fetchDeck error:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch Moxfield deck'
      })
    }
  }

  /**
   * Extract deck ID from URL or return as-is
   */
  static extractDeckId(urlOrId: string): string {
    const urlMatch = urlOrId.match(/moxfield\.com\/decks\/([a-zA-Z0-9_-]+)/)
    return urlMatch ? urlMatch[1] : urlOrId
  }

  /**
   * Extract username from profile URL or return as-is
   */
  static extractUsername(urlOrUsername: string): string {
    const urlMatch = urlOrUsername.match(/moxfield\.com\/users\/([a-zA-Z0-9_-]+)/)
    return urlMatch ? urlMatch[1] : urlOrUsername
  }
} 