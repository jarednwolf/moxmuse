# MoxMuse API Reference

This document provides comprehensive documentation for all tRPC procedures and data schemas used in MoxMuse.

## Overview

MoxMuse uses [tRPC](https://trpc.io/) for type-safe API communication between the client and server. All procedures are organized into logical routers and include full TypeScript type definitions.

### Base URL
- **Development**: `http://localhost:3000/api/trpc`
- **Production**: `https://your-domain.com/api/trpc`

### Authentication
Most procedures require authentication via NextAuth.js session cookies. Protected procedures will return `UNAUTHORIZED` error if not authenticated.

## Router Structure

```typescript
export const appRouter = createTRPCRouter({
  tutor: tutorRouter,        // AI-powered deck building
  deck: deckRouter,          // Deck management
  user: userRouter,          // User management
  collection: collectionRouter, // Collection sync
})
```

## Tutor Router

AI-powered deck building and recommendation procedures.

### `tutor.generateFullDeck`

Generates a complete 100-card Commander deck based on consultation data.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  sessionId: string          // UUID for tracking generation session
  consultationData: {        // User preferences from wizard
    buildingFullDeck: boolean
    commander?: string
    strategy?: 'aggro' | 'control' | 'combo' | 'midrange' | 'tribal' | 'value' | 'stax'
    budget?: number
    powerLevel?: 1 | 2 | 3 | 4
    useCollection?: boolean
    // ... additional consultation fields
  }
  constraints?: {
    budget?: number          // Maximum budget in USD
    powerLevel?: number      // Target power level (1-4)
    useCollection?: boolean  // Prioritize owned cards
  }
}
```

#### Response Schema
```typescript
{
  id: string
  name: string
  commander: string
  format: 'commander'
  strategy: DeckStrategy
  winConditions: WinCondition[]
  powerLevel: number
  estimatedBudget: number
  cards: GeneratedDeckCard[]
  statistics: DeckStatistics
  createdAt: Date
}
```

#### Example Usage
```typescript
const generateDeck = trpc.tutor.generateFullDeck.useMutation({
  onSuccess: (deck) => {
    console.log(`Generated ${deck.name} with ${deck.cards.length} cards`)
  },
  onError: (error) => {
    console.error('Generation failed:', error.message)
  }
})

await generateDeck.mutateAsync({
  sessionId: 'uuid-here',
  consultationData: {
    buildingFullDeck: true,
    commander: 'Atraxa, Praetors\' Voice',
    strategy: 'control',
    budget: 500,
    powerLevel: 3
  }
})
```

### `tutor.getCommanderSuggestions`

Get AI-powered commander recommendations based on user preferences.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  sessionId: string
  prompt: string             // Natural language description of preferences
  constraints?: {
    budget?: number
    powerLevel?: number
    ownedOnly?: boolean
  }
}
```

#### Response Schema
```typescript
CommanderRecommendation[] = {
  id: string
  name: string
  colors: string[]           // Color identity (W, U, B, R, G)
  manaCost: string
  type: string
  oracleText: string
  reasoning: string          // AI explanation for recommendation
  strategy: string
  powerLevel: number
  estimatedBudget: number
  imageUrl?: string
}[]
```

#### Example Usage
```typescript
const getCommanders = trpc.tutor.getCommanderSuggestions.useMutation()

const commanders = await getCommanders.mutateAsync({
  sessionId: 'uuid-here',
  prompt: 'I want a control commander in Esper colors under $300',
  constraints: {
    budget: 300,
    powerLevel: 3
  }
})
```

### `tutor.analyzeDeck`

Analyze an existing deck for statistics, synergies, and improvement suggestions.

**Type**: `query`  
**Auth**: Required

#### Input Schema
```typescript
{
  deckId: string
}
```

#### Response Schema
```typescript
{
  statistics: {
    manaCurve: number[]      // Distribution by CMC [0,1,2,3,4,5,6,7+]
    colorDistribution: {
      white: number
      blue: number
      black: number
      red: number
      green: number
      colorless: number
    }
    typeDistribution: {
      creatures: number
      instants: number
      sorceries: number
      artifacts: number
      enchantments: number
      planeswalkers: number
      lands: number
    }
    averageCMC: number
    totalValue: number
  }
  synergies: CardSynergy[]
  weaknesses: string[]
  recommendations: string[]
}
```

### `tutor.recommendAndLink`

Get card recommendations with affiliate links for existing decks.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  sessionId: string
  prompt: string             // Natural language request
  deckId?: string           // Optional deck context
  budget?: number
  owned?: boolean           // Only suggest owned cards
}
```

#### Response Schema
```typescript
Recommendation[] = {
  id: string
  cardId: string
  cardName: string
  reason: string
  confidence: number        // 0-1 confidence score
  price?: number
  affiliateUrl?: string
  owned: boolean
  alternatives?: string[]   // Alternative card suggestions
}[]
```

## Deck Router

Core deck management operations.

### `deck.create`

Create a new deck.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  name: string              // 1-100 characters
  format: 'commander' | 'standard' | 'modern' | 'legacy'
  commander?: string        // Required for Commander format
  description?: string      // Max 1000 characters
  isPublic?: boolean        // Default: false
  powerLevel?: number       // 1-4 for Commander
  budget?: number          // Target budget in USD
  tags?: string[]          // Custom tags
}
```

