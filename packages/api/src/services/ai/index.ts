/**
 * AI Services Index
 * 
 * Central export point for all AI services.
 * This provides a clean interface for importing AI functionality
 * while maintaining the modular architecture internally.
 */

export { OpenAIOrchestrator } from './OpenAIOrchestrator'
export { DeckGenerationService } from './DeckGenerationService'
export { CardRecommendationService } from './CardRecommendationService'
export { SynergyAnalysisService } from './SynergyAnalysisService'
export { PromptManagementService } from './PromptManagementService'

// Create and export the main orchestrator instance
import { OpenAIOrchestrator } from './OpenAIOrchestrator'
export const openaiOrchestrator = new OpenAIOrchestrator()

// Re-export as openaiService for backward compatibility
export { openaiOrchestrator as openaiService }

// Export instances for router compatibility
export const aiServiceOrchestrator = openaiOrchestrator
export const deckGenerationService = new DeckGenerationService()
export const deckAnalysisEngine = {} // Placeholder for now
export const intelligentLearningService = {} // Placeholder for now
export const aiUserStyleProfiler = {} // Placeholder for now
export const researchBackedPersonalization = {} // Placeholder for now