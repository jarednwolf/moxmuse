'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardContainer } from './WizardContainer'
import { WizardProgress } from './WizardProgress'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useErrorToast, useSuccessToast } from '@/components/ui/toaster'

// Import step components
import { CommanderStep } from './steps/CommanderStep'
import { CommanderSelectionStep } from './steps/CommanderSelectionStep'
import { StrategyStep } from './steps/StrategyStep'
import { BudgetStep } from './steps/BudgetStep'
import { PowerLevelStep } from './steps/PowerLevelStep'
import { WinConditionsStep } from './steps/WinConditionsStep'
import { InteractionStep } from './steps/InteractionStep'
import { RestrictionsStep } from './steps/RestrictionsStep'
import { ComplexityStep } from './steps/ComplexityStep'
import { SummaryStep } from './steps/SummaryStep'

// Step components interface
interface StepComponentProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  onComplete?: () => void
  onEditStep?: (step: number) => void
  isFirstStep: boolean
  isLastStep: boolean
}

interface DeckBuildingWizardProps {
  onComplete: (data: ConsultationData) => void
  onBack: () => void
  initialData?: Partial<ConsultationData>
}

export const DeckBuildingWizard: React.FC<DeckBuildingWizardProps> = ({
  onComplete,
  onBack,
  initialData = {}
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [consultationData, setConsultationData] = useState<ConsultationData>({
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false,
    ...initialData
  })

  const errorToast = useErrorToast()
  const successToast = useSuccessToast()

  // Step configuration - includes all wizard steps
  const steps = [
    { component: CommanderStep, title: 'Commander' },
    { component: CommanderSelectionStep, title: 'Commander Selection' },
    { component: StrategyStep, title: 'Strategy' },
    { component: BudgetStep, title: 'Budget' },
    { component: PowerLevelStep, title: 'Power Level' },
    { component: WinConditionsStep, title: 'Win Conditions' },
    { component: InteractionStep, title: 'Interaction' },
    { component: RestrictionsStep, title: 'Restrictions' },
    { component: ComplexityStep, title: 'Complexity' },
    { component: SummaryStep, title: 'Summary' },
  ]

  const stepTitles = steps.map(step => step.title)

  // Data persistence - save to localStorage on changes
  useEffect(() => {
    try {
      const sessionKey = 'wizard-consultation-data'
      localStorage.setItem(sessionKey, JSON.stringify(consultationData))
    } catch (error) {
      console.warn('Failed to save wizard data:', error)
      errorToast(
        'Save Failed',
        'Unable to save your progress. Your data may be lost if you refresh the page.'
      )
    }
  }, [consultationData, errorToast])

  // Load saved data on mount
  useEffect(() => {
    try {
      const sessionKey = 'wizard-consultation-data'
      const saved = localStorage.getItem(sessionKey)
      if (saved) {
        const parsedData = JSON.parse(saved)
        setConsultationData(prev => ({ ...prev, ...parsedData }))
        successToast('Progress Restored', 'Your previous wizard progress has been restored')
      }
    } catch (error) {
      console.warn('Failed to load saved wizard data:', error)
      errorToast(
        'Load Failed',
        'Unable to restore your previous progress. Starting fresh.'
      )
    }
  }, [errorToast, successToast])

  const handleDataChange = useCallback((newData: Partial<ConsultationData>) => {
    setConsultationData(prev => ({ ...prev, ...newData }))
  }, [])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, steps.length])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleComplete = useCallback(() => {
    try {
      // Clear saved data on completion
      localStorage.removeItem('wizard-consultation-data')
      successToast('Wizard Complete', 'Your preferences have been saved. Starting deck generation...')
      onComplete(consultationData)
    } catch (error) {
      console.error('Error completing wizard:', error)
      errorToast(
        'Completion Failed',
        'There was an error completing the wizard. Please try again.'
      )
    }
  }, [consultationData, onComplete, successToast, errorToast])

  const handleEditStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex)
    }
  }, [steps.length])

  const CurrentStepComponent = steps[currentStep].component

  return (
    <ErrorBoundary 
      context="Deck Building Wizard"
      onError={(error, errorInfo) => {
        console.error('Wizard error:', error, errorInfo)
        errorToast(
          'Wizard Error',
          'Something went wrong with the wizard. Your progress has been saved.',
          {
            label: 'Reload',
            onClick: () => window.location.reload()
          }
        )
      }}
    >
      <WizardContainer onBack={onBack}>
        <WizardProgress
          currentStep={currentStep}
          totalSteps={steps.length}
          stepTitles={stepTitles}
        />
        
        <ErrorBoundary 
          context={`Wizard Step: ${steps[currentStep].title}`}
          fallback={(error, retry) => (
            <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-medium text-red-300">Step Error</h3>
                <p className="text-sm text-red-200/80">
                  There was an error with the {steps[currentStep].title} step.
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={retry}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium"
                  >
                    Retry Step
                  </button>
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-4 py-2 border border-red-500/30 text-red-300 hover:bg-red-900/30 rounded-lg text-sm font-medium"
                    >
                      Previous Step
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        >
          <CurrentStepComponent
            data={consultationData}
            onChange={handleDataChange}
            onNext={handleNext}
            onBack={handleBack}
            onComplete={handleComplete}
            onEditStep={handleEditStep}
            isFirstStep={currentStep === 0}
          />
        </ErrorBoundary>
      </WizardContainer>
    </ErrorBoundary>
  )
}