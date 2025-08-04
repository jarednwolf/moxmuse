'use client'

import { useState } from 'react'
import { Sparkles, Loader2, ArrowRight, Lightbulb } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { isFeatureEnabled } from '@moxmuse/shared'
import { generateSessionId } from '@moxmuse/shared'

interface NaturalLanguageVisionProps {
  onVisionParsed: (parsedData: any) => void
  onStartBuilding: (visionText: string, sessionId: string) => void
}

export function NaturalLanguageVision({ onVisionParsed, onStartBuilding }: NaturalLanguageVisionProps) {
  const [visionText, setVisionText] = useState('')
  const [sessionId] = useState(() => generateSessionId())
  const [showExamples, setShowExamples] = useState(false)

  const parseVisionMutation = trpc.tutor.parseNaturalLanguageVision.useMutation({
    onSuccess: (data) => {
      onVisionParsed(data)
      onStartBuilding(visionText, sessionId)
    },
    onError: (error) => {
      console.error('Vision parsing error:', error)
      // Fallback to direct building if parsing fails
      onStartBuilding(visionText, sessionId)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!visionText.trim()) return

    if (isFeatureEnabled('NATURAL_LANGUAGE_VISION')) {
      parseVisionMutation.mutate({
        visionText: visionText.trim(),
        sessionId
      })
    } else {
      // Fallback to direct building
      onStartBuilding(visionText, sessionId)
    }
  }

  const exampleVisions = [
    "I want a Vampire tribal deck that's aggressive but can also do politics. Budget around $300, power level 3-4.",
    "Build me a Simic ramp deck that wins with big creatures. I love Hydras and want to include Doubling Season.",
    "I need a control deck in Esper colors that can counter spells early and win with a few big threats late game.",
    "Create a Gruul deck focused on fighting and dealing damage when creatures die. Include Fling effects.",
    "I want to build around Meren of Clan Nel Toth with a sacrifice/recursion theme. Moderate budget."
  ]

  if (!isFeatureEnabled('NATURAL_LANGUAGE_VISION')) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/80 to-blue-500/80 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-light mb-4 text-white drop-shadow-lg">
          Describe your perfect deck
        </h2>
        <p className="text-zinc-200 text-lg drop-shadow">
          Tell me about your deck vision in natural language - commander, strategy, budget, power level, or any special preferences
        </p>
      </div>

      {/* Main Input */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <textarea
            value={visionText}
            onChange={(e) => setVisionText(e.target.value)}
            placeholder="I want to build a deck that..."
            className="w-full h-32 rounded-xl bg-zinc-800/70 backdrop-blur-sm border border-zinc-600/50 py-4 px-6 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100 resize-none"
            disabled={parseVisionMutation.isLoading}
          />
          <button
            type="submit"
            disabled={!visionText.trim() || parseVisionMutation.isLoading}
            className="absolute bottom-3 right-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {parseVisionMutation.isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                Build My Deck
              </>
            )}
          </button>
        </div>
      </form>

      {/* Examples Section */}
      <div className="text-center">
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="flex items-center gap-2 mx-auto text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
        >
          <Lightbulb className="w-4 h-4" />
          {showExamples ? 'Hide examples' : 'Need inspiration? See examples'}
        </button>
        
        {showExamples && (
          <div className="mt-6 grid gap-3 max-w-2xl mx-auto">
            {exampleVisions.map((example, index) => (
              <button
                key={index}
                onClick={() => setVisionText(example)}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 text-sm text-zinc-300"
              >
                "{example}"
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feature Badge */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-300">
          <Sparkles className="w-3 h-3" />
          Natural Language Vision - Beta
        </div>
      </div>
    </div>
  )
}
