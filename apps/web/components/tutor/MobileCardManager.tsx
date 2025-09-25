'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Plus, 
  Minus, 
  Heart, 
  MoreVertical, 
  Search,
  Filter,
  SortAsc,
  Grid3X3,
  List,
  Star,
  Trash2,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  MobileCard, 
  MobileButton, 
  MobileInput, 
  MobileSheet,
  useSwipeGesture,
  PullToRefresh
} from '../ui/mobile-optimized'
import { VirtualizedList } from '../ui/VirtualizedList'
import { AccessibleHeading } from '../ui/accessibility'

interface DeckCard {
  id: string
  name: string
  manaCost: string
  cmc: number
  types: string[]
  colors: string[]
  price?: number
  imageUrl?: string
  quantity?: number
  category?: 'ramp' | 'draw' | 'removal' | 'threat' | 'utility' | 'land'
  isFavorite?: boolean
  tags?: string[]
}

interface MobileCardManagerProps {
  cards: DeckCard[]
  onCardUpdate: (cardId: string, updates: Partial<DeckCard>) => void
  onCardRemove: (cardId: string) => void
  onCardAdd: (card: DeckCard) => void
  onRefresh?: () => Promise<void>
  viewMode?: 'grid' | 'list'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  className?: string
}

type SortOption = 'name' | 'cmc' | 'price' | 'color' | 'type' | 'category'
type FilterOption = 'all' | 'favorites' | 'expensive' | 'budget' | 'lands' | 'spells'

