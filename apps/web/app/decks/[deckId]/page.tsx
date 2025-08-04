'use client'

import Link from 'next/link'
import { ArrowLeft, Search, Plus, Trash2, Save, Settings, Loader2, Circle, BarChart3, Download, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { formatPrice } from '@moxmuse/shared'
import { AuthPrompt } from '@/components/auth-prompt'

export default function DeckEditorPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const deckId = params.deckId as string
  
  const [isEditing, setIsEditing] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [deckDescription, setDeckDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showAddCards, setShowAddCards] = useState(false)
  const [collectionSearch, setCollectionSearch] = useState('')
  
  // Fetch deck data
  const { data: deck, isLoading: deckLoading, refetch: refetchDeck } = trpc.deck.getById.useQuery({ deckId })
  
  // Fetch card details for deck cards
  const cardIds = deck?.cards.map((c: any) => c.cardId) || []
  const { data: cardDetails } = trpc.collection.getCardDetails.useQuery(
    { cardIds },
    { enabled: cardIds.length > 0 }
  )
  
  // Update deck mutation
  const updateDeck = trpc.deck.update.useMutation({
    onSuccess: () => {
      setIsEditing(false)
      refetchDeck()
    },
  })
  
  // Remove card mutation
  const removeCard = trpc.deck.removeCard.useMutation({
    onSuccess: () => {
      refetchDeck()
    },
  })
  
  // Combine deck cards with card details
  const enrichedDeckCards = useMemo(() => {
    if (!deck?.cards || !cardDetails) return []
    
    return deck.cards.map((deckCard: any) => {
      // Try multiple ID fields to find a match
      const card = cardDetails.find((card: any) => 
        card.id === deckCard.cardId || 
        card.oracle_id === deckCard.cardId ||
        card.scryfall_id === deckCard.cardId ||
        // Some APIs return the ID in different formats
        card.id === deckCard.cardId.toLowerCase() ||
        card.id === deckCard.cardId.replace(/-/g, '')
      )
      
      return card ? { ...deckCard, card } : null
    }).filter((item: any): item is NonNullable<typeof item> => item !== null)
  }, [deck?.cards, cardDetails])
  
  // Filter cards by search and category
  const filteredCards = useMemo(() => {
    return enrichedDeckCards.filter(item => {
      if (!item || !item.card) return false
      
      const card = item.card
      
      // Search filter
      if (searchQuery && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false
      }
      
      return true
    })
  }, [enrichedDeckCards, searchQuery, selectedCategory])
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(deck?.cards.map((c: any) => c.category).filter(Boolean) || [])
    return ['all', ...Array.from(cats)] as string[]
  }, [deck?.cards])
  
  // Calculate deck stats
  const deckStats = useMemo(() => {
    const totalCards = filteredCards.reduce((sum, item) => sum + item.quantity, 0)
    const totalValue = filteredCards.reduce((sum, item) => {
      const price = parseFloat(item.card?.prices?.usd || '0')
      return sum + (price * item.quantity)
    }, 0)
    const totalCmc = filteredCards.reduce((sum, item) => {
      return sum + ((item.card?.cmc || 0) * item.quantity)
    }, 0)
    
    // Mana curve
    const manaCurve: Record<number, number> = {}
    filteredCards.forEach(item => {
      if (item.card?.cmc !== undefined) {
        const cmc = Math.floor(item.card.cmc)
        manaCurve[cmc] = (manaCurve[cmc] || 0) + item.quantity
      }
    })
    
    return { totalCards, totalValue, totalCmc, manaCurve }
  }, [filteredCards])
  
  const handleUpdateDeck = () => {
    if (!deck) return
    
    updateDeck.mutate({
      deckId,
      name: deckName || deck.name,
      description: deckDescription || deck.description || undefined,
    })
  }
  
  const handleRemoveCard = (cardId: string) => {
    removeCard.mutate({ deckId, cardId })
  }
  
  const handleExportDeck = () => {
    if (!deck || !enrichedDeckCards) return
    
    // Create text format export
    let exportText = `// ${deck.name}\n`
    exportText += `// Format: ${deck.format}\n`
    if (deck.description) {
      exportText += `// ${deck.description}\n`
    }
    exportText += '\n'
    
    // Group cards by category
    const cardsByCategory: Record<string, typeof enrichedDeckCards> = {}
    enrichedDeckCards.forEach(item => {
      if (!item) return
      
      const category = item.category || 'Other'
      if (!cardsByCategory[category]) {
        cardsByCategory[category] = []
      }
      cardsByCategory[category].push(item)
    })
    
    // Export each category
    Object.entries(cardsByCategory).forEach(([category, cards]) => {
      exportText += `// ${category}\n`
      cards.forEach(item => {
        if (item && item.card) {
          exportText += `${item.quantity} ${item.card.name}\n`
        }
      })
      exportText += '\n'
    })
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/[^a-z0-9]/gi, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  // Loading state
  if (status === 'loading' || deckLoading) {
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
              feature="Deck Editor"
              description="Build and optimize your Commander decks with advanced tools."
              benefits={[
                'Add cards from your collection',
                'Track mana curve and color distribution',
                'Export to multiple formats',
                'Get AI-powered suggestions',
              ]}
            />
          </div>
        </main>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Deck not found</p>
          <Link href="/decks" className="text-primary hover:text-primary/80">
            Back to Decks
          </Link>
        </div>
      </div>
    )
  }

  // Calculate mana curve
  const manaCurve: Record<number, number> = {}
  filteredCards.forEach(item => {
    if (item.card?.cmc !== undefined) {
      const cmc = Math.min(Math.floor(item.card.cmc), 7) // Cap at 7+
      manaCurve[cmc] = (manaCurve[cmc] || 0) + item.quantity
    }
  })
  
  const maxCurveHeight = Math.max(...Object.values(manaCurve), 1)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/decks" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Decks
              </Link>
              {isEditing ? (
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="text-xl font-light tracking-wider bg-transparent border-b border-zinc-600 focus:border-primary focus:outline-none"
                />
              ) : (
                <h1 className="text-xl font-light tracking-wider">{deck.name}</h1>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    onClick={handleUpdateDeck}
                    disabled={updateDeck.isLoading}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {updateDeck.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setDeckName(deck.name)
                      setDeckDescription(deck.description || '')
                    }}
                    className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-700/50 transition-all"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowAddCards(true)}
                    className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Cards
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(true)
                      setDeckName(deck.name)
                      setDeckDescription(deck.description || '')
                    }}
                    className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-700/50 transition-all flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Deck Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-400 mb-1">Total Cards</p>
              <p className="text-2xl font-bold">{deckStats.totalCards}</p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-400 mb-1">Unique Cards</p>
              <p className="text-2xl font-bold">{filteredCards.length}</p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-400 mb-1">Deck Value</p>
              <p className="text-2xl font-bold">{formatPrice(deckStats.totalValue * 100)}</p>
            </div>
            <div className="rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 p-4">
              <p className="text-sm text-zinc-400 mb-1">Avg CMC</p>
              <p className="text-2xl font-bold">
                {deckStats.totalCards > 0 ? (deckStats.totalCmc / deckStats.totalCards).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          {/* Mana Curve */}
          <div className="rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 p-6 mb-8">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-400 mb-4">
              <BarChart3 className="h-4 w-4" />
              Mana Curve
            </h3>
            <div className="flex items-end gap-2 h-32">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => (
                <div key={cmc} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end" style={{ height: '100px' }}>
                    <div 
                      className="w-full bg-primary rounded-t transition-all"
                      style={{ 
                        height: `${(manaCurve[cmc] || 0) / maxCurveHeight * 100}%`,
                        minHeight: manaCurve[cmc] ? '4px' : '0'
                      }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{cmc === 7 ? '7+' : cmc}</span>
                  <span className="text-xs font-bold">{manaCurve[cmc] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards in deck..."
                  className="w-full rounded-xl bg-zinc-800/50 backdrop-blur-md border border-zinc-700 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
                             <button
                 onClick={handleExportDeck}
                 className="rounded-xl border border-zinc-700 bg-zinc-800/50 backdrop-blur-md px-4 py-3 hover:bg-zinc-700/50 transition-all flex items-center gap-2"
               >
                 <Download className="h-5 w-5" />
                 Export
               </button>
            </div>

            {/* Category Filter */}
            {categories.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm capitalize transition-all ${
                      selectedCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-700 hover:bg-zinc-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cards Grid */}
          {filteredCards.length === 0 ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/90 backdrop-blur-xl p-16 text-center">
              <p className="text-zinc-400 mb-4">
                {deck.cards.length === 0
                  ? 'No cards in this deck yet'
                  : 'No cards match your search criteria'}
              </p>
              {deck.cards.length === 0 && (
                <button
                  onClick={() => setShowAddCards(true)}
                  className="rounded-xl bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Cards
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredCards.map((item) => {
                if (!item) return null
                
                return (
                  <div
                    key={item.id}
                    className="group relative rounded-xl border border-zinc-700 bg-zinc-800/50 backdrop-blur-sm overflow-hidden hover:border-zinc-600 transition-all"
                  >
                    {item.card?.image_uris?.normal && (
                      <div className="relative aspect-[488/680]">
                        <Image
                          src={item.card.image_uris.normal}
                          alt={item.card.name || 'Card image'}
                          fill
                          className="object-cover"
                        />
                        {/* Quantity Badge */}
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-white">
                          {item.quantity}x
                        </div>
                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveCard(item.cardId)}
                          className="absolute top-2 left-2 bg-red-600/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    )}
                    <div className="p-3 bg-zinc-900/80">
                      <h3 className="font-semibold text-sm truncate">{item.card?.name || 'Unknown Card'}</h3>
                      <p className="text-xs text-zinc-400">{item.card?.set_name || ''}</p>
                      <p className="text-sm font-bold mt-1">{formatPrice((parseFloat(item.card?.prices?.usd || '0') * 100))}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Cards Modal */}
      {showAddCards && (
        <AddCardsModal
          deckId={deckId}
          onClose={() => setShowAddCards(false)}
          onCardsAdded={() => {
            setShowAddCards(false)
            refetchDeck()
          }}
        />
      )}
    </div>
  )
}

// Add Cards Modal Component
function AddCardsModal({ deckId, onClose, onCardsAdded }: { 
  deckId: string
  onClose: () => void
  onCardsAdded: () => void 
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCards, setSelectedCards] = useState<Record<string, number>>({})
  
  // Fetch user's collection
  const { data: collection } = trpc.collection.get.useQuery()
  const { data: cardDetails } = trpc.collection.getCardDetails.useQuery(
    { cardIds: collection?.map((c: any) => c.cardId) || [] },
    { enabled: !!collection && collection.length > 0 }
  )
  
  // Add cards mutation
  const addCards = trpc.deck.addCard.useMutation({
    onSuccess: onCardsAdded
  })
  
  // Filter collection
  const filteredCollection = useMemo(() => {
    if (!collection || !cardDetails) return []
    
    return collection
      .map((item: any) => ({
        ...item,
        card: cardDetails.find((c: any) => c?.id === item.cardId)
      }))
      .filter((item: any) => {
        if (!item.card) return false
        if (!searchQuery) return true
        
        return item.card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               item.card.type_line.toLowerCase().includes(searchQuery.toLowerCase())
      })
  }, [collection, cardDetails, searchQuery])
  
  const handleAddCards = async () => {
    const promises = Object.entries(selectedCards).map(([cardId, quantity]) => 
      addCards.mutateAsync({ deckId, cardId, quantity })
    )
    await Promise.all(promises)
  }
  
  const totalSelected = Object.values(selectedCards).reduce((sum, q) => sum + q, 0)
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-zinc-900 rounded-2xl border border-zinc-700 flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-xl font-semibold">Add Cards from Collection</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-zinc-800/80 p-2 hover:bg-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        
        <div className="p-6 border-b border-zinc-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your collection..."
              className="w-full rounded-xl bg-zinc-800/50 border border-zinc-600 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredCollection.map((item) => {
              const selected = selectedCards[item.cardId] || 0
              const available = item.quantity + item.foilQuantity
              
              return (
                <div
                  key={item.cardId}
                  className={`relative rounded-xl border ${
                    selected > 0 ? 'border-primary' : 'border-zinc-700'
                  } bg-zinc-800/50 overflow-hidden hover:border-zinc-600 transition-all`}
                >
                  {item.card?.image_uris?.normal && (
                    <Image
                      src={item.card.image_uris.normal}
                      alt={item.card.name}
                      width={244}
                      height={340}
                      className="w-full"
                    />
                  )}
                  <div className="p-3">
                    <h3 className="font-semibold text-sm truncate">{item.card?.name}</h3>
                    <p className="text-xs text-zinc-400">Available: {available}</p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          setSelectedCards(prev => ({
                            ...prev,
                            [item.cardId]: Math.max(0, (prev[item.cardId] || 0) - 1)
                          }))
                        }}
                        disabled={selected === 0}
                        className="rounded bg-zinc-700 px-2 py-1 text-sm hover:bg-zinc-600 disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-bold">
                        {selected}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedCards(prev => ({
                            ...prev,
                            [item.cardId]: Math.min(available, (prev[item.cardId] || 0) + 1)
                          }))
                        }}
                        disabled={selected >= available}
                        className="rounded bg-zinc-700 px-2 py-1 text-sm hover:bg-zinc-600 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        <footer className="flex items-center justify-between p-6 border-t border-zinc-700">
          <p className="text-sm text-zinc-400">
            {totalSelected} cards selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-700/50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCards}
              disabled={totalSelected === 0 || addCards.isLoading}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {addCards.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add {totalSelected} Cards
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
