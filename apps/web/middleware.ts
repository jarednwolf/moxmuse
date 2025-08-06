import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // Add custom logic if needed
    console.log('🛡️ Middleware protecting:', req.nextUrl.pathname)
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Protect tutor routes - require authentication
        if (pathname.startsWith('/tutor')) {
          return !!token
        }
        
        // Protect deck management routes
        if (pathname.startsWith('/decks')) {
          return !!token
        }
        
        // Protect admin routes
        if (pathname.startsWith('/admin')) {
          return !!token
        }
        
        // Allow all other routes
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/tutor/:path*',
    '/decks/:path*',
    '/admin/:path*',
    '/api/trpc/:path*' // Protect API routes too
  ]
}