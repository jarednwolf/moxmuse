import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Types for user management
export interface UserProfile {
  id: string
  email: string
  name?: string
  username?: string
  avatar?: string
  bio?: string
  location?: string
  website?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  emailNotifications: boolean
  pushNotifications: boolean
  deckPrivacyDefault: 'public' | 'private' | 'unlisted'
  autoSave: boolean
  cardImageQuality: 'low' | 'medium' | 'high'
  showCardPrices: boolean
  defaultFormat: 'commander' | 'standard' | 'modern' | 'legacy'
  aiAssistanceLevel: 'minimal' | 'moderate' | 'aggressive'
}

export interface UserStats {
  totalDecks: number
  publicDecks: number
  totalCards: number
  favoriteColors: string[]
  mostUsedCommanders: string[]
  averageDeckValue: number
  deckBuildingStreak: number
  lastActive: Date
  joinDate: Date
}

export interface UserSession {
  isAuthenticated: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
  sessionId?: string
}

export interface UserActivity {
  id: string
  type: 'deck_created' | 'deck_updated' | 'deck_shared' | 'card_added' | 'analysis_run'
  description: string
  metadata?: Record<string, any>
  timestamp: Date
}

interface UserState {
  // User data
  profile: UserProfile | null
  preferences: UserPreferences
  stats: UserStats | null
  session: UserSession
  
  // Activity and history
  recentActivity: UserActivity[]
  favoriteDecks: string[]
  followedUsers: string[]
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Onboarding and tutorials
  hasCompletedOnboarding: boolean
  completedTutorials: string[]
  
  // Actions
  setProfile: (profile: UserProfile | null) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setPreferences: (preferences: Partial<UserPreferences>) => void
  setStats: (stats: UserStats) => void
  setSession: (session: UserSession) => void
  
  // Activity management
  addActivity: (activity: Omit<UserActivity, 'id' | 'timestamp'>) => void
  clearActivity: () => void
  
  // Favorites and social
  addFavoriteDeck: (deckId: string) => void
  removeFavoriteDeck: (deckId: string) => void
  followUser: (userId: string) => void
  unfollowUser: (userId: string) => void
  
  // Onboarding
  completeOnboarding: () => void
  completeTutorial: (tutorialId: string) => void
  resetTutorials: () => void
  
  // Authentication
  login: (profile: UserProfile, session: UserSession) => void
  logout: () => void
  refreshSession: (newSession: UserSession) => void
  
  // Loading and error states
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Utility functions
  isSessionValid: () => boolean
  getPreference: <K extends keyof UserPreferences>(key: K) => UserPreferences[K]
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  emailNotifications: true,
  pushNotifications: false,
  deckPrivacyDefault: 'private',
  autoSave: true,
  cardImageQuality: 'medium',
  showCardPrices: true,
  defaultFormat: 'commander',
  aiAssistanceLevel: 'moderate'
}

const defaultSession: UserSession = {
  isAuthenticated: false
}

export const useUserStore = create<UserState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Initial state
        profile: null,
        preferences: defaultPreferences,
        stats: null,
        session: defaultSession,
        recentActivity: [],
        favoriteDecks: [],
        followedUsers: [],
        isLoading: false,
        error: null,
        hasCompletedOnboarding: false,
        completedTutorials: [],

        // Actions
        setProfile: (profile) => set((state) => {
          state.profile = profile
        }),

        updateProfile: (updates) => set((state) => {
          if (state.profile) {
            state.profile = {
              ...state.profile,
              ...updates,
              updatedAt: new Date()
            }
          }
        }),

        setPreferences: (preferences) => set((state) => {
          state.preferences = { ...state.preferences, ...preferences }
        }),

        setStats: (stats) => set((state) => {
          state.stats = stats
        }),

        setSession: (session) => set((state) => {
          state.session = session
        }),

        addActivity: (activity) => set((state) => {
          const newActivity: UserActivity = {
            ...activity,
            id: crypto.randomUUID(),
            timestamp: new Date()
          }
          state.recentActivity.unshift(newActivity)
          
          // Keep only the last 100 activities
          if (state.recentActivity.length > 100) {
            state.recentActivity = state.recentActivity.slice(0, 100)
          }
        }),

        clearActivity: () => set((state) => {
          state.recentActivity = []
        }),

        addFavoriteDeck: (deckId) => set((state) => {
          if (!state.favoriteDecks.includes(deckId)) {
            state.favoriteDecks.push(deckId)
          }
        }),

        removeFavoriteDeck: (deckId) => set((state) => {
          state.favoriteDecks = state.favoriteDecks.filter(id => id !== deckId)
        }),

        followUser: (userId) => set((state) => {
          if (!state.followedUsers.includes(userId)) {
            state.followedUsers.push(userId)
          }
        }),

        unfollowUser: (userId) => set((state) => {
          state.followedUsers = state.followedUsers.filter(id => id !== userId)
        }),

        completeOnboarding: () => set((state) => {
          state.hasCompletedOnboarding = true
        }),

        completeTutorial: (tutorialId) => set((state) => {
          if (!state.completedTutorials.includes(tutorialId)) {
            state.completedTutorials.push(tutorialId)
          }
        }),

        resetTutorials: () => set((state) => {
          state.completedTutorials = []
        }),

        login: (profile, session) => set((state) => {
          state.profile = profile
          state.session = { ...session, isAuthenticated: true }
          state.error = null
        }),

        logout: () => set((state) => {
          state.profile = null
          state.session = defaultSession
          state.stats = null
          state.recentActivity = []
          state.favoriteDecks = []
          state.followedUsers = []
        }),

        refreshSession: (newSession) => set((state) => {
          state.session = { ...state.session, ...newSession }
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
        isSessionValid: () => {
          const { session } = get()
          if (!session.isAuthenticated || !session.expiresAt) {
            return false
          }
          return new Date() < session.expiresAt
        },

        getPreference: (key) => {
          return get().preferences[key]
        },

        updatePreference: (key, value) => set((state) => {
          state.preferences[key] = value
        })
      })),
      {
        name: 'moxmuse-user-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          profile: state.profile,
          preferences: state.preferences,
          stats: state.stats,
          favoriteDecks: state.favoriteDecks,
          followedUsers: state.followedUsers,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          completedTutorials: state.completedTutorials,
          // Don't persist session for security
          // Don't persist recent activity to avoid bloat
        })
      }
    )
  )
)

// Selectors for optimized re-renders
export const selectProfile = (state: UserState) => state.profile
export const selectPreferences = (state: UserState) => state.preferences
export const selectStats = (state: UserState) => state.stats
export const selectSession = (state: UserState) => state.session
export const selectIsAuthenticated = (state: UserState) => state.session.isAuthenticated
export const selectRecentActivity = (state: UserState) => state.recentActivity
export const selectFavoriteDecks = (state: UserState) => state.favoriteDecks
export const selectFollowedUsers = (state: UserState) => state.followedUsers
export const selectIsLoading = (state: UserState) => state.isLoading
export const selectError = (state: UserState) => state.error
export const selectHasCompletedOnboarding = (state: UserState) => state.hasCompletedOnboarding
export const selectCompletedTutorials = (state: UserState) => state.completedTutorials
export const selectTheme = (state: UserState) => state.preferences.theme
export const selectLanguage = (state: UserState) => state.preferences.language