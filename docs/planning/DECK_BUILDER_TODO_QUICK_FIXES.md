# Quick Fixes for Immediate Issues

## 1. Hide Mana Curve Box During Deck Building

```typescript
// In TutorPageContent, update the sidebar conditional:
{activeDeck && consultationMode === 'chat' && deckCards.size > 0 && (
  <div className="w-80 bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-700/50 flex flex-col">
    <DeckStatsSidebar ... />
  </div>
)}
```

## 2. Add Null Checks for Cards

```typescript
// In generateFullDeckMutation onSuccess:
onSuccess: (data) => {
  console.log('✅ Full deck generated successfully:', data)
  
  // Validate the response data
  if (!data || !data.cards || !Array.isArray(data.cards)) {
    console.error('❌ Invalid deck data received:', data)
    setMessages(prev => [...prev, {
      type: 'assistant',
      content: "I encountered an issue with the deck generation response. The deck data seems to be incomplete. Please try again, and I'll create your optimized 100-card Commander deck."
    }])
    setIsGenerating(false)
    return
  }

  const cardCount = data?.cards?.length || 0
  // ... rest of success handler
}
```

## 3. Fix State Update During Render

```typescript
// Wrap state updates in useEffect or requestAnimationFrame
const handleDeckCreated = useCallback((deck: any) => {
  // Defer state update to avoid render conflict
  requestAnimationFrame(() => {
    setActiveDeck(deck)
    setConsultationMode('chat')
  })
}, [])
```

## 4. Add Router for Redirect

```typescript
// At top of TutorPageContent
import { useRouter } from 'next/navigation'

// Inside component
const router = useRouter()

// In generateFullDeckMutation onSuccess:
onSuccess: (data) => {
  // ... validation ...
  
  if (data.deckId) {
    successToast('Deck created successfully! Redirecting...')
    setTimeout(() => {
      router.push(`/decks/${data.deckId}`)
    }, 1500)
  } else {
    // If no deckId, still call onDeckCreated
    onDeckCreated({
      deckId: data.deckId,
      cards: data.cards,
      commander
    })
  }
}
```

## 5. Add Loading State Improvements

```typescript
// Replace simple spinner with progress indicator
{isGenerating && (
  <div className="flex gap-3">
    <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
      <Bot className="w-4 h-4 text-white" />
    </div>
    <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-zinc-700/50 max-w-lg">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
        <span className="text-zinc-300">
          Building your complete 100-card deck...
        </span>
      </div>
      <p className="text-xs text-zinc-400">
        This usually takes 30-60 seconds. We're optimizing card selections, 
        mana base, and synergies specifically for your commander.
      </p>
    </div>
  </div>
)}
```

## 6. Fix the Console Error Line References

The error at `page.tsx:2654` is trying to access `deck.cards` when deck might be undefined. 

```typescript
// Find this line and add null check:
// BEFORE:
const cardCount = deck.cards.length

// AFTER:
const cardCount = deck?.cards?.length || 0
```

## 7. Add Error Boundary for Deck Generation

```typescript
// Wrap DeckBuilderChat in error boundary
<ErrorBoundary
  context="Deck Builder Chat"
  onError={(error) => {
    console.error('Deck generation error:', error)
    errorToast('Deck Generation Failed', 'Please try again')
  }}
>
  <DeckBuilderChat ... />
</ErrorBoundary>
```

## Testing Commands

```bash
# Check if environment variables are set
echo $OPENAI_API_KEY

# Monitor server logs for errors
npm run dev 2>&1 | grep -E "(error|Error|ERROR)"

# Test TRPC endpoint directly
curl -X POST http://localhost:3000/api/trpc/tutor.generateFullDeck \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "commander": "Atraxa, Praetors Voice"}'
