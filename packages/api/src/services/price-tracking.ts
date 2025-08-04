import { TRPCError } from '@trpc/server'
import type { PrismaClient } from '@moxmuse/db'
import { redisCache } from './redis'
import { scryfallService } from './scryfall'
import axios from 'axios'

interface PricePoint {
  date: Date
  price: number
  source: 'scryfall' | 'tcgplayer' | 'cardmarket' | 'mtggoldfish'
  condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
  foil: boolean
}

interface CardPriceData {
  cardId: string
  currentPrice: number
  priceHistory: PricePoint[]
  volatility: number
  trend: 'rising' | 'falling' | 'stable'
  lastUpdated: Date
  sources: {
    scryfall?: number
    tcgplayer?: number
    cardmarket?: number
    mtggoldfish?: number
  }
}

interface PriceAlert {
  id: string
  userId: string
  cardId: string
  targetPrice: number
  condition: 'below' | 'above'
  isActive: boolean
  createdAt: Date
}

interface ReprintAlert {
  cardId: string
  cardName: string
  originalPrice: number
  newPrice: number
  priceDropPercent: number
  reprintSet: string
  alertDate: Date
}

export class PriceTrackingService {
  private readonly CACHE_TTL = 60 * 15 // 15 minutes
  private readonly PRICE_HISTORY_DAYS = 90
  
  constructor(private prisma: PrismaClient) {}

  /**
   * Get current price for a single card
   */
  async getCardPrice(cardId: string): Promise<CardPriceData | null> {
    try {
      // Check cache first
      const cached = await redisCache.get<CardPriceData>(`price:${cardId}`)
      if (cached && this.isCacheValid(cached.lastUpdated)) {
        return cached
      }

      // Fetch fresh price data
      const priceData = await this.fetchCardPrice(cardId)
      if (!priceData) return null

      // Cache the result
      await redisCache.set(`price:${cardId}`, priceData, this.CACHE_TTL)

      // Store in database for historical tracking
      await this.storePriceHistory(cardId, priceData)

      return priceData
    } catch (error) {
      console.error(`Error fetching price for card ${cardId}:`, error)
      return null
    }
  }

  /**
   * Get prices for multiple cards
   */
  async getCardPrices(cardIds: string[]): Promise<Map<string, CardPriceData>> {
    const results = new Map<string, CardPriceData>()
    
    // Process in batches to avoid overwhelming APIs
    const batchSize = 10
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (cardId) => {
        const price = await this.getCardPrice(cardId)
        if (price) {
          results.set(cardId, price)
        }
      })
      
