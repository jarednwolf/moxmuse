import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Stub OpenAI when tests run in jsdom to avoid browser safety errors
vi.mock('openai', () => {
  class OpenAIMock {
    constructor(_opts: any) {}
  }
  return { default: OpenAIMock }
})

// Stub API AI index to avoid requiring server-only container in jsdom
vi.mock('@moxmuse/api/src/services/ai/index', () => {
  return {
    promptRegistry: {
      getTemplate: () => ({ id: 'commander-selection', version: '1.0' }),
    },
    modelRouter: {
      selectModel: () => ({ model: 'gpt-4o-mini', confidence: 0.9 }),
    },
    promptTemplateEngine: {},
    aiTaskClassifier: { classifyTask: () => ({ taskType: 'selection', complexity: 'low', recommendedModel: 'gpt-4o-mini' }) },
    promptVersioning: {},
    promptPerformanceTracking: {},
    contextAwarePrompting: {},
    aiResearchEngine: {},
    intelligentDeckAssembler: {},
    aiValidationEngine: {},
    deckGenerationService: {},
  }
})