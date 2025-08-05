import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { StateCreator } from 'zustand'

// Types for deck management
export interface Card {
  id: string
  name: string
  mana_cost?: string
  type_line?: string
  oracle_text?: string
  power?: string
  toughness?: string
  colors?: string[]
  color_identity?: string[]
  cmc?: number
  rarity?: string
  set?: string
  image_uris?: {
    small?: string
    normal?: string
    large?: string
  }
  prices?: {
    usd?: string
    usd_foil?: string
  }
}

export interface Commander {
  id: string
  name: string
  colors: string[]
  type_line: string
  oracle_text: string
  power?: string
  toughness?: string
  mana_cost: string
  cmc: number
  image_uris?: {
    small?: string
    normal?: string
    large?: string
  }
}

export interface Deck {
  id: string
  name: string
  commander?: Commander
  cards: Card[]
  description?: string
  strategy?: string
  budget?: number
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
  tags: string[]
  totalValue?: number
  avgCmc?: number
  colorDistribution?: Record<string, number>
}

export interface DeckAnalysis {
  deckId: string
  totalCards: number
  avgCmc: number
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  rarityDistribution: Record<string, number>
  totalValue: number
  synergies: string[]
  weaknesses: string[]
  suggestions: string[]
  lastAnalyzed: Date
}

interface DeckState {
  // Current deck being edited
  currentDeck: Deck | null
  
  // All user decks
  decks: Deck[]
  
  // Deck analysis data
  analysis: Record<string, DeckAnalysis>
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Search and filters
  searchQuery: string
  filters: {
    colors: string[]
    types: string[]
    rarity: string[]
    priceRange: [number, number]
  }
  
  // Actions
  setCurrentDeck: (deck: Deck | null) => void
  createDeck: (name: string, commander?: Commander) => void
  updateDeck: (deckId: string, updates: Partial<Deck>) => void
  deleteDeck: (deckId: string) => void
  addCardToDeck: (deckId: string, card: Card) => void
  removeCardFromDeck: (deckId: string, cardId: string) => void
  updateCardInDeck: (deckId: string, cardId: string, updates: Partial<Card>) => void
  
  // Deck management
  duplicateDeck: (deckId: string, newName: string) => void
  importDeck: (deckData: any) => void
  exportDeck: (deckId: string) => string
  
  // Analysis
  setAnalysis: (deckId: string, analysis: DeckAnalysis) => void
  clearAnalysis: (deckId: string) => void
  
  // Search and filters
  setSearchQuery: (query: string) => void
  setFilters: (filters: Partial<DeckState['filters']>) => void
  clearFilters: () => void
  
  // Loading and error states
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Utility functions
  getDeckById: (deckId: string) => Deck | undefined
  getFilteredCards: (deckId: string) => Card[]
  calculateDeckStats: (deckId: string) => {
    totalCards: number
    avgCmc: number
    colorDistribution: Record<string, number>
    typeDistribution: Record<string, number>
    totalValue: number
  } | null
}

