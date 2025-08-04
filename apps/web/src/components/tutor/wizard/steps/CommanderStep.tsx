'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'

interface CommanderStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

export const CommanderStep: React.FC<CommanderStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  return (
    <WizardStep
      title="Commander Selection"
      description="Do you know which commander you want to use for your deck?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={data.commander !== undefined || data.needsCommanderSuggestions !== undefined}
    >
      <div className="space-y-6">
        {/* Commander choice buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              onChange({ needsCommanderSuggestions: false })
              // Auto-advance after selection
              setTimeout(onNext, 100)
            }}
            className={`p-6 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
              data.needsCommanderSuggestions === false
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">I know my commander</h3>
                <p className="text-sm text-zinc-400">I already have a specific legendary creature in mind</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => {
              onChange({ needsCommanderSuggestions: true })
              setTimeout(onNext, 100)
            }}
            className={`p-6 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
              data.needsCommanderSuggestions === true
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                ?
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">Help me choose</h3>
                <p className="text-sm text-zinc-400">I'd like AI recommendations for commanders</p>
              </div>
            </div>
          </button>
        </div>
        
        {/* Commander input field */}
        {data.needsCommanderSuggestions === false && (
          <div className="mt-6 animate-in slide-in-from-top-4 duration-300">
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Commander Name
            </label>
            <input
              type="text"
              placeholder="e.g., Atraxa, Praetors' Voice"
              value={data.commander || ''}
              onChange={(e) => onChange({ commander: e.target.value })}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all"
              autoFocus
            />
            <p className="text-xs text-zinc-500 mt-2">
              Enter the full name of your commander as it appears on the card
            </p>
          </div>
        )}
        
        {/* Help text for AI suggestions */}
        {data.needsCommanderSuggestions === true && (
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in slide-in-from-top-4 duration-300">
            <p className="text-sm text-blue-300">
              Great! We'll suggest commanders based on your strategy preferences in the next steps.
            </p>
          </div>
        )}
      </div>
    </WizardStep>
  )
}