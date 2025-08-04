'use client'

import React from 'react'
import { Loader2, ChevronRight, RefreshCw } from 'lucide-react'
import type { CommanderRecommendation } from '@moxmuse/shared'

interface CommanderSelectionGridProps {
  commanders: CommanderRecommendation[]
  onCommanderSelect: (commanderName: string) => void
  sessionId: string
  isLoading: boolean
  onRequestMore: () => void
}

export function CommanderSelectionGrid({
  commanders,
  onCommanderSelect,
  sessionId,
  isLoading,
  onRequestMore
}: CommanderSelectionGridProps) {
  if (isLoading && commanders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <span className="text-zinc-300">Finding perfect commanders for you...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-light text-white drop-shadow-lg mb-3">Choose Your Commander</h2>
        <p className="text-zinc-300">Based on your preferences, here are my top recommendations</p>
      </div>

      <div className="grid gap-4">
        {commanders.map((commander, index) => (
          <button
            key={`${commander.name}-${index}`}
            data-testid="commander-option"
            onClick={() => onCommanderSelect(commander.name)}
            className="p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
          >
            <div className="flex items-start gap-4">
              {/* Commander Card Image */}
              {commander.imageUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={commander.imageUrl}
                    alt={commander.name}
                    className="w-20 h-28 rounded-md shadow-lg object-cover"
                  />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-zinc-100 group-hover:text-white transition-colors">
                    {commander.name}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors flex-shrink-0 mt-1" />
                </div>
                
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-zinc-400">
                    {commander.colorIdentity?.join('') || 'Colorless'}
                  </span>
                  {commander.price && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="text-sm text-green-400">${commander.price}</span>
                    </>
                  )}
                </div>
                
                <p className="text-zinc-300 text-sm leading-relaxed">
                  {commander.reasoning || 'A powerful commander choice for your strategy.'}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {commanders.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={onRequestMore}
            disabled={isLoading}
            className="px-6 py-3 bg-zinc-800/60 hover:bg-zinc-700/70 rounded-lg border border-zinc-700/50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading more...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Show More Commanders</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
