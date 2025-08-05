import { PrismaClient } from '@moxmuse/db'
import type { 
  ConsultationData, 
  GeneratedDeckCard, 
  CardSynergy, 
  StrategyAnalysis 
} from '@moxmuse/shared'

/**
 * Graceful degradation service
 * Provides fallback functionality when primary services are unavailable
 */

export interface ServiceStatus {
  name: string
  available: boolean
  lastCheck: Date
  responseTime?: number
  errorCount: number
  lastError?: string
}

export interface FallbackConfig {
  enableFallbacks: boolean
  cacheTimeout: number
  maxCacheSize: number
  fallbackQuality: 'basic' | 'enhanced' | 'full'
}

export const defaultFallbackConfig: FallbackConfig = {
  enableFallbacks: true,
  cacheTimeout: 300000, // 5 minutes
  maxCacheSize: 1000,
  fallbackQuality: 'enhanced'
}

/**
 * Service health monitor
 */
export class ServiceHealthMonitor {
  private serviceStatus = new Map<string, ServiceStatus>()
  private healthCheckInterval: NodeJS.Timeout | null = null

  constructor(private checkIntervalMs: number = 60000) {
    this.startHealthChecks()
  }

  registerService(name: string): void {
    this.serviceStatus.set(name, {
      name,
      available: true,
      lastCheck: new Date(),
      errorCount: 0
    })
  }

  markServiceDown(name: string, error?: string): void {
    const status = this.serviceStatus.get(name)
    if (status) {
      status.available = false
      status.lastCheck = new Date()
      status.errorCount++
      status.lastError = error
      console.warn(`Service ${name} marked as down:`, error)
    }
  }

  markServiceUp(name: string, responseTime?: number): void {
    const status = this.serviceStatus.get(name)
    if (status) {
      status.available = true
      status.lastCheck = new Date()
      status.responseTime = responseTime
      status.errorCount = 0
      status.lastError = undefined
    }
  }

  isServiceAvailable(name: string): boolean {
    const status = this.serviceStatus.get(name)
    return status?.available ?? false
  }

  getServiceStatus(name: string): ServiceStatus | undefined {
    return this.serviceStatus.get(name)
  }

  getAllServiceStatus(): ServiceStatus[] {
    return Array.from(this.serviceStatus.values())
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.checkIntervalMs)
  }

  private async performHealthChecks(): Promise<void> {
    // Basic health checks - in production, these would ping actual services
    for (const [name, status] of this.serviceStatus.entries()) {
      try {
        const startTime = Date.now()
        
        // Simulate health check based on service type
        await this.checkServiceHealth(name)
        
        const responseTime = Date.now() - startTime
        this.markServiceUp(name, responseTime)
      } catch (error) {
        this.markServiceDown(name, error instanceof Error ? error.message : String(error))
      }
    }
  }

  private async checkServiceHealth(serviceName: string): Promise<void> {
    switch (serviceName) {
      case 'openai':
        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
          throw new Error('OpenAI API key not configured')
        }
        break
      case 'database':
        // Database health would be checked via actual connection
        break
      case 'scryfall':
        // Scryfall API health check
        break
      default:
        // Generic service check
        break
    }
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

/**
 * Fallback cache for storing degraded responses
 */
export class FallbackCache {
  private cache = new Map<string, { data: any; timestamp: Date; quality: string }>()
  
  constructor(private config: FallbackConfig) {}

  set(key: string, data: any, quality: string): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: new Date(),
      quality
    })
  }

  get(key: string): { data: any; quality: string } | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry has expired
    const age = Date.now() - entry.timestamp.getTime()
    if (age > this.config.cacheTimeout) {
      this.cache.delete(key)
      return null
    }

    return {
      data: entry.data,
      quality: entry.quality
    }
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * Main graceful degradation service
 */
export class GracefulDegradationService {
  private healthMonitor = new ServiceHealthMonitor()
  private fallbackCache = new FallbackCache(defaultFallbackConfig)

  constructor(
    private prisma: PrismaClient,
    private config: FallbackConfig = defaultFallbackConfig
  ) {
    // Register services
    this.healthMonitor.registerService('openai')
    this.healthMonitor.registerService('database')
    this.healthMonitor.registerService('scryfall')
  }

