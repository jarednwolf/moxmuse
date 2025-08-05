'use client'

import React from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

interface AnalysisPanelProps {
  deck: any
  deckCards: Map<string, number>
  deckStats: any
  onRemoveCard: (cardId: string, quantity?: number) => void
}

export function AnalysisPanel({ 
  deck, 
  deckCards, 
  deckStats, 
  onRemoveCard 
}: AnalysisPanelProps) {
  const { data: cardDetails } = trpc.collection.getCardDetails.useQuery(
    { cardIds: Array.from(deckCards.keys()) },
    { enabled: deckCards.size > 0 }
  )

  // Calculate enhanced stats with card data
  const enhancedStats = React.useMemo(() => {
    if (!cardDetails) return {
      manaCurve: [0, 0, 0, 0, 0, 0, 0, 0],
      colorDistribution: {},
      typeDistribution: {},
      totalValue: 0
    }

    const manaCurve = [0, 0, 0, 0, 0, 0, 0, 0] // 0, 1, 2, 3, 4, 5, 6, 7+
    const colorDistribution: Record<string, number> = {}
    const typeDistribution: Record<string, number> = {}
    let totalValue = 0

    cardDetails.forEach((card: any) => {
      const quantity = deckCards.get(card.id) || 0
      if (quantity === 0) return

      // Mana curve
      const cmc = Math.min(card.cmc || 0, 7)
      manaCurve[cmc] += quantity

      // Color distribution
      if (card.color_identity) {
        card.color_identity.forEach((color: string) => {
          colorDistribution[color] = (colorDistribution[color] || 0) + quantity
        })
      }

      // Type distribution
      if (card.type_line) {
        const types = card.type_line.split(' — ')[0].split(' ')
        types.forEach((type: string) => {
          if (type && !['Legendary', 'Basic', 'Snow'].includes(type)) {
            typeDistribution[type] = (typeDistribution[type] || 0) + quantity
          }
        })
      }

      // Total value
      const price = parseFloat(card.prices?.usd || '0')
      totalValue += price * quantity
    })

    return { manaCurve, colorDistribution, typeDistribution, totalValue }
  }, [cardDetails, deckCards])

  const colorSymbols: Record<string, string> = {
    W: '⚪', U: '🔵', B: '⚫', R: '🔴', G: '🟢'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-700/50">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">{deck.name}</h2>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{deckStats.totalCards}/100 cards</span>
          <span>${enhancedStats.totalValue.toFixed(0)}</span>
        </div>
      </div>

      {/* Stats Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Mana Curve */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Mana Curve</h3>
          <div className="space-y-2">
            {enhancedStats.manaCurve.map((count, cmc) => (
              <div key={cmc} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 w-4">{cmc === 7 ? '7+' : cmc}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                    style={{ width: `${Math.max(4, (count / Math.max(...enhancedStats.manaCurve)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Color Distribution */}
        {Object.keys(enhancedStats.colorDistribution).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Color Identity</h3>
            <div className="space-y-2">
              {Object.entries(enhancedStats.colorDistribution).map(([color, count]) => (
                <div key={color} className="flex items-center gap-2">
                  <span className="text-sm">{colorSymbols[color] || color}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                      style={{ width: `${(count / Math.max(...Object.values(enhancedStats.colorDistribution))) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type Distribution */}
        {Object.keys(enhancedStats.typeDistribution).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Card Types</h3>
            <div className="space-y-1">
              {Object.entries(enhancedStats.typeDistribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{type}</span>
                  <span className="text-xs text-zinc-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-4 border-t border-zinc-700/50">
          <Link 
            href={`/decks/${deck.id}`}
            className="w-full px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-lg border border-zinc-700/50 transition-colors text-sm text-zinc-300 hover:text-zinc-100 flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Edit Deck
          </Link>
        </div>
      </div>
    </div>
  )
}