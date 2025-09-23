'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { VirtualizedCardList, VirtualizedCardGrid } from '../ui'
import { usePerformanceMonitor } from '../../lib/performance/PerformanceMonitor'
import { 
  Button, 
  Input, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger,
  Badge 
} from '../ui'

// Extended Card interface that includes all properties
interface ExtendedCard {
    id: string
    name: string
    manaCost?: string
    cmc: number
    typeLine: string
    oracleText?: string
    colors: string[]
    colorIdentity: string[]
    imageUris?: Record<string, string>
    prices?: Record<string, any>
    legalities?: Record<string, string>
}

// Base Card interface that matches VirtualizedList expectations
interface BaseCard {
    id: string
    name: string
    manaCost?: string
    cmc: number
    typeLine: string
    imageUris?: Record<string, string>
    prices?: Record<string, any>
}

interface PerformanceOptimizedCardListProps {
    cards: ExtendedCard[]
    onCardSelect?: (card: ExtendedCard) => void
    onLoadMore?: () => Promise<void>
    hasNextPage?: boolean
    isLoading?: boolean
    className?: string
}

export function PerformanceOptimizedCardList({
    cards,
    onCardSelect,
    onLoadMore,
    hasNextPage,
    isLoading,
    className,
}: PerformanceOptimizedCardListProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'name' | 'cmc' | 'type'>('name')
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
    const [showImages, setShowImages] = useState(true)
    const [compact, setCompact] = useState(false)

    const { recordMetric, measureSync } = usePerformanceMonitor()

    // Memoized filtered and sorted cards
    const processedCards = useMemo(() => {
        return measureSync('card-list-processing', () => {
            let filtered = cards

            // Filter by search query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase()
                filtered = cards.filter(card =>
                    card.name.toLowerCase().includes(query) ||
                    card.typeLine.toLowerCase().includes(query) ||
                    card.oracleText?.toLowerCase().includes(query)
                )
            }

            // Sort cards
            filtered.sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name)
                    case 'cmc':
                        return a.cmc - b.cmc || a.name.localeCompare(b.name)
                    case 'type':
                        return a.typeLine.localeCompare(b.typeLine) || a.name.localeCompare(b.name)
                    default:
                        return 0
                }
            })

            recordMetric('card-list-filter-sort', filtered.length)
            return filtered
        })
    }, [cards, searchQuery, sortBy, measureSync, recordMetric])

    const handleCardSelect = useCallback((card: BaseCard) => {
        recordMetric('card-selection', 1)
        // Find the full card data to pass to the callback
        const fullCard = cards.find(c => c.id === card.id)
        if (fullCard) {
            onCardSelect?.(fullCard)
        }
    }, [onCardSelect, recordMetric, cards])

    const handleLoadMore = useCallback(async () => {
        if (!onLoadMore || isLoading) return

        recordMetric('load-more-triggered', 1)
        try {
            await onLoadMore()
            recordMetric('load-more-success', 1)
        } catch (error) {
            recordMetric('load-more-error', 1)
            console.error('Failed to load more cards:', error)
        }
    }, [onLoadMore, isLoading, recordMetric])

    // Convert ExtendedCard to BaseCard for VirtualizedList components
    const baseCards: BaseCard[] = useMemo(() =>
        processedCards.map(card => ({
            id: card.id,
            name: card.name,
            manaCost: card.manaCost,
            cmc: card.cmc,
            typeLine: card.typeLine,
            imageUris: card.imageUris,
            prices: card.prices,
        })), [processedCards]
    )

    const renderListView = () => (
        <VirtualizedCardList
            cards={baseCards}
            height={600}
            onCardSelect={handleCardSelect}
            onLoadMore={handleLoadMore}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            showImages={showImages}
            compact={compact}
            className="border rounded-lg"
        />
    )

    const renderGridView = () => (
        <VirtualizedCardGrid
            cards={baseCards}
            height={600}
            itemWidth={200}
            itemHeight={280}
            gap={16}
            onCardSelect={handleCardSelect}
            onLoadMore={handleLoadMore}
            hasNextPage={hasNextPage}
            isLoading={isLoading}
            className="border rounded-lg p-4"
        />
    )

    return (
        <div className={className}>
            {/* Controls */}
            <div className="space-y-4 mb-6">
                {/* Search and Sort */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Search cards by name, type, or text..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="cmc">Mana Cost</SelectItem>
                            <SelectItem value="type">Type</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* View Options */}
                <div className="flex flex-wrap items-center gap-4">
                    <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                        <TabsList>
                            <TabsTrigger value="list">List View</TabsTrigger>
                            <TabsTrigger value="grid">Grid View</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-2">
                        <Button
                            variant={showImages ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowImages(!showImages)}
                        >
                            {showImages ? "Hide Images" : "Show Images"}
                        </Button>

                        {viewMode === 'list' && (
                            <Button
                                variant={compact ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCompact(!compact)}
                            >
                                {compact ? "Expand" : "Compact"}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">
                        {processedCards.length} of {cards.length} cards
                    </Badge>

                    {searchQuery && (
                        <Badge variant="outline">
                            Filtered by: "{searchQuery}"
                        </Badge>
                    )}

                    <Badge variant="outline">
                        Sorted by: {sortBy}
                    </Badge>

                    {hasNextPage && (
                        <Badge variant="outline">
                            More available
                        </Badge>
                    )}
                </div>
            </div>

            {/* Card List/Grid */}
            <Tabs value={viewMode} className="w-full">
                <TabsContent value="list" className="mt-0">
                    {renderListView()}
                </TabsContent>

                <TabsContent value="grid" className="mt-0">
                    {renderGridView()}
                </TabsContent>
            </Tabs>

            {/* Performance Info (Development Only) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Performance Info</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="font-medium">Total Cards</div>
                            <div className="text-muted-foreground">{cards.length}</div>
                        </div>
                        <div>
                            <div className="font-medium">Filtered Cards</div>
                            <div className="text-muted-foreground">{processedCards.length}</div>
                        </div>
                        <div>
                            <div className="font-medium">View Mode</div>
                            <div className="text-muted-foreground">{viewMode}</div>
                        </div>
                        <div>
                            <div className="font-medium">Virtualized</div>
                            <div className="text-muted-foreground">✓ Enabled</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Example usage component
export function CardListDemo() {
    const [cards, setCards] = useState<ExtendedCard[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasNextPage, setHasNextPage] = useState(true)

    // Generate mock cards for demonstration
    const generateMockCards = useCallback((count: number, startIndex = 0): ExtendedCard[] => {
        return Array.from({ length: count }, (_, i) => {
            const index = startIndex + i
            const colors = [['W'], ['U'], ['B'], ['R'], ['G'], ['W', 'U'], ['B', 'R']][index % 7]

            return {
                id: `card-${index}`,
                name: `Example Card ${index + 1}`,
                manaCost: `{${index % 10}}`,
                cmc: index % 10,
                typeLine: ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact'][index % 5],
                oracleText: `This is the oracle text for card ${index + 1}. It does something interesting.`,
                colors,
                colorIdentity: colors,
                imageUris: {
                    small: `https://cards.scryfall.io/small/front/a/b/card-${index}.jpg`,
                    normal: `https://cards.scryfall.io/normal/front/a/b/card-${index}.jpg`,
                },
                prices: {
                    usd: ((index % 100) / 10).toFixed(2),
                },
                legalities: {
                    commander: 'legal',
                    modern: index % 3 === 0 ? 'legal' : 'not_legal',
                },
            }
        })
    }, [])

    // Initialize with some cards
    React.useEffect(() => {
        setCards(generateMockCards(100))
    }, [generateMockCards])

    const handleLoadMore = useCallback(async () => {
        setIsLoading(true)

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        const newCards = generateMockCards(50, cards.length)
        setCards(prev => [...prev, ...newCards])

        // Stop loading more after 500 cards
        if (cards.length >= 450) {
            setHasNextPage(false)
        }

        setIsLoading(false)
    }, [cards.length, generateMockCards])

    const handleCardSelect = useCallback((card: ExtendedCard) => {
        console.log('Selected card:', card.name)
    }, [])

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Performance Optimized Card List</h1>
                <p className="text-muted-foreground">
                    Demonstrating virtualized lists, optimized images, and performance monitoring.
                </p>
            </div>

            <PerformanceOptimizedCardList
                cards={cards}
                onCardSelect={handleCardSelect}
                onLoadMore={handleLoadMore}
                hasNextPage={hasNextPage}
                isLoading={isLoading}
            />
        </div>
    )
}