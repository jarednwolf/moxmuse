# Testing Best Practices Guide - Loading States & Component Testing

## The Problem with String Detection

**Current Approach (Brittle):**
```javascript
await expect(page.getByText('generating your complete 100-card commander deck')).toBeVisible()
```

**Issues:**
- Breaks with text changes
- Fails with internationalization
- Fragile to copy updates
- Tests implementation, not behavior
- Not semantic

## Recommended Approaches

### 1. Data Test IDs (Primary Recommendation)

**Implementation:**
```typescript
// Component: DeckBuilderChat.tsx
function DeckBuilderChat({ mode, isGenerating }) {
  return (
    <div className="flex-1 flex flex-col">
      {isGenerating && (
        <div 
          data-testid="deck-generation-loading"
          className="flex gap-3"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Building your complete deck...</span>
        </div>
      )}
    </div>
  )
}
```

**Test:**
```javascript
test('should show loading state during deck generation', async ({ page }) => {
  await page.getByText('Continue with this Commander').click()
  await expect(page.getByTestId('deck-generation-loading')).toBeVisible()
})
```

### 2. State-Based Attributes

**Implementation:**
```typescript
<div 
  data-loading={isGenerating}
  data-process="deck-generation"
  data-status={status} // 'idle' | 'loading' | 'success' | 'error'
>
```

**Test:**
```javascript
await expect(page.locator('[data-loading="true"]')).toBeVisible()
await expect(page.locator('[data-process="deck-generation"]')).toBeVisible()
```

### 3. Network Request Testing (Most Robust)

**Test:**
```javascript
test('should handle deck generation flow', async ({ page }) => {
  // Set up response interceptor
  const generationPromise = page.waitForResponse(
    response => response.url().includes('/api/trpc/tutor.generateFullDeck') 
    && response.status() === 200
  )
  
  await page.getByText('Continue with this Commander').click()
  
  // Wait for actual API completion
  await generationPromise
  
  // Now test the result
  await expect(page.getByTestId('deck-generation-complete')).toBeVisible()
})
```

### 4. Loading Component Pattern

**Component:**
```typescript
// LoadingState.tsx
interface LoadingStateProps {
  process: 'deck-generation' | 'card-search' | 'commander-suggestions'
  message?: string
}

export function LoadingState({ process, message }: LoadingStateProps) {
  return (
    <div 
      data-testid={`loading-${process}`}
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{message || 'Loading...'}</span>
    </div>
  )
}
```

**Usage:**
```typescript
{isGenerating && (
  <LoadingState 
    process="deck-generation" 
    message="Building your complete deck..."
  />
)}
```

**Test:**
```javascript
await expect(page.getByTestId('loading-deck-generation')).toBeVisible()
```

## Migration Strategy

### Phase 1: Add Test IDs to Critical Components
1. Loading states: `data-testid="loading-{process}"`
2. Error states: `data-testid="error-{context}"`
3. Success states: `data-testid="success-{action}"`
4. Forms: `data-testid="form-{name}"`

### Phase 2: Update Tests Gradually
```javascript
// Old (remove gradually)
await expect(page.getByText(/generating/i)).toBeVisible()

// New (add immediately)
await expect(page.getByTestId('loading-deck-generation')).toBeVisible()
```

### Phase 3: Add State Attributes
```typescript
// Enhanced component state tracking
<div 
  data-testid="deck-builder"
  data-state={currentState}
  data-step={currentStep}
  data-loading={isLoading}
>
```

## Component-Specific Recommendations

### DeckBuilderChat Component
```typescript
export function DeckBuilderChat({ mode, commander, onDeckCreated }) {
  return (
    <div data-testid="deck-builder-chat" data-mode={mode}>
      {isGenerating && (
        <LoadingState 
          process="deck-generation"
          data-commander={commander}
        />
      )}
      
      {error && (
        <ErrorState 
          data-testid="deck-generation-error"
          error={error}
        />
      )}
      
      {deckCreated && (
        <div data-testid="deck-generation-success">
          Deck created successfully!
        </div>
      )}
    </div>
  )
}
```

### Test Example
```javascript
test('complete deck generation flow', async ({ page }) => {
  // Start process
  await page.getByText('Continue with this Commander').click()
  
  // Verify loading state
  await expect(page.getByTestId('loading-deck-generation')).toBeVisible()
  
  // Wait for completion (network-based)
  await page.waitForResponse(/generateFullDeck/)
  
  // Verify success state
  await expect(page.getByTestId('deck-generation-success')).toBeVisible()
  
  // Verify loading state is gone
  await expect(page.getByTestId('loading-deck-generation')).not.toBeVisible()
})
```

## Benefits of This Approach

### ✅ Robust
- Survives text changes
- Works with internationalization
- Semantic and meaningful

### ✅ Maintainable  
- Clear test intentions
- Easier to debug failures
- Separates behavior from presentation

### ✅ Accessible
- ARIA attributes improve accessibility
- Role-based selectors work with screen readers

### ✅ Performance
- Faster selectors (ID-based vs text scanning)
- More reliable timing

## Implementation Priority

1. **High Priority**: Add test IDs to loading states
2. **Medium Priority**: Add state attributes
3. **Low Priority**: Custom events (for complex flows)

This approach makes tests more reliable, maintainable, and aligned with testing best practices.