export const useDeckStore = create<DeckState>()(
  subscribeWithSelector(
    persist(
      immer<DeckState>((set, get) => ({
        // Initial state
        currentDeck: null,
        decks: [],
        analysis: {},
        isLoading: false,
        error: null,
        searchQuery: '',
        filters: {
          colors: [],
          types: [],
          rarity: [],
          priceRange: [0, 1000]
        },

        // Actions
        setCurrentDeck: (deck) => set((state) => {
          state.currentDeck = deck
        }),

        createDeck: (name, commander) => set((state) => {
          const newDeck: Deck = {
            id: crypto.randomUUID(),
            name,
            commander,
            cards: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublic: false,
            tags: []
          }
          state.decks.push(newDeck)
          state.currentDeck = newDeck
        }),

        updateDeck: (deckId, updates) => set((state) => {
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === deckId)
          if (deckIndex !== -1) {
            state.decks[deckIndex] = {
              ...state.decks[deckIndex],
              ...updates,
              updatedAt: new Date()
            }
            if (state.currentDeck?.id === deckId) {
              state.currentDeck = state.decks[deckIndex]
            }
          }
        }),

        deleteDeck: (deckId) => set((state) => {
          state.decks = state.decks.filter((d: Deck) => d.id !== deckId)
          if (state.currentDeck?.id === deckId) {
            state.currentDeck = null
          }
          delete state.analysis[deckId]
        }),

        addCardToDeck: (deckId, card) => set((state) => {
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === deckId)
          if (deckIndex !== -1) {
            // Check if card already exists, if so increment quantity
            const existingCardIndex = state.decks[deckIndex].cards.findIndex((c: Card) => c.id === card.id)
            if (existingCardIndex !== -1) {
              // For now, just don't add duplicates (Commander format)
              return
            }
            
            state.decks[deckIndex].cards.push(card)
            state.decks[deckIndex].updatedAt = new Date()
            
            if (state.currentDeck?.id === deckId) {
              state.currentDeck = state.decks[deckIndex]
            }
          }
        }),

        removeCardFromDeck: (deckId, cardId) => set((state) => {
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === deckId)
          if (deckIndex !== -1) {
            state.decks[deckIndex].cards = state.decks[deckIndex].cards.filter((c: Card) => c.id !== cardId)
            state.decks[deckIndex].updatedAt = new Date()
            
            if (state.currentDeck?.id === deckId) {
              state.currentDeck = state.decks[deckIndex]
            }
          }
        }),

        updateCardInDeck: (deckId, cardId, updates) => set((state) => {
          const deckIndex = state.decks.findIndex((d: Deck) => d.id === deckId)
          if (deckIndex !== -1) {
            const cardIndex = state.decks[deckIndex].cards.findIndex((c: Card) => c.id === cardId)
            if (cardIndex !== -1) {
              state.decks[deckIndex].cards[cardIndex] = {
                ...state.decks[deckIndex].cards[cardIndex],
                ...updates
              }
              state.decks[deckIndex].updatedAt = new Date()
              
              if (state.currentDeck?.id === deckId) {
                state.currentDeck = state.decks[deckIndex]
              }
            }
          }
        }),

        duplicateDeck: (deckId, newName) => set((state) => {
          const originalDeck = state.decks.find((d: Deck) => d.id === deckId)
          if (originalDeck) {
            const duplicatedDeck: Deck = {
              ...originalDeck,
              id: crypto.randomUUID(),
              name: newName,
              createdAt: new Date(),
              updatedAt: new Date()
            }
            state.decks.push(duplicatedDeck)
          }
        }),

        importDeck: (deckData) => set((state) => {
          // Implementation for importing deck from various formats
          const importedDeck: Deck = {
            id: crypto.randomUUID(),
            name: deckData.name || 'Imported Deck',
            commander: deckData.commander,
            cards: deckData.cards || [],
            description: deckData.description,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublic: false,
            tags: deckData.tags || []
          }
          state.decks.push(importedDeck)
        }),

        exportDeck: (deckId) => {
          const deck = get().decks.find(d => d.id === deckId)
          if (!deck) return ''
          
          // Export in a standard format (e.g., MTG Arena format)
          let exportString = `// ${deck.name}\n`
          if (deck.commander) {
            exportString += `// Commander: ${deck.commander.name}\n`
          }
          exportString += '\n'
          
          deck.cards.forEach(card => {
            exportString += `1 ${card.name}\n`
          })
          
          return exportString
        },

        setAnalysis: (deckId, analysis) => set((state) => {
          state.analysis[deckId] = analysis
        }),

        clearAnalysis: (deckId) => set((state) => {
          delete state.analysis[deckId]
        }),

        setSearchQuery: (query) => set((state) => {
          state.searchQuery = query
        }),

        setFilters: (filters) => set((state) => {
          state.filters = { ...state.filters, ...filters }
        }),

        clearFilters: () => set((state) => {
          state.filters = {
            colors: [],
            types: [],
            rarity: [],
            priceRange: [0, 1000]
          }
          state.searchQuery = ''
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading
        }),

        setError: (error) => set((state) => {
          state.error = error
        }),

        clearError: () => set((state) => {
          state.error = null
        }),

        // Utility functions
        getDeckById: (deckId) => {
          return get().decks.find(d => d.id === deckId)
        },

        getFilteredCards: (deckId) => {
          const deck = get().decks.find(d => d.id === deckId)
          if (!deck) return []
          
          const { searchQuery, filters } = get()
          
          return deck.cards.filter(card => {
            // Search query filter
            if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              return false
            }
            
            // Color filter
            if (filters.colors.length > 0) {
              const cardColors = card.colors || []
              if (!filters.colors.some(color => cardColors.includes(color))) {
                return false
              }
            }
            
            // Type filter
            if (filters.types.length > 0) {
              const cardType = card.type_line || ''
              if (!filters.types.some(type => cardType.toLowerCase().includes(type.toLowerCase()))) {
                return false
              }
            }
            
            // Rarity filter
            if (filters.rarity.length > 0) {
              if (!filters.rarity.includes(card.rarity || '')) {
                return false
              }
            }
            
            // Price range filter
            const cardPrice = parseFloat(card.prices?.usd || '0')
            if (cardPrice < filters.priceRange[0] || cardPrice > filters.priceRange[1]) {
              return false
            }
            
            return true
          })
        },

        calculateDeckStats: (deckId) => {
          const deck = get().decks.find(d => d.id === deckId)
          if (!deck) return null
          
          const totalCards = deck.cards.length
          const avgCmc = deck.cards.reduce((sum, card) => sum + (card.cmc || 0), 0) / totalCards || 0
          
          const colorDistribution: Record<string, number> = {}
          const typeDistribution: Record<string, number> = {}
          let totalValue = 0
          
          deck.cards.forEach(card => {
            // Color distribution
            const colors = card.colors || []
            colors.forEach(color => {
              colorDistribution[color] = (colorDistribution[color] || 0) + 1
            })
            
            // Type distribution
            const types = card.type_line?.split(' — ')[0]?.split(' ') || []
            types.forEach(type => {
              if (type && type !== '//') {
                typeDistribution[type] = (typeDistribution[type] || 0) + 1
              }
            })
            
            // Total value
            totalValue += parseFloat(card.prices?.usd || '0')
          })
          
          return {
            totalCards,
            avgCmc,
            colorDistribution,
            typeDistribution,
            totalValue
          }
        }
      })),
      {
        name: 'moxmuse-deck-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          decks: state.decks,
          analysis: state.analysis
        })
      }
    )
  )
)

// Selectors for optimized re-renders
export const selectCurrentDeck = (state: DeckState) => state.currentDeck
export const selectDecks = (state: DeckState) => state.decks
export const selectDeckById = (deckId: string) => (state: DeckState) => 
  state.decks.find(d => d.id === deckId)
export const selectDeckAnalysis = (deckId: string) => (state: DeckState) => 
  state.analysis[deckId]
export const selectIsLoading = (state: DeckState) => state.isLoading
export const selectError = (state: DeckState) => state.error
export const selectFilters = (state: DeckState) => state.filters
export const selectSearchQuery = (state: DeckState) => state.searchQuery