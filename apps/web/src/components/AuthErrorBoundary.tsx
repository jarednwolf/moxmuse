'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { AlertCircle } from 'lucide-react'

interface AuthErrorBoundaryProps {
  children: React.ReactNode
  error?: Error | null
  reset?: () => void
}

export function AuthErrorBoundary({ children, error, reset }: AuthErrorBoundaryProps) {
  useEffect(() => {
    if (error?.message.includes('UNAUTHORIZED')) {
      console.log('🚨 Authentication error detected, signing out user')
      signOut({ callbackUrl: '/auth/signin' })
    }
  }, [error])

  if (error?.message.includes('UNAUTHORIZED')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-300 mb-4">
              Your session has expired. Redirecting to sign in...
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-300 mb-4">
              {error.message || 'An unexpected error occurred'}
            </p>
            {reset && (
              <button
                onClick={reset}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}