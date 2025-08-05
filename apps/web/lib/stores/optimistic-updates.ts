import React from 'react'
import { useDeckStore } from './deck-store'
import { useAIStore } from './ai-store'
import { useUserStore } from './user-store'
import type { Card, Deck } from './deck-store'
import type { AIRequest } from './ai-store'

// Optimistic update utilities for better UX
export class OptimisticUpdates {
  // Deck optimistic updates
  static async addCardToDeck(deckId: string, card: Card, apiCall: () => Promise<void>) {
    const { addCardToDeck, removeCardFromDeck, setError } = useDeckStore.getState()
    
    // Optimistically add the card
    addCardToDeck(deckId, card)
    
    try {
      // Make the actual API call
      await apiCall()
    } catch (error) {
      // Revert on failure
      removeCardFromDeck(deckId, card.id)
      setError(error instanceof Error ? error.message : 'Failed to add card')
      throw error
    }
  }

  static async removeCardFromDeck(deckId: string, cardId: string, apiCall: () => Promise<void>) {
    const { removeCardFromDeck, addCardToDeck, getDeckById, setError } = useDeckStore.getState()
    
    // Store the card for potential rollback
    const deck = getDeckById(deckId)
    const cardToRemove = deck?.cards.find(c => c.id === cardId)
    
    if (!cardToRemove) return
    
    // Optimistically remove the card
    removeCardFromDeck(deckId, cardId)
    
    try {
      // Make the actual API call
      await apiCall()
    } catch (error) {
      // Revert on failure
      addCardToDeck(deckId, cardToRemove)
      setError(error instanceof Error ? error.message : 'Failed to remove card')
      throw error
    }
  }

  static async updateDeck(deckId: string, updates: Partial<Deck>, apiCall: () => Promise<void>) {
    const { updateDeck, getDeckById, setError } = useDeckStore.getState()
    
    // Store original state for rollback
    const originalDeck = getDeckById(deckId)
    if (!originalDeck) return
    
    // Optimistically update the deck
    updateDeck(deckId, updates)
    
    try {
      // Make the actual API call
      await apiCall()
    } catch (error) {
      // Revert on failure
      updateDeck(deckId, originalDeck)
      setError(error instanceof Error ? error.message : 'Failed to update deck')
      throw error
    }
  }

  // AI request optimistic updates
  static async createAIRequest(
    type: AIRequest['type'],
    prompt: string,
    parameters: Record<string, any>,
    apiCall: (requestId: string) => Promise<any>
  ) {
    const { createRequest, completeRequest, failRequest } = useAIStore.getState()
    
    // Optimistically create the request
    const requestId = createRequest(type, prompt, parameters)
    
    try {
      // Make the actual API call
      const result = await apiCall(requestId)
      
      // Complete the request with the result
      completeRequest(requestId, result)
      
      return { requestId, result }
    } catch (error) {
      // Mark request as failed
      failRequest(requestId, error instanceof Error ? error.message : 'Request failed')
      throw error
    }
  }

  // User preference optimistic updates
  static async updateUserPreference<K extends keyof import('./user-store').UserPreferences>(
    key: K,
    value: import('./user-store').UserPreferences[K],
    apiCall: () => Promise<void>
  ) {
    const { updatePreference, getPreference, setError } = useUserStore.getState()
    
    // Store original value for rollback
    const originalValue = getPreference(key)
    
    // Optimistically update the preference
    updatePreference(key, value)
    
    try {
      // Make the actual API call
      await apiCall()
    } catch (error) {
      // Revert on failure
      updatePreference(key, originalValue)
      setError(error instanceof Error ? error.message : 'Failed to update preference')
      throw error
    }
  }

  // Batch operations with rollback
  static async batchDeckUpdates(
    operations: Array<{
      type: 'add' | 'remove' | 'update'
      deckId: string
      data: any
    }>,
    apiCall: () => Promise<void>
  ) {
    const { addCardToDeck, removeCardFromDeck, updateDeck, getDeckById, setError } = useDeckStore.getState()
    
    // Store rollback operations
    const rollbackOps: Array<() => void> = []
    
    try {
      // Apply all operations optimistically
      for (const op of operations) {
        switch (op.type) {
          case 'add':
            addCardToDeck(op.deckId, op.data)
            rollbackOps.push(() => removeCardFromDeck(op.deckId, op.data.id))
            break
            
          case 'remove':
            const deck = getDeckById(op.deckId)
            const card = deck?.cards.find(c => c.id === op.data.cardId)
            if (card) {
              removeCardFromDeck(op.deckId, op.data.cardId)
              rollbackOps.push(() => addCardToDeck(op.deckId, card))
            }
            break
            
          case 'update':
            const originalDeck = getDeckById(op.deckId)
            if (originalDeck) {
              updateDeck(op.deckId, op.data)
              rollbackOps.push(() => updateDeck(op.deckId, originalDeck))
            }
            break
        }
      }
      
      // Make the actual API call
      await apiCall()
    } catch (error) {
      // Rollback all operations in reverse order
      rollbackOps.reverse().forEach(rollback => rollback())
      setError(error instanceof Error ? error.message : 'Batch operation failed')
      throw error
    }
  }
}

// Hook for optimistic updates with automatic error handling
export function useOptimisticUpdate() {
  const setDeckError = useDeckStore(state => state.setError)
  const setUserError = useUserStore(state => state.setError)
  const setAIError = useAIStore(state => state.setError)

  const withOptimisticUpdate = async <T>(
    optimisticAction: () => void,
    apiCall: () => Promise<T>,
    rollbackAction: () => void,
    errorSetter: (error: string) => void
  ): Promise<T> => {
    // Apply optimistic update
    optimisticAction()

    try {
      // Make API call
      const result = await apiCall()
      return result
    } catch (error) {
      // Rollback on failure
      rollbackAction()
      const errorMessage = error instanceof Error ? error.message : 'Operation failed'
      errorSetter(errorMessage)
      throw error
    }
  }

  return {
    withOptimisticUpdate,
    setDeckError,
    setUserError,
    setAIError
  }
}

// Debounced update utility for auto-save functionality
export function useDebouncedUpdate(delay: number = 1000) {
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const debouncedUpdate = React.useCallback(
    (updateFn: () => void) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        updateFn()
      }, delay)
    },
    [delay]
  )

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedUpdate
}

// Conflict resolution utilities
export class ConflictResolver {
  // Merge deck changes with conflict resolution
  static mergeDeckChanges(
    localDeck: Deck,
    serverDeck: Deck,
    strategy: 'local' | 'server' | 'merge' = 'merge'
  ): Deck {
    switch (strategy) {
      case 'local':
        return localDeck
        
      case 'server':
        return serverDeck
        
      case 'merge':
        // Merge strategy: prefer local for user-generated content, server for metadata
        return {
          ...serverDeck,
          name: localDeck.name, // Prefer local name changes
          description: localDeck.description, // Prefer local description
          cards: this.mergeCardLists(localDeck.cards, serverDeck.cards),
          tags: Array.from(new Set([...localDeck.tags, ...serverDeck.tags])), // Merge tags
          updatedAt: new Date() // Update timestamp
        }
    }
  }

  private static mergeCardLists(localCards: Card[], serverCards: Card[]): Card[] {
    const cardMap = new Map<string, Card>()
    
    // Add server cards first
    serverCards.forEach(card => cardMap.set(card.id, card))
    
    // Override with local cards (local changes take precedence)
    localCards.forEach(card => cardMap.set(card.id, card))
    
    return Array.from(cardMap.values())
  }
}