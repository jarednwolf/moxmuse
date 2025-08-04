# Scalable Deck Architecture Plan

## Current Issues

### 1. Immediate Problem
The deck view shows "0 cards" because:
- Generated decks store card IDs in one format (likely Scryfall IDs)
- The `getCardDetails` endpoint returns cards with `id` field
- The comparison `card.id === deckCard.cardId` fails due to format mismatch

### 2. Architectural Problems
- **No Card Metadata Storage**: Cards are stored as IDs only, requiring API calls for every view
- **Format Inconsistency**: Different parts of the system use different ID formats
- **No Caching**: Every deck view triggers multiple Scryfall API calls
- **External API Dependency**: System breaks if Scryfall is down or changes
- **Performance Issues**: Loading 99 cards requires fetching all their details repeatedly

## Long-Term Scalable Solution

### Phase 1: Immediate Fix (1-2 days)
Fix the display issue while maintaining current architecture:

```typescript
// Fix the comparison in deck view
const enrichedDeckCards = useMemo(() => {
  if (!deck?.cards || !cardDetails) return []
  
  return deck.cards.map(deckCard => ({
    ...deckCard,
    card: cardDetails.find((card: any) => 
      card.id === deckCard.cardId || 
      card.oracle_id === deckCard.cardId ||
      card.scryfall_id === deckCard.cardId
    ),
  })).filter(item => item.card)
}, [deck?.cards, cardDetails])
```

### Phase 2: Card Metadata System (1 week)

#### 1. Create Card Master Table
```prisma
model Card {
  id              String   @id // Scryfall ID
  oracleId        String   @unique
  name            String
  manaCost        String?
  cmc             Float
  typeLine        String
  oracleText      String?
  power           String?
  toughness       String?
  colors          String[]
  colorIdentity   String[]
  imageUris       Json
  prices          Json
  set             String
  setName         String
  collectorNumber String
  rarity          String
  artist          String?
  flavorText      String?
  lastUpdated     DateTime @default(now())
  
  @@index([name])
  @@index([oracleId])
  @@index([cmc])
  @@index([colors])
}
```

#### 2. Card Sync Service
```typescript
class CardSyncService {
  async syncCard(scryfallId: string): Promise<Card> {
    // Check cache first
    const cached = await prisma.card.findUnique({ where: { id: scryfallId } })
    if (cached && isRecent(cached.lastUpdated)) {
      return cached
    }
    
    // Fetch from Scryfall
    const scryfallData = await scryfallService.getCard(scryfallId)
    
    // Upsert to database
    return await prisma.card.upsert({
      where: { id: scryfallId },
      create: mapScryfallToCard(scryfallData),
      update: mapScryfallToCard(scryfallData)
    })
  }
  
  async syncBatch(scryfallIds: string[]): Promise<Card[]> {
    // Efficient batch processing with rate limiting
    const chunks = chunk(scryfallIds, 75) // Scryfall limit
    const results = []
    
    for (const chunk of chunks) {
      const cards = await scryfallService.getCollection(chunk)
      await prisma.card.createMany({
        data: cards.map(mapScryfallToCard),
        skipDuplicates: true
      })
      results.push(...cards)
      await sleep(100) // Rate limiting
    }
    
    return results
  }
}
```

### Phase 3: Enhanced Deck Generation (2 weeks)

#### 1. Store Card Data During Generation
```typescript
// In deck generation process
async function generateDeck(params: DeckGenerationParams) {
  // Generate deck with AI
  const generatedCards = await openAIService.generateDeck(params)
  
  // Sync all cards to database
  const cardIds = generatedCards.map(c => c.scryfallId)
  await cardSyncService.syncBatch(cardIds)
  
  // Create deck with full card references
  const deck = await prisma.generatedDeck.create({
    data: {
      ...deckData,
      cards: {
        create: generatedCards.map(card => ({
          cardId: card.scryfallId,
          quantity: card.quantity,
          category: card.category,
          // Store snapshot of card data for historical purposes
          cardSnapshot: {
            name: card.name,
            cmc: card.cmc,
            imageUri: card.imageUri
          }
        }))
      }
    },
    include: {
      cards: {
        include: {
          card: true // Now we can include full card data
        }
      }
    }
  })
  
  return deck
}
```

#### 2. Optimized Deck View
```typescript
// New deck router endpoint
deckRouter.getWithCards.query(async ({ input }) => {
  const deck = await prisma.deck.findUnique({
    where: { id: input.deckId },
    include: {
      cards: {
        include: {
          card: true // Direct join with card table
        }
      }
    }
  })
  
  return deck
})
```

### Phase 4: Performance & Scalability (1 month)

