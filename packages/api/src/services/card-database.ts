import { PrismaClient } from '@moxmuse/db'
import { scryfallService } from './scryfall'
import type { ScryfallCard } from '@moxmuse/shared'
import OpenAI from 'openai'

interface CuratedCard {
  id: string
  name: string
  colorIdentity: string[]
  cmc: number
  types: string[]
  keywords: string[]
  themes: string[]
  powerLevel: number
  price: number
  oracleText: string
  manaCost: string
  popularity: number // EDHREC rank or similar
}

interface CardCategory {
  name: string
  queries: string[]
  keywords: string[]
  oraclePatterns: RegExp[]
}

// Define card categories with Scryfall queries and patterns
const CARD_CATEGORIES: CardCategory[] = [
  {
    name: 'ramp',
    queries: [
      'f:commander (o:"search your library" o:"land" o:"battlefield") cmc<=3',
      'f:commander (o:"add" o:"mana") t:artifact cmc<=3',
      'f:commander t:creature o:"when ~ enters" o:"search your library" o:"land"',
      'f:commander o:"mana" o:"creature" t:enchantment'
    ],
    keywords: ['ramp', 'mana', 'accelerate'],
    oraclePatterns: [
      /search your library for.*land/i,
      /add.*mana/i,
      /additional land/i,
      /mana.*any color/i
    ]
  },
  {
    name: 'draw',
    queries: [
      'f:commander o:"draw" o:"card" -o:"discard"',
      'f:commander o:"whenever" o:"draw"',
      'f:commander o:"at the beginning" o:"draw"',
      'f:commander t:creature o:"when ~ enters" o:"draw"'
    ],
    keywords: ['draw', 'card advantage', 'refill'],
    oraclePatterns: [
      /draw.*card/i,
      /whenever.*draw/i,
      /card.*hand/i,
      /look at.*top.*library/i
    ]
  },
  {
    name: 'removal',
    queries: [
      'f:commander (o:"destroy target" OR o:"exile target")',
      'f:commander o:"destroy all"',
      'f:commander t:instant o:"counter target"',
      'f:commander o:"return target" o:"owner"'
    ],
    keywords: ['removal', 'destroy', 'exile', 'counter'],
    oraclePatterns: [
      /destroy target/i,
      /exile target/i,
      /counter target/i,
      /return.*owner's hand/i
    ]
  },
  {
    name: 'protection',
    queries: [
      'f:commander (o:"hexproof" OR o:"shroud" OR o:"indestructible")',
      'f:commander o:"protection from"',
      'f:commander o:"prevent all damage"',
      'f:commander o:"can\'t be countered"'
    ],
    keywords: ['protection', 'hexproof', 'indestructible'],
    oraclePatterns: [
      /hexproof/i,
      /indestructible/i,
      /protection from/i,
      /can't be (the )?target/i
    ]
  },
  {
    name: 'sacrifice-outlet',
    queries: [
      'f:commander o:"sacrifice" o:":" -o:"opponent"',
      'f:commander o:"sacrifice a creature:"'
    ],
    keywords: ['sacrifice', 'sac outlet'],
    oraclePatterns: [
      /sacrifice.*creature.*:/i,
      /sacrifice.*permanent.*:/i
    ]
  },
  {
    name: 'death-trigger',
    queries: [
      'f:commander o:"whenever" o:"dies"',
      'f:commander o:"whenever" o:"creature" o:"graveyard"',
      'f:commander o:"death" o:"trigger"'
    ],
    keywords: ['death trigger', 'dies', 'aristocrats'],
    oraclePatterns: [
      /whenever.*dies/i,
      /whenever.*creature.*graveyard/i,
      /when.*dies/i
    ]
  },
  {
    name: 'token-generator',
    queries: [
      'f:commander o:"create" o:"token"',
      'f:commander o:"put" o:"token" o:"battlefield"'
    ],
    keywords: ['token', 'create', 'generator'],
    oraclePatterns: [
      /create.*token/i,
      /put.*token.*battlefield/i
    ]
  }
]

