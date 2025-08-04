'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function SignOutPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/' })
  }, [])

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mx-auto mb-4" />
        <p className="text-zinc-400">Signing out...</p>
      </div>
    </div>
  )
} 