'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { trpc } from '@/lib/trpc/client'

interface Deck {
  id: string
  name: string
  format: string
  commander?: string
  description?: string
  isPublic: boolean
  powerLevel?: number
  budget?: number
  tags: string[]
  cards: DeckCard[]
  _count: {
    cards: number
  }
}

interface DeckCard {
  id: string
  deckId: string
  cardId: string
  quantity: number
  isCommander: boolean
  isCompanion: boolean
  category?: string
  boardState: string
}

interface DeckStats {
  totalCards: number
  manaCurve: number[]
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
}

interface DeckContextType {
  activeDeck: Deck | null
  setActiveDeck: (deck: Deck | null) => void
  deckCards: Map<string, number> // cardId -> quantity
  deckStats: DeckStats
  addCardToDeck: (cardId: string, quantity?: number) => Promise<void>
  removeCardFromDeck: (cardId: string, quantity?: number) => Promise<void>
  isLoading: boolean
  error: string | null
}

const DeckContext = createContext<DeckContextType | undefined>(undefined)

export function useDeck() {
  const context = useContext(DeckContext)
  if (context === undefined) {
    throw new Error('useDeck must be used within a DeckProvider')
  }
  return context
}

interface DeckProviderProps {
  children: React.ReactNode
}

export function DeckProvider({ children }: DeckProviderProps) {
  const [activeDeck, setActiveDeckState] = useState<Deck | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const utils = trpc.useUtils()

  const addCardMutation = trpc.deck.addCard.useMutation({
    onSuccess: () => {
      // Invalidate and refetch deck data
      if (activeDeck) {
        utils.deck.getById.invalidate({ deckId: activeDeck.id })
      }
    },
    onError: (error) => {
      setError(error.message)
    }
  })

  const removeCardMutation = trpc.deck.removeCard.useMutation({
    onSuccess: () => {
      // Invalidate and refetch deck data
      if (activeDeck) {
        utils.deck.getById.invalidate({ deckId: activeDeck.id })
      }
    },
    onError: (error) => {
      setError(error.message)
    }
  })

  // Calculate deck cards map for quick lookup
  const deckCards = React.useMemo(() => {
    const cardMap = new Map<string, number>()
    if (activeDeck?.cards) {
      activeDeck.cards.forEach(card => {
        cardMap.set(card.cardId, card.quantity)
      })
    }
    return cardMap
  }, [activeDeck?.cards])

  // Calculate deck statistics
  const deckStats = React.useMemo((): DeckStats => {
    if (!activeDeck?.cards) {
      return {
        totalCards: 0,
        manaCurve: [0, 0, 0, 0, 0, 0, 0, 0], // 0-7+ mana costs
        colorDistribution: {},
        typeDistribution: {}
      }
    }

    const totalCards = activeDeck.cards.reduce((sum, card) => sum + card.quantity, 0)
    
    // TODO: Calculate mana curve and distributions when we have card data
    // This would require fetching Scryfall data for each card in the deck
    
    return {
      totalCards,
      manaCurve: [0, 0, 0, 0, 0, 0, 0, 0],
      colorDistribution: {},
      typeDistribution: {}
    }
  }, [activeDeck?.cards])

  const setActiveDeck = useCallback((deck: Deck | null) => {
    setActiveDeckState(deck)
    setError(null)
  }, [])

  const addCardToDeck = useCallback(async (cardId: string, quantity = 1) => {
    if (!activeDeck) {
      setError('No active deck selected')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await addCardMutation.mutateAsync({
        deckId: activeDeck.id,
        cardId,
        quantity,
        boardState: 'mainboard'
      })
    } catch (error) {
      console.error('Failed to add card to deck:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeDeck, addCardMutation])

  const removeCardFromDeck = useCallback(async (cardId: string, quantity = 1) => {
    if (!activeDeck) {
      setError('No active deck selected')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // If removing all copies or the card only has 1 copy, delete the card entirely
      const currentQuantity = deckCards.get(cardId) || 0
      if (quantity >= currentQuantity) {
        await removeCardMutation.mutateAsync({
          deckId: activeDeck.id,
          cardId,
          boardState: 'mainboard'
        })
      } else {
        // Otherwise, just reduce the quantity
        await addCardMutation.mutateAsync({
          deckId: activeDeck.id,
          cardId,
          quantity: -quantity,
          boardState: 'mainboard'
        })
      }
    } catch (error) {
      console.error('Failed to remove card from deck:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeDeck, deckCards, addCardMutation, removeCardMutation])

  const value: DeckContextType = {
    activeDeck,
    setActiveDeck,
    deckCards,
    deckStats,
    addCardToDeck,
    removeCardFromDeck,
    isLoading,
    error
  }

  return (
    <DeckContext.Provider value={value}>
      {children}
    </DeckContext.Provider>
  )
}