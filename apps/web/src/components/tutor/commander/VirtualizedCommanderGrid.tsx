'use client'

import React, { useRef, useEffect, useState } from 'react'
import { CommanderRecommendation } from '@moxmuse/shared'
import { CommanderCard } from './CommanderCard'
import { useGridVirtualization } from '@/hooks/useVirtualization'

interface VirtualizedCommanderGridProps {
  commanders: CommanderRecommendation[]
  onSelect: (commander: CommanderRecommendation) => void
  selectedCommanderId?: string
  isLoading?: boolean
  itemWidth?: number
  itemHeight?: number
  gap?: number
}

const DEFAULT_ITEM_WIDTH = 240
const DEFAULT_ITEM_HEIGHT = 360
const DEFAULT_GAP = 16
const DEFAULT_CONTAINER_HEIGHT = 600

export const VirtualizedCommanderGrid: React.FC<VirtualizedCommanderGridProps> = ({
  commanders,
  onSelect,
  selectedCommanderId,
  isLoading = false,
  itemWidth = DEFAULT_ITEM_WIDTH,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  gap = DEFAULT_GAP
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerDimensions, setContainerDimensions] = useState({
    width: 1200, // Default width
    height: DEFAULT_CONTAINER_HEIGHT
  })

  // Update container dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerDimensions({
          width: rect.width,
          height: rect.height
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const {
    virtualItems,
    totalHeight,
    handleScroll,
    columnsPerRow
  } = useGridVirtualization({
    itemWidth,
    itemHeight,
    containerWidth: containerDimensions.width,
    containerHeight: containerDimensions.height,
    itemCount: isLoading ? 5 : commanders.length,
    gap,
    overscan: 2
  })

  // Show loading state with skeleton cards
  if (isLoading) {
    return (
      <div 
        ref={containerRef}
        className="w-full overflow-y-auto"
        style={{ height: DEFAULT_CONTAINER_HEIGHT }}
        onScroll={handleScroll}
      >
        <div 
          className="relative"
          style={{ height: totalHeight }}
        >
          {virtualItems.map(virtualItem => (
            <div
              key={`loading-${virtualItem.index}`}
              className="absolute"
              style={{
                top: virtualItem.start,
                left: virtualItem.column * (itemWidth + gap),
                width: itemWidth,
                height: itemHeight
              }}
            >
              <CommanderCard
                commander={{} as CommanderRecommendation}
                onSelect={() => {}}
                isLoading={true}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Show empty state if no commanders
  if (commanders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🤔</div>
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">
          No commanders found
        </h3>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          We couldn't find any commanders matching your preferences. 
          Try adjusting your criteria or request more options.
        </p>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-y-auto"
      style={{ height: DEFAULT_CONTAINER_HEIGHT }}
      onScroll={handleScroll}
    >
      <div 
        className="relative"
        style={{ height: totalHeight }}
      >
        {virtualItems.map(virtualItem => {
          const commander = commanders[virtualItem.index]
          if (!commander) return null

          return (
            <div
              key={commander.cardId}
              className="absolute"
              style={{
                top: virtualItem.start,
                left: virtualItem.column * (itemWidth + gap),
                width: itemWidth,
                height: itemHeight
              }}
            >
              <CommanderCard
                commander={commander}
                onSelect={onSelect}
                isSelected={selectedCommanderId === commander.cardId}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}