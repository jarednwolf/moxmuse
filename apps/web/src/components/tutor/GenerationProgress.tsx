'use client'

import React from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { Sparkles, Loader2, Wand2, Brain, BarChart3, CheckCircle } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'

interface GenerationProgressProps {
  phase: string
  description: string
  progress: number
  isGenerating: boolean
  commander: string
  consultationData: ConsultationData
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  phase,
  description,
  progress,
  isGenerating,
  commander,
  consultationData
}) => {
  const { isMobile, isTablet } = useMobile()

  const getPhaseIcon = (phaseName: string) => {
    const iconSize = isMobile ? 'w-4 h-4' : 'w-5 h-5'
    switch (phaseName) {
      case 'Analyzing Strategy':
        return <Brain className={iconSize} />
      case 'Generating Cards':
        return <Wand2 className={iconSize} />
      case 'Assembling Deck':
        return <Sparkles className={iconSize} />
      case 'Calculating Statistics':
        return <BarChart3 className={iconSize} />
      case 'Finalizing':
        return <CheckCircle className={iconSize} />
      default:
        return <Loader2 className={`${iconSize} animate-spin`} />
    }
  }

  const formatStrategy = (strategy?: string) => {
    if (!strategy) return 'Custom Strategy'
    return strategy.charAt(0).toUpperCase() + strategy.slice(1)
  }

  const formatBudget = (budget?: number) => {
    if (!budget) return isMobile ? 'No limit' : 'No budget limit'
    return isMobile ? `$${budget}` : `$${budget} budget`
  }

  const formatPowerLevel = (powerLevel?: number) => {
    if (!powerLevel) return isMobile ? 'Bracket 3' : 'Bracket 3'
    const brackets = ['', 'Precon', 'Focused', 'Optimized', 'High Power']
    return isMobile 
      ? `Bracket ${powerLevel}` 
      : `Bracket ${powerLevel} (${brackets[powerLevel] || 'Custom'})`
  }

  return (
    <div className={`w-full mx-auto px-4 sm:px-0 ${isMobile ? 'max-w-sm' : 'max-w-2xl'}`}>
      {/* Header */}
      <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
        <div className={`bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/30 ${
          isMobile ? 'w-12 h-12' : 'w-16 h-16'
        }`}>
          <Sparkles className={`text-purple-400 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
        </div>
        <h2 className={`font-bold text-zinc-100 mb-2 ${
          isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl'
        }`}>
          Building Your Commander Deck
        </h2>
        <p className={`text-zinc-400 ${isMobile ? 'text-sm px-2' : 'text-base'}`}>
          Creating a complete 100-card Commander deck with {commander}
        </p>
      </div>

      {/* Deck Summary */}
      <div className={`bg-zinc-800/60 backdrop-blur-sm rounded-xl border border-zinc-700/50 ${
        isMobile ? 'p-4 mb-6' : 'p-6 mb-8'
      }`}>
        <h3 className={`font-semibold text-zinc-100 mb-4 ${
          isMobile ? 'text-base' : 'text-lg'
        }`}>
          {isMobile ? 'Deck Config' : 'Commander Deck Configuration'}
        </h3>
        <div className={`grid gap-3 ${
          isMobile ? 'grid-cols-1 text-sm' : 'grid-cols-1 md:grid-cols-2 gap-4 text-sm'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0"></div>
            <span className="text-zinc-300">Commander:</span>
            <span className="text-zinc-100 font-medium truncate">{commander}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
            <span className="text-zinc-300">Strategy:</span>
            <span className="text-zinc-100 font-medium">{formatStrategy(consultationData.strategy)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
            <span className="text-zinc-300">Power Level:</span>
            <span className="text-zinc-100 font-medium">{formatPowerLevel(consultationData.powerLevel)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></div>
            <span className="text-zinc-300">Budget:</span>
            <span className="text-zinc-100 font-medium">{formatBudget(consultationData.budget)}</span>
          </div>
          {consultationData.themes && consultationData.themes.length > 0 && (
            <div className={`flex items-center gap-3 ${isMobile ? '' : 'md:col-span-2'}`}>
              <div className="w-2 h-2 bg-pink-400 rounded-full flex-shrink-0"></div>
              <span className="text-zinc-300">Themes:</span>
              <span className="text-zinc-100 font-medium truncate">
                {consultationData.themes.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className={`bg-zinc-800/60 backdrop-blur-sm rounded-xl border border-zinc-700/50 ${
        isMobile ? 'p-4' : 'p-6'
      }`}>
        {/* Current Phase */}
        <div className={`flex items-center gap-3 ${isMobile ? 'mb-4' : 'mb-6'}`}>
          <div className={`bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center border border-purple-500/30 ${
            isMobile ? 'w-8 h-8' : 'w-10 h-10'
          }`}>
            {isGenerating ? (
              <Loader2 className={`animate-spin text-purple-400 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
            ) : (
              <div className="text-purple-400">
                {getPhaseIcon(phase)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-zinc-100 ${isMobile ? 'text-sm' : 'text-lg'}`}>
              {phase}
            </h3>
            <p className={`text-zinc-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {description}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className={`flex items-center justify-between text-zinc-400 mb-2 ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className={`w-full bg-zinc-700/50 rounded-full overflow-hidden ${
            isMobile ? 'h-2' : 'h-2'
          }`}>
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Phase Steps */}
        <div className={`space-y-2 ${isMobile ? 'space-y-1.5' : ''}`}>
          {[
            { name: 'Analyzing Strategy', completed: progress > 10 },
            { name: 'Generating Cards', completed: progress > 30 },
            { name: 'Assembling Deck', completed: progress > 60 },
            { name: 'Calculating Statistics', completed: progress > 80 },
            { name: 'Finalizing', completed: progress >= 100 }
          ].map((step, index) => (
            <div key={index} className={`flex items-center gap-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              <div className={`rounded-full flex items-center justify-center ${
                isMobile ? 'w-3 h-3' : 'w-4 h-4'
              } ${
                step.completed 
                  ? 'bg-green-500/20 border border-green-500/50' 
                  : step.name === phase
                    ? 'bg-purple-500/20 border border-purple-500/50'
                    : 'bg-zinc-700/50 border border-zinc-600/50'
              }`}>
                {step.completed ? (
                  <CheckCircle className={`text-green-400 ${isMobile ? 'w-2 h-2' : 'w-3 h-3'}`} />
                ) : step.name === phase ? (
                  <Loader2 className={`animate-spin text-purple-400 ${isMobile ? 'w-2 h-2' : 'w-3 h-3'}`} />
                ) : (
                  <div className={`bg-zinc-500 rounded-full ${isMobile ? 'w-1 h-1' : 'w-2 h-2'}`} />
                )}
              </div>
              <span className={`${
                step.completed 
                  ? 'text-green-300' 
                  : step.name === phase
                    ? 'text-purple-300'
                    : 'text-zinc-400'
              }`}>
                {step.name}
              </span>
            </div>
          ))}
        </div>

        {/* Estimated Time */}
        {isGenerating && (
          <div className={`bg-zinc-900/60 rounded-lg border border-zinc-700/50 ${
            isMobile ? 'mt-4 p-3' : 'mt-6 p-3'
          }`}>
            <div className={`flex items-center gap-2 text-zinc-400 ${
              isMobile ? 'text-xs' : 'text-sm'
            }`}>
              <Loader2 className={`animate-spin ${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
              <span>{isMobile ? 'Usually 30-60 seconds...' : 'This usually takes 30-60 seconds...'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}