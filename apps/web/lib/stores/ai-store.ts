import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Types for AI operations
export interface AIRequest {
  id: string
  type: 'deck_generation' | 'card_recommendation' | 'synergy_analysis' | 'commander_suggestion'
  prompt: string
  parameters: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: any
  error?: string
  createdAt: Date
  completedAt?: Date
  duration?: number
  tokensUsed?: number
  cost?: number
}

export interface AIUsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalTokensUsed: number
  totalCost: number
  averageResponseTime: number
  requestsByType: Record<string, number>
  dailyUsage: Record<string, number>
  monthlyUsage: Record<string, number>
}

export interface AIModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'local'
  type: 'chat' | 'completion' | 'embedding'
  maxTokens: number
  costPerToken: number
  isAvailable: boolean
  capabilities: string[]
}

export interface AISettings {
  preferredModel: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  enableStreaming: boolean
  enableCaching: boolean
  maxRetries: number
  timeoutMs: number
}

export interface AICache {
  key: string
  prompt: string
  response: any
  model: string
  parameters: Record<string, any>
  createdAt: Date
  expiresAt: Date
  hitCount: number
}

interface AIState {
  // Current requests
  activeRequests: AIRequest[]
  requestHistory: AIRequest[]
  
  // Usage tracking
  usageStats: AIUsageStats
  dailyQuota: number
  remainingQuota: number
  
  // Models and settings
  availableModels: AIModel[]
  settings: AISettings
  
  // Caching
  cache: AICache[]
  cacheEnabled: boolean
  
  // UI state
  isProcessing: boolean
  error: string | null
  
  // Streaming responses
  streamingResponses: Record<string, string>
  
  // Actions
  createRequest: (type: AIRequest['type'], prompt: string, parameters?: Record<string, any>) => string
  updateRequest: (requestId: string, updates: Partial<AIRequest>) => void
  completeRequest: (requestId: string, result: any, tokensUsed?: number, cost?: number) => void
  failRequest: (requestId: string, error: string) => void
  cancelRequest: (requestId: string) => void
  
  // Usage tracking
  updateUsageStats: (stats: Partial<AIUsageStats>) => void
  resetDailyUsage: () => void
  
  // Settings management
  updateSettings: (settings: Partial<AISettings>) => void
  setPreferredModel: (modelId: string) => void
  
  // Cache management
  addToCache: (key: string, prompt: string, response: any, model: string, parameters: Record<string, any>) => void
  getFromCache: (key: string) => AICache | null
  clearCache: () => void
  cleanExpiredCache: () => void
  
  // Streaming
  updateStreamingResponse: (requestId: string, chunk: string) => void
  clearStreamingResponse: (requestId: string) => void
  
  // Loading and error states
  setProcessing: (processing: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Utility functions
  getRequestById: (requestId: string) => AIRequest | undefined
  getRequestsByType: (type: AIRequest['type']) => AIRequest[]
  calculateCacheKey: (prompt: string, model: string, parameters: Record<string, any>) => string
  isQuotaExceeded: () => boolean
  getUsageForPeriod: (period: 'day' | 'week' | 'month') => number
}

const defaultSettings: AISettings = {
  preferredModel: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  enableStreaming: true,
  enableCaching: true,
  maxRetries: 3,
  timeoutMs: 30000
}

const defaultUsageStats: AIUsageStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTokensUsed: 0,
  totalCost: 0,
  averageResponseTime: 0,
  requestsByType: {},
  dailyUsage: {},
  monthlyUsage: {}
}

