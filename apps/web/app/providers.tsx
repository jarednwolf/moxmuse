'use client'

import { SessionProvider } from 'next-auth/react'
import { TRPCProvider } from '../src/lib/trpc/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      basePath="/api/auth"
    >
      <TRPCProvider>
        {children}
      </TRPCProvider>
    </SessionProvider>
  )
}