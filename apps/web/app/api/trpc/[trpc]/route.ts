import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@moxmuse/api'
import { getServerSession } from 'next-auth'
import { authOptions } from '@moxmuse/api/src/auth'
import { prisma } from '@moxmuse/db'

// Export runtime configuration for extended timeouts
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes in seconds for Vercel

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      // Use the same session retrieval logic as the main tRPC context
      const session = await getServerSession(authOptions)
      
      // Add debugging for session state
      console.log('tRPC Route Context:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      })
      
      return {
        session,
        prisma,
      }
    },
    // Handle batch requests properly
    onError({ error, path }) {
      console.error(`TRPC Error on ${path}:`, error)
      
      // Add more detailed error logging for debugging
      if (error.code === 'UNAUTHORIZED') {
        console.error('Authentication failed for path:', path)
      }
    },
    // Respect client timeout headers
    responseMeta() {
      return {
        headers: {
          // Allow CORS if needed
          'Access-Control-Allow-Origin': '*',
          // Cache control for mutations
          'Cache-Control': 'no-store',
        },
      }
    },
  })

export { handler as GET, handler as POST }