export function MobileCardManager({
  cards,
  onCardUpdate,
  onCardRemove,
  onCardAdd,
  onRefresh,
  viewMode = 'list',
  onViewModeChange,
  className
}: MobileCardManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState<string | null>(null)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [swipeActions, setSwipeActions] = useState<Record<string, 'remove' | 'favorite' | null>>({})
  
  // Gesture handling for card interactions
  const handleCardSwipe = useCallback((cardId: string, direction: 'left' | 'right') => {
    if (direction === 'left') {
      // Swipe left to remove
      setSwipeActions(prev => ({ ...prev, [cardId]: 'remove' }))
      setTimeout(() => {
        onCardRemove(cardId)
        setSwipeActions(prev => ({ ...prev, [cardId]: null }))
      }, 300)
    } else if (direction === 'right') {
      // Swipe right to favorite
      const card = cards.find(c => c.id === cardId)
      if (card) {
        onCardUpdate(cardId, { isFavorite: !card.isFavorite })
        setSwipeActions(prev => ({ ...prev, [cardId]: 'favorite' }))
        setTimeout(() => {
          setSwipeActions(prev => ({ ...prev, [cardId]: null }))
        }, 300)
      }
    }
  }, [cards, onCardUpdate, onCardRemove])
  
  // Filter and sort cards
  const filteredAndSortedCards = React.useMemo(() => {
    const filtered = cards.filter(card => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!card.name.toLowerCase().includes(query) && 
            !card.types.some(type => type.toLowerCase().includes(query))) {
          return false
        }
      }
      
      // Category filter
      switch (filterBy) {
        case 'favorites':
          return card.isFavorite
        case 'expensive':
          return (card.price || 0) > 20
        case 'budget':
          return (card.price || 0) < 5
        case 'lands':
          return card.types.includes('Land')
        case 'spells':
          return !card.types.includes('Land') && !card.types.includes('Creature')
        default:
          return true
      }
    })
    
    // Sort cards
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'cmc':
          return a.cmc - b.cmc
        case 'price':
          return (b.price || 0) - (a.price || 0)
        case 'color':
          return a.colors.join('').localeCompare(b.colors.join(''))
        case 'type':
          return a.types.join('').localeCompare(b.types.join(''))
        case 'category':
          return (a.category || '').localeCompare(b.category || '')
        default:
          return 0
      }
    })
    
    return filtered
  }, [cards, searchQuery, sortBy, filterBy])
  
  // Card component with gesture support
  const CardItem = ({ card, index }: { card: DeckCard; index: number }) => {
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState(0)
    const cardRef = useRef<HTMLDivElement>(null)
    
    const swipeHandlers = useSwipeGesture(
      () => handleCardSwipe(card.id, 'left'), // Swipe left = remove
      () => handleCardSwipe(card.id, 'right'), // Swipe right = favorite
      undefined,
      undefined,
      100 // Threshold for swipe
    )
    
    const handleTouchStart = (e: React.TouchEvent) => {
      setIsDragging(true)
      swipeHandlers.onTouchStart(e)
    }
    
    const handleTouchMove = (e: React.TouchEvent) => {
      if (isDragging) {
        const touch = e.touches[0]
        const rect = cardRef.current?.getBoundingClientRect()
        if (rect) {
          const offset = touch.clientX - rect.left - rect.width / 2
          setDragOffset(Math.max(-100, Math.min(100, offset)))
        }
      }
      swipeHandlers.onTouchMove(e)
    }
    
    const handleTouchEnd = (e: React.TouchEvent) => {
      setIsDragging(false)
      setDragOffset(0)
      swipeHandlers.onTouchEnd(e)
    }
    
    const swipeAction = swipeActions[card.id]
    const isSelected = selectedCards.has(card.id)
    
    if (viewMode === 'grid') {
      return (
        <div
          ref={cardRef}
          className={cn(
            'relative transition-all duration-300',
            swipeAction === 'remove' && 'opacity-0 scale-95',
            swipeAction === 'favorite' && 'scale-105',
            isDragging && 'z-10'
          )}
          style={{ transform: `translateX(${dragOffset}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <MobileCard
            interactive
            onClick={() => setShowCardDetails(card.id)}
            className={cn(
              'cursor-pointer aspect-[3/4] relative overflow-hidden',
              isSelected && 'ring-2 ring-blue-500'
            )}
            padding="sm"
          >
            {/* Card image placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-800">
              {card.imageUrl ? (
                <img 
                  src={card.imageUrl} 
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-4xl">🃏</span>
                </div>
              )}
            </div>
            
            {/* Card info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <div className="text-xs font-medium text-white truncate">
                {card.name}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-zinc-300">
                  {card.cmc} CMC
                </span>
                {card.price && (
                  <span className="text-xs text-green-400">
                    ${card.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            
            {/* Selection indicator */}
            {isSelectionMode && (
              <div className="absolute top-2 right-2">
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                  isSelected 
                    ? 'bg-blue-500 border-blue-500' 
                    : 'bg-transparent border-zinc-400'
                )}>
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>
            )}
            
            {/* Favorite indicator */}
            {card.isFavorite && (
              <div className="absolute top-2 left-2">
                <Heart className="w-4 h-4 text-red-500 fill-current" />
              </div>
            )}
            
            {/* Quantity badge */}
            {card.quantity && card.quantity > 1 && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {card.quantity}
              </div>
            )}
          </MobileCard>
          
          {/* Swipe action indicators */}
          {isDragging && (
            <>
              <div className={cn(
                'absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center transition-opacity',
                dragOffset > 50 ? 'opacity-100' : 'opacity-50'
              )}>
                <Heart className="w-6 h-6 text-red-500" />
              </div>
              <div className={cn(
                'absolute right-0 top-0 bottom-0 w-16 flex items-center justify-center transition-opacity',
                dragOffset < -50 ? 'opacity-100' : 'opacity-50'
              )}>
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
            </>
          )}
        </div>
      )
    }
    
    // List view
    return (
      <div
        ref={cardRef}
        className={cn(
          'relative transition-all duration-300',
          swipeAction === 'remove' && 'opacity-0 scale-95',
          swipeAction === 'favorite' && 'scale-105',
          isDragging && 'z-10'
        )}
        style={{ transform: `translateX(${dragOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <MobileCard
          interactive
          onClick={() => isSelectionMode ? toggleCardSelection(card.id) : setShowCardDetails(card.id)}
          className={cn(
            'cursor-pointer',
            isSelected && 'ring-2 ring-blue-500'
          )}
          padding="md"
        >
          <div className="flex items-center gap-3">
            {/* Selection checkbox */}
            {isSelectionMode && (
              <div className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                isSelected 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-transparent border-zinc-400'
              )}>
                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            )}
            
            {/* Card thumbnail */}
            <div className="w-12 h-16 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded flex-shrink-0 flex items-center justify-center">
              {card.imageUrl ? (
                <img 
                  src={card.imageUrl} 
                  alt={card.name}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <span className="text-lg">🃏</span>
              )}
            </div>
            
            {/* Card info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-zinc-100 truncate">
                    {card.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {card.types.join(' • ')} • {card.cmc} CMC
                  </p>
                  {card.category && (
                    <span className="inline-block px-2 py-0.5 bg-zinc-700 text-xs text-zinc-300 rounded mt-1">
                      {card.category}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-2">
                  {card.isFavorite && (
                    <Heart className="w-4 h-4 text-red-500 fill-current" />
                  )}
                  {card.price && (
                    <span className="text-sm text-green-400">
                      ${card.price.toFixed(2)}
                    </span>
                  )}
                  {card.quantity && card.quantity > 1 && (
                    <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {card.quantity}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MobileCard>
        
        {/* Swipe action indicators */}
        {isDragging && (
          <>
            <div className={cn(
              'absolute left-0 top-0 bottom-0 w-16 bg-green-500/20 flex items-center justify-center transition-opacity rounded-l',
              dragOffset > 50 ? 'opacity-100' : 'opacity-50'
            )}>
              <Heart className="w-6 h-6 text-red-500" />
            </div>
            <div className={cn(
              'absolute right-0 top-0 bottom-0 w-16 bg-red-500/20 flex items-center justify-center transition-opacity rounded-r',
              dragOffset < -50 ? 'opacity-100' : 'opacity-50'
            )}>
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
          </>
        )}
      </div>
    )
  }
  
  const toggleCardSelection = (cardId: string) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId)
    } else {
      newSelected.add(cardId)
    }
    setSelectedCards(newSelected)
  }
  
  const handleBulkAction = (action: 'remove' | 'favorite' | 'unfavorite') => {
    selectedCards.forEach(cardId => {
      switch (action) {
        case 'remove':
          onCardRemove(cardId)
          break
        case 'favorite':
          onCardUpdate(cardId, { isFavorite: true })
          break
        case 'unfavorite':
          onCardUpdate(cardId, { isFavorite: false })
          break
      }
    })
    setSelectedCards(new Set())
    setIsSelectionMode(false)
  }
  
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header with search and controls */}
      <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/50 p-4 space-y-3">
        {/* Search bar */}
        <MobileInput
          placeholder="Search cards..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          rightIcon={
            searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4" />
              </button>
            )
          }
        />
        
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MobileButton
              variant="ghost"
              onClick={() => setShowFilters(true)}
              className="p-2"
            >
              <Filter className="w-4 h-4" />
            </MobileButton>
            
            <MobileButton
              variant="ghost"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className="p-2"
            >
              <Edit className="w-4 h-4" />
            </MobileButton>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">
              {filteredAndSortedCards.length} cards
            </span>
            
            {onViewModeChange && (
              <div className="flex bg-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => onViewModeChange('list')}
                  className={cn(
                    'p-1 rounded',
                    viewMode === 'list' ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('grid')}
                  className={cn(
                    'p-1 rounded',
                    viewMode === 'grid' ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Selection mode controls */}
        {isSelectionMode && selectedCards.size > 0 && (
          <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <span className="text-sm text-blue-400">
              {selectedCards.size} selected
            </span>
            <div className="flex gap-2">
              <MobileButton
                variant="ghost"
                onClick={() => handleBulkAction('favorite')}
                className="p-2"
              >
                <Heart className="w-4 h-4" />
              </MobileButton>
              <MobileButton
                variant="ghost"
                onClick={() => handleBulkAction('remove')}
                className="p-2"
              >
                <Trash2 className="w-4 h-4" />
              </MobileButton>
            </div>
          </div>
        )}
      </div>
      
      {/* Card list */}
      <div className="flex-1 overflow-hidden">
        <PullToRefresh
          onRefresh={onRefresh || (() => Promise.resolve())}
          disabled={!onRefresh}
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {filteredAndSortedCards.map((card, index) => (
                <CardItem key={card.id} card={card} index={index} />
              ))}
            </div>
          ) : (
            <VirtualizedList
              items={filteredAndSortedCards}
              renderItem={({ item, index }) => (
                <div className="px-4 py-2">
                  <CardItem card={item} index={index} />
                </div>
              )}
              itemHeight={80}
              className="h-full"
            />
          )}
        </PullToRefresh>
      </div>
      
      {/* Filters sheet */}
      <MobileSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filters & Sort"
        position="bottom"
        size="lg"
      >
        <div className="p-4 space-y-6">
          {/* Sort options */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Sort by</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'name', label: 'Name' },
                { value: 'cmc', label: 'CMC' },
                { value: 'price', label: 'Price' },
                { value: 'color', label: 'Color' },
                { value: 'type', label: 'Type' },
                { value: 'category', label: 'Category' }
              ].map(option => (
                <MobileButton
                  key={option.value}
                  variant={sortBy === option.value ? 'primary' : 'secondary'}
                  onClick={() => setSortBy(option.value as SortOption)}
                  className="justify-center"
                >
                  {option.label}
                </MobileButton>
              ))}
            </div>
          </div>
          
          {/* Filter options */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Filter by</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'all', label: 'All Cards' },
                { value: 'favorites', label: 'Favorites' },
                { value: 'expensive', label: 'Expensive' },
                { value: 'budget', label: 'Budget' },
                { value: 'lands', label: 'Lands' },
                { value: 'spells', label: 'Spells' }
              ].map(option => (
                <MobileButton
                  key={option.value}
                  variant={filterBy === option.value ? 'primary' : 'secondary'}
                  onClick={() => setFilterBy(option.value as FilterOption)}
                  className="justify-center"
                >
                  {option.label}
                </MobileButton>
              ))}
            </div>
          </div>
        </div>
      </MobileSheet>
      
      {/* Card details sheet */}
      {showCardDetails && (
        <MobileSheet
          isOpen={!!showCardDetails}
          onClose={() => setShowCardDetails(null)}
          title="Card Details"
          position="bottom"
          size="lg"
        >
          {(() => {
            const card = cards.find(c => c.id === showCardDetails)
            if (!card) return null
            
            return (
              <div className="p-4 space-y-4">
                <div className="flex gap-4">
                  <div className="w-24 h-32 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded flex-shrink-0 flex items-center justify-center">
                    {card.imageUrl ? (
                      <img 
                        src={card.imageUrl} 
                        alt={card.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <span className="text-2xl">🃏</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{card.name}</h3>
                    <p className="text-sm text-zinc-400 mt-1">{card.manaCost}</p>
                    <p className="text-sm text-zinc-400">{card.types.join(' • ')}</p>
                    {card.price && (
                      <p className="text-lg text-green-400 mt-2">${card.price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <MobileButton
                    variant={card.isFavorite ? 'primary' : 'secondary'}
                    onClick={() => onCardUpdate(card.id, { isFavorite: !card.isFavorite })}
                    className="flex-1"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    {card.isFavorite ? 'Unfavorite' : 'Favorite'}
                  </MobileButton>
                  
                  <MobileButton
                    variant="danger"
                    onClick={() => {
                      onCardRemove(card.id)
                      setShowCardDetails(null)
                    }}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </MobileButton>
                </div>
              </div>
            )
          })()}
        </MobileSheet>
      )}
    </div>
  )
}