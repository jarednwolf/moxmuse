import { describe, it, expect } from 'vitest'
import { 
  validateCommanderStep,
  validateStrategyStep,
  validateBudgetStep,
  validatePowerLevelStep,
  validateWinConditionsStep,
  validateInteractionStep,
  validateRestrictionsStep,
  validateComplexityStep,
  validateConsultationData
} from '../validation'
import { ConsultationData } from '@moxmuse/shared'

describe('Wizard Validation', () => {
  const baseData: ConsultationData = {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false
  }

  describe('validateCommanderStep', () => {
    it('should pass when commander is provided and needsCommanderSuggestions is false', () => {
      const data = {
        ...baseData,
        commander: 'Atraxa, Praetors\' Voice',
        needsCommanderSuggestions: false
      }
      expect(validateCommanderStep(data)).toBe(true)
    })

    it('should pass when needsCommanderSuggestions is true', () => {
      const data = {
        ...baseData,
        needsCommanderSuggestions: true
      }
      expect(validateCommanderStep(data)).toBe(true)
    })

    it('should fail when commander is missing and needsCommanderSuggestions is false', () => {
      const data = {
        ...baseData,
        needsCommanderSuggestions: false
      }
      expect(validateCommanderStep(data)).toBe(false)
    })

    it('should fail when commander is empty string', () => {
      const data = {
        ...baseData,
        commander: '',
        needsCommanderSuggestions: false
      }
      expect(validateCommanderStep(data)).toBe(false)
    })
  })

  describe('validateStrategyStep', () => {
    it('should pass when strategy is provided', () => {
      const data = {
        ...baseData,
        strategy: 'aggro' as const
      }
      expect(validateStrategyStep(data)).toBe(true)
    })

    it('should fail when strategy is missing', () => {
      expect(validateStrategyStep(baseData)).toBe(false)
    })

    it('should pass with valid strategy values', () => {
      const strategies = ['aggro', 'control', 'combo', 'midrange', 'tribal', 'value', 'stax'] as const
      strategies.forEach(strategy => {
        const data = { ...baseData, strategy }
        expect(validateStrategyStep(data)).toBe(true)
      })
    })
  })

  describe('validateBudgetStep', () => {
    it('should pass when budget is provided', () => {
      const data = {
        ...baseData,
        budget: 100
      }
      expect(validateBudgetStep(data)).toBe(true)
    })

    it('should pass when budget is 0', () => {
      const data = {
        ...baseData,
        budget: 0
      }
      expect(validateBudgetStep(data)).toBe(true)
    })

    it('should fail when budget is negative', () => {
      const data = {
        ...baseData,
        budget: -50
      }
      expect(validateBudgetStep(data)).toBe(false)
    })

    it('should fail when budget is missing', () => {
      expect(validateBudgetStep(baseData)).toBe(false)
    })
  })

  describe('validatePowerLevelStep', () => {
    it('should pass when power level is provided', () => {
      const data = {
        ...baseData,
        powerLevel: 3
      }
      expect(validatePowerLevelStep(data)).toBe(true)
    })

    it('should pass with valid power level range (1-4)', () => {
      for (let level = 1; level <= 4; level++) {
        const data = { ...baseData, powerLevel: level }
        expect(validatePowerLevelStep(data)).toBe(true)
      }
    })

    it('should fail when power level is out of range', () => {
      const invalidLevels = [0, 5, -1, 10]
      invalidLevels.forEach(level => {
        const data = { ...baseData, powerLevel: level }
        expect(validatePowerLevelStep(data)).toBe(false)
      })
    })

    it('should fail when power level is missing', () => {
      expect(validatePowerLevelStep(baseData)).toBe(false)
    })
  })

  describe('validateWinConditionsStep', () => {
    it('should pass when primary win condition is provided', () => {
      const data = {
        ...baseData,
        winConditions: { primary: 'combat' as const }
      }
      expect(validateWinConditionsStep(data)).toBe(true)
    })

    it('should pass with all valid primary win conditions', () => {
      const winConditions = ['combat', 'combo', 'alternative', 'control'] as const
      winConditions.forEach(primary => {
        const data = { ...baseData, winConditions: { primary } }
        expect(validateWinConditionsStep(data)).toBe(true)
      })
    })

    it('should pass with combat style when primary is combat', () => {
      const data = {
        ...baseData,
        winConditions: {
          primary: 'combat' as const,
          combatStyle: 'voltron' as const
        }
      }
      expect(validateWinConditionsStep(data)).toBe(true)
    })

    it('should pass with combo type when primary is combo', () => {
      const data = {
        ...baseData,
        winConditions: {
          primary: 'combo' as const,
          comboType: 'infinite' as const
        }
      }
      expect(validateWinConditionsStep(data)).toBe(true)
    })

    it('should fail when win conditions are missing', () => {
      expect(validateWinConditionsStep(baseData)).toBe(false)
    })

    it('should fail when primary win condition is missing', () => {
      const data = {
        ...baseData,
        winConditions: {}
      }
      expect(validateWinConditionsStep(data)).toBe(false)
    })
  })

  describe('validateInteractionStep', () => {
    it('should pass when interaction level is provided', () => {
      const data = {
        ...baseData,
        interaction: { level: 'medium' as const, types: [], timing: 'balanced' as const }
      }
      expect(validateInteractionStep(data)).toBe(true)
    })

    it('should pass with all valid interaction levels', () => {
      const levels = ['low', 'medium', 'high'] as const
      levels.forEach(level => {
        const data = {
          ...baseData,
          interaction: { level, types: [], timing: 'balanced' as const }
        }
        expect(validateInteractionStep(data)).toBe(true)
      })
    })

    it('should pass with interaction types', () => {
      const data = {
        ...baseData,
        interaction: {
          level: 'high' as const,
          types: ['removal', 'counterspells'],
          timing: 'reactive' as const
        }
      }
      expect(validateInteractionStep(data)).toBe(true)
    })

    it('should fail when interaction is missing', () => {
      expect(validateInteractionStep(baseData)).toBe(false)
    })
  })

  describe('validateRestrictionsStep', () => {
    it('should pass when restrictions are provided', () => {
      const data = {
        ...baseData,
        avoidStrategies: ['stax'],
        avoidCards: ['Winter Orb']
      }
      expect(validateRestrictionsStep(data)).toBe(true)
    })

    it('should pass with empty restrictions', () => {
      const data = {
        ...baseData,
        avoidStrategies: [],
        avoidCards: []
      }
      expect(validateRestrictionsStep(data)).toBe(true)
    })

    it('should pass when restrictions are undefined', () => {
      expect(validateRestrictionsStep(baseData)).toBe(true)
    })
  })

  describe('validateComplexityStep', () => {
    it('should pass when complexity level is provided', () => {
      const data = {
        ...baseData,
        complexityLevel: 'moderate' as const
      }
      expect(validateComplexityStep(data)).toBe(true)
    })

    it('should pass with all valid complexity levels', () => {
      const levels = ['simple', 'moderate', 'complex'] as const
      levels.forEach(complexityLevel => {
        const data = { ...baseData, complexityLevel }
        expect(validateComplexityStep(data)).toBe(true)
      })
    })

    it('should fail when complexity level is missing', () => {
      expect(validateComplexityStep(baseData)).toBe(false)
    })
  })

  describe('validateConsultationData', () => {
    it('should pass with complete valid data', () => {
      const completeData: ConsultationData = {
        ...baseData,
        commander: 'Atraxa, Praetors\' Voice',
        strategy: 'value',
        budget: 200,
        powerLevel: 3,
        winConditions: { primary: 'combat', combatStyle: 'voltron' },
        interaction: { level: 'medium', types: ['removal'], timing: 'balanced' },
        complexityLevel: 'moderate',
        avoidStrategies: [],
        avoidCards: []
      }
      expect(validateConsultationData(completeData)).toBe(true)
    })

    it('should fail with incomplete data', () => {
      const incompleteData = {
        ...baseData,
        commander: 'Atraxa, Praetors\' Voice'
        // Missing required fields
      }
      expect(validateConsultationData(incompleteData)).toBe(false)
    })

    it('should handle commander suggestions flow', () => {
      const dataWithSuggestions: ConsultationData = {
        ...baseData,
        needsCommanderSuggestions: true,
        strategy: 'combo',
        budget: 150,
        powerLevel: 4,
        winConditions: { primary: 'combo', comboType: 'infinite' },
        interaction: { level: 'high', types: ['counterspells'], timing: 'reactive' },
        complexityLevel: 'complex'
      }
      expect(validateConsultationData(dataWithSuggestions)).toBe(true)
    })
  })
})