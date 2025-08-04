'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { HighlightText } from '@/components/ui/highlight-text'
import { Plus, Minus, Star, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScryfallCard {
  id: string
  name: string
  set_name: string
  rarity: string
  type_line: string
  mana_cost?: string
  cmc: number
  colors?: string[]
  image_uris?: {
    normal?: string
    small?: string
    art_crop?: string
  }
  prices?: {
    usd?: string
  }
}

interface CollectionCard {
  cardId: string
  quantity: number
  foilQuantity: number
  condition: string
  language: string
  card?: ScryfallCard
  inDeck?: number // quantity already in active deck
}

interface CardItemProps {
  item: CollectionCard
  viewMode: 'grid' | 'list'
  searchQuery?: string
  activeDeck?: any // Will be properly typed later
  onAddToDeck?: (cardId: string, quantity?: number) => void
  onRemoveFromDeck?: (cardId: string, quantity?: number) => void
  onViewDetails?: (cardId: string) => void
  className?: string
}

const rarityColors = {
  common: 'bg-gray-600',
  uncommon: 'bg-gray-400', 
  rare: 'bg-yellow-500',
  mythic: 'bg-orange-500',
  special: 'bg-purple-500'
}

const conditionLabels = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played', 
  HP: 'Heavily Played',
  DMG: 'Damaged'
}

export function CardItem({ 
  item, 
  viewMode, 
  searchQuery = '',
  activeDeck, 
  onAddToDeck, 
  onRemoveFromDeck, 
  onViewDetails,
  className 
}: CardItemProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const { card } = item
  
  if (!card) {
    return (
      <Card className={cn("bg-zinc-800/50 border-zinc-700", className)}>
        <CardContent className="p-4">
          <div className="text-center text-zinc-400">
            <div className="w-full h-32 bg-zinc-700 rounded mb-2 flex items-center justify-center">
              <span className="text-xs">No Image</span>
            </div>
            <p className="text-sm">Card ID: {item.cardId}</p>
            <p className="text-xs text-red-400">Failed to load card details</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalQuantity = item.quantity + item.foilQuantity
  const inDeckQuantity = item.inDeck || 0
  const availableQuantity = totalQuantity - inDeckQuantity
  const canAddToDeck = activeDeck && availableQuantity > 0 && onAddToDeck
  const canRemoveFromDeck = activeDeck && inDeckQuantity > 0 && onRemoveFromDeck

  if (viewMode === 'list') {
    return (
      <Card className={cn("bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800/70 transition-colors", className)}>
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            {/* Card Image */}
            <div className="relative w-16 h-22 flex-shrink-0">
              {!imageError && card.image_uris?.small ? (
                <Image
                  src={card.image_uris.small}
                  alt={card.name}
                  fill
                  className={cn(
                    "object-cover rounded transition-opacity duration-200",
                    imageLoading ? "opacity-0" : "opacity-100"
                  )}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-zinc-700 rounded flex items-center justify-center">
                  <span className="text-xs text-zinc-400">No Image</span>
                </div>
              )}
              {imageLoading && !imageError && (
                <div className="absolute inset-0 bg-zinc-700 rounded animate-pulse" />
              )}
            </div>

            {/* Card Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-zinc-100 truncate">
                    <HighlightText 
                      text={card.name} 
                      searchQuery={searchQuery}
                      highlightClassName="bg-yellow-400/80 text-black px-0.5 rounded"
                    />
                  </h3>
                  <p className="text-sm text-zinc-400 truncate">
                    <HighlightText 
                      text={card.type_line} 
                      searchQuery={searchQuery}
                      highlightClassName="bg-yellow-400/80 text-black px-0.5 rounded"
                    />
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">{card.set_name}</span>
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", rarityColors[card.rarity.toLowerCase() as keyof typeof rarityColors] || rarityColors.common)}
                    >
                      {card.rarity}
                    </Badge>
                  </div>
                </div>
                
                {/* Quantity and Actions */}
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-zinc-100">
                      {totalQuantity} owned
                    </div>
                    {item.foilQuantity > 0 && (
                      <div className="text-xs text-yellow-400">
                        {item.foilQuantity} foil
                      </div>
                    )}
                    {inDeckQuantity > 0 && (
                      <div className="text-xs text-purple-400">
                        {inDeckQuantity} in deck
                      </div>
                    )}
                    <div className="text-xs text-zinc-500">
                      {conditionLabels[item.condition as keyof typeof conditionLabels] || item.condition}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {canRemoveFromDeck && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveFromDeck(item.cardId, 1)}
                        className="h-8 w-8 p-0 border-zinc-600 hover:border-red-500 hover:text-red-400"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                    {canAddToDeck && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAddToDeck(item.cardId, 1)}
                        className="h-8 w-8 p-0 border-zinc-600 hover:border-purple-500 hover:text-purple-400"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                    {onViewDetails && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewDetails(item.cardId)}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Grid view
  return (
    <Card className={cn("bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800/70 transition-all duration-200 group", className)}>
      <CardContent className="p-0">
        {/* Card Image */}
        <div className="relative aspect-[5/7] overflow-hidden rounded-t-lg">
          {!imageError && card.image_uris?.normal ? (
            <Image
              src={card.image_uris.normal}
              alt={card.name}
              fill
              className={cn(
                "object-cover transition-all duration-200 group-hover:scale-105",
                imageLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
              <span className="text-sm text-zinc-400">No Image</span>
            </div>
          )}
          
          {imageLoading && !imageError && (
            <div className="absolute inset-0 bg-zinc-700 animate-pulse" />
          )}

          {/* Overlay with quantity and actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="absolute bottom-2 left-2 right-2">
              <div className="flex items-end justify-between">
                <div className="text-white">
                  <div className="text-sm font-bold">{totalQuantity} owned</div>
                  {item.foilQuantity > 0 && (
                    <div className="text-xs text-yellow-400 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      {item.foilQuantity} foil
                    </div>
                  )}
                  {inDeckQuantity > 0 && (
                    <div className="text-xs text-purple-400">
                      {inDeckQuantity} in deck
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  {canRemoveFromDeck && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onRemoveFromDeck(item.cardId, 1)}
                      className="h-7 w-7 p-0 bg-red-600/80 hover:bg-red-600 border-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  )}
                  {canAddToDeck && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onAddToDeck(item.cardId, 1)}
                      className="h-7 w-7 p-0 bg-purple-600/80 hover:bg-purple-600 border-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rarity indicator */}
          <div className={cn(
            "absolute top-2 right-2 w-3 h-3 rounded-full",
            rarityColors[card.rarity.toLowerCase() as keyof typeof rarityColors] || rarityColors.common
          )} />
        </div>

        {/* Card Info */}
        <div className="p-3">
          <h3 className="font-semibold text-zinc-100 text-sm leading-tight mb-1 overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            <HighlightText 
              text={card.name} 
              searchQuery={searchQuery}
              highlightClassName="bg-yellow-400/80 text-black px-0.5 rounded"
            />
          </h3>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="truncate">{card.set_name}</span>
            <span className="ml-2 flex-shrink-0">{conditionLabels[item.condition as keyof typeof conditionLabels] || item.condition}</span>
          </div>
          {card.prices?.usd && (
            <div className="text-xs text-green-400 mt-1">
              ${parseFloat(card.prices.usd).toFixed(2)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}