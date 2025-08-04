'use client'

import React, { useState, useCallback } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { trpc } from '../../lib/trpc/client'
import { CardSearchQuery, ScryfallCard } from '@moxmuse/shared'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

// Local type definitions
interface SearchSuggestion {
  type: 'card' | 'keyword' | 'set' | 'type'
  value: string
  label?: string
}

// Extended search query with UI-only fields
interface ExtendedCardSearchQuery extends Partial<CardSearchQuery> {
  limit?: number
  offset?: number
  sortBy?: 'name' | 'cmc' | 'power' | 'toughness' | 'price' | 'releaseDate'
  sortOrder?: 'asc' | 'desc'
  cmcRange?: [number, number]
  rarities?: string[]
  typeText?: string
  sets?: string[]
  hasKeywords?: string[]
}

interface CardSearchProps {
  onCardSelect?: (card: ScryfallCard) => void
  onAddToDeck?: (cardId: string) => void
  initialQuery?: Partial<ExtendedCardSearchQuery>
  className?: string
}

export const CardSearch: React.FC<CardSearchProps> = ({
  onCardSelect,
  onAddToDeck,
  initialQuery = {},
  className
}) => {
  const [query, setQuery] = useState<ExtendedCardSearchQuery>({
    text: '',
    ...initialQuery
  })
  
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 300)

  // Handlers
  const handleTextSearch = useCallback((text: string) => {
    setQuery(prev => ({
      ...prev,
      text
    }))
  }, [])

  const handleAdvancedSearch = useCallback((advancedQuery: Partial<ExtendedCardSearchQuery>) => {
    setQuery(prev => ({
      ...prev,
      ...advancedQuery
    }))
    setShowAdvanced(false)
  }, [])

  return (
    <div className={cn("card-search", className)}>
      {/* Search Header */}
      <Card className="p-4 mb-4">
        <div className="space-y-4">
          {/* Main search input */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search for cards..."
              value={query.text || ''}
              onChange={(e) => handleTextSearch(e.target.value)}
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                Advanced
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Advanced search form - simplified */}
      {showAdvanced && (
        <Card className="p-4 mb-4">
          <div className="space-y-4">
            <h3 className="font-medium">Advanced Search</h3>
            <p className="text-sm text-muted-foreground">
              Advanced search functionality coming soon...
            </p>
            <Button onClick={() => setShowAdvanced(false)}>
              Close
            </Button>
          </div>
        </Card>
      )}

      {/* Search results placeholder */}
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          Card search functionality is being implemented...
        </p>
      </Card>
    </div>
  )
}

export default CardSearch
