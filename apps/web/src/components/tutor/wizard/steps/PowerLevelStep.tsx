'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'
import { HelpIcon } from '@/components/ui/tooltip'
import { WIZARD_HELP_CONTENT, POWER_LEVEL_EXAMPLES } from '../help-content'

interface PowerLevelStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const powerLevels = [
  { 
    value: 1, 
    label: 'Casual', 
    description: 'Precon level, fun themes',
    details: 'Unmodified precons, janky combos, theme over power',
    examples: ['Unmodified preconstructed decks', 'Tribal themes with suboptimal cards', 'Fun interactions over efficiency'],
    icon: '🎲',
    color: 'from-green-500 to-emerald-500'
  },
  { 
    value: 2, 
    label: 'Focused', 
    description: 'Upgraded, clear strategy',
    details: 'Upgraded precons, focused game plan, some powerful cards',
    examples: ['Upgraded precons with clear win conditions', 'Focused strategy with good card selection', 'Some expensive cards but not optimized'],
    icon: '🎯',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    value: 3, 
    label: 'Optimized', 
    description: 'Efficient, competitive cards',
    details: 'Highly tuned, efficient cards, strong mana base',
    examples: ['Optimized card choices for strategy', 'Efficient mana base with fetches/shocks', 'Fast, consistent game plan'],
    icon: '⚡',
    color: 'from-orange-500 to-red-500'
  },
  { 
    value: 4, 
    label: 'High Power', 
    description: 'Fast combos, powerful cards',
    details: 'cEDH adjacent, fast combos, maximum efficiency',
    examples: ['Turn 3-4 consistent wins', 'Expensive staples and fast mana', 'Interaction and protection heavy'],
    icon: '💎',
    color: 'from-purple-500 to-pink-500'
  },
]

export const PowerLevelStep: React.FC<PowerLevelStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  return (
    <WizardStep
      title="Power Level"
      description="What power level are you targeting for your playgroup?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={data.powerLevel !== undefined}
    >
      <div className="space-y-6">
        {/* Help content */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <HelpIcon content={
            <div className="space-y-2">
              <p className="font-medium">{WIZARD_HELP_CONTENT.powerLevel.title}</p>
              <p className="text-sm">{WIZARD_HELP_CONTENT.powerLevel.description}</p>
            </div>
          } />
          <span>Click for power level guidance</span>
        </div>
        
        {/* Power level cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {powerLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => {
                onChange({ powerLevel: level.value })
                setTimeout(onNext, 100)
              }}
              className={`p-6 rounded-xl border-2 transition-all text-left hover:scale-[1.02] group ${
                data.powerLevel === level.value
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${level.color} flex items-center justify-center text-white text-xl`}>
                    {level.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-white transition-colors">
                      Level {level.value}: {level.label}
                    </h3>
                    <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                      {level.description}
                    </p>
                  </div>
                </div>
                
                {/* Details */}
                <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {level.details}
                </p>
                
                {/* Examples */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Examples:
                  </h4>
                  <ul className="space-y-1">
                    {level.examples.map((example, index) => (
                      <li key={index} className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors flex items-start gap-2">
                        <span className="text-zinc-600 mt-1">•</span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {/* Power level explanation */}
        <div className="max-w-3xl mx-auto p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
          <h4 className="text-lg font-medium text-zinc-200 mb-3">Understanding Power Levels</h4>
          <div className="space-y-3 text-sm text-zinc-400">
            <p>
              Power level helps match your deck to your playgroup's expectations. Consider:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-1">•</span>
                <span><strong className="text-zinc-300">Turn count:</strong> How quickly does your playgroup typically win?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-1">•</span>
                <span><strong className="text-zinc-300">Budget:</strong> What's the typical deck value in your group?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-1">•</span>
                <span><strong className="text-zinc-300">Interaction:</strong> How much removal and counterspells are common?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-600 mt-1">•</span>
                <span><strong className="text-zinc-300">Combos:</strong> Are infinite combos accepted or frowned upon?</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Selected power level display */}
        {data.powerLevel && (
          <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-300">
              Target power level: <span className="font-semibold">
                Level {data.powerLevel} - {powerLevels.find(l => l.value === data.powerLevel)?.label}
              </span>
            </p>
          </div>
        )}
      </div>
    </WizardStep>
  )
}