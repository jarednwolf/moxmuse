import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

// Lazy-load authOptions and prisma to avoid prisma init during Next build
export const dynamic = 'force-dynamic'

// Export runtime configuration for extended timeouts
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes in seconds for Vercel

const handler = async (req: Request) => {
  let appRouterVar: any
  let authOptions: any
  let prisma: any

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    appRouterVar = (0, eval)('require')("@moxmuse/api").appRouter
  } catch (_e) {
    appRouterVar = undefined
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    authOptions = (0, eval)('require')("@moxmuse/api/src/auth").authOptions
  } catch (_e) {
    authOptions = undefined
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = (0, eval)('require')("@moxmuse/db").prisma
  } catch (_e) {
    prisma = undefined
  }

  if (!appRouterVar) {
    return NextResponse.json({ error: 'tRPC router unavailable in build context' }, { status: 503 })
  }

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouterVar as any,
    createContext: async () => {
      const session = authOptions ? await getServerSession(authOptions) : null

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
    onError({ error, path }) {
      console.error(`TRPC Error on ${path}:`, error)
      if ((error as any).code === 'UNAUTHORIZED') {
        console.error('Authentication failed for path:', path)
      }
    },
    responseMeta() {
      return {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      }
    },
  })
}

export { handler as GET, handler as POST }
