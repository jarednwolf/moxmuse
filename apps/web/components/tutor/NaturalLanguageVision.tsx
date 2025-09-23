'use client'

import React from 'react'

export function NaturalLanguageVision({
  onVisionParsed,
  onStartBuilding,
}: {
  onVisionParsed: (data: any) => void
  onStartBuilding: (text: string, sessionId: string) => void
}) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-light text-white mb-4">Describe your deck idea</h2>
      <p className="text-zinc-300 mb-6">
        Paste a short description of your strategy or the cards you want to build around, and we’ll parse it into preferences.
      </p>
      <textarea className="w-full min-h-[160px] rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-4 text-zinc-100" placeholder="e.g., I want a tokens deck that wins with go-wide combat and value engines..." />
      <div className="mt-4 flex gap-3">
        <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">Parse Vision</button>
        <button className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200">Start Building</button>
      </div>
    </div>
  )
}


