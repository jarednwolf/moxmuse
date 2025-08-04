'use client'

import React, { useState } from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'
import { CommanderSelection } from '../../commander/CommanderSelection'

interface CommanderSelectionStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

export const CommanderSelectionStep: React.FC<CommanderSelectionStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const [sessionId] = useState(() => `commander-selection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  const handleCommanderSelect = (commanderName: string, colorIdentity?: string[]) => {
    onChange({ 
      commander: commanderName,
      commanderColors: colorIdentity 
    })
    // Auto-advance after selection
    setTimeout(onNext, 500)
  }

  // Only show this step if user requested commander suggestions
  if (!data.needsCommanderSuggestions) {
    // Skip this step and go to next
    setTimeout(onNext, 0)
    return null
  }

  return (
    <WizardStep
      title="Commander Selection"
      description="Choose from these AI-recommended commanders based on your preferences"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={!!data.commander}
      hideNextButton={true} // Commander selection will auto-advance
    >
      <CommanderSelection
        consultationData={data}
        onCommanderSelect={handleCommanderSelect}
        sessionId={sessionId}
      />
    </WizardStep>
  )
}