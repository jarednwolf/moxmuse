# AI-First Deck Generation: 99-Card Accuracy Plan

## Current Issues

After analyzing the AI-first implementation, here are the key issues preventing consistent 99-card deck generation:

1. **Token Limits**: The 4000 token limit may truncate long card lists
2. **Weak Parsing**: The `parseFinalDeck` method has unreliable fallback parsing
3. **No Validation Loop**: No mechanism to retry if card count is wrong
4. **Insufficient Guidance**: AI needs better instructions for basic land calculation
5. **No Structured Output**: Relying on JSON parsing from free-form text

## Solution Strategy

### 1. Implement Multi-Stage Generation

Instead of asking for all 99 cards at once, break it into stages:

```typescript
// Stage 1: Commander Selection & Strategy
const stage1 = await generateCommanderAndStrategy(request);

// Stage 2: Core Cards (30-40 cards)
const stage2 = await generateCoreCards(commander, strategy);

// Stage 3: Support Cards (30-40 cards)
const stage3 = await generateSupportCards(commander, coreCards);

// Stage 4: Lands & Fill (remaining cards)
const stage4 = await generateLandsAndFill(commander, existingCards);
```

### 2. Enhanced Prompt Engineering

```typescript
const CARD_GENERATION_RULES = `
CRITICAL RULES FOR CARD GENERATION:
1. You MUST generate EXACTLY the number of cards requested
2. Count each card as you add it
3. For basic lands, use this formula:
   - Total lands needed: ~37-40
   - Non-basic lands: (you determine based on budget/strategy)
   - Basic lands needed: 37-40 minus non-basic count
   - Distribute basics evenly among commander's colors
4. Double-check your count before responding
5. If you're unsure about reaching the exact count, add more basic lands

RESPONSE FORMAT:
{
  "cards": [
    {"name": "Card Name", "category": "core|support|land|ramp|removal|draw", "quantity": 1}
  ],
  "count": <exact number>,
  "verification": "I have provided exactly X cards"
}
`;
```

### 3. Implement Validation & Correction Loop

```typescript
async function ensureExactly99Cards(
  generator: AIFirstDeckGenerator,
  commander: string,
  partialDeck: string[]
): Promise<string[]> {
  let deck = [...partialDeck];
  let attempts = 0;
  const maxAttempts = 3;
  
  while (deck.length !== 99 && attempts < maxAttempts) {
    attempts++;
    
    if (deck.length < 99) {
      // Ask AI to add exact number of missing cards
      const missing = 99 - deck.length;
      const additionalCards = await generator.generateAdditionalCards(
        commander,
        deck,
        missing
      );
      deck.push(...additionalCards);
    } else if (deck.length > 99) {
      // Ask AI to remove excess cards
      const excess = deck.length - 99;
      const cardsToRemove = await generator.selectCardsToRemove(
        commander,
        deck,
        excess
      );
      deck = deck.filter(card => !cardsToRemove.includes(card));
    }
  }
  
  // Final failsafe: trim or pad with basic lands
  if (deck.length > 99) {
    deck = deck.slice(0, 99);
  } else if (deck.length < 99) {
    const basics = getBasicLandsForCommander(commander);
    while (deck.length < 99) {
      deck.push(basics[deck.length % basics.length]);
    }
  }
  
  return deck;
}
```

### 4. Structured Output with JSON Mode

Use OpenAI's JSON mode for more reliable parsing:

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [...],
  response_format: { type: "json_object" },
  // ... other params
});
```

### 5. Category-Based Generation

Generate cards by category to ensure proper deck composition:

```typescript
const DECK_CATEGORIES = {
  lands: { target: 37, prompt: "Generate land cards" },
  ramp: { target: 10, prompt: "Generate mana ramp cards" },
  removal: { target: 10, prompt: "Generate removal/interaction" },
  draw: { target: 10, prompt: "Generate card draw/advantage" },
  core: { target: 20, prompt: "Generate core strategy cards" },
  support: { target: 12, prompt: "Generate support/utility cards" }
};

async function generateByCategory(
  commander: string,
  category: string,
  target: number
): Promise<string[]> {
  // Generate exactly 'target' number of cards for this category
}
```

### 6. Basic Land Calculator

Implement a smart basic land calculator:

```typescript
function calculateBasicLands(
  commander: Card,
  nonBasicLands: Card[],
  totalCards: number
): Map<string, number> {
  const targetLands = 37; // Standard for Commander
  const basicsNeeded = targetLands - nonBasicLands.length;
  const colors = commander.colorIdentity;
  
  // Distribute evenly among colors
  const basicsPerColor = Math.floor(basicsNeeded / colors.length);
  const remainder = basicsNeeded % colors.length;
  
  const distribution = new Map<string, number>();
  colors.forEach((color, index) => {
    const count = basicsPerColor + (index < remainder ? 1 : 0);
    distribution.set(getBasicLandForColor(color), count);
  });
  
  return distribution;
}
```

### 7. Incremental Token Management

To avoid token limits, use incremental generation:

```typescript
async function generateDeckIncremental(request: AIFirstRequest) {
  const messages: ChatMessage[] = [];
  let currentDeck: string[] = [];
  
  // Generate in chunks of 20-30 cards
  while (currentDeck.length < 99) {
    const remaining = 99 - currentDeck.length;
    const chunkSize = Math.min(25, remaining);
    
    const chunk = await generateCardChunk(
      messages,
      currentDeck,
      chunkSize,
      request
    );
    
    currentDeck.push(...chunk);
    messages.push({
      role: 'assistant',
      content: `Added ${chunk.length} cards. Total: ${currentDeck.length}/99`
    });
  }
  
  return currentDeck;
}
```

## Implementation Checklist

- [ ] Refactor `deck-generator-ai-first.ts` to use multi-stage generation
- [ ] Implement validation & correction loop
- [ ] Add JSON response format for reliable parsing
- [ ] Create category-based generation system
- [ ] Implement smart basic land calculator
- [ ] Add incremental generation for token management
- [ ] Create comprehensive test suite
- [ ] Add telemetry to track success rates

## Testing Strategy

1. **Unit Tests**: Test each component individually
2. **Integration Tests**: Test full deck generation flow
3. **Validation Tests**: Ensure all decks are exactly 99 cards
4. **Edge Cases**: Test with various commander colors, strategies
5. **Stress Tests**: Generate 100+ decks to verify consistency

## Success Metrics

- **99-Card Accuracy**: 100% of generated decks have exactly 99 cards
- **Legal Decks**: 100% pass Commander legality validation
- **Generation Time**: < 30 seconds per deck
- **Token Efficiency**: Stay within token limits
- **Retry Rate**: < 10% need correction loops

## Next Steps

1. Implement the enhanced AI-first generator with these improvements
2. Create comprehensive test suite
3. Run validation tests on 100+ deck generations
4. Fine-tune prompts based on results
5. Deploy with monitoring and telemetry
