'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'
import { Edit, User, Target, DollarSign, Zap, Swords, Shield, Ban, Settings } from 'lucide-react'

interface SummaryStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext?: () => void
  onBack: () => void
  onComplete: () => void
  isFirstStep: boolean
  onEditStep: (step: number) => void
}

export const SummaryStep: React.FC<SummaryStepProps> = ({ 
  data, 
  onChange, 
  onBack, 
  onComplete,
  isFirstStep,
  onEditStep
}) => {
  const formatBudget = (budget?: number) => {
    if (!budget) return 'No budget specified'
    return `$${budget.toLocaleString()}`
  }

  const formatPowerLevel = (level?: number) => {
    if (!level) return 'Not specified'
    const levels = ['', 'Casual (1)', 'Focused (2)', 'Optimized (3)', 'Competitive (4)']
    return levels[level] || 'Unknown'
  }

  const formatWinConditions = (winConditions?: ConsultationData['winConditions']) => {
    if (!winConditions?.primary) return 'Not specified'
    
    let result = winConditions.primary.charAt(0).toUpperCase() + winConditions.primary.slice(1)
    
    if (winConditions.combatStyle) {
      result += ` (${winConditions.combatStyle})`
    }
    if (winConditions.comboType) {
      result += ` (${winConditions.comboType})`
    }
    
    return result
  }

  const formatInteraction = (interaction?: ConsultationData['interaction']) => {
    if (!interaction?.level) return 'Not specified'
    
    let result = interaction.level.charAt(0).toUpperCase() + interaction.level.slice(1)
    if (interaction.timing) {
      result += ` (${interaction.timing})`
    }
    
    return result
  }

  const formatComplexity = (complexity?: string) => {
    if (!complexity) return 'Not specified'
    return complexity.charAt(0).toUpperCase() + complexity.slice(1)
  }

  const formatPolitics = (politics?: ConsultationData['politics']) => {
    if (!politics?.style) return 'Not specified'
    
    let result = politics.style.charAt(0).toUpperCase() + politics.style.slice(1)
    if (politics.threatLevel) {
      const threatLevel = politics.threatLevel.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
      result += ` (${threatLevel})`
    }
    
    return result
  }

  const summaryItems = [
    {
      icon: User,
      title: 'Commander',
      value: data.commander || (data.needsCommanderSuggestions ? 'Will be suggested' : 'Not specified'),
      stepIndex: 0,
      color: 'text-purple-400'
    },
    {
      icon: Target,
      title: 'Strategy',
      value: data.strategy ? data.strategy.charAt(0).toUpperCase() + data.strategy.slice(1) : 'Not specified',
      stepIndex: 1,
      color: 'text-blue-400'
    },
    {
      icon: DollarSign,
      title: 'Budget',
      value: formatBudget(data.budget),
      stepIndex: 2,
      color: 'text-green-400'
    },
    {
      icon: Zap,
      title: 'Power Level',
      value: formatPowerLevel(data.powerLevel),
      stepIndex: 3,
      color: 'text-yellow-400'
    },
    {
      icon: Target,
      title: 'Win Conditions',
      value: formatWinConditions(data.winConditions),
      stepIndex: 4,
      color: 'text-red-400'
    },
    {
      icon: Swords,
      title: 'Interaction',
      value: formatInteraction(data.interaction),
      stepIndex: 5,
      color: 'text-orange-400'
    },
    {
      icon: Ban,
      title: 'Restrictions',
      value: (data.avoidStrategies?.length || 0) + (data.avoidCards?.length || 0) > 0 
        ? `${(data.avoidStrategies?.length || 0) + (data.avoidCards?.length || 0)} restrictions`
        : 'No restrictions',
      stepIndex: 6,
      color: 'text-red-400'
    },
    {
      icon: Settings,
      title: 'Complexity',
      value: formatComplexity(data.complexityLevel),
      stepIndex: 7,
      color: 'text-indigo-400'
    }
  ]

  return (
    <WizardStep
      title="Deck Building Summary"
      description="Review your preferences before generating your deck"
      onBack={onBack}
      onComplete={onComplete}
      completeLabel="Generate Deck"
      isFirstStep={isFirstStep}
      isLastStep={true}
      canProceed={true}
    >
      <div className="space-y-6">
        {/* Summary grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryItems.map((item, index) => {
            const IconComponent = item.icon
            return (
              <div
                key={index}
                className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-zinc-600/50 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <IconComponent className={`w-5 h-5 ${item.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <h4 className="font-medium text-zinc-200 mb-1">{item.title}</h4>
                      <p className="text-sm text-zinc-400">{item.value}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onEditStep(item.stepIndex)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-300"
                    title="Edit this section"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detailed sections */}
        <div className="space-y-6">
          {/* Themes */}
          {(data.themes && data.themes.length > 0) && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-2">Themes</h4>
              <div className="flex flex-wrap gap-2">
                {data.themes.map((theme, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-full text-sm"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Win conditions details */}
          {data.winConditions?.secondary && data.winConditions.secondary.length > 0 && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-2">Secondary Win Conditions</h4>
              <p className="text-sm text-zinc-400">{data.winConditions.secondary.join(', ')}</p>
            </div>
          )}

          {/* Interaction types */}
          {data.interaction?.types && data.interaction.types.length > 0 && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-2">Interaction Types</h4>
              <div className="flex flex-wrap gap-2">
                {data.interaction.types.map((type, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded-full text-sm"
                  >
                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Restrictions */}
          {((data.avoidStrategies && data.avoidStrategies.length > 0) || 
            (data.avoidCards && data.avoidCards.length > 0)) && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-3">Restrictions</h4>
              <div className="space-y-3">
                {data.avoidStrategies && data.avoidStrategies.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-zinc-300 mb-2">Avoided Strategies</h5>
                    <div className="flex flex-wrap gap-2">
                      {data.avoidStrategies.map((strategy, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-300 rounded-full text-sm"
                        >
                          {strategy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {data.avoidCards && data.avoidCards.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-zinc-300 mb-2">Avoided Cards</h5>
                    <div className="flex flex-wrap gap-2">
                      {data.avoidCards.map((card, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-300 rounded-full text-sm"
                        >
                          {card}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pet cards */}
          {data.petCards && data.petCards.length > 0 && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-2">Pet Cards</h4>
              <div className="flex flex-wrap gap-2">
                {data.petCards.map((card, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-300 rounded-full text-sm"
                  >
                    {card}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Collection usage */}
          {data.useCollection && (
            <div className="p-4 bg-zinc-800/20 rounded-lg border border-zinc-700/30">
              <h4 className="font-medium text-zinc-200 mb-2">Collection Usage</h4>
              <p className="text-sm text-zinc-400">
                Will prioritize cards from your collection when possible
              </p>
            </div>
          )}
        </div>

        {/* Generation note */}
        <div className="p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
          <h4 className="font-medium text-zinc-200 mb-2">Ready to Generate</h4>
          <p className="text-sm text-zinc-400 mb-4">
            Your deck will be generated based on these preferences. The AI will create a complete 100-card deck 
            that matches your strategy, budget, and constraints.
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            This process typically takes 30-60 seconds
          </div>
        </div>
      </div>
    </WizardStep>
  )
}