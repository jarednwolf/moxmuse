'use client'

import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useDeckStore } from './deck-store'
import { useUserStore } from './user-store'
import { useAIStore } from './ai-store'

interface StoreContextValue {
  deckStore: ReturnType<typeof useDeckStore>
  userStore: ReturnType<typeof useUserStore>
  aiStore: ReturnType<typeof useAIStore>
}

const StoreContext = createContext<StoreContextValue | null>(null)

interface StoreProviderProps {
  children: ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  const deckStore = useDeckStore()
  const userStore = useUserStore()
  const aiStore = useAIStore()

  // Initialize stores and set up subscriptions
  useEffect(() => {
    // Clean up expired cache on mount
    aiStore.cleanExpiredCache()

    // Set up daily quota reset
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime()
    
    const resetTimer = setTimeout(() => {
      aiStore.resetDailyUsage()
      
      // Set up daily interval
      const dailyInterval = setInterval(() => {
        aiStore.resetDailyUsage()
      }, 24 * 60 * 60 * 1000)
      
      return () => clearInterval(dailyInterval)
    }, msUntilMidnight)

    return () => clearTimeout(resetTimer)
  }, [aiStore])

  // Sync user preferences with system
  useEffect(() => {
    const theme = userStore.getPreference('theme')
    
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = () => {
        document.documentElement.classList.toggle('dark', mediaQuery.matches)
      }
      
      updateTheme()
      mediaQuery.addEventListener('change', updateTheme)
      
      return () => mediaQuery.removeEventListener('change', updateTheme)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }, [userStore])

  // Subscribe to user preference changes
  useEffect(() => {
    const unsubscribe = useUserStore.subscribe(
      (state) => state.preferences.theme,
      (theme) => {
        if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          document.documentElement.classList.toggle('dark', isDark)
        } else {
          document.documentElement.classList.toggle('dark', theme === 'dark')
        }
      }
    )

    return unsubscribe
  }, [])

  // Auto-save current deck
  useEffect(() => {
    const unsubscribe = useDeckStore.subscribe(
      (state) => state.currentDeck,
      (currentDeck) => {
        if (currentDeck && userStore.getPreference('autoSave')) {
          // Debounced auto-save logic would go here
          console.log('Auto-saving deck:', currentDeck.name)
        }
      }
    )

    return unsubscribe
  }, [userStore])

  const contextValue: StoreContextValue = {
    deckStore,
    userStore,
    aiStore
  }

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStoreContext() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStoreContext must be used within a StoreProvider')
  }
  return context
}

// Convenience hooks for accessing individual stores
export function useDeckStoreContext() {
  return useStoreContext().deckStore
}

export function useUserStoreContext() {
  return useStoreContext().userStore
}

export function useAIStoreContext() {
  return useStoreContext().aiStore
}