#### Response Schema
```typescript
{
  id: string
  name: string
  format: string
  commander?: string
  description?: string
  isPublic: boolean
  powerLevel?: number
  budget?: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
  _count: {
    cards: number
  }
}
```

### `deck.update`

Update an existing deck.

**Type**: `mutation`  
**Auth**: Required (must own deck)

#### Input Schema
```typescript
{
  id: string
  name?: string
  description?: string
  isPublic?: boolean
  powerLevel?: number
  budget?: number
  tags?: string[]
}
```

### `deck.delete`

Delete a deck and all associated cards.

**Type**: `mutation`  
**Auth**: Required (must own deck)

#### Input Schema
```typescript
{
  id: string
}
```

### `deck.getById`

Get a specific deck with cards and statistics.

**Type**: `query`  
**Auth**: Required (must own deck or deck must be public)

#### Input Schema
```typescript
{
  id: string
  includeCards?: boolean    // Default: true
  includeStats?: boolean    // Default: true
}
```

#### Response Schema
```typescript
{
  id: string
  name: string
  format: string
  commander?: string
  description?: string
  isPublic: boolean
  powerLevel?: number
  budget?: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
  cards?: DeckCard[]
  statistics?: DeckStatistics
  _count: {
    cards: number
  }
}
```

### `deck.list`

Get user's decks with optional filtering and pagination.

**Type**: `query`  
**Auth**: Required

#### Input Schema
```typescript
{
  format?: string
  search?: string           // Search in name and description
  tags?: string[]          // Filter by tags
  limit?: number           // Default: 20, max: 100
  cursor?: string          // For pagination
  orderBy?: 'name' | 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}
```

#### Response Schema
```typescript
{
  decks: Deck[]
  nextCursor?: string      // For pagination
  hasMore: boolean
}
```

### `deck.addCard`

Add a card to a deck.

**Type**: `mutation`  
**Auth**: Required (must own deck)

#### Input Schema
```typescript
{
  deckId: string
  cardId: string
  quantity?: number         // Default: 1
  isCommander?: boolean     // Default: false
  category?: string         // e.g., 'ramp', 'draw', 'removal'
  boardState?: 'mainboard' | 'sideboard' | 'maybeboard'
}
```

### `deck.removeCard`

Remove a card from a deck.

**Type**: `mutation`  
**Auth**: Required (must own deck)

#### Input Schema
```typescript
{
  deckId: string
  cardId: string
  quantity?: number         // If not specified, removes all copies
}
```

### `deck.updateCard`

Update card quantity or metadata in a deck.

**Type**: `mutation`  
**Auth**: Required (must own deck)

#### Input Schema
```typescript
{
  deckId: string
  cardId: string
  quantity?: number
  category?: string
  boardState?: 'mainboard' | 'sideboard' | 'maybeboard'
}
```

## User Router

User management and preferences.

### `user.getProfile`

Get current user profile and preferences.

**Type**: `query`  
**Auth**: Required

#### Response Schema
```typescript
{
  id: string
  email: string
  name?: string
  image?: string
  createdAt: Date
  preferences?: {
    defaultFormat: string
    defaultPowerLevel: number
    budgetRange: [number, number]
    favoriteColors: string[]
  }
  _count: {
    decks: number
    collections: number
  }
}
```

### `user.updateProfile`

