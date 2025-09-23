# Enhanced Collection Browser Design

## Overview

The enhanced collection browser will transform the current basic grid into a sophisticated card management interface that integrates seamlessly with deck building and AI recommendations. The design focuses on usability, performance, and maintaining the existing dark MTG aesthetic.

## Architecture

### Component Structure
```
LotusList (Main Page)
├── CollectionHeader (Search, Filters, View Controls)
├── CollectionStats (Quick stats display)
├── CollectionGrid (Card display area)
│   ├── CardItem (Individual card component)
│   └── EmptyState (No cards/results state)
└── DeckContext (Active deck sidebar - optional)
```

### State Management
- Use React Query (already integrated) for collection data
- Local state for filters, search, and view preferences
- Context for active deck state when building
- Debounced search to avoid excessive API calls

## Components and Interfaces

### CollectionHeader Component
```typescript
interface CollectionHeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: CollectionFilters
  onFiltersChange: (filters: CollectionFilters) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

interface CollectionFilters {
  colors: string[]
  rarities: string[]
  types: string[]
  sets: string[]
  ownedOnly: boolean
}

type SortOption = 'name' | 'set' | 'rarity' | 'quantity' | 'cmc'
```

### Enhanced CardItem Component
```typescript
interface CardItemProps {
  card: EnrichedCollectionCard
  viewMode: 'grid' | 'list'
  activeDeck?: Deck
  onAddToDeck?: (cardId: string) => void
  onRemoveFromDeck?: (cardId: string) => void
}

interface EnrichedCollectionCard {
  cardId: string
  quantity: number
  foilQuantity: number
  condition: string
  language: string
  card: ScryfallCard
  inDeck?: number // quantity already in active deck
}
```

### Filter System Design
- **Color Filter**: Multi-select with WUBRG color symbols
- **Rarity Filter**: Checkboxes for Common, Uncommon, Rare, Mythic
- **Type Filter**: Dropdown with major types (Creature, Instant, Sorcery, etc.)
- **Set Filter**: Searchable dropdown with recent sets prioritized
- **Advanced Filters**: Collapsible section for CMC range, owned quantity, etc.

## Data Models

### Collection Query Enhancement
```typescript
interface CollectionQueryParams {
  search?: string
  colors?: string[]
  rarities?: string[]
  types?: string[]
  sets?: string[]
  sortBy?: SortOption
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

### Deck Context Integration
```typescript
interface DeckBuildingContext {
  activeDeck: Deck | null
  deckCards: Map<string, number> // cardId -> quantity
  addCardToDeck: (cardId: string, quantity?: number) => Promise<void>
  removeCardFromDeck: (cardId: string, quantity?: number) => Promise<void>
  deckStats: {
    totalCards: number
    manaCurve: number[]
    colorDistribution: Record<string, number>
  }
}
```

## Error Handling

### Collection Loading States
- **Loading**: Skeleton cards while fetching
- **Error**: Retry button with error message
- **Empty**: Helpful message with link to SolSync
- **No Results**: Clear filters button and suggestions

### Deck Building Error Handling
- **Deck Full**: Warning when approaching 100 cards
- **Invalid Addition**: Feedback for singleton violations
- **Network Errors**: Optimistic updates with rollback on failure

## Testing Strategy

### Unit Tests
- Filter logic with various combinations
- Search functionality with edge cases
- Card addition/removal to deck
- Sort and view mode persistence

### Integration Tests
- Collection data fetching and caching
- Deck building workflow end-to-end
- Filter performance with large collections
- Mobile responsiveness

### Performance Considerations
- Virtual scrolling for large collections (1000+ cards)
- Image lazy loading with placeholder
- Debounced search (300ms delay)
- Memoized filter calculations
- Optimistic updates for deck changes

## UI/UX Design Decisions

### Visual Hierarchy
1. **Search bar** - Primary action, prominent placement
2. **Filters** - Secondary, collapsible on mobile
3. **View controls** - Tertiary, top-right placement
4. **Cards** - Main content area with clear focus

### Card Display Modes

#### Grid View
- Card images as primary visual element
- Overlay with quantity, condition, deck status
- Hover effects for additional details
- 4-6 cards per row depending on screen size

#### List View
- Compact rows with card image thumbnail
- Full details visible: name, set, rarity, quantity, condition
- Quick action buttons for deck building
- Sortable columns

### Mobile Adaptations
- Collapsible filter drawer
- Larger touch targets for card actions
- Simplified grid (2-3 cards per row)
- Sticky search bar
- Bottom sheet for card details

### Accessibility
- Keyboard navigation for all filters
- Screen reader support for card details
- High contrast mode compatibility
- Focus management for modal interactions

## Integration Points

### TolarianTutor Integration
- Pass collection context to AI recommendations
- Highlight owned cards in AI responses
- Quick "Add to Deck" from recommendation cards
- Update deck context in real-time during chat

### SolSync Integration
- Refresh collection data after imports
- Show import status and progress
- Link to add more sources when collection is empty

### Future Pricing Integration (V2)
- Price display on cards
- Value sorting option
- Collection value calculations
- Price change indicators