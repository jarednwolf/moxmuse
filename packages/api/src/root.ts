import { createTRPCRouter } from './trpc'
import { authRouter } from './routers/auth'
import { collectionRouter } from './routers/collection'
import { deckRouter } from './routers/deck'
import { tutorRouter } from './routers/tutor'
import { enhancedTutorRouter } from './routers/enhanced-tutor-simple'
import { folderManagementRouter } from './routers/folder-management'
import { deckTemplateRouter } from './routers/deck-template'
import { cardSearchRouter } from './routers/card-search'
import { formatLegalityRouter } from './routers/format-legality'
import { cardSynergyRouter } from './routers/card-synergy'
// import { importJobProcessorRouter } from './routers/import-job-processor' // Temporarily disabled
import { monitoringRouter } from './routers/monitoring'

export const appRouter = createTRPCRouter({
  auth: authRouter,
  collection: collectionRouter,
  deck: deckRouter,
  tutor: tutorRouter,
  enhancedTutor: enhancedTutorRouter,
  folderManagement: folderManagementRouter,
  deckTemplate: deckTemplateRouter,
  cardSearch: cardSearchRouter,
  formatLegality: formatLegalityRouter,
  cardSynergy: cardSynergyRouter,
  // importJobProcessor: importJobProcessorRouter, // Temporarily disabled
  monitoring: monitoringRouter,
})

export type AppRouter = typeof appRouter