Update user profile information.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  name?: string
  preferences?: {
    defaultFormat?: string
    defaultPowerLevel?: number
    budgetRange?: [number, number]
    favoriteColors?: string[]
  }
}
```

## Collection Router

Collection management and synchronization.

### `collection.sync`

Sync collection from external platform.

**Type**: `mutation`  
**Auth**: Required

#### Input Schema
```typescript
{
  provider: 'moxfield' | 'archidekt' | 'csv'
  username?: string         // For platform sync
  csvData?: string         // For CSV import
  options?: {
    overwrite: boolean      // Replace existing collection
    includeWishlists: boolean
  }
}
```

#### Response Schema
```typescript
{
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  itemsTotal?: number
  itemsProcessed?: number
  errors?: string[]
}
```

### `collection.getSyncStatus`

Get status of a collection sync job.

**Type**: `query`  
**Auth**: Required

#### Input Schema
```typescript
{
  jobId: string
}
```

### `collection.list`

Get user's collection with filtering and search.

**Type**: `query`  
**Auth**: Required

#### Input Schema
```typescript
{
  search?: string          // Search card names
  colors?: string[]        // Filter by colors
  types?: string[]         // Filter by card types
  sets?: string[]          // Filter by sets
  rarity?: string[]        // Filter by rarity
  owned?: boolean          // Only owned cards
  limit?: number           // Default: 50
  cursor?: string          // For pagination
}
```

#### Response Schema
```typescript
{
  cards: CollectionCard[]
  nextCursor?: string
  hasMore: boolean
  totalCount: number
}
```

## Data Schemas

### Core Types

#### ConsultationData
```typescript
interface ConsultationData {
  buildingFullDeck: boolean
  needsCommanderSuggestions: boolean
  commander?: string
  commanderColors?: string[]
  strategy?: DeckStrategy
  themes?: string[]
  budget?: number
  powerLevel?: number
  useCollection?: boolean
  colorPreferences?: string[]
  winConditions?: WinConditions
  interaction?: InteractionPreferences
  avoidStrategies?: string[]
  avoidCards?: string[]
  complexityLevel?: 'simple' | 'moderate' | 'complex'
}
```

#### GeneratedDeck
```typescript
interface GeneratedDeck {
  id: string
  userId: string
  sessionId: string
  name: string
  commander: string
  format: string
  strategy: DeckStrategy
  winConditions: WinCondition[]
  powerLevel?: number
  estimatedBudget?: number
  consultationData: ConsultationData
  cards: GeneratedDeckCard[]
  statistics?: DeckStatistics
  createdAt: Date
  updatedAt: Date
}
```

#### DeckStatistics
```typescript
interface DeckStatistics {
  manaCurve: {
    distribution: number[]   // [0,1,2,3,4,5,6,7+]
    averageCMC: number
    peakCMC: number
  }
  colorDistribution: {
    white: number
    blue: number
    black: number
    red: number
    green: number
    colorless: number
    multicolor: number
  }
  typeDistribution: {
    creatures: number
    instants: number
    sorceries: number
    artifacts: number
    enchantments: number
    planeswalkers: number
    lands: number
  }
  totalCards: number
  totalValue: number
  landCount: number
  nonlandCount: number
}
```

## Error Codes

### Common Error Codes
- `UNAUTHORIZED` - User not authenticated
- `FORBIDDEN` - User lacks permission for resource
- `NOT_FOUND` - Resource does not exist
- `BAD_REQUEST` - Invalid input data
- `TOO_MANY_REQUESTS` - Rate limit exceeded
- `INTERNAL_SERVER_ERROR` - Unexpected server error

### AI Service Errors
- `AI_SERVICE_UNAVAILABLE` - OpenAI API is down
- `AI_GENERATION_FAILED` - Deck generation failed
- `AI_TIMEOUT` - Request timed out
- `AI_RATE_LIMITED` - OpenAI rate limit hit

### Example Error Response
```typescript
{
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: 'You can only generate 5 decks per hour',
    data: {
      retryAfter: 3600,      // Seconds until retry allowed
      limit: 5,
      remaining: 0
    }
  }
}
```

## Rate Limits

### General API
- **Authenticated users**: 1000 requests per hour
- **Unauthenticated**: 100 requests per hour

### AI Services
- **Deck generation**: 5 per hour per user
- **Commander suggestions**: 10 per hour per user
- **Card recommendations**: 20 per hour per user

### Collection Sync
- **Platform sync**: 3 per hour per user
- **CSV import**: 5 per hour per user

## Webhooks

### Collection Sync Events
```typescript
// POST to your webhook URL
{
  event: 'collection.sync.completed',
  data: {
    userId: string
    jobId: string
    status: 'completed' | 'failed'
    itemsProcessed: number
    errors?: string[]
  },
  timestamp: string
}
```

### Deck Generation Events
```typescript
{
  event: 'deck.generated',
  data: {
    userId: string
    deckId: string
    sessionId: string
    commander: string
    cardCount: number
  },
  timestamp: string
}
```

## Enhanced Endpoints (Tutor)

The Tutor router includes enhanced endpoints for full deck workflows, analysis, improvements, exports, and session persistence. Key endpoints:

- generateFullDeck: Creates a 100-card Commander deck with AI assistance. Input: GenerateFullDeckInputSchema. Output: generated deck and metadata.
- analyzeDeck: Calculates deck statistics, synergies, and strategy analysis. Input: AnalyzeDeckInputSchema.
- suggestDeckImprovements: AI-powered optimization suggestions with ownership awareness.
- exportDeck: Export to text/json/moxfield/archidekt.
- saveConsultationSession: Upserts wizard progress.

Implementation details include caching of analysis (1-hour TTL), comprehensive error handling (auth, ownership, AI failures), and Zod-validated inputs. See Tutor router source for exhaustive schemas and types.

This API reference provides comprehensive documentation for integrating with MoxMuse's tRPC API. All procedures include full TypeScript types for compile-time safety and excellent developer experience.