'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error')
  
  const getErrorMessage = () => {
    switch (error) {
      case 'Configuration':
        return 'The Moxfield OAuth is not properly configured. Please contact the administrator.'
      case 'AccessDenied':
        return 'Access was denied. You may have cancelled the authorization.'
      case 'Verification':
        return 'The verification token has expired or has already been used.'
      default:
        return 'An error occurred during authentication. Please try again.'
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-800 rounded-lg p-8 border border-zinc-700 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-light mb-4">Authentication Error</h1>
          
          <p className="text-zinc-400 mb-8">
            {getErrorMessage()}
          </p>
          
          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
          
          {error === 'Configuration' && (
            <div className="mt-8 p-4 bg-zinc-900 rounded-lg border border-zinc-700 text-left">
              <h3 className="text-sm font-medium mb-2">For developers:</h3>
              <ol className="text-sm text-zinc-400 space-y-1">
                <li>1. Create an OAuth app at <a href="https://www.moxfield.com/account/developers" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">moxfield.com/account/developers</a></li>
                <li>2. Add these environment variables:</li>
                <li className="pl-4 font-mono text-xs">MOXFIELD_CLIENT_ID=your_client_id</li>
                <li className="pl-4 font-mono text-xs">MOXFIELD_CLIENT_SECRET=your_client_secret</li>
                <li>3. Set callback URL to: <span className="font-mono text-xs">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/callback/moxfield</span></li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 