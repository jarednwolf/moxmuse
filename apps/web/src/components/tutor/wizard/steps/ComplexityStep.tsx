'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'

interface ComplexityStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const complexityLevels = [
  {
    value: 'simple',
    label: 'Simple & Straightforward',
    description: 'Easy to pilot, clear game plan',
    details: 'Minimal complex interactions, straightforward win conditions, beginner-friendly',
    examples: 'Creature beatdown, simple tribal decks, basic ramp strategies',
    icon: '🎯',
    color: 'from-green-500 to-emerald-500'
  },
  {
    value: 'moderate',
    label: 'Moderate Complexity',
    description: 'Some decision points and synergies',
    details: 'Balanced mix of simple and complex cards, moderate decision-making required',
    examples: 'Value engines, moderate synergies, some stack interaction',
    icon: '⚖️',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    value: 'complex',
    label: 'High Complexity',
    description: 'Many decision points and interactions',
    details: 'Complex synergies, multiple lines of play, requires deep game knowledge',
    examples: 'Combo decks, heavy control, intricate engine pieces',
    icon: '🧩',
    color: 'from-purple-500 to-indigo-500'
  }
]

const decisionMakingPreferences = [
  {
    value: 'linear',
    label: 'Linear Game Plan',
    description: 'Clear, consistent strategy each game',
    details: 'Same general approach every game, predictable lines of play'
  },
  {
    value: 'adaptive',
    label: 'Adaptive Strategy',
    description: 'Adjust based on game state',
    details: 'Multiple viable strategies, adapt to opponents and board state'
  },
  {
    value: 'reactive',
    label: 'Reactive Play',
    description: 'Respond to opponents\' actions',
    details: 'Make decisions based on what opponents are doing'
  },
  {
    value: 'proactive',
    label: 'Proactive Play',
    description: 'Set the pace and force responses',
    details: 'Drive the game forward, make opponents react to you'
  }
]

const pilotingPreferences = [
  {
    value: 'autopilot',
    label: 'Autopilot Friendly',
    description: 'Plays itself with minimal decisions',
    icon: '🚗'
  },
  {
    value: 'guided',
    label: 'Guided Decisions',
    description: 'Clear optimal plays most of the time',
    icon: '🧭'
  },
  {
    value: 'flexible',
    label: 'Flexible Options',
    description: 'Multiple viable plays each turn',
    icon: '🔄'
  },
  {
    value: 'puzzle',
    label: 'Puzzle Solving',
    description: 'Complex optimization and sequencing',
    icon: '🧩'
  }
]

export const ComplexityStep: React.FC<ComplexityStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const handleComplexityLevel = (complexityLevel: 'simple' | 'moderate' | 'complex') => {
    onChange({ complexityLevel })
  }

  const handlePoliticsStyle = (style: 'diplomatic' | 'aggressive' | 'hidden' | 'chaotic') => {
    onChange({ 
      politics: { 
        ...data.politics,
        style,
        threatLevel: data.politics?.threatLevel || 'moderate'
      } 
    })
  }

  const handleThreatLevel = (threatLevel: 'low-profile' | 'moderate' | 'high-threat') => {
    onChange({ 
      politics: { 
        ...data.politics,
        style: data.politics?.style || 'diplomatic',
        threatLevel
      } 
    })
  }

  const canProceed = data.complexityLevel !== undefined

  return (
    <WizardStep
      title="Deck Complexity & Politics"
      description="How complex should your deck be to pilot, and how do you like to play politically?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={canProceed}
    >
      <div className="space-y-8">
        {/* Complexity level selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Deck Complexity</h3>
          <div className="space-y-4">
            {complexityLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => handleComplexityLevel(level.value as any)}
                className={`w-full p-5 rounded-xl border-2 transition-all text-left hover:scale-[1.01] group ${
                  data.complexityLevel === level.value
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${level.color} flex items-center justify-center text-white text-xl flex-shrink-0`}>
                    {level.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">
                      {level.label}
                    </h4>
                    <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors mb-2">
                      {level.description}
                    </p>
                    <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors mb-2">
                      {level.details}
                    </p>
                    <p className="text-xs text-zinc-600 group-hover:text-zinc-500 transition-colors italic">
                      Examples: {level.examples}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Political style */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Political Style</h3>
          <p className="text-sm text-zinc-400 mb-4">
            How do you like to interact with other players at the table?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                value: 'diplomatic',
                label: 'Diplomatic',
                description: 'Make deals and alliances',
                details: 'Negotiate, form temporary partnerships, mutual benefit'
              },
              {
                value: 'aggressive',
                label: 'Aggressive',
                description: 'Apply pressure consistently',
                details: 'Attack early and often, force opponents to react'
              },
              {
                value: 'hidden',
                label: 'Under the Radar',
                description: 'Stay quiet until you can win',
                details: 'Avoid attention, build up resources secretly'
              },
              {
                value: 'chaotic',
                label: 'Chaotic',
                description: 'Keep the game unpredictable',
                details: 'Random effects, shake up the game state'
              }
            ].map((style) => (
              <button
                key={style.value}
                onClick={() => handlePoliticsStyle(style.value as any)}
                className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                  data.politics?.style === style.value
                    ? 'border-purple-400 bg-purple-400/10'
                    : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                }`}
              >
                <h4 className="font-medium text-zinc-200 mb-1">{style.label}</h4>
                <p className="text-sm text-zinc-400 mb-2">{style.description}</p>
                <p className="text-xs text-zinc-500">{style.details}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Threat level */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Threat Level</h3>
          <p className="text-sm text-zinc-400 mb-4">
            How threatening do you want your deck to appear to opponents?
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                value: 'low-profile',
                label: 'Low Profile',
                description: 'Fly under the radar',
                details: 'Avoid scary cards, build up quietly'
              },
              {
                value: 'moderate',
                label: 'Moderate Threat',
                description: 'Balanced threat assessment',
                details: 'Some scary cards, but not the biggest threat'
              },
              {
                value: 'high-threat',
                label: 'High Threat',
                description: 'Embrace being the archenemy',
                details: 'Powerful cards, expect to be targeted'
              }
            ].map((threat) => (
              <button
                key={threat.value}
                onClick={() => handleThreatLevel(threat.value as any)}
                className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                  data.politics?.threatLevel === threat.value
                    ? 'border-purple-400 bg-purple-400/10'
                    : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                }`}
              >
                <h4 className="font-medium text-zinc-200 mb-1">{threat.label}</h4>
                <p className="text-sm text-zinc-400 mb-2">{threat.description}</p>
                <p className="text-xs text-zinc-500">{threat.details}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Complexity and politics summary */}
        {(data.complexityLevel || data.politics?.style) && (
          <div className="p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
            <h4 className="text-lg font-medium text-zinc-200 mb-3">Complexity & Politics Summary</h4>
            <div className="space-y-2 text-sm">
              {data.complexityLevel && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Complexity:</span> {
                    complexityLevels.find(l => l.value === data.complexityLevel)?.label
                  }
                </p>
              )}
              {data.politics?.style && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Political Style:</span> {
                    data.politics.style.charAt(0).toUpperCase() + data.politics.style.slice(1)
                  }
                </p>
              )}
              {data.politics?.threatLevel && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Threat Level:</span> {
                    data.politics.threatLevel.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')
                  }
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  )
}