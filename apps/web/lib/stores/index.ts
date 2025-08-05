// Export stores with explicit naming to avoid conflicts
export {
  useDeckStore,
  selectCurrentDeck,
  selectDecks,
  selectDeckById,
  selectDeckAnalysis,
  selectIsLoading as selectDeckIsLoading,
  selectError as selectDeckError,
  selectFilters,
  selectSearchQuery,
  type Card,
  type Commander,
  type Deck,
  type DeckAnalysis
} from './deck-store'

export {
  useUserStore,
  selectProfile,
  selectPreferences,
  selectStats,
  selectSession,
  selectIsAuthenticated,
  selectRecentActivity,
  selectFavoriteDecks,
  selectFollowedUsers,
  selectIsLoading as selectUserIsLoading,
  selectError as selectUserError,
  selectHasCompletedOnboarding,
  selectCompletedTutorials,
  selectTheme,
  selectLanguage,
  type UserProfile,
  type UserPreferences,
  type UserStats,
  type UserSession,
  type UserActivity
} from './user-store'

export {
  useAIStore,
  selectActiveRequests,
  selectRequestHistory,
  selectUsageStats,
  selectSettings,
  selectIsProcessing,
  selectError as selectAIError,
  selectRemainingQuota,
  selectStreamingResponse,
  selectRequestById,
  selectRequestsByType,
  type AIRequest,
  type AIUsageStats,
  type AIModel,
  type AISettings,
  type AICache
} from './ai-store'

// Store provider and hooks
export { StoreProvider, useStoreContext } from './store-provider'

// Optimistic update utilities
export * from './optimistic-updates'