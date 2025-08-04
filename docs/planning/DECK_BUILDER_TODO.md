# Deck Builder Improvements TODO

## 1. Mana Curve Box Placement Issue
**Problem**: The mana curve visualization appears out of place during the deck building process.

### Tasks:
- [ ] Investigate where `DeckStatsSidebar` is being shown during deck building flow
- [ ] Hide deck statistics sidebar until a deck is actually created and has cards
- [ ] Only show the sidebar in the chat/recommendation phase, not during consultation
- [ ] Add conditional rendering based on consultation mode

### Implementation Notes:
```typescript
// Only show sidebar when in chat mode AND deck has cards
{activeDeck && consultationMode === 'chat' && deckCards.size > 0 && (
  <DeckStatsSidebar ... />
)}
```

---

## 2. Full Deck Generation UX Improvements
**Problem**: No progress indication during deck generation, chat interface isn't ideal for this process.

### Tasks:
- [ ] Create a dedicated deck generation progress component
- [ ] Show estimated time (e.g., "This usually takes 30-60 seconds")
- [ ] Add progress steps visualization:
  - Step 1: Analyzing commander strategy
  - Step 2: Selecting core cards
  - Step 3: Adding support cards
  - Step 4: Optimizing mana base
  - Step 5: Final adjustments
- [ ] Replace chat interface with a more professional deck builder interface
- [ ] Add cancel/abort functionality
- [ ] Show partial results as they come in

### UI Mockup:
```
Building Your Commander Deck
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Progress Bar: 60%]

✓ Analyzing Atraxa's abilities
✓ Selecting proliferate synergies
● Adding removal and interaction (15/20 cards)
○ Optimizing mana base
○ Final balance check

Estimated time remaining: 20 seconds
[Cancel Build]
```

---

## 3. Deck Generation Redirect Issue
**Problem**: After deck generation completes, user isn't redirected to the deck page.

### Tasks:
- [ ] Add navigation logic after successful deck generation
- [ ] Use Next.js router to redirect to `/decks/[deckId]`
- [ ] Pass deck ID from the generation response
- [ ] Show success message before redirect
- [ ] Handle edge cases where deck ID is missing

### Implementation:
```typescript
import { useRouter } from 'next/navigation'

// In generateFullDeckMutation onSuccess:
onSuccess: (data) => {
  if (data.deckId) {
    successToast('Deck created successfully! Redirecting...')
    setTimeout(() => {
      router.push(`/decks/${data.deckId}`)
    }, 1500)
  }
}
```

---

## 4. Deck Generation Errors
**Problem**: Multiple errors occurring during deck generation process.

### Root Causes:
1. **TRPC Error**: Backend failing to generate deck
2. **Component Update Warning**: State updates during render
3. **Cards Undefined Error**: Trying to access `deck.cards` when deck is undefined

### Tasks:
- [ ] Add null checks for deck data before accessing properties
- [ ] Fix component update timing issues
- [ ] Add proper error boundaries around deck generation
- [ ] Implement retry logic for failed generations
- [ ] Add fallback UI for error states
- [ ] Log detailed error information for debugging

### Error Handling Implementation:
```typescript
// Add null checks
const cardCount = data?.cards?.length || 0

// Fix setState timing
useEffect(() => {
  // Defer state updates to avoid render conflicts
  requestAnimationFrame(() => {
    setDeckData(data)
  })
}, [data])

// Add retry mechanism
const retryGeneration = () => {
  setRetryCount(prev => prev + 1)
  generateFullDeckMutation.mutate(originalParams)
}
```

---

## 5. Backend Investigation
**Problem**: TRPC endpoint failing to generate decks.

### Tasks:
- [ ] Check server logs for actual error
- [ ] Verify API keys are set (OpenAI, etc.)
- [ ] Check rate limiting
- [ ] Validate request payload structure
- [ ] Add better error messages from backend
- [ ] Implement timeout handling (60s+)

---

## Priority Order:
1. **Fix Errors (P0)**: Items #4 and #5 - System is broken without these
2. **Fix Redirect (P1)**: Item #3 - Core functionality issue  
3. **Improve UX (P1)**: Item #2 - Critical for user experience
4. **Fix UI Layout (P2)**: Item #1 - Visual polish

---

## Testing Checklist:
- [ ] Test with different commanders
- [ ] Test error scenarios (network failure, timeout)
- [ ] Test on slow connections
- [ ] Verify deck has exactly 100 cards
- [ ] Check that generated deck is playable
- [ ] Test cancel functionality
- [ ] Verify proper cleanup on component unmount
