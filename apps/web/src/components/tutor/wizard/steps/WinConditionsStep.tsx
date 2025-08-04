'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'

interface WinConditionsStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const primaryWinConditions = [
  {
    value: 'combat',
    label: 'Combat Damage',
    description: 'Win through creature combat',
    details: 'Traditional creature-based strategies',
    icon: '⚔️',
    color: 'from-red-500 to-orange-500'
  },
  {
    value: 'combo',
    label: 'Combo',
    description: 'Win with card combinations',
    details: 'Assemble specific card interactions',
    icon: '⚙️',
    color: 'from-purple-500 to-blue-500'
  },
  {
    value: 'alternative',
    label: 'Alternative Win',
    description: 'Non-combat, non-combo wins',
    details: 'Mill, burn, or other unique conditions',
    icon: '🎯',
    color: 'from-green-500 to-teal-500'
  },
  {
    value: 'control',
    label: 'Control Victory',
    description: 'Win through inevitability',
    details: 'Control the game until victory is assured',
    icon: '🛡️',
    color: 'from-blue-500 to-indigo-500'
  }
]

const combatStyles = [
  { value: 'aggro', label: 'Aggressive Swarm', description: 'Many small creatures attacking quickly' },
  { value: 'voltron', label: 'Voltron', description: 'One big creature with equipment/auras' },
  { value: 'tokens', label: 'Token Army', description: 'Create many creature tokens' },
  { value: 'big-creatures', label: 'Big Creatures', description: 'Large individual threats' }
]

const comboTypes = [
  { value: 'infinite', label: 'Infinite Combos', description: 'Repeatable loops for instant wins' },
  { value: 'synergy', label: 'Synergy Combos', description: 'Powerful interactions between cards' },
  { value: 'engine', label: 'Engine Combos', description: 'Value engines that snowball to victory' }
]

export const WinConditionsStep: React.FC<WinConditionsStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const handlePrimaryWinCondition = (primary: 'combat' | 'combo' | 'alternative' | 'control') => {
    onChange({ 
      winConditions: { 
        ...data.winConditions,
        primary 
      } 
    })
  }

  const handleCombatStyle = (combatStyle: 'aggro' | 'voltron' | 'tokens' | 'big-creatures') => {
    onChange({ 
      winConditions: { 
        primary: 'combat', // Ensure primary is set when selecting combat style
        ...data.winConditions,
        combatStyle 
      } 
    })
  }

  const handleComboType = (comboType: 'infinite' | 'synergy' | 'engine') => {
    onChange({ 
      winConditions: { 
        primary: 'combo', // Ensure primary is set when selecting combo type
        ...data.winConditions,
        comboType 
      } 
    })
  }

  const canProceed = data.winConditions?.primary !== undefined

  return (
    <WizardStep
      title="Win Conditions"
      description="How do you want your deck to win games?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={canProceed}
    >
      <div className="space-y-8">
        {/* Primary win condition selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Primary Win Condition</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {primaryWinConditions.map((condition) => (
              <button
                key={condition.value}
                onClick={() => handlePrimaryWinCondition(condition.value as any)}
                className={`p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.02] group ${
                  data.winConditions?.primary === condition.value
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${condition.color} flex items-center justify-center text-white text-xl`}>
                    {condition.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">
                      {condition.label}
                    </h4>
                    <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors mb-2">
                      {condition.description}
                    </p>
                    <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                      {condition.details}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Combat style selection */}
        {data.winConditions?.primary === 'combat' && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-medium text-zinc-200">Combat Style</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {combatStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => handleCombatStyle(style.value as any)}
                  className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                    data.winConditions?.combatStyle === style.value
                      ? 'border-purple-400 bg-purple-400/10'
                      : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                  }`}
                >
                  <h4 className="font-medium text-zinc-200 mb-1">{style.label}</h4>
                  <p className="text-sm text-zinc-400">{style.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Combo type selection */}
        {data.winConditions?.primary === 'combo' && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-medium text-zinc-200">Combo Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {comboTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleComboType(type.value as any)}
                  className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                    data.winConditions?.comboType === type.value
                      ? 'border-purple-400 bg-purple-400/10'
                      : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                  }`}
                >
                  <h4 className="font-medium text-zinc-200 mb-1">{type.label}</h4>
                  <p className="text-sm text-zinc-400">{type.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Secondary win conditions */}
        {data.winConditions?.primary && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-medium text-zinc-200">Secondary Win Conditions</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Optional: What backup plans should your deck have?
            </p>
            <textarea
              placeholder="e.g., Commander damage, mill, burn, planeswalker ultimates"
              value={data.winConditions?.secondary?.join(', ') || ''}
              onChange={(e) => {
                const secondary = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0)
                onChange({ 
                  winConditions: { 
                    primary: data.winConditions?.primary || 'combat', // Ensure primary is set
                    ...data.winConditions,
                    secondary: secondary.length > 0 ? secondary : undefined
                  } 
                })
              }}
              className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all resize-none"
              rows={3}
            />
            <p className="text-xs text-zinc-500">
              Separate multiple win conditions with commas. Leave blank if you want to focus entirely on your primary win condition.
            </p>
          </div>
        )}

        {/* Win condition summary */}
        {data.winConditions?.primary && (
          <div className="p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
            <h4 className="text-lg font-medium text-zinc-200 mb-3">Win Condition Summary</h4>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                <span className="text-zinc-400">Primary:</span> {
                  primaryWinConditions.find(c => c.value === data.winConditions?.primary)?.label
                }
                {data.winConditions?.combatStyle && (
                  <span className="text-zinc-400"> ({
                    combatStyles.find(s => s.value === data.winConditions?.combatStyle)?.label
                  })</span>
                )}
                {data.winConditions?.comboType && (
                  <span className="text-zinc-400"> ({
                    comboTypes.find(t => t.value === data.winConditions?.comboType)?.label
                  })</span>
                )}
              </p>
              {data.winConditions?.secondary && data.winConditions.secondary.length > 0 && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Secondary:</span> {data.winConditions.secondary.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  )
}