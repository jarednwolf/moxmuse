'use client'

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

interface VirtualizedListProps<T> {
  items: T[]
  height: number
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  onLoadMore?: () => void
  hasNextPage?: boolean
  isLoading?: boolean
  loadingComponent?: React.ReactNode
  emptyComponent?: React.ReactNode
  getItemKey?: (item: T, index: number) => string | number
}

export function VirtualizedList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
  overscan = 5,
  onLoadMore,
  hasNextPage,
  isLoading,
  loadingComponent,
  emptyComponent,
  getItemKey,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof itemHeight === 'function' ? itemHeight : () => itemHeight,
    overscan,
  })

  // Infinite loading logic
  const handleScroll = useCallback(async () => {
    if (!onLoadMore || !hasNextPage || isLoading || isLoadingMore) return

    const scrollElement = parentRef.current
    if (!scrollElement) return

    const { scrollTop, scrollHeight, clientHeight } = scrollElement
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Load more when 80% scrolled
    if (scrollPercentage > 0.8) {
      setIsLoadingMore(true)
      try {
        await onLoadMore()
      } finally {
        setIsLoadingMore(false)
      }
    }
  }, [onLoadMore, hasNextPage, isLoading, isLoadingMore])

  useEffect(() => {
    const scrollElement = parentRef.current
    if (!scrollElement) return

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const virtualItems = virtualizer.getVirtualItems()

  if (items.length === 0 && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        {emptyComponent || <div className="text-muted-foreground">No items found</div>}
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          const key = getItemKey ? getItemKey(item, virtualItem.index) : virtualItem.index

          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          )
        })}

        {/* Loading indicator at the bottom */}
        {(isLoading || isLoadingMore) && (
          <div
            style={{
              position: 'absolute',
              top: `${virtualizer.getTotalSize()}px`,
              left: 0,
              width: '100%',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {loadingComponent || (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Specialized card list component
interface Card {
  id: string
  name: string
  manaCost?: string
  cmc: number
  typeLine: string
  imageUris?: Record<string, string>
  prices?: Record<string, any>
}

interface VirtualizedCardListProps {
  cards: Card[]
  height: number
  onCardSelect?: (card: Card) => void
  onLoadMore?: () => void
  hasNextPage?: boolean
  isLoading?: boolean
  className?: string
  showImages?: boolean
  compact?: boolean
}

export function VirtualizedCardList({
  cards,
  height,
  onCardSelect,
  onLoadMore,
  hasNextPage,
  isLoading,
  className,
  showImages = true,
  compact = false,
}: VirtualizedCardListProps) {
  const itemHeight = compact ? 60 : showImages ? 120 : 80

  const renderCard = useCallback((card: Card, index: number) => {
    return (
      <div
        key={card.id}
        className={cn(
          'flex items-center p-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors',
          compact && 'p-2'
        )}
        onClick={() => onCardSelect?.(card)}
      >
        {showImages && card.imageUris?.small && (
          <div className={cn('flex-shrink-0 mr-3', compact ? 'w-8 h-8' : 'w-16 h-16')}>
            <img
              src={card.imageUris.small}
              alt={card.name}
              className="w-full h-full object-cover rounded"
              loading="lazy"
            />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={cn('font-medium truncate', compact ? 'text-sm' : 'text-base')}>
              {card.name}
            </h3>
            {card.manaCost && (
              <div className={cn('flex-shrink-0 ml-2', compact ? 'text-xs' : 'text-sm')}>
                <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                  {card.manaCost}
                </span>
              </div>
            )}
          </div>
          
          <div className={cn('text-muted-foreground mt-1', compact ? 'text-xs' : 'text-sm')}>
            {card.typeLine}
          </div>
          
          {!compact && card.prices?.usd && (
            <div className="text-xs text-muted-foreground mt-1">
              ${card.prices.usd}
            </div>
          )}
        </div>
      </div>
    )
  }, [onCardSelect, showImages, compact])

  return (
    <VirtualizedList
      items={cards}
      height={height}
      itemHeight={itemHeight}
      renderItem={renderCard}
      className={className}
      onLoadMore={onLoadMore}
      hasNextPage={hasNextPage}
      isLoading={isLoading}
      getItemKey={(card) => card.id}
      emptyComponent={
        <div className="text-center py-8">
          <div className="text-muted-foreground">No cards found</div>
        </div>
      }
    />
  )
}

// Grid virtualization for card images
interface VirtualizedCardGridProps {
  cards: Card[]
  height: number
  itemWidth: number
  itemHeight: number
  gap?: number
  onCardSelect?: (card: Card) => void
  onLoadMore?: () => void
  hasNextPage?: boolean
  isLoading?: boolean
  className?: string
}

export function VirtualizedCardGrid({
  cards,
  height,
  itemWidth,
  itemHeight,
  gap = 8,
  onCardSelect,
  onLoadMore,
  hasNextPage,
  isLoading,
  className,
}: VirtualizedCardGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const updateWidth = () => {
      if (parentRef.current) {
        setContainerWidth(parentRef.current.clientWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const columnsCount = Math.floor((containerWidth + gap) / (itemWidth + gap)) || 1
  const rowsCount = Math.ceil(cards.length / columnsCount)

  const virtualizer = useVirtualizer({
    count: rowsCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan: 2,
  })

  const renderRow = useCallback((rowIndex: number) => {
    const startIndex = rowIndex * columnsCount
    const endIndex = Math.min(startIndex + columnsCount, cards.length)
    const rowCards = cards.slice(startIndex, endIndex)

    return (
      <div
        key={rowIndex}
        className="flex"
        style={{ gap: `${gap}px` }}
      >
        {rowCards.map((card, colIndex) => (
          <div
            key={card.id}
            className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
            style={{ width: itemWidth, height: itemHeight }}
            onClick={() => onCardSelect?.(card)}
          >
            {card.imageUris?.normal ? (
              <img
                src={card.imageUris.normal}
                alt={card.name}
                className="w-full h-full object-cover rounded-lg shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-xs text-center p-2">{card.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }, [cards, columnsCount, itemWidth, itemHeight, gap, onCardSelect])

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
              padding: `0 ${gap}px`,
            }}
          >
            {renderRow(virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}