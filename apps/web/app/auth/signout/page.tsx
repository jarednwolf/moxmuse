'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function SignOutPage() {
  useEffect(() => {
    // Force sign out and redirect to home
    signOut({ 
      callbackUrl: '/',
      redirect: true 
    })
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
        <p className="text-white">Signing out...</p>
      </div>
    </div>
  )
} 