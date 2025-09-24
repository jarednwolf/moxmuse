import type { Session } from 'next-auth'
import type { User } from '@prisma/client'

// Context type for protected procedures where session is guaranteed
export interface ProtectedContext {
  session: Session & {
    user: {
      id: string
      email?: string | null
      name?: string | null
      image?: string | null
    }
  }
  user: User
  prisma: any // We'll use any for now to avoid circular dependencies
}

// Helper type guard
export function isProtectedContext(ctx: any): ctx is ProtectedContext {
  return ctx.session && ctx.session.user && ctx.user
}
