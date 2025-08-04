'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react'

interface AuthPromptProps {
  feature: string
  description: string
  benefits: string[]
}

export function AuthPrompt({ feature, description, benefits }: AuthPromptProps) {
  const pathname = usePathname()
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  
  const handleDemoSignIn = async () => {
    setIsDemoLoading(true)
    try {
      await signIn('credentials', {
        email: 'demo@moxmuse.com',
        password: 'demo123',
        callbackUrl: pathname,
      })
    } catch (error) {
      console.error('Demo sign in failed:', error)
      setIsDemoLoading(false)
    }
  }
  
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 mb-6">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        
        <h2 className="text-3xl font-light mb-4">
          Sign in to access {feature}
        </h2>
        
        <p className="text-lg text-zinc-400 mb-8">
          {description}
        </p>
        
        <div className="mb-8 space-y-3">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center justify-center gap-2 text-zinc-300">
              <span className="text-green-500">✓</span>
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-200 transition-all rounded"
          >
            Sign In to Continue
            <ArrowRight className="h-4 w-4" />
          </Link>
          
          <button
            onClick={handleDemoSignIn}
            disabled={isDemoLoading}
            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 font-medium transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDemoLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Try Demo Account
              </>
            )}
          </button>
        </div>
        
        <p className="mt-6 text-sm text-zinc-500">
          No credit card required • Free to start
        </p>
      </div>
    </div>
  )
} 