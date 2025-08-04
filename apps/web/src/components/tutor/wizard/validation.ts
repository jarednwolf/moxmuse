import { ConsultationData } from '@moxmuse/shared'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface StepValidation {
  [stepIndex: number]: (data: ConsultationData) => ValidationResult
}

// Validation functions for each step
export const stepValidations: StepValidation = {
  // Commander Step (0)
  0: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.commander && !data.needsCommanderSuggestions) {
      errors.push('Please select a commander or choose to get commander suggestions')
    }

    if (data.commander && data.needsCommanderSuggestions) {
      warnings.push('You have both a commander selected and requested suggestions. The selected commander will be used.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Strategy Step (1)
  1: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.strategy) {
      errors.push('Please select a deck strategy')
    }

    if (data.themes && data.themes.length > 3) {
      warnings.push('Having too many themes might make the deck unfocused')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Budget Step (2)
  2: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (data.budget === undefined || data.budget < 0) {
      errors.push('Please specify a valid budget')
    }

    if (data.budget && data.budget < 50) {
      warnings.push('Very low budgets may limit deck building options significantly')
    }

    if (data.budget && data.budget > 2000) {
      warnings.push('High budgets may result in very expensive card recommendations')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Power Level Step (3)
  3: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.powerLevel || data.powerLevel < 1 || data.powerLevel > 4) {
      errors.push('Please select a valid power level (1-4)')
    }

    if (data.powerLevel === 4 && data.budget && data.budget < 500) {
      warnings.push('Competitive power level (4) typically requires a higher budget')
    }

    if (data.powerLevel === 1 && data.budget && data.budget > 1000) {
      warnings.push('Casual power level (1) may not need such a high budget')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Win Conditions Step (4)
  4: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.winConditions?.primary) {
      errors.push('Please select a primary win condition')
    }

    if (data.winConditions?.primary === 'combat' && !data.winConditions?.combatStyle) {
      warnings.push('Consider specifying a combat style for better deck focus')
    }

    if (data.winConditions?.primary === 'combo' && !data.winConditions?.comboType) {
      warnings.push('Consider specifying a combo type for better deck focus')
    }

    if (data.winConditions?.secondary && data.winConditions.secondary.length > 3) {
      warnings.push('Too many secondary win conditions might make the deck unfocused')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Interaction Step (5)
  5: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.interaction?.level) {
      errors.push('Please select an interaction level')
    }

    if (data.interaction?.level === 'high' && data.interaction?.types?.length === 0) {
      warnings.push('High interaction level should include specific interaction types')
    }

    if (data.interaction?.level === 'low' && data.interaction?.types && data.interaction.types.length > 2) {
      warnings.push('Low interaction level with many interaction types may be contradictory')
    }

    if (data.interaction?.timing === 'reactive' && data.strategy === 'aggro') {
      warnings.push('Reactive timing may not align well with aggressive strategies')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Restrictions Step (6) - Always valid since restrictions are optional
  6: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (data.avoidStrategies && data.avoidStrategies.includes(data.strategy || '')) {
      warnings.push('You are avoiding a strategy that matches your selected deck strategy')
    }

    if (data.avoidStrategies && data.avoidStrategies.length > 5) {
      warnings.push('Avoiding too many strategies may severely limit deck building options')
    }

    if (data.avoidCards && data.avoidCards.length > 20) {
      warnings.push('Avoiding too many cards may limit deck building options')
    }

    if (data.petCards && data.petCards.length > 10) {
      warnings.push('Too many pet cards may not all fit in the final deck')
    }

    return {
      isValid: true, // Always valid since restrictions are optional
      errors,
      warnings
    }
  },

  // Complexity Step (7)
  7: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.complexityLevel) {
      errors.push('Please select a complexity level')
    }

    if (data.complexityLevel === 'simple' && data.strategy === 'combo') {
      warnings.push('Combo strategies are typically more complex to pilot')
    }

    if (data.complexityLevel === 'complex' && data.powerLevel === 1) {
      warnings.push('Complex decks may not be suitable for casual power levels')
    }

    if (data.politics?.style === 'chaotic' && data.complexityLevel === 'simple') {
      warnings.push('Chaotic political style may add complexity to gameplay')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  },

  // Summary Step (8) - Always valid if we reach it
  8: (data: ConsultationData): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    // Final validation checks
    const requiredFields = [
      'strategy',
      'budget',
      'powerLevel',
      'complexityLevel'
    ]

    const missingFields = requiredFields.filter(field => !data[field as keyof ConsultationData])
    
    if (missingFields.length > 0) {
      errors.push(`Missing required information: ${missingFields.join(', ')}`)
    }

    if (!data.commander && !data.needsCommanderSuggestions) {
      errors.push('Commander information is required')
    }

    if (!data.winConditions?.primary) {
      errors.push('Primary win condition is required')
    }

    if (!data.interaction?.level) {
      errors.push('Interaction level is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

// Utility function to validate a specific step
export const validateStep = (stepIndex: number, data: ConsultationData): ValidationResult => {
  const validator = stepValidations[stepIndex]
  if (!validator) {
    return {
      isValid: true,
      errors: [],
      warnings: []
    }
  }
  return validator(data)
}

// Utility function to validate all steps up to a given step
export const validateAllSteps = (upToStep: number, data: ConsultationData): ValidationResult => {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  for (let i = 0; i <= upToStep; i++) {
    const result = validateStep(i, data)
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
}

// Error messages for common validation scenarios
export const getStepErrorMessage = (stepIndex: number, data: ConsultationData): string | null => {
  const result = validateStep(stepIndex, data)
  return result.errors.length > 0 ? result.errors[0] : null
}

// Check if user can proceed from current step
export const canProceedFromStep = (stepIndex: number, data: ConsultationData): boolean => {
  const result = validateStep(stepIndex, data)
  return result.isValid
}

// Individual validation functions for testing
export const validateCommanderStep = (data: ConsultationData): boolean => {
  return stepValidations[0](data).isValid
}

export const validateStrategyStep = (data: ConsultationData): boolean => {
  return stepValidations[1](data).isValid
}

export const validateBudgetStep = (data: ConsultationData): boolean => {
  return stepValidations[2](data).isValid
}

export const validatePowerLevelStep = (data: ConsultationData): boolean => {
  return stepValidations[3](data).isValid
}

export const validateWinConditionsStep = (data: ConsultationData): boolean => {
  return stepValidations[4](data).isValid
}

export const validateInteractionStep = (data: ConsultationData): boolean => {
  return stepValidations[5](data).isValid
}

export const validateRestrictionsStep = (data: ConsultationData): boolean => {
  return stepValidations[6](data).isValid
}

export const validateComplexityStep = (data: ConsultationData): boolean => {
  return stepValidations[7](data).isValid
}

export const validateConsultationData = (data: ConsultationData): boolean => {
  return stepValidations[8](data).isValid
}