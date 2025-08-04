'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'

interface InteractionStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const interactionLevels = [
  {
    value: 'low',
    label: 'Low Interaction',
    description: 'Focus on your own game plan',
    details: 'Minimal removal and counterspells, prioritize proactive plays',
    icon: '🎯',
    color: 'from-green-500 to-emerald-500'
  },
  {
    value: 'medium',
    label: 'Balanced Interaction',
    description: 'Mix of threats and answers',
    details: 'Moderate removal and interaction to handle key threats',
    icon: '⚖️',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    value: 'high',
    label: 'High Interaction',
    description: 'Control the game state',
    details: 'Plenty of removal, counterspells, and reactive plays',
    icon: '🛡️',
    color: 'from-purple-500 to-indigo-500'
  }
]

const interactionTypes = [
  { value: 'creature-removal', label: 'Creature Removal', description: 'Destroy or exile creatures' },
  { value: 'artifact-enchantment', label: 'Artifact/Enchantment Removal', description: 'Deal with problematic permanents' },
  { value: 'counterspells', label: 'Counterspells', description: 'Counter spells on the stack' },
  { value: 'board-wipes', label: 'Board Wipes', description: 'Clear multiple threats at once' },
  { value: 'hand-disruption', label: 'Hand Disruption', description: 'Discard and hand attack' },
  { value: 'graveyard-hate', label: 'Graveyard Hate', description: 'Prevent graveyard strategies' },
  { value: 'combo-disruption', label: 'Combo Disruption', description: 'Stop infinite combos' },
  { value: 'protection', label: 'Protection', description: 'Protect your own threats' }
]

const timingOptions = [
  {
    value: 'proactive',
    label: 'Proactive',
    description: 'Act on your turn, set the pace',
    details: 'Sorcery-speed removal, main phase plays'
  },
  {
    value: 'reactive',
    label: 'Reactive',
    description: 'Respond to threats as they appear',
    details: 'Instant-speed responses, counterspells'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Mix of proactive and reactive plays',
    details: 'Flexible timing based on situation'
  }
]

export const InteractionStep: React.FC<InteractionStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const handleInteractionLevel = (level: 'low' | 'medium' | 'high') => {
    onChange({ 
      interaction: { 
        ...data.interaction,
        level,
        types: data.interaction?.types || [],
        timing: data.interaction?.timing || 'balanced'
      } 
    })
  }

  const handleInteractionTypes = (type: string) => {
    const currentTypes = data.interaction?.types || []
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type]
    
    onChange({ 
      interaction: { 
        ...data.interaction,
        level: data.interaction?.level || 'medium',
        types: newTypes,
        timing: data.interaction?.timing || 'balanced'
      } 
    })
  }

  const handleTiming = (timing: 'proactive' | 'reactive' | 'balanced') => {
    onChange({ 
      interaction: { 
        ...data.interaction,
        level: data.interaction?.level || 'medium',
        types: data.interaction?.types || [],
        timing
      } 
    })
  }

  const canProceed = data.interaction?.level !== undefined

  return (
    <WizardStep
      title="Interaction Preferences"
      description="How much do you want to interact with opponents' strategies?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={canProceed}
    >
      <div className="space-y-8">
        {/* Interaction level selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Interaction Level</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {interactionLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => handleInteractionLevel(level.value as any)}
                className={`p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.02] group ${
                  data.interaction?.level === level.value
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                }`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${level.color} flex items-center justify-center text-white text-xl`}>
                    {level.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">
                      {level.label}
                    </h4>
                    <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors mb-2">
                      {level.description}
                    </p>
                    <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                      {level.details}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Interaction types selection */}
        {data.interaction?.level && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-medium text-zinc-200">Types of Interaction</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Select the types of interaction you want in your deck (choose multiple):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {interactionTypes.map((type) => {
                const isSelected = data.interaction?.types?.includes(type.value) || false
                return (
                  <button
                    key={type.value}
                    onClick={() => handleInteractionTypes(type.value)}
                    className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                      isSelected
                        ? 'border-purple-400 bg-purple-400/10'
                        : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 transition-all ${
                        isSelected 
                          ? 'bg-purple-500 border-purple-500' 
                          : 'border-zinc-500'
                      }`}>
                        {isSelected && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-zinc-200 mb-1">{type.label}</h4>
                        <p className="text-sm text-zinc-400">{type.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Timing preference */}
        {data.interaction?.level && (
          <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-medium text-zinc-200">Interaction Timing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {timingOptions.map((timing) => (
                <button
                  key={timing.value}
                  onClick={() => handleTiming(timing.value as any)}
                  className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                    data.interaction?.timing === timing.value
                      ? 'border-purple-400 bg-purple-400/10'
                      : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                  }`}
                >
                  <h4 className="font-medium text-zinc-200 mb-1">{timing.label}</h4>
                  <p className="text-sm text-zinc-400 mb-2">{timing.description}</p>
                  <p className="text-xs text-zinc-500">{timing.details}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interaction summary */}
        {data.interaction?.level && (
          <div className="p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
            <h4 className="text-lg font-medium text-zinc-200 mb-3">Interaction Summary</h4>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                <span className="text-zinc-400">Level:</span> {
                  interactionLevels.find(l => l.value === data.interaction?.level)?.label
                }
              </p>
              {data.interaction?.types && data.interaction.types.length > 0 && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Types:</span> {
                    data.interaction.types.map(type => 
                      interactionTypes.find(t => t.value === type)?.label
                    ).join(', ')
                  }
                </p>
              )}
              <p className="text-zinc-300">
                <span className="text-zinc-400">Timing:</span> {
                  timingOptions.find(t => t.value === data.interaction?.timing)?.label
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  )
}