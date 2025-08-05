'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, ExternalLink, Bot, User, X, Plus, Minus, ChevronRight, Sparkles } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { useDeck } from '@/contexts/DeckContext'
import { useErrorToast } from '@/components/ui/toaster'
import Link from 'next/link'

interface DeckEditorProps {
  sessionId: string
  recommendations: any[]
  onRecommendationsChange: (recommendations: any[]) => void
  activeDeck?: any
}

export function DeckEditor({ 
  sessionId, 
  recommendations, 
  onRecommendationsChange,
  activeDeck 
}: DeckEditorProps) {
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { deckCards, addCardToDeck, removeCardFromDeck, isLoading: deckLoading } = useDeck()
  const errorToast = useErrorToast()

  const chatRecommendMutation = trpc.tutor.recommendAndLink.useMutation({
    onSuccess: (data) => {
      onRecommendationsChange([...recommendations, ...data])
      if (data.length === 0) {
        errorToast('No Recommendations', 'No card recommendations were found. Try rephrasing your request.')
      }
    },
    onError: (error) => {
      console.error('Recommendation error:', error)
      errorToast(
        'Recommendation Failed',
        'Unable to get card recommendations. Please try again.',
        {
          label: 'Retry',
          onClick: () => {
            if (message.trim()) {
              chatRecommendMutation.mutate({ sessionId, prompt: message })
            }
          }
        }
      )
    }
  })

  const trackClickMutation = trpc.tutor.trackClick.useMutation({
    onError: (error) => {
      console.warn('Failed to track click:', error)
    }
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [recommendations])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || chatRecommendMutation.isLoading) return

    const userMessage = message
    setMessage('')
    
    // Add user message to recommendations list
    onRecommendationsChange([...recommendations, { type: 'user', content: userMessage }])

    // Get AI recommendations
    chatRecommendMutation.mutate({
      sessionId,
      prompt: userMessage,
    })
  }

  const handleCardClick = (recommendation: any) => {
    // Track affiliate click if URL exists
    if (recommendation.tcgPlayerUrl || recommendation.cardKingdomUrl) {
      trackClickMutation.mutate({
        sessionId,
        cardId: recommendation.id || recommendation.name,
        affiliateUrl: recommendation.tcgPlayerUrl || recommendation.cardKingdomUrl,
        affiliatePartner: recommendation.tcgPlayerUrl ? 'tcgplayer' : 'cardkingdom',
      })
    }
  }

  return (
    <>
      {/* Deck Status */}
      {activeDeck && (
        <div className="px-6 py-3 bg-zinc-800/30 border-b border-zinc-700/50">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600/80 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">Building: {activeDeck.name}</p>
                <p className="text-xs text-zinc-400">{activeDeck._count?.cards || 0} cards • {activeDeck.format}</p>
              </div>
            </div>
            <Link
              href="/lotuslist"
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              View Collection
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        {recommendations.length === 0 ? (
          <div className="max-w-3xl mx-auto text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-light mb-4 text-white drop-shadow-lg">Let's talk about your deck</h2>
            <p className="text-zinc-200 mb-8 text-lg drop-shadow">
              Tell me about your deck idea, your commander, or what kind of strategy you're looking for.
            </p>
            <div className="grid gap-3 max-w-xl mx-auto text-left">
              <button
                onClick={() => setMessage("I'm building a Teysa Karlov deck focused on death triggers")}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-sm border border-zinc-700/50"
              >
                <span className="text-zinc-300">💀</span> "I'm building a Teysa Karlov deck focused on death triggers"
              </button>
              <button
                onClick={() => setMessage("What are the best ramp cards for a Gruul deck under $5?")}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-sm border border-zinc-700/50"
              >
                <span className="text-zinc-300">🌲</span> "What are the best ramp cards for a Gruul deck under $5?"
              </button>
              <button
                onClick={() => setMessage("I need card draw options for my mono-red deck")}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-sm border border-zinc-700/50"
              >
                <span className="text-zinc-300">🔥</span> "I need card draw options for my mono-red deck"
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {recommendations.map((item, index) => (
              <div key={index}>
                {item.type === 'user' ? (
                  <div className="flex gap-3 justify-end">
                    <div className="bg-zinc-800/70 backdrop-blur-sm rounded-2xl px-6 py-3 max-w-xl border border-zinc-700/50">
                      <p className="text-zinc-100">{item.content}</p>
                    </div>
                    <div className="w-8 h-8 bg-zinc-700/70 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0 border border-zinc-600/50">
                      <User className="w-4 h-4 text-zinc-200" />
                    </div>
                  </div>
                ) : item.type === 'assistant' ? (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 max-w-xl border border-zinc-700/50">
                      <p className="whitespace-pre-wrap text-zinc-100">{item.content}</p>
                    </div>
                  </div>
                ) : item.type === 'card' ? (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-zinc-800/70 backdrop-blur-sm rounded-xl p-4 hover:bg-zinc-800/80 transition-all border border-zinc-700/50 group">
                        <div className="flex gap-4">
                          {/* Compact Card Image */}
                          <div className="flex-shrink-0">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-20 h-28 rounded-md shadow-lg object-cover cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => {
                                // Toggle full-size image view
                                const img = document.createElement('img');
                                img.src = item.imageUrl;
                                img.className = 'max-w-sm max-h-96 rounded-lg shadow-2xl';
                                const modal = document.createElement('div');
                                modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-pointer';
                                modal.appendChild(img);
                                modal.onclick = () => modal.remove();
                                document.body.appendChild(modal);
                              }}
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Header Row */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-zinc-100 truncate">{item.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                  <span>{item.typeLine}</span>
                                  <span>•</span>
                                  <span>{item.setName}</span>
                                </div>
                              </div>
                              
                              {/* Price and Status */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-lg font-bold text-green-400">${item.price}</span>
                                {item.owned && (
                                  <div className="w-2 h-2 bg-blue-400 rounded-full" title="In Collection" />
                                )}
                              </div>
                            </div>
                            
                            {/* Oracle Text - Collapsible */}
                            {item.oracleText && (
                              <div className="mb-3">
                                <p className="text-xs leading-relaxed text-zinc-300 overflow-hidden transition-all" style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}>
                                  {item.oracleText}
                                </p>
                              </div>
                            )}
                            
                            {/* Action Row */}
                            <div className="flex items-center justify-between gap-2">
                              {/* Deck Actions */}
                              {activeDeck && (
                                <div className="flex items-center gap-1">
                                  {(deckCards.get(item.cardId) || 0) > 0 && (
                                    <button
                                      onClick={() => removeCardFromDeck(item.cardId, 1)}
                                      disabled={deckLoading}
                                      className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-md transition-all text-xs border border-red-500/50 disabled:opacity-50"
                                      title="Remove from deck"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => addCardToDeck(item.cardId, 1)}
                                    disabled={deckLoading}
                                    className="px-2 py-1.5 bg-purple-600/80 hover:bg-purple-600 rounded-md transition-all text-xs border border-purple-500/50 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add
                                  </button>
                                  {(deckCards.get(item.cardId) || 0) > 0 && (
                                    <span className="text-xs text-purple-400 px-1">
                                      {deckCards.get(item.cardId)}
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {/* Purchase Links - Compact */}
                              <div className="flex items-center gap-1">
                                {item.tcgPlayerUrl && (
                                  <a
                                    href={item.tcgPlayerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleCardClick(item)}
                                    className="px-2 py-1.5 bg-zinc-700/70 hover:bg-zinc-600/70 rounded-md transition-all text-xs border border-zinc-600/50 flex items-center gap-1"
                                    title="View on TCGPlayer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    TCG
                                  </a>
                                )}
                                {item.cardKingdomUrl && (
                                  <a
                                    href={item.cardKingdomUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleCardClick(item)}
                                    className="px-2 py-1.5 bg-zinc-700/70 hover:bg-zinc-600/70 rounded-md transition-all text-xs border border-zinc-600/50 flex items-center gap-1"
                                    title="View on Card Kingdom"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    CK
                                  </a>
                                )}
                              </div>
                            </div>
                            
                            {/* AI Reasoning - Expandable */}
                            {item.reasoning && (
                              <details className="mt-3 group/details">
                                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-300 flex items-center gap-1">
                                  <span>Why this card?</span>
                                  <ChevronRight className="w-3 h-3 transition-transform group-open/details:rotate-90" />
                                </summary>
                                <div className="mt-2 p-2 bg-zinc-900/60 rounded-md border border-zinc-700/50">
                                  <p className="text-xs text-zinc-300 italic leading-relaxed">{item.reasoning}</p>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : item.type === 'error' ? (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-red-500/30 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0 border border-red-500/50">
                      <X className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="bg-red-500/20 backdrop-blur-sm rounded-2xl px-6 py-3 max-w-xl border border-red-500/30">
                      <p className="text-red-300">{item.content}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {chatRecommendMutation.isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-zinc-700/50">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-700/50 bg-zinc-900/60 backdrop-blur-md px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask me about commanders, strategies, or specific cards..."
              className="w-full rounded-xl bg-zinc-800/70 backdrop-blur-sm border border-zinc-600/50 py-4 pl-6 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100"
            />
            <button
              type="submit"
              disabled={!message.trim() || chatRecommendMutation.isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}