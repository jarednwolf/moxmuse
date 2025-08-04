'use client'

import React, { useState } from 'react'
import { CommanderRecommendation } from '@moxmuse/shared'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Info, Check } from 'lucide-react'
import { CommanderDetailModal } from './CommanderDetailModal'

interface CommanderCardProps {
  commander: CommanderRecommendation
  onSelect: (commander: CommanderRecommendation) => void
  isSelected?: boolean
  isLoading?: boolean
}

export const CommanderCard: React.FC<CommanderCardProps> = ({
  commander,
  onSelect,
  isSelected = false,
  isLoading = false
}) => {
  const [showDetailModal, setShowDetailModal] = useState(false)

  const colorIdentityColors = {
    W: { name: 'White', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    U: { name: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    B: { name: 'Black', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    R: { name: 'Red', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    G: { name: 'Green', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  }

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isLoading) {
      onSelect(commander)
    }
  }

  const handleShowDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDetailModal(true)
  }

  const handleCardClick = () => {
    if (!isLoading) {
      setShowDetailModal(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  if (isLoading) {
    return (
      <Card className="h-full animate-pulse">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="w-full h-48 bg-zinc-700 rounded-lg" />
            <div className="h-4 bg-zinc-700 rounded w-3/4" />
            <div className="h-3 bg-zinc-700 rounded w-1/2" />
            <div className="space-y-2">
              <div className="h-3 bg-zinc-700 rounded" />
              <div className="h-3 bg-zinc-700 rounded w-5/6" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card 
        className={`h-full cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
          isSelected 
            ? 'ring-2 ring-purple-500 bg-purple-500/10 border-purple-500' 
            : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
        }`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${commander.name}`}
      >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Card Image */}
          <div className="relative w-full h-48 bg-zinc-700 rounded-lg overflow-hidden">
            {commander.imageUrl ? (
              <img
                src={commander.imageUrl}
                alt={commander.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <div className="text-center">
                  <div className="text-2xl mb-2">🃏</div>
                  <div className="text-xs">No Image</div>
                </div>
              </div>
            )}
            
            {/* Owned Badge */}
            {commander.owned && (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                  Owned
                </Badge>
              </div>
            )}
            
            {/* Price Badge */}
            <div className="absolute bottom-2 left-2">
              <Badge variant="outline" className="bg-zinc-900/80 text-zinc-200 border-zinc-600">
                ${commander.price}
              </Badge>
            </div>
          </div>

          {/* Commander Name */}
          <div>
            <h3 className="font-semibold text-zinc-100 text-sm leading-tight">
              {commander.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {commander.typeLine}
            </p>
          </div>

          {/* Color Identity */}
          {commander.colorIdentity.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {commander.colorIdentity.map((color) => {
                const colorInfo = colorIdentityColors[color as keyof typeof colorIdentityColors]
                return colorInfo ? (
                  <Badge
                    key={color}
                    variant="outline"
                    className={`text-xs px-1.5 py-0.5 ${colorInfo.bg} ${colorInfo.text} ${colorInfo.border}`}
                  >
                    {color}
                  </Badge>
                ) : null
              })}
            </div>
          )}

          {/* Reasoning */}
          <div className="text-xs text-zinc-300 leading-relaxed">
            {commander.reasoning}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Match:</span>
            <div className="flex-1 bg-zinc-700 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${commander.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">
              {Math.round(commander.confidence * 100)}%
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleSelect}
              disabled={isLoading}
              className={`flex-1 text-xs ${
                isSelected 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                  : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30'
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Selected
                </>
              ) : (
                'Select'
              )}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleShowDetails}
              disabled={isLoading}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            >
              <Info className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Detail Modal */}
    <CommanderDetailModal
      commander={commander}
      isOpen={showDetailModal}
      onClose={() => setShowDetailModal(false)}
      onSelect={onSelect}
    />
  </>
  )
}