export const useAIStore = create<AIState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Initial state
        activeRequests: [],
        requestHistory: [],
        usageStats: defaultUsageStats,
        dailyQuota: 1000, // Default daily quota
        remainingQuota: 1000,
        availableModels: [],
        settings: defaultSettings,
        cache: [],
        cacheEnabled: true,
        isProcessing: false,
        error: null,
        streamingResponses: {},

        // Actions
        createRequest: (type, prompt, parameters = {}) => {
          const requestId = crypto.randomUUID()
          
          set((state) => {
            const newRequest: AIRequest = {
              id: requestId,
              type,
              prompt,
              parameters,
              status: 'pending',
              createdAt: new Date()
            }
            
            state.activeRequests.push(newRequest)
            state.isProcessing = true
          })
          
          return requestId
        },

        updateRequest: (requestId, updates) => set((state) => {
          const requestIndex = state.activeRequests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            state.activeRequests[requestIndex] = {
              ...state.activeRequests[requestIndex],
              ...updates
            }
          }
        }),

        completeRequest: (requestId, result, tokensUsed = 0, cost = 0) => set((state) => {
          const requestIndex = state.activeRequests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            const request = state.activeRequests[requestIndex]
            const completedRequest: AIRequest = {
              ...request,
              status: 'completed',
              result,
              completedAt: new Date(),
              duration: new Date().getTime() - request.createdAt.getTime(),
              tokensUsed,
              cost
            }
            
            // Move to history
            state.requestHistory.unshift(completedRequest)
            state.activeRequests.splice(requestIndex, 1)
            
            // Update usage stats
            state.usageStats.totalRequests++
            state.usageStats.successfulRequests++
            state.usageStats.totalTokensUsed += tokensUsed
            state.usageStats.totalCost += cost
            state.usageStats.requestsByType[request.type] = (state.usageStats.requestsByType[request.type] || 0) + 1
            
            // Update daily usage
            const today = new Date().toISOString().split('T')[0]
            state.usageStats.dailyUsage[today] = (state.usageStats.dailyUsage[today] || 0) + 1
            
            // Update remaining quota
            state.remainingQuota = Math.max(0, state.remainingQuota - tokensUsed)
            
            // Check if no more active requests
            if (state.activeRequests.length === 0) {
              state.isProcessing = false
            }
          }
        }),

        failRequest: (requestId, error) => set((state) => {
          const requestIndex = state.activeRequests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            const request = state.activeRequests[requestIndex]
            const failedRequest: AIRequest = {
              ...request,
              status: 'failed',
              error,
              completedAt: new Date(),
              duration: new Date().getTime() - request.createdAt.getTime()
            }
            
            // Move to history
            state.requestHistory.unshift(failedRequest)
            state.activeRequests.splice(requestIndex, 1)
            
            // Update usage stats
            state.usageStats.totalRequests++
            state.usageStats.failedRequests++
            
            // Check if no more active requests
            if (state.activeRequests.length === 0) {
              state.isProcessing = false
            }
          }
        }),

        cancelRequest: (requestId) => set((state) => {
          const requestIndex = state.activeRequests.findIndex(r => r.id === requestId)
          if (requestIndex !== -1) {
            state.activeRequests.splice(requestIndex, 1)
            
            if (state.activeRequests.length === 0) {
              state.isProcessing = false
            }
          }
        }),

        updateUsageStats: (stats) => set((state) => {
          state.usageStats = { ...state.usageStats, ...stats }
        }),

        resetDailyUsage: () => set((state) => {
          state.remainingQuota = state.dailyQuota
          const today = new Date().toISOString().split('T')[0]
          state.usageStats.dailyUsage[today] = 0
        }),

        updateSettings: (settings) => set((state) => {
          state.settings = { ...state.settings, ...settings }
        }),

        setPreferredModel: (modelId) => set((state) => {
          state.settings.preferredModel = modelId
        }),

        addToCache: (key, prompt, response, model, parameters) => set((state) => {
          if (!state.cacheEnabled) return
          
          const cacheEntry: AICache = {
            key,
            prompt,
            response,
            model,
            parameters,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            hitCount: 0
          }
          
          // Remove existing entry with same key
          state.cache = state.cache.filter(c => c.key !== key)
          
          // Add new entry
          state.cache.unshift(cacheEntry)
          
          // Keep only last 100 entries
          if (state.cache.length > 100) {
            state.cache = state.cache.slice(0, 100)
          }
        }),

        getFromCache: (key) => {
          const { cache, cacheEnabled } = get()
          if (!cacheEnabled) return null
          
          const entry = cache.find(c => c.key === key && c.expiresAt > new Date())
          if (entry) {
            // Increment hit count
            set((state) => {
              const cacheIndex = state.cache.findIndex(c => c.key === key)
              if (cacheIndex !== -1) {
                state.cache[cacheIndex].hitCount++
              }
            })
          }
          
          return entry || null
        },

        clearCache: () => set((state) => {
          state.cache = []
        }),

        cleanExpiredCache: () => set((state) => {
          const now = new Date()
          state.cache = state.cache.filter(c => c.expiresAt > now)
        }),

        updateStreamingResponse: (requestId, chunk) => set((state) => {
          state.streamingResponses[requestId] = (state.streamingResponses[requestId] || '') + chunk
        }),

        clearStreamingResponse: (requestId) => set((state) => {
          delete state.streamingResponses[requestId]
        }),

        setProcessing: (processing) => set((state) => {
          state.isProcessing = processing
        }),

        setError: (error) => set((state) => {
          state.error = error
        }),

        clearError: () => set((state) => {
          state.error = null
        }),

        // Utility functions
        getRequestById: (requestId) => {
          const { activeRequests, requestHistory } = get()
          return [...activeRequests, ...requestHistory].find(r => r.id === requestId)
        },

        getRequestsByType: (type) => {
          const { activeRequests, requestHistory } = get()
          return [...activeRequests, ...requestHistory].filter(r => r.type === type)
        },

        calculateCacheKey: (prompt, model, parameters) => {
          const data = { prompt, model, parameters }
          return btoa(JSON.stringify(data)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
        },

        isQuotaExceeded: () => {
          const { remainingQuota } = get()
          return remainingQuota <= 0
        },

        getUsageForPeriod: (period) => {
          const { usageStats } = get()
          const now = new Date()
          
          switch (period) {
            case 'day':
              const today = now.toISOString().split('T')[0]
              return usageStats.dailyUsage[today] || 0
              
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              return Object.entries(usageStats.dailyUsage)
                .filter(([date]) => new Date(date) >= weekAgo)
                .reduce((sum, [, count]) => sum + count, 0)
                
            case 'month':
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              return usageStats.monthlyUsage[monthKey] || 0
              
            default:
              return 0
          }
        }
      })),
      {
        name: 'moxmuse-ai-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          requestHistory: state.requestHistory.slice(0, 50), // Keep only last 50 requests
          usageStats: state.usageStats,
          settings: state.settings,
          cache: state.cache.filter(c => c.expiresAt > new Date()), // Only persist non-expired cache
          cacheEnabled: state.cacheEnabled,
          dailyQuota: state.dailyQuota,
          remainingQuota: state.remainingQuota
        })
      }
    )
  )
)

// Selectors for optimized re-renders
export const selectActiveRequests = (state: AIState) => state.activeRequests
export const selectRequestHistory = (state: AIState) => state.requestHistory
export const selectUsageStats = (state: AIState) => state.usageStats
export const selectSettings = (state: AIState) => state.settings
export const selectIsProcessing = (state: AIState) => state.isProcessing
export const selectError = (state: AIState) => state.error
export const selectRemainingQuota = (state: AIState) => state.remainingQuota
export const selectStreamingResponse = (requestId: string) => (state: AIState) => 
  state.streamingResponses[requestId]
export const selectRequestById = (requestId: string) => (state: AIState) => 
  [...state.activeRequests, ...state.requestHistory].find(r => r.id === requestId)
export const selectRequestsByType = (type: AIRequest['type']) => (state: AIState) => 
  [...state.activeRequests, ...state.requestHistory].filter(r => r.type === type)