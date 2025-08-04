import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@moxmuse/api'
import { prisma } from '@moxmuse/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@moxmuse/api/src/auth'

// Export runtime configuration for extended timeouts
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes in seconds for Vercel

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getServerSession(authOptions)
      return {
        session,
        prisma,
      }
    },
    // Handle batch requests properly
    onError({ error, path }) {
      console.error(`TRPC Error on ${path}:`, error)
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
