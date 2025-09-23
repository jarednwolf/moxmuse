'use client'

import React from 'react'

export function EntryPointSelector({
  onDeckBuilding,
  onCardRecommendations,
  onNaturalLanguageVision,
}: {
  onDeckBuilding: () => void
  onCardRecommendations: () => void
  onNaturalLanguageVision: () => void
}) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-light text-white mb-6">What would you like to do?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={onDeckBuilding}
          className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-6 text-left hover:bg-zinc-700/70 transition-colors"
        >
          <span className="block text-lg font-semibold text-white mb-1">Build a deck</span>
          <span className="text-sm text-zinc-300">Start from a commander or get suggestions</span>
        </button>
        <button
          onClick={onCardRecommendations}
          className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-6 text-left hover:bg-zinc-700/70 transition-colors"
        >
          <span className="block text-lg font-semibold text-white mb-1">Get card recommendations</span>
          <span className="text-sm text-zinc-300">Chat to find synergies and upgrades</span>
        </button>
        <button
          onClick={onNaturalLanguageVision}
          className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-6 text-left hover:bg-zinc-700/70 transition-colors sm:col-span-2"
        >
          <span className="block text-lg font-semibold text-white mb-1">Use natural language vision</span>
          <span className="text-sm text-zinc-300">Paste a deck idea and let us parse it</span>
        </button>
      </div>
    </div>
  )
}


