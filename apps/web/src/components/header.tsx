'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Circle, LogOut, Sparkles, Database, TrendingUp, MessageSquare, Hammer } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="relative border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <Circle className="w-8 h-8 text-white fill-white/10 border border-zinc-600" />
              <Circle className="w-8 h-8 text-blue-400 fill-blue-900/30 border border-blue-800" />
              <Circle className="w-8 h-8 text-zinc-400 fill-black border border-zinc-400" />
              <Circle className="w-8 h-8 text-red-500 fill-red-900/30 border border-red-800" />
              <Circle className="w-8 h-8 text-green-500 fill-green-900/30 border border-green-800" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-wider">MOXMUSE</h1>
              <p className="text-[11px] text-zinc-500 tracking-widest uppercase">Commander Deck Engine</p>
            </div>
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/solsync" className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
              <Database className="w-4 h-4" />
              <span className="text-sm">SolSync</span>
            </Link>
            <Link href="/lotuslist" className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">LotusList</span>
            </Link>
            <Link href="/tutor" className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm">TolarianTutor</span>
            </Link>
            <Link href="/decks" className="flex items-center gap-2 hover:text-zinc-300 transition-colors">
              <Hammer className="w-4 h-4" />
              <span className="text-sm">DeckForge</span>
            </Link>

            {session ? (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-zinc-700">
                <div className="text-right">
                  <p className="text-sm font-medium">{session.user?.name || 'User'}</p>
                  <p className="text-xs text-zinc-500">{session.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
} 