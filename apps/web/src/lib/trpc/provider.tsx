'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, httpLink, splitLink } from '@trpc/client'
import React, { useState } from 'react'
import { trpc } from './client'
import superjson from 'superjson'

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Increase stale time and cache time for better performance
        staleTime: 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        // Extended timeout for deck generation (5 minutes)
        // This is important because deck generation involves multiple API calls
        networkMode: 'online',
      },
    },
  }))
  
  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        splitLink({
          // Use regular HTTP link for large operations to avoid batching issues
          condition(op) {
            // Don't batch deck-related operations or collection operations
            // These often have large payloads that exceed batch limits
            return op.path.includes('deck') || 
                   op.path.includes('collection') ||
                   op.path.includes('tutor')
          },
          // Use regular HTTP link (no batching) for large operations
          true: httpLink({
            url: '/api/trpc',
            headers() {
              return {
                // Add timeout header for server awareness
                'x-trpc-timeout': '300000', // 5 minutes
              }
            },
            // Fetch options with extended timeout
            fetch(url, options) {
              return fetch(url, {
                ...options,
                // AbortSignal timeout (5 minutes)
                signal: AbortSignal.timeout(300000),
              })
            },
          }),
          // Use batch link for smaller operations
          false: httpBatchLink({
            url: '/api/trpc',
            // Increase max URL length for batched requests
            maxURLLength: 8192, // Increased from 2083
            headers() {
              return {
                // Add timeout header for server awareness
                'x-trpc-timeout': '300000', // 5 minutes
              }
            },
            // Fetch options with extended timeout
            fetch(url, options) {
              return fetch(url, {
                ...options,
                // AbortSignal timeout (5 minutes)
                signal: AbortSignal.timeout(300000),
              })
            },
          }),
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
}
