import { describe, it, expect } from 'vitest'

// Test that AI services can be imported and initialized
describe('AI Services Integration', () => {
  it('should be able to import AI services without errors', async () => {
    // Dynamic import to avoid build-time issues
    const aiServices = await import('@moxmuse/api/src/services/ai/index')
    
    expect(aiServices).toBeDefined()
    expect(aiServices.promptRegistry).toBeDefined()
    expect(aiServices.modelRouter).toBeDefined()
    expect(aiServices.promptTemplateEngine).toBeDefined()
    expect(aiServices.aiTaskClassifier).toBeDefined()
    expect(aiServices.promptVersioning).toBeDefined()
    expect(aiServices.promptPerformanceTracking).toBeDefined()
    expect(aiServices.contextAwarePrompting).toBeDefined()
    expect(aiServices.aiResearchEngine).toBeDefined()
    expect(aiServices.intelligentDeckAssembler).toBeDefined()
    expect(aiServices.aiValidationEngine).toBeDefined()
    expect(aiServices.deckGenerationService).toBeDefined()
  })

  it('should have working prompt registry with default templates', async () => {
    const { promptRegistry } = await import('@moxmuse/api/src/services/ai/index')
    
    const commanderTemplate = promptRegistry.getTemplate('commander-selection')
    expect(commanderTemplate).toBeDefined()
    expect(commanderTemplate?.id).toBe('commander-selection')
    expect(commanderTemplate?.version).toBe('1.0')
  })

  it('should have working model router', async () => {
    const { modelRouter } = await import('@moxmuse/api/src/services/ai/index')
    
    const selection = modelRouter.selectModel('commander-selection', 'low')
    expect(selection).toBeDefined()
    expect(selection.model).toBeDefined()
    expect(selection.confidence).toBeGreaterThan(0)
  })

  it('should have working task classifier', async () => {
    const { aiTaskClassifier } = await import('@moxmuse/api/src/services/ai/index')
    
    const classification = aiTaskClassifier.classifyTask({
      prompt: 'Suggest 5 commanders for an aggro strategy',
      context: {},
    })
    
    expect(classification).toBeDefined()
    expect(classification.taskType).toBeDefined()
    expect(classification.complexity).toBeDefined()
    expect(classification.recommendedModel).toBeDefined()
  })
})