      await Promise.all(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < cardIds.length) {
        await this.delay(200)
      }
    }
    
    return results
  }

  /**
   * Fetch price data from multiple sources
   */
  private async fetchCardPrice(cardId: string): Promise<CardPriceData | null> {
    try {
      // Get card data from Scryfall (includes basic price info)
      const card = await scryfallService.getCard(cardId)
      if (!card) return null

      const sources: CardPriceData['sources'] = {}
      let currentPrice = 0

      // Scryfall prices (USD)
      if (card.prices?.usd) {
        const price = parseFloat(card.prices.usd)
        sources.scryfall = price
        currentPrice = price // Use Scryfall as primary source
      }

      // Get historical data for volatility calculation
      const historicalPrices = await this.getHistoricalPrices(cardId)
      const volatility = this.calculateVolatility(historicalPrices)
      const trend = this.calculateTrend(historicalPrices)

      return {
        cardId,
        currentPrice,
        priceHistory: historicalPrices,
        volatility,
        trend,
        lastUpdated: new Date(),
        sources
      }
    } catch (error) {
      console.error(`Error fetching price data for ${cardId}:`, error)
      return null
    }
  }

  /**
   * Get historical price data from database
   */
  private async getHistoricalPrices(cardId: string): Promise<PricePoint[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.PRICE_HISTORY_DAYS)

      const prices = await this.prisma.cardPriceHistory.findMany({
        where: {
          cardId,
          date: {
            gte: cutoffDate
          }
        },
        orderBy: {
          date: 'asc'
        }
      })

      return prices.map((p: any) => ({
        date: p.date,
        price: p.price.toNumber(),
        source: p.source as PricePoint['source'],
        condition: p.condition as PricePoint['condition'],
        foil: p.foil
      }))
    } catch (error) {
      console.error(`Error fetching historical prices for ${cardId}:`, error)
      return []
    }
  }

  /**
   * Store price data in database for historical tracking
   */
  private async storePriceHistory(cardId: string, priceData: CardPriceData): Promise<void> {
    try {
      // Only store if price has changed significantly (>5% or >$1)
      const lastPrice = await this.getLastStoredPrice(cardId)
      if (lastPrice) {
        const priceChange = Math.abs(priceData.currentPrice - lastPrice)
        const percentChange = priceChange / lastPrice
        
        if (percentChange < 0.05 && priceChange < 1) {
          return // Skip storing if change is minimal
        }
      }

      await this.prisma.cardPriceHistory.create({
        data: {
          cardId,
          price: priceData.currentPrice,
          source: 'scryfall',
          condition: 'NM',
          foil: false,
          date: new Date(),
          metadata: {
            sources: priceData.sources,
            volatility: priceData.volatility,
            trend: priceData.trend
          }
        }
      })
    } catch (error) {
      console.error(`Error storing price history for ${cardId}:`, error)
    }
  }

  /**
   * Get the last stored price for a card
   */
  private async getLastStoredPrice(cardId: string): Promise<number | null> {
    try {
      const lastPrice = await this.prisma.cardPriceHistory.findFirst({
        where: { cardId },
        orderBy: { date: 'desc' },
        select: { price: true }
      })

      return lastPrice?.price.toNumber() || null
    } catch (error) {
      return null
    }
  }

  /**
   * Calculate price volatility (standard deviation of price changes)
   */
  private calculateVolatility(prices: PricePoint[]): number {
    if (prices.length < 2) return 0

    const priceChanges = []
    for (let i = 1; i < prices.length; i++) {
      const change = (prices[i].price - prices[i-1].price) / prices[i-1].price
      priceChanges.push(change)
    }

    if (priceChanges.length === 0) return 0

    const mean = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length
    const variance = priceChanges.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / priceChanges.length
    
    return Math.sqrt(variance)
  }

  /**
   * Calculate price trend based on recent price movements
   */
  private calculateTrend(prices: PricePoint[]): 'rising' | 'falling' | 'stable' {
    if (prices.length < 2) return 'stable'

    // Look at last 30 days or available data
    const recentPrices = prices.slice(-30)
    if (recentPrices.length < 2) return 'stable'

    const firstPrice = recentPrices[0].price
    const lastPrice = recentPrices[recentPrices.length - 1].price
    const change = (lastPrice - firstPrice) / firstPrice

    if (change > 0.1) return 'rising'
    if (change < -0.1) return 'falling'
    return 'stable'
  }

  /**
   * Set up price alerts for users
   */
  async createPriceAlert(
    userId: string,
    cardId: string,
    targetPrice: number,
    condition: 'below' | 'above'
  ): Promise<PriceAlert> {
    try {
      const alert = await this.prisma.priceAlert.create({
        data: {
          userId,
          cardId,
          targetPrice,
          condition,
          isActive: true
        }
      })

      return {
        id: alert.id,
        userId: alert.userId,
        cardId: alert.cardId,
        targetPrice: alert.targetPrice.toNumber(),
        condition: alert.condition as 'below' | 'above',
        isActive: alert.isActive,
        createdAt: alert.createdAt
      }
    } catch (error) {
      console.error('Error creating price alert:', error)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create price alert'
      })
    }
  }

  /**
   * Check for triggered price alerts
   */
  async checkPriceAlerts(): Promise<void> {
    try {
      const activeAlerts = await this.prisma.priceAlert.findMany({
        where: { isActive: true }
      })

      for (const alert of activeAlerts) {
        const priceData = await this.getCardPrice(alert.cardId)
        if (!priceData) continue

        const shouldTrigger = 
          (alert.condition === 'below' && priceData.currentPrice <= alert.targetPrice.toNumber()) ||
          (alert.condition === 'above' && priceData.currentPrice >= alert.targetPrice.toNumber())

        if (shouldTrigger) {
          await this.triggerPriceAlert(alert, priceData.currentPrice)
        }
      }
    } catch (error) {
      console.error('Error checking price alerts:', error)
    }
  }

  /**
   * Trigger a price alert (send notification, etc.)
   */
  private async triggerPriceAlert(alert: any, currentPrice: number): Promise<void> {
    try {
      // Mark alert as triggered
      await this.prisma.priceAlert.update({
        where: { id: alert.id },
        data: { isActive: false }
      })

      // Create notification record
      await this.prisma.notification.create({
        data: {
          userId: alert.userId,
          type: 'PRICE_ALERT',
          title: 'Price Alert Triggered',
          message: `Card price ${alert.condition} $${alert.targetPrice.toNumber()}. Current price: $${currentPrice}`,
          data: {
            cardId: alert.cardId,
            targetPrice: alert.targetPrice.toNumber(),
            currentPrice,
            condition: alert.condition
          }
        }
      })

      // TODO: Send email/push notification
      console.log(`Price alert triggered for user ${alert.userId}: ${alert.cardId} is now $${currentPrice}`)
    } catch (error) {
      console.error('Error triggering price alert:', error)
    }
  }

  /**
   * Detect reprint alerts (significant price drops)
   */
  async detectReprintAlerts(): Promise<ReprintAlert[]> {
    try {
      const alerts: ReprintAlert[] = []
      
      // Get cards with significant price drops in the last 7 days
      const recentPriceDrops = await this.prisma.$queryRaw`
        SELECT 
          cardId,
          MIN(price) as minPrice,
          MAX(price) as maxPrice,
          COUNT(*) as pricePoints
        FROM CardPriceHistory 
        WHERE date >= NOW() - INTERVAL 7 DAY
        GROUP BY cardId
        HAVING (maxPrice - minPrice) / maxPrice > 0.3
        AND pricePoints >= 2
      ` as any[]

      for (const drop of recentPriceDrops) {
        const card = await scryfallService.getCard(drop.cardId)
        if (!card) continue

        const priceDropPercent = ((drop.maxPrice - drop.minPrice) / drop.maxPrice) * 100

        alerts.push({
          cardId: drop.cardId,
          cardName: card.name,
          originalPrice: drop.maxPrice,
          newPrice: drop.minPrice,
          priceDropPercent,
          reprintSet: 'Unknown', // Would need additional logic to detect reprint set
          alertDate: new Date()
        })
      }

      return alerts
    } catch (error) {
      console.error('Error detecting reprint alerts:', error)
      return []
    }
  }

  /**
   * Get price performance analysis for a card
   */
  async getPricePerformanceAnalysis(cardId: string): Promise<{
    performance: 'excellent' | 'good' | 'average' | 'poor'
    priceToPlayabilityRatio: number
    recommendedAction: 'buy' | 'hold' | 'sell' | 'wait'
    reasoning: string
  } | null> {
    try {
      const priceData = await this.getCardPrice(cardId)
      if (!priceData) return null

      const card = await scryfallService.getCard(cardId)
      if (!card) return null

      // Simple analysis based on price trend and volatility
      let performance: 'excellent' | 'good' | 'average' | 'poor' = 'average'
      let recommendedAction: 'buy' | 'hold' | 'sell' | 'wait' = 'hold'
      let reasoning = 'Price is stable with normal volatility'

      // Analyze based on trend and volatility
      if (priceData.trend === 'rising' && priceData.volatility < 0.2) {
        performance = 'excellent'
        recommendedAction = 'buy'
        reasoning = 'Strong upward trend with low volatility indicates good investment potential'
      } else if (priceData.trend === 'falling' && priceData.volatility > 0.4) {
        performance = 'poor'
        recommendedAction = 'wait'
        reasoning = 'Declining price with high volatility suggests waiting for stabilization'
      } else if (priceData.volatility > 0.3) {
        performance = 'poor'
        recommendedAction = 'wait'
        reasoning = 'High price volatility makes this a risky purchase'
      } else if (priceData.trend === 'rising') {
        performance = 'good'
        recommendedAction = 'buy'
        reasoning = 'Upward price trend suggests good timing for purchase'
      }

      // Calculate price-to-playability ratio (simplified)
      const edhrecRank = (card as any).edhrec_rank || 10000
      const priceToPlayabilityRatio = priceData.currentPrice / (10000 - edhrecRank + 1) * 1000

      return {
        performance,
        priceToPlayabilityRatio,
        recommendedAction,
        reasoning
      }
    } catch (error) {
      console.error(`Error analyzing price performance for ${cardId}:`, error)
      return null
    }
  }

  /**
   * Utility methods
   */
  private isCacheValid(lastUpdated: Date): boolean {
    const now = new Date()
    const diffMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60)
    return diffMinutes < 15 // Cache valid for 15 minutes
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}