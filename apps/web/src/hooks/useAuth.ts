import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'

export function useAuth() {
  const { data: session, status } = useSession()
  
  // Only fetch user data if we have a session
  const { data: user, isLoading: isUserLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: !!session?.user,
    retry: false,
  })

  return {
    user,
    session,
    isLoading: status === 'loading' || isUserLoading,
    isAuthenticated: !!session?.user,
    isError: status === 'unauthenticated',
  }
}