#### 1. Redis Caching Layer
```typescript
class DeckCacheService {
  private redis: Redis
  private ttl = 3600 // 1 hour
  
  async getDeck(deckId: string): Promise<DeckWithCards | null> {
    const cached = await this.redis.get(`deck:${deckId}`)
    if (cached) return JSON.parse(cached)
    
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: { cards: { include: { card: true } } }
    })
    
    if (deck) {
      await this.redis.setex(
        `deck:${deckId}`,
        this.ttl,
        JSON.stringify(deck)
      )
    }
    
    return deck
  }
  
  async invalidateDeck(deckId: string) {
    await this.redis.del(`deck:${deckId}`)
  }
}
```

#### 2. Background Jobs for Card Updates
```typescript
// Bull queue for card sync jobs
const cardSyncQueue = new Queue('card-sync', {
  redis: { host: 'localhost', port: 6379 }
})

cardSyncQueue.process(async (job) => {
  const { cardIds } = job.data
  await cardSyncService.syncBatch(cardIds)
})

// Schedule daily updates for popular cards
cron.schedule('0 3 * * *', async () => {
  const popularCards = await prisma.card.findMany({
    where: { lastUpdated: { lt: subDays(new Date(), 7) } },
    orderBy: { usageCount: 'desc' },
    take: 1000
  })
  
  await cardSyncQueue.add('sync-batch', {
    cardIds: popularCards.map(c => c.id)
  })
})
```

#### 3. GraphQL for Efficient Data Fetching
```graphql
type Deck {
  id: ID!
  name: String!
  cards: [DeckCard!]!
  stats: DeckStats!
  manaCurve: [ManaCurvePoint!]!
}

type DeckCard {
  quantity: Int!
  card: Card!
  category: String
}

type Card {
  id: ID!
  name: String!
  manaCost: String
  cmc: Float!
  imageUris: ImageUris!
  prices: Prices!
}

# Client can request only needed fields
query GetDeck($id: ID!) {
  deck(id: $id) {
    id
    name
    cards {
      quantity
      card {
        id
        name
        imageUris {
          small
        }
      }
    }
  }
}
```

### Phase 5: Advanced Features (2-3 months)

#### 1. Card Version Tracking
```prisma
model CardVersion {
  id          String   @id @default(cuid())
  cardId      String
  version     Int
  data        Json
  validFrom   DateTime
  validTo     DateTime?
  
  card        Card     @relation(fields: [cardId], references: [id])
  
  @@index([cardId, validFrom])
}
```

#### 2. Offline Support
```typescript
// Service Worker for offline deck viewing
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/deck/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          return caches.open('deck-cache').then((cache) => {
            cache.put(event.request, response.clone())
            return response
          })
        })
      })
    )
  }
})
```

#### 3. Real-time Collaboration
```typescript
// Socket.io for real-time deck editing
io.on('connection', (socket) => {
  socket.on('join-deck', (deckId) => {
    socket.join(`deck:${deckId}`)
  })
  
  socket.on('card-added', async (data) => {
    const { deckId, cardId, quantity } = data
    
    // Update database
    await prisma.deckCard.create({
      data: { deckId, cardId, quantity }
    })
    
    // Invalidate cache
    await deckCacheService.invalidateDeck(deckId)
    
    // Notify other users
    socket.to(`deck:${deckId}`).emit('deck-updated', {
      type: 'card-added',
      cardId,
      quantity
    })
  })
})
```

## Implementation Priority

### Immediate (This Week)
1. Fix the ID comparison bug in deck view
2. Add proper error handling and loading states
3. Create a temporary card data enrichment endpoint

### Short Term (Next Month)
1. Implement Card master table
2. Create card sync service
3. Update deck generation to store card references
4. Add Redis caching for frequently accessed decks

### Medium Term (Next Quarter)
1. Implement background job system for card updates
2. Add GraphQL API for efficient data fetching
3. Create card version tracking system
4. Implement offline support

### Long Term (Next 6 Months)
1. Real-time collaboration features
2. Advanced caching strategies
3. Horizontal scaling preparation
4. Machine learning for card recommendations

## Key Benefits

1. **Performance**: 10-100x faster deck loading
2. **Reliability**: No dependency on external APIs for viewing
3. **Scalability**: Can handle millions of decks and cards
4. **Features**: Enables offline support, real-time collaboration
5. **Cost**: Reduced API calls to external services
6. **User Experience**: Instant deck loading, no more "0 cards" issues

## Migration Strategy

1. **Backward Compatibility**: New system works with existing data
2. **Gradual Rollout**: Feature flag for new deck view
3. **Data Migration**: Background job to populate card table
4. **Zero Downtime**: All changes are additive, not breaking

## Monitoring & Success Metrics

- Deck load time: Target < 200ms (currently 2-5s)
- API reliability: Target 99.9% uptime
- Cache hit rate: Target > 90%
- User satisfaction: Reduce "deck not loading" complaints to zero
- Cost reduction: 80% fewer Scryfall API calls

## Conclusion

This architecture solves the immediate "0 cards" issue while building a foundation for a scalable, performant, and feature-rich deck management system. The phased approach allows for quick wins while working toward the long-term vision.
