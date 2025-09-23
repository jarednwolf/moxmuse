import { createTRPCRouter } from './trpc'
import { cardSearchRouter } from './routers/card-search'
import { cardSynergyRouter } from './routers/card-synergy'
import { healthRouter } from './routers/health'
import { formatLegalityRouter } from './routers/format-legality'
import { enhancedTutorRouter as enhancedTutorRouterFull } from './routers/enhanced-tutor'
import { enhancedCardDataRouter } from './routers/enhanced-card-data'

export const appRouter = createTRPCRouter({
  cardSearch: cardSearchRouter,
  cardSynergy: cardSynergyRouter,
  health: healthRouter,
  formatLegality: formatLegalityRouter,
  enhancedTutor: enhancedTutorRouterFull,
  enhancedCardData: enhancedCardDataRouter,
})

export type AppRouter = typeof appRouter
