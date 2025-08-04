'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { ConsultationData } from '@moxmuse/shared'

// Wizard state interface
interface WizardState {
  currentStep: number
  consultationData: ConsultationData
  isComplete: boolean
  sessionId: string
}

// Action types for wizard state management
type WizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'UPDATE_DATA'; payload: Partial<ConsultationData> }
  | { type: 'RESET_WIZARD' }
  | { type: 'COMPLETE_WIZARD' }
  | { type: 'LOAD_SAVED_STATE'; payload: Partial<WizardState> }

// Initial state
const initialState: WizardState = {
  currentStep: 0,
  consultationData: {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false,
  },
  isComplete: false,
  sessionId: '',
}

// Wizard reducer
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: Math.max(0, action.payload),
      }
    
    case 'UPDATE_DATA':
      return {
        ...state,
        consultationData: {
          ...state.consultationData,
          ...action.payload,
        },
      }
    
    case 'RESET_WIZARD':
      return {
        ...initialState,
        sessionId: generateSessionId(),
      }
    
    case 'COMPLETE_WIZARD':
      return {
        ...state,
        isComplete: true,
      }
    
    case 'LOAD_SAVED_STATE':
      return {
        ...state,
        ...action.payload,
      }
    
    default:
      return state
  }
}

// Generate a unique session ID
function generateSessionId(): string {
  return `wizard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Context interface
interface WizardContextType {
  state: WizardState
  setStep: (step: number) => void
  updateData: (data: Partial<ConsultationData>) => void
  nextStep: () => void
  previousStep: () => void
  resetWizard: () => void
  completeWizard: () => void
  canProceed: (step?: number) => boolean
  getStepValidation: (step: number) => boolean
}

// Create context
const WizardContext = createContext<WizardContextType | undefined>(undefined)

// Storage key for persistence
const STORAGE_KEY = 'deck-wizard-state'

// Provider component
interface WizardProviderProps {
  children: React.ReactNode
  totalSteps: number
}

export const WizardProvider: React.FC<WizardProviderProps> = ({ 
  children, 
  totalSteps 
}) => {
  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialState,
    sessionId: generateSessionId(),
  })

  // Load saved state on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        dispatch({ type: 'LOAD_SAVED_STATE', payload: parsed })
      } catch (error) {
        console.warn('Failed to load saved wizard state:', error)
      }
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!state.isComplete) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } else {
      // Clear saved state when wizard is complete
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [state])

  // Step validation logic
  const getStepValidation = useCallback((step: number): boolean => {
    const { consultationData } = state
    
    switch (step) {
      case 0: // Commander step
        return consultationData.commander !== undefined || 
               consultationData.needsCommanderSuggestions !== undefined
      
      case 1: // Strategy step
        return !!consultationData.strategy
      
      case 2: // Budget step
        return consultationData.budget !== undefined
      
      case 3: // Power level step
        return consultationData.powerLevel !== undefined
      
      case 4: // Win conditions step
        return consultationData.winConditions?.primary !== undefined
      
      case 5: // Interaction step
        return consultationData.interaction?.level !== undefined
      
      case 6: // Restrictions step (always valid since restrictions are optional)
        return true
      
      case 7: // Complexity step
        return consultationData.complexityLevel !== undefined
      
      case 8: // Summary step (always valid if we reach it)
        return true
      
      default:
        return false
    }
  }, [state])

  const canProceed = useCallback((step?: number): boolean => {
    const currentStep = step ?? state.currentStep
    return getStepValidation(currentStep)
  }, [state.currentStep, getStepValidation])

  const setStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      dispatch({ type: 'SET_STEP', payload: step })
    }
  }, [totalSteps])

  const updateData = useCallback((data: Partial<ConsultationData>) => {
    dispatch({ type: 'UPDATE_DATA', payload: data })
  }, [])

  const nextStep = useCallback(() => {
    if (canProceed() && state.currentStep < totalSteps - 1) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep + 1 })
    }
  }, [canProceed, state.currentStep, totalSteps])

  const previousStep = useCallback(() => {
    if (state.currentStep > 0) {
      dispatch({ type: 'SET_STEP', payload: state.currentStep - 1 })
    }
  }, [state.currentStep])

  const resetWizard = useCallback(() => {
    dispatch({ type: 'RESET_WIZARD' })
  }, [])

  const completeWizard = useCallback(() => {
    dispatch({ type: 'COMPLETE_WIZARD' })
  }, [])

  const contextValue: WizardContextType = {
    state,
    setStep,
    updateData,
    nextStep,
    previousStep,
    resetWizard,
    completeWizard,
    canProceed,
    getStepValidation,
  }

  return (
    <WizardContext.Provider value={contextValue}>
      {children}
    </WizardContext.Provider>
  )
}

// Hook to use wizard context
export const useWizard = (): WizardContextType => {
  const context = useContext(WizardContext)
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}