export class CardDatabaseService {
  private cards: Map<string, CuratedCard> = new Map()
  private cardsByCategory: Map<string, Set<string>> = new Map()
  private initialized = false
  private db: PrismaClient
  private openai: OpenAI

  constructor(db: PrismaClient) {
    this.db = db
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    console.log('🔧 Initializing card database...')
    
    // Load popular commander cards from database cache or Scryfall
    const cachedCards = await this.loadCachedCards()
    
    if (cachedCards.length > 0) {
      console.log(`📦 Loaded ${cachedCards.length} cards from cache`)
      this.processCachedCards(cachedCards)
    } else {
      console.log('🔍 Loading cards from Scryfall...')
      await this.loadCommanderStaples()
    }
    
    this.initialized = true
    console.log(`✅ Card database initialized with ${this.cards.size} cards`)
  }

  private async loadCachedCards(): Promise<any[]> {
    // Try to load from a cached table if it exists
    try {
      // For now, return empty array to force Scryfall loading
      return []
    } catch (error) {
      return []
    }
  }

  private processCachedCards(cards: any[]): void {
    for (const card of cards) {
      const curated: CuratedCard = {
        id: card.id,
        name: card.name,
        colorIdentity: card.colorIdentity || [],
        cmc: card.cmc || 0,
        types: this.extractTypes(card.typeLine || ''),
        keywords: this.extractKeywords(card.oracleText || ''),
        themes: this.categorizeCard(card),
        powerLevel: this.calculatePowerLevel(card),
        price: parseFloat(card.prices?.usd || '0'),
        oracleText: card.oracleText || '',
        manaCost: card.manaCost || '',
        popularity: card.popularity || 1000
      }
      
      this.cards.set(card.id, curated)
      
      // Add to category maps
      for (const theme of curated.themes) {
        if (!this.cardsByCategory.has(theme)) {
          this.cardsByCategory.set(theme, new Set())
        }
        this.cardsByCategory.get(theme)!.add(card.id)
      }
    }
  }

  async loadCommanderStaples(): Promise<void> {
    const allCards: ScryfallCard[] = []
    
    // Load essential lands
    console.log('Loading lands...')
    const lands = await scryfallService.search(
      'f:commander t:land (produces:c OR produces:w OR produces:u OR produces:b OR produces:r OR produces:g) -t:basic',
      { maxResults: 100 }
    )
    allCards.push(...lands)
    
    // Load staples by category
    for (const category of CARD_CATEGORIES) {
      console.log(`Loading ${category.name} cards...`)
      for (const query of category.queries.slice(0, 2)) { // Limit queries to avoid rate limits
        try {
          const cards = await scryfallService.search(query, { maxResults: 50 })
          allCards.push(...cards)
        } catch (error) {
          console.error(`Failed to load ${category.name} cards:`, error)
        }
      }
    }
    
    // Load format staples
    console.log('Loading format staples...')
    const stapleQueries = [
      'f:commander usd<5 -t:basic top:50', // Budget staples
      'f:commander edhrec>5000 usd<20', // Popular mid-range cards
      'is:commander f:commander usd<30' // Actual commanders
    ]
    
    for (const query of stapleQueries) {
      try {
        const cards = await scryfallService.search(query, { maxResults: 100 })
        allCards.push(...cards)
      } catch (error) {
        console.error('Failed to load staples:', error)
      }
    }
    
    // Deduplicate and process
    const uniqueCards = this.deduplicateCards(allCards)
    console.log(`Processing ${uniqueCards.length} unique cards...`)
    
    for (const card of uniqueCards) {
      const curated: CuratedCard = {
        id: card.id,
        name: card.name,
        colorIdentity: card.color_identity || [],
        cmc: card.cmc || 0,
        types: this.extractTypes(card.type_line),
        keywords: this.extractKeywords(card.oracle_text || ''),
        themes: this.categorizeCard(card),
        powerLevel: this.calculatePowerLevel(card),
        price: parseFloat(card.prices?.usd || '0'),
        oracleText: card.oracle_text || '',
        manaCost: card.mana_cost || '',
        popularity: 99999 // TODO: Get from EDHREC API or other source
      }
      
      this.cards.set(card.id, curated)
      
      // Add to category maps
      for (const theme of curated.themes) {
        if (!this.cardsByCategory.has(theme)) {
          this.cardsByCategory.set(theme, new Set())
        }
        this.cardsByCategory.get(theme)!.add(card.id)
      }
    }
  }

