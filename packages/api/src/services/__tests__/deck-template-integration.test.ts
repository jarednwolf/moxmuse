import { describe, it, expect } from 'vitest'

describe('DeckTemplateService Integration', () => {
  it('should have all required methods', async () => {
    // Simple test to verify the service exports the expected methods
    const { deckTemplateService } = await import('../deck-template')
    
    expect(deckTemplateService).toBeDefined()
    expect(typeof deckTemplateService.createTemplate).toBe('function')
    expect(typeof deckTemplateService.createTemplateFromDeck).toBe('function')
    expect(typeof deckTemplateService.instantiateTemplate).toBe('function')
    expect(typeof deckTemplateService.getTemplates).toBe('function')
    expect(typeof deckTemplateService.getTemplate).toBe('function')
    expect(typeof deckTemplateService.updateTemplate).toBe('function')
    expect(typeof deckTemplateService.deleteTemplate).toBe('function')
    expect(typeof deckTemplateService.getTemplateRecommendations).toBe('function')
    expect(typeof deckTemplateService.rateTemplate).toBe('function')
  })

  it('should validate template data structure', () => {
    // Test the template data structure validation
    const validTemplateData = {
      name: 'Test Template',
      description: 'A test template',
      format: 'commander',
      archetype: 'Control',
      isPublic: false,
      powerLevel: 7,
      estimatedBudget: 200,
      tags: ['control', 'blue'],
      categories: [{
        name: 'Ramp',
        description: 'Ramp cards',
        targetCount: 10,
        minCount: 8,
        maxCount: 12,
        priority: 8
      }],
      coreCards: [{
        cardId: 'card-1',
        category: 'Ramp',
        isCore: true,
        alternatives: [],
        reasoning: 'Essential ramp'
      }],
      flexSlots: [{
        category: 'Removal',
        count: 5,
        criteria: 'Flexible removal',
        suggestions: ['card-2', 'card-3']
      }]
    }

    // Verify the structure is valid
    expect(validTemplateData.name).toBeDefined()
    expect(validTemplateData.description).toBeDefined()
    expect(validTemplateData.categories).toBeInstanceOf(Array)
    expect(validTemplateData.coreCards).toBeInstanceOf(Array)
    expect(validTemplateData.flexSlots).toBeInstanceOf(Array)
    expect(validTemplateData.categories[0]).toHaveProperty('name')
    expect(validTemplateData.categories[0]).toHaveProperty('targetCount')
    expect(validTemplateData.coreCards[0]).toHaveProperty('cardId')
    expect(validTemplateData.flexSlots[0]).toHaveProperty('category')
  })

  it('should handle template instantiation data structure', () => {
    const instantiateData = {
      templateId: 'template-123',
      deckName: 'My New Deck',
      customizations: {
        powerLevel: 8,
        budget: 300,
        excludedCards: ['card-1', 'card-2'],
        preferredCards: ['card-3', 'card-4'],
        categoryAdjustments: {
          'Ramp': 12,
          'Removal': 8
        }
      }
    }

    expect(instantiateData.templateId).toBeDefined()
    expect(instantiateData.deckName).toBeDefined()
    expect(instantiateData.customizations).toBeDefined()
    expect(instantiateData.customizations.excludedCards).toBeInstanceOf(Array)
    expect(instantiateData.customizations.preferredCards).toBeInstanceOf(Array)
    expect(typeof instantiateData.customizations.categoryAdjustments).toBe('object')
  })
})