'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { GeneratedDeck, DeckStatistics, CardSynergy } from '@moxmuse/shared'
import { getCachedDeckStatistics, getCachedCardSynergies, startCacheCleanup, stopCacheCleanup } from '@/lib/cache/deck-cache'
import { performanceMonitor } from '@/lib/performance/monitor'

interface TutorDeckState {
  currentDeck: GeneratedDeck | null
  statistics: DeckStatistics | null
  synergies: CardSynergy[] | null
  isLoading: boolean
  isLoadingStatistics: boolean
  isLoadingSynergies: boolean
  error: string | null
  hasUnsavedChanges: boolean
}

type TutorDeckAction =
  | { type: 'SET_DECK'; payload: GeneratedDeck }
  | { type: 'UPDATE_DECK'; payload: GeneratedDeck }
  | { type: 'SET_STATISTICS'; payload: DeckStatistics }
  | { type: 'SET_SYNERGIES'; payload: CardSynergy[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_STATISTICS'; payload: boolean }
  | { type: 'SET_LOADING_SYNERGIES'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'CLEAR_DECK' }

const initialState: TutorDeckState = {
  currentDeck: null,
  statistics: null,
  synergies: null,
  isLoading: false,
  isLoadingStatistics: false,
  isLoadingSynergies: false,
  error: null,
  hasUnsavedChanges: false
}

function tutorDeckReducer(state: TutorDeckState, action: TutorDeckAction): TutorDeckState {
  switch (action.type) {
    case 'SET_DECK':
      return {
        ...state,
        currentDeck: action.payload,
        isLoading: false,
        error: null,
        hasUnsavedChanges: false
      }
    case 'UPDATE_DECK':
      return {
        ...state,
        currentDeck: action.payload,
        hasUnsavedChanges: true,
        // Clear cached data when deck is updated
        statistics: null,
        synergies: null
      }
    case 'SET_STATISTICS':
      return {
        ...state,
        statistics: action.payload,
        isLoadingStatistics: false
      }
    case 'SET_SYNERGIES':
      return {
        ...state,
        synergies: action.payload,
        isLoadingSynergies: false
      }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }
    case 'SET_LOADING_STATISTICS':
      return {
        ...state,
        isLoadingStatistics: action.payload
      }
    case 'SET_LOADING_SYNERGIES':
      return {
        ...state,
        isLoadingSynergies: action.payload
      }
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isLoadingStatistics: false,
        isLoadingSynergies: false
      }
    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload
      }
    case 'CLEAR_DECK':
      return initialState
    default:
      return state
  }
}

interface TutorDeckContextValue extends TutorDeckState {
  setDeck: (deck: GeneratedDeck) => void
  updateDeck: (deck: GeneratedDeck) => void
  loadStatistics: () => Promise<void>
  loadSynergies: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearDeck: () => void
  markSaved: () => void
}

const TutorDeckContext = createContext<TutorDeckContextValue | undefined>(undefined)

export function TutorDeckProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tutorDeckReducer, initialState)

  // Start cache cleanup on mount
  useEffect(() => {
    startCacheCleanup()
    return () => stopCacheCleanup()
  }, [])

  const setDeck = useCallback((deck: GeneratedDeck) => {
    performanceMonitor.measureFunction('tutor-set-deck', () => {
      dispatch({ type: 'SET_DECK', payload: deck })
    })
  }, [])

  const updateDeck = useCallback((deck: GeneratedDeck) => {
    performanceMonitor.measureFunction('tutor-update-deck', () => {
      dispatch({ type: 'UPDATE_DECK', payload: deck })
    })
  }, [])

  const loadStatistics = useCallback(async () => {
    if (!state.currentDeck || state.isLoadingStatistics) return

    dispatch({ type: 'SET_LOADING_STATISTICS', payload: true })
    
    try {
      const statistics = await performanceMonitor.measureAsyncFunction(
        'tutor-load-statistics',
        () => getCachedDeckStatistics(state.currentDeck!)
      )
      dispatch({ type: 'SET_STATISTICS', payload: statistics })
    } catch (error) {
      console.error('Failed to load deck statistics:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load deck statistics' })
    }
  }, [state.currentDeck, state.isLoadingStatistics])

  const loadSynergies = useCallback(async () => {
    if (!state.currentDeck || state.isLoadingSynergies) return

    dispatch({ type: 'SET_LOADING_SYNERGIES', payload: true })
    
    try {
      const synergies = await performanceMonitor.measureAsyncFunction(
        'tutor-load-synergies',
        () => getCachedCardSynergies(state.currentDeck!)
      )
      dispatch({ type: 'SET_SYNERGIES', payload: synergies })
    } catch (error) {
      console.error('Failed to load card synergies:', error)
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load card synergies' })
    }
  }, [state.currentDeck, state.isLoadingSynergies])

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const clearDeck = useCallback(() => {
    dispatch({ type: 'CLEAR_DECK' })
  }, [])

  const markSaved = useCallback(() => {
    dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false })
  }, [])

  const value: TutorDeckContextValue = {
    ...state,
    setDeck,
    updateDeck,
    loadStatistics,
    loadSynergies,
    setLoading,
    setError,
    clearDeck,
    markSaved
  }

  return (
    <TutorDeckContext.Provider value={value}>
      {children}
    </TutorDeckContext.Provider>
  )
}

export function useTutorDeck() {
  const context = useContext(TutorDeckContext)
  if (context === undefined) {
    throw new Error('useTutorDeck must be used within a TutorDeckProvider')
  }
  return context
}