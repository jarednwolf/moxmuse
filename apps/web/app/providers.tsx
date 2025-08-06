'use client'

import { SessionProvider } from 'next-auth/react'
import { TRPCProvider } from '../src/lib/trpc/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true}
      refetchWhenOffline={false}
      basePath="/api/auth"
    >
      <TRPCProvider>
        {children}
      </TRPCProvider>
    </SessionProvider>
  )
}