  private deduplicateCards(cards: ScryfallCard[]): ScryfallCard[] {
    const seen = new Set<string>()
    const unique: ScryfallCard[] = []
    
    for (const card of cards) {
      if (!seen.has(card.id)) {
        seen.add(card.id)
        unique.push(card)
      }
    }
    
    return unique
  }

  private extractTypes(typeLine: string): string[] {
    const types: string[] = []
    const mainTypes = ['Land', 'Creature', 'Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker']
    
    for (const type of mainTypes) {
      if (typeLine.includes(type)) {
        types.push(type)
      }
    }
    
    return types
  }

  private extractKeywords(oracleText: string): string[] {
    const keywords: string[] = []
    const commonKeywords = [
      'Flying', 'Trample', 'Haste', 'Vigilance', 'Deathtouch', 'Lifelink',
      'Hexproof', 'Indestructible', 'Menace', 'First strike', 'Double strike',
      'Flash', 'Reach', 'Defender', 'Ward', 'Protection'
    ]
    
    for (const keyword of commonKeywords) {
      if (oracleText.toLowerCase().includes(keyword.toLowerCase())) {
        keywords.push(keyword.toLowerCase())
      }
    }
    
    return keywords
  }

  private categorizeCard(card: any): string[] {
    const themes: string[] = []
    const oracleText = (card.oracle_text || '').toLowerCase()
    const typeLine = (card.type_line || '').toLowerCase()
    
    // Check each category
    for (const category of CARD_CATEGORIES) {
      let matches = false
      
      // Check oracle text patterns
      for (const pattern of category.oraclePatterns) {
        if (pattern.test(oracleText)) {
          matches = true
          break
        }
      }
      
      // Check keywords
      if (!matches) {
        for (const keyword of category.keywords) {
          if (oracleText.includes(keyword) || card.name.toLowerCase().includes(keyword)) {
            matches = true
            break
          }
        }
      }
      
      if (matches) {
        themes.push(category.name)
      }
    }
    
    // Add type-based categories
    if (typeLine.includes('land')) themes.push('land')
    if (typeLine.includes('creature')) themes.push('creature')
    if (typeLine.includes('artifact') && oracleText.includes('mana')) themes.push('mana-rock')
    
    // If no categories found, mark as utility
    if (themes.length === 0) {
      themes.push('utility')
    }
    
    return themes
  }

  private calculatePowerLevel(card: any): number {
    // Simple power level calculation based on various factors
    let powerLevel = 2 // Base level
    
    const price = parseFloat(card.prices?.usd || '0')
    
    // Price-based adjustment
    if (price > 50) powerLevel = 5
    else if (price > 20) powerLevel = 4
    else if (price > 10) powerLevel = 3
    
    // Popularity adjustment (using price as proxy for now)
    // TODO: Integrate EDHREC data
    if (price > 5 && price < 10) powerLevel = Math.max(powerLevel, 3)
    
    // Card type adjustments
    if (card.type_line?.includes('Legendary')) powerLevel += 0.5
    if (card.oracle_text?.includes('win the game')) powerLevel = 5
    if (card.oracle_text?.includes('extra turn')) powerLevel = Math.max(powerLevel, 4)
    
    return Math.min(5, Math.round(powerLevel))
  }

  // Public methods for deck generation

  async getCardsForCommander(
    commanderName: string,
    budget?: number
  ): Promise<CuratedCard[]> {
    await this.initialize()
    
    // First, find the commander
    const commander = await this.findCommander(commanderName)
    if (!commander) {
      throw new Error(`Commander "${commanderName}" not found`)
    }
    
    const colorIdentity = commander.colorIdentity
    
    // Filter cards by color identity and budget
    const legalCards: CuratedCard[] = []
    
    for (const [cardId, card] of this.cards) {
      // Skip the commander itself
      if (card.id === commander.id) continue
      
      // Check color identity
      const isLegal = card.colorIdentity.every(color => 
        colorIdentity.includes(color)
      )
      
      if (!isLegal) continue
      
      // Check budget
      if (budget && card.price > budget * 0.1) continue // No single card > 10% of budget
      
      legalCards.push(card)
    }
    
    return legalCards
  }