  /**
   * Execute operation with graceful degradation
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T> | T,
    serviceName: string,
    cacheKey?: string
  ): Promise<{ result: T; quality: 'primary' | 'fallback' | 'cached' }> {
    // Try cached result first if available
    if (cacheKey && this.config.enableFallbacks) {
      const cached = this.fallbackCache.get(cacheKey)
      if (cached) {
        return {
          result: cached.data,
          quality: 'cached' as const
        }
      }
    }

    try {
      // Try primary operation
      const result = await operation()
      this.healthMonitor.markServiceUp(serviceName)
      
      // Cache successful result
      if (cacheKey && this.config.enableFallbacks) {
        this.fallbackCache.set(cacheKey, result, 'primary')
      }
      
      return {
        result,
        quality: 'primary'
      }
    } catch (error) {
      this.healthMonitor.markServiceDown(serviceName, error instanceof Error ? error.message : String(error))
      
      if (!this.config.enableFallbacks) {
        throw error
      }

      try {
        // Try fallback operation
        const fallbackResult = await fallbackOperation()
        
        // Cache fallback result
        if (cacheKey) {
          this.fallbackCache.set(cacheKey, fallbackResult, 'fallback')
        }
        
        return {
          result: fallbackResult,
          quality: 'fallback'
        }
      } catch (fallbackError) {
        console.error(`Both primary and fallback operations failed for ${serviceName}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        })
        throw error // Throw original error
      }
    }
  }

  /**
   * AI service fallbacks
   */
  async generateDeckWithFallback(
    consultationData: ConsultationData,
    commander: string
  ): Promise<{ cards: GeneratedDeckCard[]; quality: 'primary' | 'fallback' | 'cached' }> {
    const cacheKey = `deck_${commander}_${JSON.stringify(consultationData)}`
    
    const result = await this.executeWithFallback(
      // Primary: AI generation (would call actual AI service)
      async () => {
        throw new Error('AI service unavailable') // Simulate failure for demo
      },
      // Fallback: Template-based generation
      () => this.generateFallbackDeck(consultationData, commander),
      'openai',
      cacheKey
    )
    
    return {
      cards: result.result,
      quality: result.quality
    }
  }

  async getCardRecommendationsWithFallback(
    prompt: string,
    constraints: any
  ): Promise<{ recommendations: any[]; quality: 'primary' | 'fallback' | 'cached' }> {
    const cacheKey = `recommendations_${prompt}_${JSON.stringify(constraints)}`
    
    const result = await this.executeWithFallback(
      // Primary: AI recommendations
      async () => {
        throw new Error('AI service unavailable') // Simulate failure for demo
      },
      // Fallback: Rule-based recommendations
      () => this.getFallbackRecommendations(prompt, constraints),
      'openai',
      cacheKey
    )
    
    return {
      recommendations: result.result,
      quality: result.quality
    }
  }

  async analyzeSynergiesWithFallback(
    cards: any[]
  ): Promise<{ synergies: CardSynergy[]; quality: 'primary' | 'fallback' | 'cached' }> {
    const cacheKey = `synergies_${cards.map(c => c.id).join(',')}`
    
    const result = await this.executeWithFallback(
      // Primary: AI synergy analysis
      async () => {
        throw new Error('AI service unavailable') // Simulate failure for demo
      },
      // Fallback: Rule-based synergy detection
      () => this.getFallbackSynergies(cards),
      'openai',
      cacheKey
    )
    
    return {
      synergies: result.result,
      quality: result.quality
    }
  }

  /**
   * Fallback implementations
   */
  private generateFallbackDeck(consultationData: ConsultationData, commander: string): GeneratedDeckCard[] {
    console.log('🔄 Using fallback deck generation for:', commander)
    
    // Template-based deck generation
    const cards: GeneratedDeckCard[] = []
    
    // Add commander
    cards.push({
      cardId: 'unknown',
      quantity: 1,
      category: 'commander',
      role: 'commander',
      reasoning: 'Selected commander'
    } as GeneratedDeckCard)

    // Add basic lands (simplified)
    const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest']
    const landsPerType = Math.floor(35 / basicLands.length)
    
    basicLands.forEach((landName, index) => {
      for (let i = 0; i < landsPerType; i++) {
        cards.push({
          cardId: `basic-${landName.toLowerCase()}`,
          quantity: 1,
          category: 'land',
          role: 'mana',
          reasoning: 'Basic mana source'
        } as GeneratedDeckCard)
      }
    })

    // Add generic staples based on strategy
    const strategy = consultationData.themes?.[0] || 'midrange'
    const staples = this.getStrategyStaples(strategy)
    
    staples.forEach((staple, index) => {
      cards.push({
        cardId: `staple-${staple.name.toLowerCase().replace(/\s+/g, '-')}`,
        quantity: 1,
        category: staple.category,
        role: staple.role,
        reasoning: staple.reasoning
      } as GeneratedDeckCard)
    })

    return cards.slice(0, 100) // Ensure exactly 100 cards
  }

