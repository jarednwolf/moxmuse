'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Package, ChevronRight, Plus } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

interface DeckSelectorProps {
  onDeckSelected: (deck: any) => void
}

export function DeckSelector({ onDeckSelected }: DeckSelectorProps) {
  const { data: decks, isLoading } = trpc.deck.getAll.useQuery()
  const [showAll, setShowAll] = useState(false)

  const displayDecks = showAll ? decks : decks?.slice(0, 3)

  if (isLoading) {
    return (
      <div className="p-8 rounded-xl bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-zinc-700/80 rounded-lg flex items-center justify-center">
          <Package className="w-4 h-4 text-zinc-300" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-100">Continue with Existing Deck</h3>
      </div>
      
      {decks && decks.length > 0 ? (
        <div className="space-y-2">
          {displayDecks?.map((deck: any) => (
            <button
              key={deck.id}
              onClick={() => onDeckSelected(deck)}
              className="w-full p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors text-left border border-zinc-600/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-100 text-sm">{deck.name}</div>
                  <div className="text-xs text-zinc-400">{deck._count?.cards || 0} cards • {deck.format}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          ))}
          
          {decks.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full p-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              {showAll ? 'Show Less' : `Show ${decks.length - 3} More`}
            </button>
          )}
          
          <Link
            href="/decks"
            className="block w-full p-3 rounded-lg bg-zinc-700/30 hover:bg-zinc-600/30 transition-colors text-center border border-zinc-600/20 text-sm text-zinc-300 hover:text-zinc-100"
          >
            Manage All Decks
          </Link>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-zinc-400 text-sm mb-3">No decks found</p>
          <Link
            href="/decks"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Your First Deck
          </Link>
        </div>
      )}
    </div>
  )
}