'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'
import { HelpIcon } from '@/components/ui/tooltip'
import { WIZARD_HELP_CONTENT, STRATEGY_EXAMPLES } from '../help-content'

interface StrategyStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const strategies = [
  { 
    value: 'aggro', 
    label: 'Aggro', 
    description: 'Fast, aggressive gameplay',
    details: 'Win quickly with efficient creatures and combat damage',
    icon: '⚡'
  },
  { 
    value: 'control', 
    label: 'Control', 
    description: 'Counter and control the game',
    details: 'Use removal and counterspells to control the board',
    icon: '🛡️'
  },
  { 
    value: 'combo', 
    label: 'Combo', 
    description: 'Win with card combinations',
    details: 'Assemble powerful synergies for explosive turns',
    icon: '⚙️'
  },
  { 
    value: 'midrange', 
    label: 'Midrange', 
    description: 'Balanced approach',
    details: 'Flexible strategy adapting to the game state',
    icon: '⚖️'
  },
  { 
    value: 'tribal', 
    label: 'Tribal', 
    description: 'Creature type synergies',
    details: 'Focus on a specific creature type with tribal support',
    icon: '🦁'
  },
  { 
    value: 'value', 
    label: 'Value', 
    description: 'Card advantage and resources',
    details: 'Generate card advantage and out-resource opponents',
    icon: '📚'
  },
  { 
    value: 'stax', 
    label: 'Stax', 
    description: 'Resource denial and prison',
    details: 'Limit opponents\' resources while building advantage',
    icon: '🔒'
  },
]

export const StrategyStep: React.FC<StrategyStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  return (
    <WizardStep
      title="Deck Strategy"
      description="What type of strategy do you want your deck to focus on?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={!!data.strategy}
    >
      <div className="space-y-6">
        {/* Help content */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <HelpIcon content={
            <div className="space-y-2">
              <p className="font-medium">{WIZARD_HELP_CONTENT.strategy.title}</p>
              <p className="text-sm">{WIZARD_HELP_CONTENT.strategy.description}</p>
            </div>
          } />
          <span>Click for strategy guidance</span>
        </div>
        {/* Strategy grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <button
              key={strategy.value}
              onClick={() => {
                onChange({ strategy: strategy.value as any })
                setTimeout(onNext, 100)
              }}
              className={`p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.02] group ${
                data.strategy === strategy.value
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{strategy.icon}</span>
                  <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
                    {strategy.label}
                  </h3>
                </div>
                <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  {strategy.description}
                </p>
                <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {strategy.details}
                </p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Theme selection */}
        {data.strategy && (
          <div className="mt-8 p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-lg font-medium text-zinc-200 mb-4">Optional: Specific Themes</h4>
            <p className="text-sm text-zinc-400 mb-4">
              Do you have any specific themes or mechanics you'd like to focus on?
            </p>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="e.g., Artifacts, +1/+1 counters, Graveyard value"
                value={data.customTheme || ''}
                onChange={(e) => onChange({ customTheme: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all"
              />
              <p className="text-xs text-zinc-500">
                Leave blank if you want the AI to choose themes that work well with your strategy
              </p>
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  )
}