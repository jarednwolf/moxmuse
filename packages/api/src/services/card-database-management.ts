import { PrismaClient } from '@moxmuse/db'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { createHash } from 'crypto'
import { z } from 'zod'
import { logger } from './core/logging'
import { performanceMonitor } from './core/performance-monitor'
import { redisCache } from './redis'
import { scryfallRateLimiter } from '../utils/rateLimiter'

const SCRYFALL_API = process.env.SCRYFALL_API_BASE || 'https://api.scryfall.com'
const BULK_DATA_CACHE_TTL = 60 * 60 * 24 // 24 hours
const CARD_DATA_CACHE_TTL = 60 * 60 * 24 * 7 // 7 days
const IMAGE_CACHE_TTL = 60 * 60 * 24 * 30 // 30 days

// Enhanced Scryfall card schema
const ScryfallCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  mana_cost: z.string().optional(),
  cmc: z.number().default(0),
  type_line: z.string(),
  oracle_text: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  colors: z.array(z.string()).default([]),
  color_identity: z.array(z.string()).default([]),
  legalities: z.record(z.string()),
  prices: z.object({
    usd: z.string().optional(),
    usd_foil: z.string().optional(),
    eur: z.string().optional(),
    tix: z.string().optional()
  }).optional(),
  rarity: z.string(),
  set: z.string(),
  set_name: z.string(),
  collector_number: z.string(),
  released_at: z.string(),
  image_uris: z.object({
    small: z.string().optional(),
    normal: z.string().optional(),
    large: z.string().optional(),
    png: z.string().optional(),
    art_crop: z.string().optional(),
    border_crop: z.string().optional()
  }).optional(),
  card_faces: z.array(z.any()).optional(),
  layout: z.string().optional(),
  edhrec_rank: z.number().optional(),
  rulings_uri: z.string().optional()
})

type ScryfallCard = z.infer<typeof ScryfallCardSchema>

interface BulkDataInfo {
  type: string
  download_uri: string
  updated_at: string
  size: number
  content_type: string
  content_encoding?: string
}

interface ImportProgress {
  phase: 'downloading' | 'processing' | 'indexing' | 'complete' | 'error'
  totalCards: number
  processedCards: number
  errors: string[]
  startTime: Date
  estimatedCompletion?: Date
}

interface CardImageOptimization {
  cardId: string
  originalUrls: Record<string, string>
  optimizedUrls: Record<string, string>
  sizes: {
    thumbnail: string // 146x204
    small: string     // 488x680
    normal: string    // 672x936
    large: string     // 936x1302
  }
  webpUrls: Record<string, string>
  avifUrls: Record<string, string>
}

export class CardDatabaseManagementService {
  private static instance: CardDatabaseManagementService
  private db: PrismaClient
  private currentImport: ImportProgress | null = null

  constructor(db?: PrismaClient) {
    this.db = db || new PrismaClient()
  }

  static getInstance(db?: PrismaClient): CardDatabaseManagementService {
    if (!CardDatabaseManagementService.instance) {
      CardDatabaseManagementService.instance = new CardDatabaseManagementService(db)
    }
    return CardDatabaseManagementService.instance
  }

