'use client'

import { useState } from 'react'
import { Search, Grid3X3, List, Filter, SortAsc, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface CollectionFilters {
  colors: string[]
  rarities: string[]
  types: string[]
  sets: string[]
  ownedOnly: boolean
}

export type SortOption = 'name' | 'set' | 'rarity' | 'quantity' | 'cmc'
export type ViewMode = 'grid' | 'list'

interface CollectionHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: CollectionFilters
  onFiltersChange: (filters: CollectionFilters) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
  totalCards: number
  filteredCards: number
  className?: string
}

const colorOptions = [
  { value: 'W', label: 'White', color: 'bg-gray-100 text-gray-900' },
  { value: 'U', label: 'Blue', color: 'bg-blue-500 text-white' },
  { value: 'B', label: 'Black', color: 'bg-gray-900 text-white' },
  { value: 'R', label: 'Red', color: 'bg-red-500 text-white' },
  { value: 'G', label: 'Green', color: 'bg-green-500 text-white' },
  { value: 'C', label: 'Colorless', color: 'bg-gray-500 text-white' }
]

const rarityOptions = [
  { value: 'common', label: 'Common', color: 'bg-gray-600' },
  { value: 'uncommon', label: 'Uncommon', color: 'bg-gray-400' },
  { value: 'rare', label: 'Rare', color: 'bg-yellow-500' },
  { value: 'mythic', label: 'Mythic', color: 'bg-orange-500' }
]

const typeOptions = [
  'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'
]

const sortOptions = [
  { value: 'name' as const, label: 'Name' },
  { value: 'set' as const, label: 'Set' },
  { value: 'rarity' as const, label: 'Rarity' },
  { value: 'quantity' as const, label: 'Quantity' },
  { value: 'cmc' as const, label: 'Mana Cost' }
]

export function CollectionHeader({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalCards,
  filteredCards,
  className
}: CollectionHeaderProps) {
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = 
    filters.colors.length + 
    filters.rarities.length + 
    filters.types.length + 
    filters.sets.length + 
    (filters.ownedOnly ? 1 : 0)

  const clearAllFilters = () => {
    onFiltersChange({
      colors: [],
      rarities: [],
      types: [],
      sets: [],
      ownedOnly: false
    })
  }

  const toggleColorFilter = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color]
    onFiltersChange({ ...filters, colors: newColors })
  }

  const toggleRarityFilter = (rarity: string) => {
    const newRarities = filters.rarities.includes(rarity)
      ? filters.rarities.filter(r => r !== rarity)
      : [...filters.rarities, rarity]
    onFiltersChange({ ...filters, rarities: newRarities })
  }

  const toggleTypeFilter = (type: string) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter(t => t !== type)
      : [...filters.types, type]
    onFiltersChange({ ...filters, types: newTypes })
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Header Row */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "border-zinc-700 text-zinc-300 hover:text-zinc-100",
            showFilters && "bg-zinc-700"
          )}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-purple-600 text-white">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-zinc-400" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode */}
        <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className={cn(
              "rounded-none border-0 px-3",
              viewMode === 'grid' 
                ? "bg-zinc-700 text-zinc-100" 
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={cn(
              "rounded-none border-0 px-3",
              viewMode === 'list' 
                ? "bg-zinc-700 text-zinc-100" 
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Showing {filteredCards.toLocaleString()} of {totalCards.toLocaleString()} cards
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-purple-400 hover:text-purple-300 underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
          {/* Colors */}
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-2">Colors</h3>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(color => (
                <button
                  key={color.value}
                  onClick={() => toggleColorFilter(color.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all",
                    color.color,
                    filters.colors.includes(color.value)
                      ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rarities */}
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-2">Rarity</h3>
            <div className="flex flex-wrap gap-2">
              {rarityOptions.map(rarity => (
                <button
                  key={rarity.value}
                  onClick={() => toggleRarityFilter(rarity.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium text-white transition-all",
                    rarity.color,
                    filters.rarities.includes(rarity.value)
                      ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-900"
                      : "opacity-70 hover:opacity-100"
                  )}
                >
                  {rarity.label}
                </button>
              ))}
            </div>
          </div>

          {/* Types */}
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-2">Card Types</h3>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map(type => (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                    filters.types.includes(type)
                      ? "bg-purple-600 text-white border-purple-500"
                      : "bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-zinc-500"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}