  async findCommander(name: string): Promise<CuratedCard | null> {
    await this.initialize()
    
    // First try exact match in our database
    for (const [id, card] of this.cards) {
      if (card.name.toLowerCase() === name.toLowerCase() && 
          card.types.includes('Creature')) {
        return card
      }
    }
    
    // If not found, search Scryfall
    try {
      const results = await scryfallService.search(
        `"${name}" is:commander`,
        { maxResults: 1 }
      )
      
      if (results.length > 0) {
        const commander = results[0]
        const curated: CuratedCard = {
          id: commander.id,
          name: commander.name,
          colorIdentity: commander.color_identity || [],
          cmc: commander.cmc || 0,
          types: this.extractTypes(commander.type_line),
          keywords: this.extractKeywords(commander.oracle_text || ''),
          themes: ['commander'],
          powerLevel: this.calculatePowerLevel(commander),
          price: parseFloat(commander.prices?.usd || '0'),
          oracleText: commander.oracle_text || '',
          manaCost: commander.mana_cost || '',
          popularity: 99999 // TODO: Get from EDHREC API
        }
        
        // Add to cache
        this.cards.set(commander.id, curated)
        
        return curated
      }
    } catch (error) {
      console.error('Failed to find commander:', error)
    }
    
    return null
  }

  getCardsByCategory(category: string, limit?: number): CuratedCard[] {
    const cardIds = this.cardsByCategory.get(category) || new Set()
    const cards: CuratedCard[] = []
    
    for (const cardId of cardIds) {
      const card = this.cards.get(cardId)
      if (card) {
        cards.push(card)
      }
      if (limit && cards.length >= limit) break
    }
    
    // Sort by power level and popularity
    cards.sort((a, b) => {
      if (a.powerLevel !== b.powerLevel) {
        return b.powerLevel - a.powerLevel
      }
      return a.popularity - b.popularity
    })
    
    return cards
  }

  getBasicLands(colors: string[], count: number): string[] {
    const basicLandIds: Record<string, string[]> = {
      'W': [
        '56b21b47-c8e0-425a-9bb0-ff0b6c0c0bce',
        '2f3b36a0-7e1a-4aa5-8f08-b4b76e0e7e3b',
        '59e19bac-176c-4e37-bfc8-27c00de7c0a5'
      ],
      'U': [
        '92daaa39-cd2f-4c03-8f41-92d99d0a3366',
        '4134be9c-1dea-40d3-99d3-92c4c193b07f',
        '6e73e082-b16a-45d5-bc4a-24c694b0b9af'
      ],
      'B': [
        '0a469d76-fc13-4e57-933e-52e3f6041444',
        '1967d4a8-6cc4-4a4d-9d24-93257de35e6d',
        '436a0795-f23f-48f9-8c1f-d40a5c8be818'
      ],
      'R': [
        '132ecc65-e8e5-4a76-84ba-39d0e48ebad6',
        '4747ef5f-7300-4f91-b061-51ab5242af2f',
        '6f2fcc20-a89a-4d8d-acee-99ea27ddb602'
      ],
      'G': [
        '32ebeece-5e81-48f1-be89-b13133bcdb0d',
        '32af9f41-89e2-4e7a-9fec-fffe79cae077',
        '50b95c20-b095-442a-8a01-d5e586f822f2'
      ]
    }
    
    const selectedLands: string[] = []
    const landsPerColor = Math.ceil(count / colors.length)
    
    for (const color of colors) {
      const colorLands = basicLandIds[color] || []
      for (let i = 0; i < landsPerColor && selectedLands.length < count; i++) {
        selectedLands.push(colorLands[i % colorLands.length])
      }
    }
    
    return selectedLands
  }
}

// Export singleton instance
export const cardDatabase = new CardDatabaseService(new PrismaClient())