  /**
   * Perform incremental bulk data import with change detection
   */
  async performIncrementalImport(): Promise<{
    success: boolean
    cardsAdded: number
    cardsUpdated: number
    cardsRemoved: number
    errors: string[]
    duration: number
  }> {
    const timer = performanceMonitor.startTimer('incremental_bulk_import')
    const startTime = Date.now()
    
    try {
      logger.info('Starting incremental bulk data import')

      // Get current bulk data info
      const bulkDataInfo = await this.getBulkDataInfo()
      
      // Check if we need to update
      const lastImportInfo = await this.getLastImportInfo()
      if (lastImportInfo && lastImportInfo.updated_at === bulkDataInfo.updated_at) {
        logger.info('Bulk data is up to date, skipping import')
        timer.end({ source: 'up_to_date' })
        return {
          success: true,
          cardsAdded: 0,
          cardsUpdated: 0,
          cardsRemoved: 0,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Initialize progress tracking
      this.currentImport = {
        phase: 'downloading',
        totalCards: 0,
        processedCards: 0,
        errors: [],
        startTime: new Date()
      }

      // Download bulk data
      const filePath = await this.downloadBulkData(bulkDataInfo)
      
      // Process the data incrementally
      const result = await this.processIncrementalData(filePath, lastImportInfo)
      
      // Update import info
      await this.saveImportInfo(bulkDataInfo)
      
      // Clean up
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

      this.currentImport.phase = 'complete'
      
      logger.info('Incremental import completed', {
        cardsAdded: result.cardsAdded,
        cardsUpdated: result.cardsUpdated,
        cardsRemoved: result.cardsRemoved,
        errors: result.errors.length,
        duration: Date.now() - startTime
      })

      timer.end({
        cards_added: result.cardsAdded,
        cards_updated: result.cardsUpdated,
        cards_removed: result.cardsRemoved,
        errors_count: result.errors.length
      })

      return {
        ...result,
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      logger.error('Incremental import failed', { error })
      
      if (this.currentImport) {
        this.currentImport.phase = 'error'
        this.currentImport.errors.push(error.message)
      }

      timer.end({ source: 'error' })
      
      return {
        success: false,
        cardsAdded: 0,
        cardsUpdated: 0,
        cardsRemoved: 0,
        errors: [error.message],
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Optimize and cache card images with multiple formats and sizes
   */
  async optimizeCardImages(cardId: string, imageUrls: Record<string, string>): Promise<CardImageOptimization> {
    const timer = performanceMonitor.startTimer('card_image_optimization')
    
    try {
      const cacheKey = `card_images:${cardId}`
      
      // Check if already optimized
      const cached = await redisCache.get<CardImageOptimization>(cacheKey)
      if (cached) {
        timer.end({ source: 'cache' })
        return cached
      }

      // Generate optimized image URLs
      // In production, this would:
      // 1. Download original images
      // 2. Resize to different sizes
      // 3. Convert to WebP and AVIF formats
      // 4. Upload to CDN
      // 5. Return optimized URLs
      
      const optimization: CardImageOptimization = {
        cardId,
        originalUrls: imageUrls,
        optimizedUrls: imageUrls, // For now, use original URLs
        sizes: {
          thumbnail: imageUrls.small || imageUrls.normal || '',
          small: imageUrls.normal || imageUrls.large || '',
          normal: imageUrls.large || imageUrls.normal || '',
          large: imageUrls.large || imageUrls.normal || ''
        },
        webpUrls: this.generateWebPUrls(imageUrls),
        avifUrls: this.generateAVIFUrls(imageUrls)
      }

      // Cache the optimization
      await redisCache.set(cacheKey, optimization, IMAGE_CACHE_TTL)
      
      timer.end({ source: 'optimized' })
      return optimization

    } catch (error) {
      logger.error('Image optimization failed', { cardId, error })
      timer.end({ source: 'error' })
      
      // Return fallback optimization
      return {
        cardId,
        originalUrls: imageUrls,
        optimizedUrls: imageUrls,
        sizes: {
          thumbnail: imageUrls.small || '',
          small: imageUrls.normal || '',
          normal: imageUrls.large || imageUrls.normal || '',
          large: imageUrls.large || ''
        },
        webpUrls: {},
        avifUrls: {}
      }
    }
  }

  /**
   * Validate format legality and update in real-time
   */
  async validateAndUpdateLegality(cardId: string): Promise<{
    legalities: Record<string, string>
    changes: Array<{ format: string; oldStatus: string; newStatus: string }>
    lastUpdated: Date
  }> {
    const timer = performanceMonitor.startTimer('legality_validation')
    
    try {
      // Get current legality from database
      const currentCard = await this.db.enhancedCardData.findUnique({
        where: { cardId },
        select: { legalities: true, lastUpdated: true }
      })

      // Fetch latest legality from Scryfall
      const scryfallCard = await scryfallRateLimiter.limit(async () => {
        const response = await axios.get(`${SCRYFALL_API}/cards/${cardId}`)
        return response.data
      })

      const newLegalities = scryfallCard.legalities || {}
      const oldLegalities = (currentCard?.legalities as Record<string, string>) || {}
      
      // Detect changes
      const changes: Array<{ format: string; oldStatus: string; newStatus: string }> = []
      
      for (const format of Object.keys({ ...oldLegalities, ...newLegalities })) {
        const oldStatus = oldLegalities[format] || 'unknown'
        const newStatus = newLegalities[format] || 'unknown'
        
        if (oldStatus !== newStatus) {
          changes.push({ format, oldStatus, newStatus })
        }
      }

      // Update database if there are changes
      if (changes.length > 0) {
        await this.db.enhancedCardData.update({
          where: { cardId },
          data: {
            legalities: newLegalities,
            lastUpdated: new Date()
          }
        })

        // Log significant changes
        const significantChanges = changes.filter(c => 
          (c.oldStatus === 'legal' && c.newStatus === 'banned') ||
          (c.oldStatus === 'banned' && c.newStatus === 'legal')
        )

        if (significantChanges.length > 0) {
          logger.info('Significant legality changes detected', {
            cardId,
            changes: significantChanges
          })

          // Notify users who have this card in their decks
          await this.notifyLegalityChanges(cardId, significantChanges)
        }
      }

      timer.end({ changes_count: changes.length })
      
      return {
        legalities: newLegalities,
        changes,
        lastUpdated: new Date()
      }

    } catch (error) {
      logger.error('Legality validation failed', { cardId, error })
      timer.end({ source: 'error' })
      throw error
    }
  }

  /**
   * Create and maintain full-text search indexes
   */
  async createSearchIndexes(): Promise<void> {
    const timer = performanceMonitor.startTimer('search_index_creation')
    
    try {
      logger.info('Creating search indexes')

      // Create full-text search indexes
      const indexQueries = [
        // Card name search index
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_name_search 
         ON "EnhancedCardData" USING gin(to_tsvector('english', name))`,
        
        // Oracle text search index
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_oracle_search 
         ON "EnhancedCardData" USING gin(to_tsvector('english', coalesce("oracleText", '')))`,
        
        // Type line search index
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_type_search 
         ON "EnhancedCardData" USING gin(to_tsvector('english', "typeLine"))`,
        
        // Combined search index
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_full_search 
         ON "EnhancedCardData" USING gin(
           to_tsvector('english', 
             name || ' ' || 
             coalesce("oracleText", '') || ' ' || 
             "typeLine"
           )
         )`,
        
        // Color identity index (GIN for array operations)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_color_identity_gin 
         ON "EnhancedCardData" USING gin("colorIdentity")`,
        
        // Colors index (GIN for array operations)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_colors_gin 
         ON "EnhancedCardData" USING gin(colors)`,
        
        // Synergy tags index
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_synergy_tags 
         ON "EnhancedCardData" USING gin("synergyTags")`,
        
        // Legalities index (GIN for JSON operations)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_legalities 
         ON "EnhancedCardData" USING gin(legalities)`,
        
        // Performance indexes
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_cmc_price 
         ON "EnhancedCardData" (cmc, "currentPrice")`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_popularity 
         ON "EnhancedCardData" ("popularityScore" DESC, "lastUpdated" DESC)`,
        
        // Composite indexes for common queries
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_commander_legal 
         ON "EnhancedCardData" (cmc, "colorIdentity") 
         WHERE (legalities->>'commander') = 'legal'`,
        
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enhanced_cards_recent_updates 
         ON "EnhancedCardData" ("lastUpdated" DESC) 
         WHERE "lastUpdated" > NOW() - INTERVAL '7 days'`
      ]

      // Execute index creation queries
      for (const query of indexQueries) {
        try {
          await this.db.$executeRawUnsafe(query)
          logger.info('Index created successfully', { 
            index: query.match(/idx_\w+/)?.[0] || 'unknown' 
          })
        } catch (error) {
          // Index might already exist, log warning but continue
          logger.warn('Index creation skipped (may already exist)', { 
            error: error.message,
            index: query.match(/idx_\w+/)?.[0] || 'unknown'
          })
        }
      }

      // Create search statistics table for query optimization
      await this.createSearchStatisticsTable()
      
      // Update table statistics for query planner
      await this.db.$executeRaw`ANALYZE "EnhancedCardData"`

      timer.end({ indexes_created: indexQueries.length })
      logger.info('Search indexes creation completed')

    } catch (error) {
      logger.error('Search index creation failed', { error })
      timer.end({ source: 'error' })
      throw error
    }
  }

  /**
   * Set up automated daily sync jobs
   */
  async setupAutomatedSyncJobs(): Promise<void> {
    logger.info('Setting up automated sync jobs')

    try {
      // Create sync job configurations
      const syncJobs = [
        {
          name: 'daily_bulk_import',
          schedule: '0 2 * * *', // 2 AM daily
          description: 'Daily incremental bulk data import',
          enabled: true
        },
        {
          name: 'hourly_legality_check',
          schedule: '0 * * * *', // Every hour
          description: 'Check for format legality changes',
          enabled: true
        },
        {
          name: 'price_update',
          schedule: '0 */4 * * *', // Every 4 hours
          description: 'Update card prices',
          enabled: true
        },
        {
          name: 'image_optimization',
          schedule: '0 3 * * *', // 3 AM daily
          description: 'Optimize and cache card images',
          enabled: true
        },
        {
          name: 'search_index_maintenance',
          schedule: '0 4 * * 0', // 4 AM on Sundays
          description: 'Maintain search indexes',
          enabled: true
        }
      ]

      // Store job configurations
      for (const job of syncJobs) {
        await redisCache.set(
          `sync_job_config:${job.name}`,
          job,
          60 * 60 * 24 * 365 // 1 year TTL
        )
      }

      logger.info('Automated sync jobs configured', { 
        jobs: syncJobs.length 
      })

    } catch (error) {
      logger.error('Failed to setup automated sync jobs', { error })
      throw error
    }
  }

  /**
   * Get import progress for monitoring
   */
  async getImportProgress(): Promise<ImportProgress | null> {
    return this.currentImport
  }

  /**
   * Perform full database health check
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Array<{
      name: string
      status: 'pass' | 'fail' | 'warn'
      message: string
      duration: number
    }>
    summary: {
      totalCards: number
      lastImport: Date | null
      indexHealth: string
      cacheHealth: string
    }
  }> {
    const checks: Array<{
      name: string
      status: 'pass' | 'fail' | 'warn'
      message: string
      duration: number
    }> = []

    // Check database connectivity
    const dbCheck = await this.checkDatabaseConnectivity()
    checks.push(dbCheck)

    // Check card count
    const cardCountCheck = await this.checkCardCount()
    checks.push(cardCountCheck)

    // Check index health
    const indexCheck = await this.checkIndexHealth()
    checks.push(indexCheck)

    // Check cache connectivity
    const cacheCheck = await this.checkCacheConnectivity()
    checks.push(cacheCheck)

    // Check last import status
    const importCheck = await this.checkLastImportStatus()
    checks.push(importCheck)

    // Determine overall status
    const failedChecks = checks.filter(c => c.status === 'fail').length
    const warnChecks = checks.filter(c => c.status === 'warn').length
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (failedChecks > 0) {
      status = 'unhealthy'
    } else if (warnChecks > 0) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    // Get summary information
    const totalCards = await this.db.enhancedCardData.count()
    const lastImportInfo = await this.getLastImportInfo()

    return {
      status,
      checks,
      summary: {
        totalCards,
        lastImport: lastImportInfo ? new Date(lastImportInfo.updated_at) : null,
        indexHealth: indexCheck.status,
        cacheHealth: cacheCheck.status
      }
    }
  }

  // Private helper methods

  private async getBulkDataInfo(): Promise<BulkDataInfo> {
    const response = await scryfallRateLimiter.limit(async () =>
      await axios.get(`${SCRYFALL_API}/bulk-data`)
    )
    
    const bulkData = response.data.data.find((d: any) => d.type === 'default_cards')
    
    if (!bulkData) {
      throw new Error('Default cards bulk data not found')
    }
    
    return bulkData
  }

  private async downloadBulkData(bulkDataInfo: BulkDataInfo): Promise<string> {
    logger.info('Downloading bulk data', { 
      size: bulkDataInfo.size,
      url: bulkDataInfo.download_uri 
    })

    const fileName = path.join(__dirname, `scryfall-bulk-${Date.now()}.json`)
    
    const response = await axios({
      method: 'GET',
      url: bulkDataInfo.download_uri,
      responseType: 'stream',
      timeout: 300000 // 5 minutes
    })
    
    const writer = fs.createWriteStream(fileName)
    await pipeline(response.data, writer)
    
    logger.info('Bulk data download completed', { fileName })
    return fileName
  }

  private async processIncrementalData(
    filePath: string, 
    lastImportInfo: BulkDataInfo | null
  ): Promise<{
    cardsAdded: number
    cardsUpdated: number
    cardsRemoved: number
    errors: string[]
  }> {
    logger.info('Processing incremental data', { filePath })

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const cards: ScryfallCard[] = JSON.parse(fileContent)
    
    if (this.currentImport) {
      this.currentImport.totalCards = cards.length
      this.currentImport.phase = 'processing'
    }

    // Get existing card IDs for comparison
    const existingCards = await this.db.enhancedCardData.findMany({
      select: { cardId: true, lastUpdated: true }
    })
    
    const existingCardMap = new Map(
      existingCards.map(card => [card.cardId, card.lastUpdated])
    )

    let cardsAdded = 0
    let cardsUpdated = 0
    let cardsRemoved = 0
    const errors: string[] = []

    // Process cards in batches
    const batchSize = 100
    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize)
      
      try {
        await this.processBatch(batch, existingCardMap, (stats) => {
          cardsAdded += stats.added
          cardsUpdated += stats.updated
          errors.push(...stats.errors)
        })

        if (this.currentImport) {
          this.currentImport.processedCards = i + batch.length
        }

      } catch (error) {
        errors.push(`Batch processing error: ${error.message}`)
      }
    }

    // Find removed cards (cards that exist in DB but not in new data)
    const newCardIds = new Set(cards.map(card => card.id))
    const removedCardIds = Array.from(existingCardMap.keys())
      .filter(cardId => !newCardIds.has(cardId))

    if (removedCardIds.length > 0) {
      try {
        await this.db.enhancedCardData.deleteMany({
          where: { cardId: { in: removedCardIds } }
        })
        cardsRemoved = removedCardIds.length
        logger.info('Removed obsolete cards', { count: cardsRemoved })
      } catch (error) {
        errors.push(`Failed to remove obsolete cards: ${error.message}`)
      }
    }

    return { cardsAdded, cardsUpdated, cardsRemoved, errors }
  }

  private async processBatch(
    batch: ScryfallCard[],
    existingCardMap: Map<string, Date>,
    onProgress: (stats: { added: number; updated: number; errors: string[] }) => void
  ): Promise<void> {
    let added = 0
    let updated = 0
    const errors: string[] = []

    for (const scryfallCard of batch) {
      try {
        // Validate card data
        const validatedCard = ScryfallCardSchema.parse(scryfallCard)
        
        // Check if card exists and needs update
        const existingDate = existingCardMap.get(validatedCard.id)
        const cardData = await this.transformScryfallCard(validatedCard)
        
        if (!existingDate) {
          // New card
          await this.db.enhancedCardData.create({ data: cardData })
          added++
        } else {
          // Existing card - check if update needed
          const needsUpdate = await this.cardNeedsUpdate(validatedCard, existingDate)
          
          if (needsUpdate) {
            await this.db.enhancedCardData.update({
              where: { cardId: validatedCard.id },
              data: cardData
            })
            updated++
          }
        }

      } catch (error) {
        errors.push(`Failed to process card ${scryfallCard.id}: ${error.message}`)
      }
    }

    onProgress({ added, updated, errors })
  }

  private async transformScryfallCard(scryfallCard: ScryfallCard): Promise<any> {
    // Extract synergy keywords
    const synergyTags = this.extractSynergyKeywords(scryfallCard)
    
    // Optimize images
    const imageOptimization = await this.optimizeCardImages(
      scryfallCard.id,
      scryfallCard.image_uris || {}
    )

    return {
      cardId: scryfallCard.id,
      name: scryfallCard.name,
      manaCost: scryfallCard.mana_cost || '',
      cmc: scryfallCard.cmc || 0,
      typeLine: scryfallCard.type_line,
      oracleText: scryfallCard.oracle_text || '',
      power: scryfallCard.power,
      toughness: scryfallCard.toughness,
      colors: scryfallCard.colors,
      colorIdentity: scryfallCard.color_identity,
      legalities: scryfallCard.legalities,
      rulings: [], // Will be populated separately
      printings: [{
        setCode: scryfallCard.set,
        setName: scryfallCard.set_name,
        collectorNumber: scryfallCard.collector_number,
        rarity: scryfallCard.rarity,
        imageUrls: scryfallCard.image_uris || {}
      }],
      relatedCards: [], // Will be populated by AI analysis
      edhrecRank: scryfallCard.edhrec_rank,
      popularityScore: scryfallCard.edhrec_rank ? 
        Math.max(0, 100 - (scryfallCard.edhrec_rank / 1000)) : 0,
      synergyTags,
      currentPrice: parseFloat(scryfallCard.prices?.usd || '0') || null,
      priceHistory: [],
      availability: {
        inStock: true,
        sources: ['scryfall'],
        lastChecked: new Date().toISOString()
      },
      imageUrls: imageOptimization.optimizedUrls,
      lastUpdated: new Date()
    }
  }

  private extractSynergyKeywords(card: ScryfallCard): string[] {
    const keywords = new Set<string>()
    const text = `${card.oracle_text || ''} ${card.type_line}`.toLowerCase()
    
    // Creature types
    const creatureTypes = [
      'angel', 'spirit', 'vampire', 'zombie', 'goblin', 'elf', 'human',
      'artifact creature', 'dragon', 'demon', 'beast', 'elemental', 'wizard',
      'warrior', 'soldier', 'knight', 'rogue', 'cleric', 'shaman'
    ]
    
    // Mechanics and abilities
    const mechanics = [
      'flying', 'lifelink', 'deathtouch', 'vigilance', 'trample', 'haste',
      'first strike', 'double strike', 'hexproof', 'indestructible', 'menace',
      'sacrifice', 'tokens', 'counters', '+1/+1', 'graveyard', 'flash',
      'death triggers', 'etb', 'aristocrats', 'lifegain', 'draw', 'ramp',
      'removal', 'protection', 'storm', 'cascade', 'flashback', 'cycling'
    ]
    
    // Themes and archetypes
    const themes = [
      'tribal', 'voltron', 'combo', 'control', 'aggro', 'midrange',
      'reanimator', 'storm', 'superfriends', 'enchantress', 'artifacts matter',
      'landfall', 'spellslinger', 'tokens', 'aristocrats', 'lifegain'
    ]
    
    // Check for matches
    const allKeywords = creatureTypes.concat(mechanics, themes)
    allKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.add(keyword)
      }
    })
    
    // Special pattern matching
    if (text.includes('when') && text.includes('dies')) {
      keywords.add('death triggers')
    }
    if (text.includes('enters the battlefield')) {
      keywords.add('etb')
    }
    if (text.includes('sacrifice')) {
      keywords.add('aristocrats')
    }
    if (text.includes('gain life') || text.includes('gains life')) {
      keywords.add('lifegain')
    }
    if (text.includes('draw') && text.includes('card')) {
      keywords.add('card draw')
    }
    if (text.includes('search') && text.includes('library')) {
      keywords.add('tutor')
    }
    
    // Add existing keywords
    if (card.keywords) {
      card.keywords.forEach(k => keywords.add(k.toLowerCase()))
    }
    
    return Array.from(keywords)
  }

  private async cardNeedsUpdate(scryfallCard: ScryfallCard, lastUpdated: Date): Promise<boolean> {
    // Always update if card is older than 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    if (lastUpdated < weekAgo) {
      return true
    }

    // Check for specific changes that require immediate update
    const existingCard = await this.db.enhancedCardData.findUnique({
      where: { cardId: scryfallCard.id },
      select: { 
        legalities: true, 
        currentPrice: true, 
        oracleText: true 
      }
    })

    if (!existingCard) return true

    // Check for legality changes
    const existingLegalities = existingCard.legalities as Record<string, string>
    if (JSON.stringify(existingLegalities) !== JSON.stringify(scryfallCard.legalities)) {
      return true
    }

    // Check for significant price changes (>10%)
    const newPrice = parseFloat(scryfallCard.prices?.usd || '0')
    const oldPrice = existingCard.currentPrice ? Number(existingCard.currentPrice) : 0
    if (oldPrice > 0 && Math.abs(newPrice - oldPrice) / oldPrice > 0.1) {
      return true
    }

    // Check for oracle text changes
    if (existingCard.oracleText !== (scryfallCard.oracle_text || '')) {
      return true
    }

    return false
  }

  private generateWebPUrls(imageUrls: Record<string, string>): Record<string, string> {
    // In production, this would generate WebP versions of images
    const webpUrls: Record<string, string> = {}
    
    for (const [size, url] of Object.entries(imageUrls)) {
      // Mock WebP URL generation
      webpUrls[size] = url.replace(/\.(jpg|jpeg|png)$/i, '.webp')
    }
    
    return webpUrls
  }

  private generateAVIFUrls(imageUrls: Record<string, string>): Record<string, string> {
    // In production, this would generate AVIF versions of images
    const avifUrls: Record<string, string> = {}
    
    for (const [size, url] of Object.entries(imageUrls)) {
      // Mock AVIF URL generation
      avifUrls[size] = url.replace(/\.(jpg|jpeg|png)$/i, '.avif')
    }
    
    return avifUrls
  }

  private async notifyLegalityChanges(
    cardId: string, 
    changes: Array<{ format: string; oldStatus: string; newStatus: string }>
  ): Promise<void> {
    try {
      // Find users who have this card in their decks
      const affectedDecks = await this.db.deckCard.findMany({
        where: { cardId },
        include: {
          deck: {
            include: { user: true }
          }
        }
      })

      // Create notifications for affected users
      for (const deckCard of affectedDecks) {
        const { deck } = deckCard
        
        for (const change of changes) {
          if (deck.format === change.format) {
            await this.db.legalityNotification.create({
              data: {
                userId: deck.userId,
                cardId,
                deckId: deck.id,
                format: change.format,
                oldStatus: change.oldStatus,
                newStatus: change.newStatus,
                notified: false,
                createdAt: new Date()
              }
            })
          }
        }
      }

    } catch (error) {
      logger.error('Failed to notify legality changes', { cardId, error })
    }
  }

  private async createSearchStatisticsTable(): Promise<void> {
    try {
      await this.db.$executeRaw`
        CREATE TABLE IF NOT EXISTS search_statistics (
          id SERIAL PRIMARY KEY,
          query_hash VARCHAR(64) NOT NULL,
          query_text TEXT NOT NULL,
          execution_time INTEGER NOT NULL,
          result_count INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          INDEX idx_search_stats_hash (query_hash),
          INDEX idx_search_stats_time (execution_time),
          INDEX idx_search_stats_created (created_at)
        )
      `
    } catch (error) {
      logger.warn('Search statistics table creation failed', { error })
    }
  }

  private async getLastImportInfo(): Promise<BulkDataInfo | null> {
    try {
      return await redisCache.get<BulkDataInfo>('last_bulk_import_info')
    } catch (error) {
      logger.warn('Failed to get last import info', { error })
      return null
    }
  }

  private async saveImportInfo(bulkDataInfo: BulkDataInfo): Promise<void> {
    try {
      await redisCache.set(
        'last_bulk_import_info',
        bulkDataInfo,
        60 * 60 * 24 * 30 // 30 days
      )
    } catch (error) {
      logger.warn('Failed to save import info', { error })
    }
  }

  // Health check methods
  private async checkDatabaseConnectivity(): Promise<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration: number
  }> {
    const start = Date.now()
    
    try {
      await this.db.$queryRaw`SELECT 1`
      
      return {
        name: 'Database Connectivity',
        status: 'pass',
        message: 'Database connection successful',
        duration: Date.now() - start
      }
    } catch (error) {
      return {
        name: 'Database Connectivity',
        status: 'fail',
        message: `Database connection failed: ${error.message}`,
        duration: Date.now() - start
      }
    }
  }

  private async checkCardCount(): Promise<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration: number
  }> {
    const start = Date.now()
    
    try {
      const count = await this.db.enhancedCardData.count()
      
      let status: 'pass' | 'fail' | 'warn'
      let message: string
      
      if (count === 0) {
        status = 'fail'
        message = 'No cards found in database'
      } else if (count < 10000) {
        status = 'warn'
        message = `Low card count: ${count} cards`
      } else {
        status = 'pass'
        message = `Card count healthy: ${count} cards`
      }
      
      return {
        name: 'Card Count',
        status,
        message,
        duration: Date.now() - start
      }
    } catch (error) {
      return {
        name: 'Card Count',
        status: 'fail',
        message: `Card count check failed: ${error.message}`,
        duration: Date.now() - start
      }
    }
  }

  private async checkIndexHealth(): Promise<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration: number
  }> {
    const start = Date.now()
    
    try {
      // Check if key indexes exist
      const indexCheck = await this.db.$queryRaw`
        SELECT COUNT(*) as index_count
        FROM pg_indexes 
        WHERE tablename = 'EnhancedCardData'
        AND indexname LIKE 'idx_%'
      ` as Array<{ index_count: bigint }>
      
      const indexCount = Number(indexCheck[0].index_count)
      
      let status: 'pass' | 'fail' | 'warn'
      let message: string
      
      if (indexCount === 0) {
        status = 'fail'
        message = 'No search indexes found'
      } else if (indexCount < 5) {
        status = 'warn'
        message = `Few indexes found: ${indexCount}`
      } else {
        status = 'pass'
        message = `Index health good: ${indexCount} indexes`
      }
      
      return {
        name: 'Index Health',
        status,
        message,
        duration: Date.now() - start
      }
    } catch (error) {
      return {
        name: 'Index Health',
        status: 'fail',
        message: `Index health check failed: ${error.message}`,
        duration: Date.now() - start
      }
    }
  }

  private async checkCacheConnectivity(): Promise<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration: number
  }> {
    const start = Date.now()
    
    try {
      const testKey = 'health_check_test'
      const testValue = 'test_value'
      
      await redisCache.set(testKey, testValue, 60)
      const retrieved = await redisCache.get(testKey)
      await redisCache.del(testKey)
      
      if (retrieved === testValue) {
        return {
          name: 'Cache Connectivity',
          status: 'pass',
          message: 'Cache connection successful',
          duration: Date.now() - start
        }
      } else {
        return {
          name: 'Cache Connectivity',
          status: 'warn',
          message: 'Cache read/write mismatch',
          duration: Date.now() - start
        }
      }
    } catch (error) {
      return {
        name: 'Cache Connectivity',
        status: 'fail',
        message: `Cache connection failed: ${error.message}`,
        duration: Date.now() - start
      }
    }
  }

  private async checkLastImportStatus(): Promise<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration: number
  }> {
    const start = Date.now()
    
    try {
      const lastImport = await this.getLastImportInfo()
      
      if (!lastImport) {
        return {
          name: 'Last Import Status',
          status: 'warn',
          message: 'No import history found',
          duration: Date.now() - start
        }
      }
      
      const importDate = new Date(lastImport.updated_at)
      const daysSinceImport = (Date.now() - importDate.getTime()) / (1000 * 60 * 60 * 24)
      
      let status: 'pass' | 'fail' | 'warn'
      let message: string
      
      if (daysSinceImport > 7) {
        status = 'fail'
        message = `Last import was ${Math.floor(daysSinceImport)} days ago`
      } else if (daysSinceImport > 2) {
        status = 'warn'
        message = `Last import was ${Math.floor(daysSinceImport)} days ago`
      } else {
        status = 'pass'
        message = `Last import was ${Math.floor(daysSinceImport)} days ago`
      }
      
      return {
        name: 'Last Import Status',
        status,
        message,
        duration: Date.now() - start
      }
    } catch (error) {
      return {
        name: 'Last Import Status',
        status: 'fail',
        message: `Import status check failed: ${error.message}`,
        duration: Date.now() - start
      }
    }
  }
}

// Export singleton instance
export const cardDatabaseManagementService = CardDatabaseManagementService.getInstance()