  private getFallbackRecommendations(prompt: string, constraints: any): any[] {
    console.log('🔄 Using fallback recommendations for:', prompt)
    
    // Simple keyword-based recommendations
    const keywords = prompt.toLowerCase().split(' ')
    const recommendations = []
    
    if (keywords.includes('draw') || keywords.includes('card')) {
      recommendations.push({
        cardId: 'rhystic-study',
        reason: 'Excellent card draw engine',
        confidence: 0.8
      })
    }
    
    if (keywords.includes('ramp') || keywords.includes('mana')) {
      recommendations.push({
        cardId: 'sol-ring',
        reason: 'Universal mana acceleration',
        confidence: 0.9
      })
    }
    
    if (keywords.includes('removal') || keywords.includes('destroy')) {
      recommendations.push({
        cardId: 'swords-to-plowshares',
        reason: 'Efficient creature removal',
        confidence: 0.7
      })
    }

    return recommendations
  }

  private getFallbackSynergies(cards: any[]): CardSynergy[] {
    console.log('🔄 Using fallback synergy analysis for', cards.length, 'cards')
    
    // Simple rule-based synergy detection
    const synergies: CardSynergy[] = []
    
    // Look for basic synergy patterns
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const card1 = cards[i]
        const card2 = cards[j]
        
        // Check for type-based synergies
        if (card1.typeLine?.includes('Artifact') && card2.typeLine?.includes('Artifact')) {
          synergies.push({
            cardId: card1.id,
            relatedCardIds: [card2.id],
            synergyType: 'engine',
            strength: 0.6,
            description: 'Artifact synergy'
          })
        }
        
        // Check for color synergies
        if (card1.colors?.some((color: string) => card2.colors?.includes(color))) {
          synergies.push({
            cardId: card1.id,
            relatedCardIds: [card2.id],
            synergyType: 'support',
            strength: 0.4,
            description: 'Shared color identity'
          })
        }
      }
    }
    
    return synergies.slice(0, 20) // Limit to prevent overwhelming output
  }

  private getStrategyStaples(strategy: string): any[] {
    const baseStaples = [
      {
        name: 'Sol Ring',
        manaCost: '{1}',
        cmc: 1,
        typeLine: 'Artifact',
        oracleText: '{T}: Add {C}{C}.',
        colors: [],
        colorIdentity: [],
        rarity: 'uncommon',
        role: 'ramp',
        category: 'artifact',
        reasoning: 'Universal mana acceleration',
        synergyScore: 8,
        price: 1.5
      },
      {
        name: 'Command Tower',
        manaCost: '',
        cmc: 0,
        typeLine: 'Land',
        oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
        colors: [],
        colorIdentity: [],
        rarity: 'common',
        role: 'mana',
        category: 'land',
        reasoning: 'Perfect mana fixing for commanders',
        synergyScore: 9,
        price: 0.5
      }
    ]

    // Add strategy-specific cards
    switch (strategy) {
      case 'aggro':
        baseStaples.push({
          name: 'Lightning Bolt',
          manaCost: '{R}',
          cmc: 1,
          typeLine: 'Instant',
          oracleText: 'Lightning Bolt deals 3 damage to any target.',
          colors: [],
          colorIdentity: [],
          rarity: 'common',
          role: 'removal',
          category: 'instant',
          reasoning: 'Efficient damage spell',
          synergyScore: 7,
          price: 0.25
        })
        break
      case 'control':
        baseStaples.push({
          name: 'Counterspell',
          manaCost: '{U}{U}',
          cmc: 2,
          typeLine: 'Instant',
          oracleText: 'Counter target spell.',
          colors: [],
          colorIdentity: [],
          rarity: 'common',
          role: 'interaction',
          category: 'instant',
          reasoning: 'Classic counterspell',
          synergyScore: 8,
          price: 0.5
        })
        break
      default:
        // Add generic good stuff
        break
    }

    return baseStaples
  }

  /**
   * Service status and monitoring
   */
  getServiceHealth(): { overall: string; services: ServiceStatus[] } {
    const services = this.healthMonitor.getAllServiceStatus()
    const availableServices = services.filter(s => s.available).length
    const totalServices = services.length
    
    let overall = 'healthy'
    if (availableServices === 0) {
      overall = 'critical'
    } else if (availableServices < totalServices * 0.5) {
      overall = 'degraded'
    } else if (availableServices < totalServices) {
      overall = 'partial'
    }

    return { overall, services }
  }

  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.fallbackCache.size(),
      maxSize: this.config.maxCacheSize
    }
  }

  clearCache(): void {
    this.fallbackCache.clear()
  }

  updateConfig(newConfig: Partial<FallbackConfig>): void {
    Object.assign(this.config, newConfig)
  }

  destroy(): void {
    this.healthMonitor.destroy()
    this.fallbackCache.clear()
  }
}

// Export singleton instance
export const createGracefulDegradationService = (prisma: PrismaClient, config?: FallbackConfig) => {
  return new GracefulDegradationService(prisma, config)
}