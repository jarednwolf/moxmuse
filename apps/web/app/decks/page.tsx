'use client'

import Link from 'next/link'
import { ArrowLeft, Plus, Loader2, Edit2, Trash2, Copy, Eye, EyeOff, Sparkles, Circle, Hammer } from 'lucide-react'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { formatNumber } from '@moxmuse/shared'
import { AuthPrompt } from '@/components/auth-prompt'

export default function DecksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckFormat, setNewDeckFormat] = useState<'commander'>('commander')
  const [newDeckDescription, setNewDeckDescription] = useState('')
  
  const { data: decks, isLoading, refetch } = trpc.deck.getAll.useQuery()
  
  const createDeck = trpc.deck.create.useMutation({
    onSuccess: (deck) => {
      setIsCreating(false)
      setNewDeckName('')
      setNewDeckDescription('')
      refetch()
      router.push(`/decks/${deck.id}`)
    },
  })
  
  const deleteDeck = trpc.deck.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })
  
  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDeckName.trim()) return
    
    createDeck.mutate({
      name: newDeckName,
      format: newDeckFormat,
      description: newDeckDescription || undefined,
    })
  }
  
  const handleDeleteDeck = (deckId: string, deckName: string) => {
    if (confirm(`Are you sure you want to delete "${deckName}"?`)) {
      deleteDeck.mutate({ deckId })
    }
  }
  
  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-zinc-900 text-zinc-100">
        <header className="relative border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm z-50">
          <div className="container mx-auto px-6 py-4">
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
          </div>
        </header>
        
        <main className="relative min-h-[calc(100vh-73px)]">
          {/* Cycling background layers */}
          <div className="absolute inset-0 cycling-backgrounds">
            <div className="cycling-image bg-plains"></div>
            <div className="cycling-image bg-island"></div>
            <div className="cycling-image bg-swamp"></div>
            <div className="cycling-image bg-mountain"></div>
            <div className="cycling-image bg-forest"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80"></div>
          
          <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-73px)]">
            <AuthPrompt
              feature="Deck Management"
              description="Create and manage your Commander decks with powerful tools and insights."
              benefits={[
                'Build multiple decks with your collection',
                'Track deck statistics and mana curves',
                'Export to popular formats (Moxfield, TXT, CSV)',
                'Get AI-powered optimization suggestions',
              ]}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden bg-zinc-900 text-zinc-100">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10 opacity-20">
        <div className="absolute top-1/4 -left-12 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-1/3 -right-12 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link href="/" className="mr-8 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-light tracking-wider">My Decks</h1>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Create Deck Form */}
          {isCreating ? (
            <form onSubmit={handleCreateDeck} className="mb-8 rounded-xl border border-zinc-700 bg-zinc-800/90 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Deck</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-zinc-400 mb-2">
                    Deck Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="My Awesome Deck"
                    className="w-full rounded-lg bg-zinc-700/50 border border-zinc-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                </div>
                
                {/* Format is always Commander - no selection needed */}
                <div className="text-sm text-zinc-400">
                  <span className="font-medium">Format:</span> Commander (100 cards)
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-zinc-400 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={newDeckDescription}
                    onChange={(e) => setNewDeckDescription(e.target.value)}
                    placeholder="What's your deck strategy?"
                    rows={3}
                    className="w-full rounded-lg bg-zinc-700/50 border border-zinc-600 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!newDeckName.trim() || createDeck.isLoading}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {createDeck.isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Deck
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false)
                      setNewDeckName('')
                      setNewDeckDescription('')
                    }}
                    className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-700/50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="mb-8 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Create New Deck
            </button>
          )}

          {/* Decks List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : decks && decks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="group rounded-xl border border-zinc-700 bg-zinc-800/50 backdrop-blur-sm p-6 hover:border-zinc-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{deck.name}</h3>
                      <p className="text-sm text-zinc-400 capitalize">{deck.format}</p>
                      {deck.description && (
                        <p className="text-sm text-zinc-500 mt-2">{deck.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/deckforge/${deck.id}`}
                        className="rounded-lg bg-orange-600/20 p-2 hover:bg-orange-600/30 transition-colors"
                        title="Open in DeckForge"
                      >
                        <Hammer className="h-4 w-4 text-orange-400" />
                      </Link>
                      <Link
                        href={`/decks/${deck.id}`}
                        className="rounded-lg bg-zinc-700/50 p-2 hover:bg-zinc-600/50 transition-colors"
                        title="Basic Editor"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteDeck(deck.id, deck.name)}
                        className="rounded-lg bg-zinc-700/50 p-2 hover:bg-red-600/20 transition-colors"
                        title="Delete Deck"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      {deck._count.cards} cards
                    </span>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/deckforge/${deck.id}`}
                        className="text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 text-xs"
                      >
                        <Hammer className="h-3 w-3" />
                        DeckForge
                      </Link>
                      <Link
                        href={`/decks/${deck.id}`}
                        className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        View Deck
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/90 backdrop-blur-xl p-16 text-center">
              <p className="text-zinc-400 mb-4">You haven't created any decks yet</p>
              <button
                onClick={() => setIsCreating(true)}
                className="rounded-xl bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-all inline-flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Create Your First Deck
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 