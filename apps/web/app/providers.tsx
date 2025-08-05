'use client'

import { SessionProvider } from 'next-auth/react'
import { TRPCProvider } from '../src/lib/trpc/provider'

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a custom session object to prevent null/undefined errors
  const mockSession = {
    user: {
      id: '',
      email: '',
      name: '',
      image: ''
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  return (
    <SessionProvider
      session={mockSession}
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