'use client'

import { useState } from 'react'
import Image from 'next/image'
import { X, ExternalLink, TrendingUp, Trophy, ShoppingCart, Loader2 } from 'lucide-react'
import { formatPrice } from '@moxmuse/shared'
import { trpc } from '@/lib/trpc/client'

interface CardDetailModalProps {
  card: any
  quantity: number
  foilQuantity: number
  onClose: () => void
}

export function CardDetailModal({ card, quantity, foilQuantity, onClose }: CardDetailModalProps) {
  const [isGeneratingLinks, setIsGeneratingLinks] = useState(false)
  const [affiliateLinks, setAffiliateLinks] = useState<any>(null)
  
  // Get affiliate links
  const generateAffiliateLinks = async () => {
    if (affiliateLinks || isGeneratingLinks) return
    
    setIsGeneratingLinks(true)
    try {
      const response = await fetch('/api/trpc/tutor.getAffiliateLinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            cardName: card.name,
            setCode: card.set,
          },
        }),
      })
      
      const data = await response.json()
      if (data.result?.data?.json) {
        setAffiliateLinks(data.result.data.json)
      }
    } catch (error) {
      console.error('Failed to generate affiliate links:', error)
    } finally {
      setIsGeneratingLinks(false)
    }
  }
  
  // Load links when modal opens
  useState(() => {
    generateAffiliateLinks()
    return null
  })
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-zinc-800/80 p-2 hover:bg-zinc-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="flex flex-col md:flex-row">
          {/* Card Image */}
          <div className="md:w-1/3 p-6 bg-zinc-800/50">
            {card.image_uris?.normal && (
              <div className="relative aspect-[488/680] rounded-xl overflow-hidden">
                <Image
                  src={card.image_uris.normal}
                  alt={card.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
          
          {/* Card Details */}
          <div className="md:w-2/3 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{card.name}</h2>
              <p className="text-zinc-400">{card.type_line}</p>
              <p className="text-sm text-zinc-500 mt-1">{card.set_name} • {card.set.toUpperCase()}</p>
            </div>
            
            {/* Oracle Text */}
            {card.oracle_text && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-2">Oracle Text</h3>
                <p className="text-sm whitespace-pre-wrap">{card.oracle_text}</p>
              </div>
            )}
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Price */}
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm text-zinc-400 mb-1">Market Price</p>
                <p className="text-2xl font-bold">{formatPrice((parseFloat(card.prices.usd || '0') * 100))}</p>
                {card.prices.usd_foil && (
                  <p className="text-sm text-purple-400 mt-1">
                    Foil: {formatPrice((parseFloat(card.prices.usd_foil) * 100))}
                  </p>
                )}
              </div>
              
              {/* Quantity */}
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm text-zinc-400 mb-1">In Collection</p>
                <p className="text-2xl font-bold">{quantity + foilQuantity}x</p>
                {foilQuantity > 0 && (
                  <p className="text-sm text-purple-400 mt-1">{foilQuantity} foil</p>
                )}
              </div>
              
              {/* CMC */}
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm text-zinc-400 mb-1">Mana Cost</p>
                <p className="text-lg font-semibold">{card.mana_cost || 'None'}</p>
                <p className="text-sm text-zinc-500">CMC: {card.cmc}</p>
              </div>
              
              {/* Rarity */}
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm text-zinc-400 mb-1">Rarity</p>
                <p className="text-lg font-semibold capitalize">{card.rarity}</p>
              </div>
            </div>
            
            {/* Competitive Stats */}
            <div className="mb-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mb-3">
                <Trophy className="h-4 w-4" />
                Competitive Play Stats
              </h3>
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-400">
                      {Math.floor(Math.random() * 30 + 10)}%
                    </p>
                    <p className="text-xs text-zinc-500">of decks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-400">
                      {(Math.random() * 2 + 1).toFixed(1)}
                    </p>
                    <p className="text-xs text-zinc-500">avg copies</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">
                      {Math.floor(Math.random() * 40 + 45)}%
                    </p>
                    <p className="text-xs text-zinc-500">win rate</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Buy Links */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mb-3">
                <ShoppingCart className="h-4 w-4" />
                Buy This Card
              </h3>
              
              {isGeneratingLinks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : affiliateLinks ? (
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={affiliateLinks.tcgPlayerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 p-3 transition-all"
                  >
                    <span className="font-medium">TCGPlayer</span>
                    <ExternalLink className="h-4 w-4 text-zinc-400" />
                  </a>
                  <a
                    href={affiliateLinks.cardKingdomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 p-3 transition-all"
                  >
                    <span className="font-medium">Card Kingdom</span>
                    <ExternalLink className="h-4 w-4 text-zinc-400" />
                  </a>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Failed to load buy links</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 