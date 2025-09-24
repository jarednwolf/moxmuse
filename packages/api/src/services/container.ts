// Service Container: centralizes construction of singletons and exposes a stable facade
import { prisma } from '@moxmuse/db'
import { redisCache } from './redis'
import { OpenAIOrchestrator } from './ai/OpenAIOrchestrator'
import { DeckGenerationService } from './ai/DeckGenerationService'
import { CardRecommendationService } from './ai/CardRecommendationService'
import { SynergyAnalysisService } from './ai/SynergyAnalysisService'
import { MetaAnalysisService } from './meta-analysis'
import { PriceTrackingService } from './price-tracking'

// Core singletons (use existing constructors; inject prisma/cache where required)
const orchestrator = new OpenAIOrchestrator({})
const deckGen = new DeckGenerationService(orchestrator as any)
const cardRecs = new CardRecommendationService(orchestrator as any)
const synergy = new SynergyAnalysisService(orchestrator as any)
const metaSvc = new MetaAnalysisService(prisma as any)
const priceSvc = new PriceTrackingService(prisma as any)

// Learning/Profile facades (lightweight adapters)
const learningFacade = {
  async getUserProfile(userId: string) {
    // Prefer a lightweight read; adjust include as needed
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, image: true } })
    return user
  },
  async getUserLearningHistory(_userId: string) {
    // Backward compatible shim – route can evolve to use getUserLearningStats instead
    return [] as any[]
  },
  async getUserLearningStats(_userId: string) {
    return { totalEvents: 0, strategiesExplored: 0 }
  }
}

// Adapters expected by routers
export const services = {
  // AI Orchestrator facade
  openaiOrchestrator: Object.assign(orchestrator, {
    getDeckGenerationProgress: (_deckId: string) => ({ progress: 0, status: 'pending' as const }),
    getSystemPerformance: () => ({ uptime: process.uptime(), queueDepth: 0 }),
    analyzeWithStreaming: (_req: any) => ({ subscribe: () => ({ unsubscribe(){} }) })
  }),

  // AI domain services
  deckGenerationService: deckGen,
  cardRecommendationService: cardRecs,
  synergyAnalysisService: synergy,

  // Meta/Price
  metaAnalysisService: Object.assign(metaSvc, {
    analyzeMetaPosition: async (commander: string, strategy?: string) =>
      metaSvc.analyzeDeckMeta({ commander, strategy } as any),
    getCurrentMeta: async () => ({ popularDecks: [], winRates: {} as Record<string, number> })
  }),
  priceTrackingService: Object.assign(priceSvc, {}),

  // Learning/Profile
  learning: learningFacade
}

export type ServicesFacade = typeof services
