'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { ScryfallCard } from '@moxmuse/shared'
import { cn } from '../../lib/utils'

interface CardImageProps {
  card: ScryfallCard
  className?: string
  size?: 'small' | 'medium' | 'large'
  showFallback?: boolean
}

export const CardImage: React.FC<CardImageProps> = ({
  card,
  className,
  size = 'medium',
  showFallback = true
}) => {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Get the appropriate image URL based on size
  const getImageUrl = () => {
    const imageUris = card.image_uris
    if (!imageUris) return null
    
    switch (size) {
      case 'small':
        return imageUris.normal || imageUris.large
      case 'large':
        return imageUris.large || imageUris.normal || imageUris.png
      default:
        return imageUris.normal || imageUris.large
    }
  }

  const imageUrl = getImageUrl()

  // Fallback component when image fails to load
  const CardFallback = () => (
    <div className={cn(
      "flex flex-col items-center justify-center bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/25 rounded-lg",
      className
    )}>
      <div className="text-center p-4">
        <div className="text-2xl mb-2">🃏</div>
        <div className="font-medium text-sm mb-1">{card.name}</div>
        <div className="text-xs opacity-75">{card.type_line}</div>
        {card.mana_cost && (
          <div className="text-xs mt-2 font-mono">{card.mana_cost}</div>
        )}
      </div>
    </div>
  )

  // Loading placeholder
  const LoadingPlaceholder = () => (
    <div className={cn(
      "animate-pulse bg-muted rounded-lg",
      className
    )}>
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    </div>
  )

  if (!imageUrl || imageError) {
    return showFallback ? <CardFallback /> : null
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {isLoading && <LoadingPlaceholder />}
      <Image
        src={imageUrl}
        alt={card.name}
        fill
        className={cn(
          "object-cover transition-opacity duration-200",
          isLoading ? "opacity-0" : "opacity-100"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setImageError(true)
          setIsLoading(false)
        }}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </div>
  )
}

export default CardImage
