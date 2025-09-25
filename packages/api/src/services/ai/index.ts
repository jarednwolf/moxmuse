/**
 * AI Services Index
 * 
 * Central export point for all AI services.
 * This provides a clean interface for importing AI functionality
 * while maintaining the modular architecture internally.
 */

import { services } from '../container'
export { services }

export const {
  openaiOrchestrator,
  deckGenerationService,
  cardRecommendationService,
  synergyAnalysisService,
} = services