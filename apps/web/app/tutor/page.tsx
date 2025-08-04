'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import { generateSessionId, type CommanderRecommendation } from '@moxmuse/shared'
import { Send, Loader2, ExternalLink, Check, X, Sparkles, Bot, User, ArrowLeft, Circle, TrendingUp, TrendingDown, MessageSquare, Compass, DollarSign, Trophy, Package, ChevronRight, HelpCircle, Plus, Minus, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { AuthPrompt } from '@/components/auth-prompt'
import { useDeck } from '@/contexts/DeckContext'
import { EntryPointSelector } from '@/components/tutor/EntryPointSelector'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { LoadingState } from '@/components/ui/loading-state'
import { useErrorToast, useSuccessToast } from '@/components/ui/toaster'
import { CommanderSelectionGrid } from '@/components/tutor/commander/CommanderSelectionGrid'
import { NaturalLanguageVision } from '@/components/tutor/NaturalLanguageVision'
import React from 'react'

type ConsultationMode = 'welcome' | 'commander' | 'budget' | 'bracket' | 'themes' | 'collection' | 
  'winCondition' | 'winConditionFollowup' | 'interaction' | 'interactionFollowup' | 
  'socialDynamics' | 'socialFollowup' | 'restrictions' | 'complexity' | 'complexityFollowup' |
  'specificCards' | 'manaBase' | 'manaFollowup' | 
  'summary' | 'chat' | 'deckBuilder' | 'commanderSelection' | 'deckGeneration' | 'naturalLanguageVision'

interface ConsultationData {
  commander?: string
  commanderColors?: string[]
  theme?: string
  themeCustom?: string  // Add custom theme field
  budget?: string
  budgetAmount?: number
  bracket?: number
  useCollection?: boolean
  colorPreferences?: string[]  // Add multi-select color preferences
  specificColors?: string[]    // Add specific colors for multi/5-color decks
  buildingFullDeck?: boolean   // Flag to indicate full deck building mode
  needsCommanderSuggestions?: boolean  // Flag to indicate we need commander suggestions after consultation
  // Win conditions
  winCondition?: string
  combatStrategy?: string
  combatSpeed?: string
  comboType?: string
  comboTiming?: string
  comboPieces?: string
  altWinType?: string
  // Interaction
  interactionLevel?: string
  interactionTypes?: string[]
  interactionTiming?: string
  protectionNeeds?: string
  // Social dynamics
  tablePolitics?: string
  threatApproach?: string
  hiddenPowerStyle?: string
  politicalTools?: string
  // Restrictions
  avoidStrategies?: string[]
  avoidCards?: string
  // Complexity
  complexityLevel?: string
  decisionType?: string
  complexityType?: string
  // Specific cards
  petCards?: string
  houseBans?: string
  maxCardPrice?: string
  proxiesAllowed?: boolean
  // Mana base
  manaStrategy?: string
  preferredColors?: string[]
  tappedLandRatio?: string
  fetchBudget?: string
  utilityPreference?: string
  // Legacy
  additionalNotes?: string
}

// Deck Builder Chat Component
function DeckBuilderChat({ 
  mode, 
  commander, 
  initialRecommendations = [],
  sessionId,
  consultationData
}: { 
  mode: 'commanderSelection' | 'deckGeneration'
  commander?: string
  initialRecommendations?: any[]
  sessionId: string
  consultationData?: ConsultationData
}) {
  console.log('DeckBuilderChat rendered with:', { mode, commander, sessionId })
  const [messages, setMessages] = useState<any[]>(initialRecommendations)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasTriggeredGeneration = useRef(false)
  const generationPromise = useRef<Promise<any> | null>(null)
  const isGenerationInProgress = useRef(false)
  const router = useRouter()
  const successToast = useSuccessToast()
  
  // Update messages when initialRecommendations changes
  useEffect(() => {
    if (initialRecommendations.length > 0) {
      setMessages(initialRecommendations)
    }
  }, [initialRecommendations])
  
  const recommendMutation = trpc.tutor.recommendAndLink.useMutation({
    onSuccess: (data) => {
      console.log('Received recommendations:', data)
      if (data && data.length > 0) {
        setMessages(prev => [...prev, ...data])
      } else {
        // Handle case where no recommendations are returned
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: "I'm having trouble generating specific card recommendations right now. Let me try a different approach. What specific aspects of your deck would you like help with? For example, I can suggest mana ramp, card draw, or removal options."
        }])
      }
      setIsGenerating(false)
    },
    onError: (error) => {
      console.error('Recommendation error:', error)
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: "I encountered an error while generating recommendations. Please try again or let me know if you'd like help with a specific aspect of your deck."
      }])
      setIsGenerating(false)
    }
  })

  // Separate mutation for full deck generation - AI-First V2
  const generateFullDeckMutation = trpc.tutor.generateFullDeckAIFirst.useMutation({
    onSuccess: (data) => {
      console.log('✅ AI-First deck generated successfully:', data)
      
      // Validate the response data
      if (!data || !data.deckId || typeof data.deckId !== 'string') {
        console.error('❌ Invalid deck data received:', data)
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: "I encountered an issue with the deck generation response. The deck data seems to be incomplete. Please try again, and I'll create your optimized 100-card Commander deck."
        }])
        setIsGenerating(false)
        return
      }

      const cardCount = data.cardCount || 100
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `🎉 Your complete ${cardCount}-card Commander deck has been generated! I've created a fully optimized deck with ${commander || data.commander} including a balanced mana base, ramp package, card draw, removal suite, and win conditions that synergize perfectly with your commander's strategy.`
      }])
      setIsGenerating(false)
      
      // Redirect to the deck page
      successToast('Deck created successfully! Redirecting...')
      setTimeout(() => {
        router.push(`/decks/${data.deckId}`)
      }, 1500)
    },
    onError: (error) => {
      console.error('❌ AI-First deck generation error:', error)
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: "I encountered an error while generating your complete deck. This might be due to high demand or a temporary issue. Please try again, and I'll create your optimized 100-card Commander deck."
      }])
      setIsGenerating(false)
    }
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Reset generation flag when commander changes
  useEffect(() => {
    hasTriggeredGeneration.current = false
  }, [commander])

  useEffect(() => {
    console.log('DeckBuilderChat useEffect triggered:', { mode, commander, sessionId, hasTriggered: hasTriggeredGeneration.current, isGeneratingDeck, isGenerationInProgress: isGenerationInProgress.current })
    
    // Initialize the conversation based on mode
    if (mode === 'commanderSelection') {
      // Don't auto-start - the generateCommanderSuggestions function will handle this
      // The recommendations should already be populated from the consultation flow
    } else if (mode === 'deckGeneration' && commander && !hasTriggeredGeneration.current && !isGeneratingDeck && !generationPromise.current && !isGenerationInProgress.current) {
      hasTriggeredGeneration.current = true
      isGenerationInProgress.current = true
      setIsGeneratingDeck(true)
      console.log('🚀 Starting full deck generation for commander:', commander)
      setIsGenerating(true)
      
      // Add initial message to show we're starting
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: `🎯 Perfect! I'm now generating your complete 100-card Commander deck with ${commander}. This will include an optimized mana base, ramp package, card draw engine, removal suite, and powerful synergies. Please wait while I craft your deck...`
      }])
      
        // Handle 'mixed' win condition by converting to 'combat'
        const winCondition = consultationData?.winCondition === 'mixed' ? 'combat' : consultationData?.winCondition;
        
        // Map the consultation data to match the backend schema
        const mappedConsultationData = {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: commander,
          commanderColors: consultationData?.commanderColors,
          strategy: consultationData?.theme === 'tokens' ? 'aggro' as const :
                   consultationData?.theme === 'aristocrats' ? 'combo' as const :
                   consultationData?.theme === 'spellslinger' ? 'control' as const :
                   consultationData?.theme === 'voltron' ? 'aggro' as const :
                   consultationData?.theme === 'reanimator' ? 'combo' as const :
                   consultationData?.theme === 'lands' ? 'value' as const :
                   consultationData?.theme === 'tribal' ? 'tribal' as const :
                   consultationData?.theme === 'control' ? 'control' as const :
                   consultationData?.theme === 'combo' ? 'combo' as const :
                   consultationData?.theme === 'stax' ? 'stax' as const :
                   'midrange' as const,
          themes: consultationData?.theme ? [consultationData.theme] : [],
          budget: consultationData?.budgetAmount || 200,
          powerLevel: consultationData?.bracket || 3,
          useCollection: consultationData?.useCollection || false,
          colorPreferences: consultationData?.colorPreferences || [],
          specificColors: consultationData?.specificColors || [],
          winConditions: winCondition ? {
            primary: winCondition as "combat" | "combo" | "alternative" | "control"
          } : { primary: "combat" as const },
          interaction: consultationData?.interactionLevel ? {
            level: (consultationData?.interactionLevel === 'heavy' || consultationData?.interactionLevel === 'high' ? 'high' : 
                   consultationData?.interactionLevel === 'low' ? 'low' : 
                   'medium') as "low" | "medium" | "high",
            types: consultationData?.interactionTypes || [],
            timing: "balanced" as const
          } : undefined,
          petCards: consultationData?.petCards ? consultationData.petCards.split(',').map(s => s.trim()).filter(Boolean) : [],
          avoidStrategies: consultationData?.avoidStrategies || [],
          avoidCards: consultationData?.avoidCards ? consultationData.avoidCards.split(',').map(s => s.trim()).filter(Boolean) : [],
          complexityLevel: consultationData?.complexityLevel as "simple" | "moderate" | "complex" | undefined
        }
        
        console.log('📤 Sending deck generation request with:', {
          sessionId,
          commander,
          consultationData: mappedConsultationData
        })
        
        // Generate a unique sessionId for this deck generation attempt
        const deckGenerationSessionId = `${sessionId}-deck-${Date.now()}`
        console.log('📤 Using unique deck generation sessionId:', deckGenerationSessionId)
        
        // Build a natural language request from consultation data
        let userRequest = `Build a ${consultationData?.theme || 'optimized'} Commander deck with ${commander}.`
        
        if (consultationData?.theme) {
          userRequest += ` Focus on ${consultationData.theme} strategy.`
        }
        
        if (winCondition) {
          userRequest += ` Win condition: ${winCondition}.`
          if (consultationData?.combatStrategy) userRequest += ` Combat strategy: ${consultationData.combatStrategy}.`
          if (consultationData?.comboType) userRequest += ` Combo type: ${consultationData.comboType}.`
          if (consultationData?.altWinType) userRequest += ` Alternative win: ${consultationData.altWinType}.`
        }
        
        if (consultationData?.interactionLevel) {
          userRequest += ` Interaction level: ${consultationData.interactionLevel}.`
          if (consultationData?.interactionTypes?.length) {
            userRequest += ` Include ${consultationData.interactionTypes.join(', ')}.`
          }
        }
        
        if (consultationData?.complexityLevel) {
          userRequest += ` Complexity: ${consultationData.complexityLevel}.`
        }
        
        if (consultationData?.avoidStrategies?.length) {
          userRequest += ` Avoid: ${consultationData.avoidStrategies.join(', ')}.`
        }
        
        if (consultationData?.petCards) {
          userRequest += ` Must include: ${consultationData.petCards}.`
        }
        
        if (consultationData?.avoidCards) {
          userRequest += ` Must exclude: ${consultationData.avoidCards}.`
        }
        
        console.log('🤖 AI-First user request:', userRequest)
        
        // Store the promise to prevent duplicate calls
        generationPromise.current = generateFullDeckMutation.mutateAsync({
          sessionId: deckGenerationSessionId,
          userRequest: userRequest,
          commanderName: commander,
          constraints: {
            budget: consultationData?.budgetAmount || 200,
            powerLevel: consultationData?.bracket || 3,
            mustInclude: consultationData?.petCards ? consultationData.petCards.split(',').map(s => s.trim()).filter(Boolean) : [],
            mustExclude: consultationData?.avoidCards ? consultationData.avoidCards.split(',').map(s => s.trim()).filter(Boolean) : []
          }
        }).finally(() => {
          setIsGeneratingDeck(false)
          generationPromise.current = null
          isGenerationInProgress.current = false
        })
    } else if (mode === 'deckGeneration' && !commander) {
      console.error('DeckGeneration mode triggered but no commander provided!')
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: 'I need a commander to build your deck. Please go back and select a commander first.'
      }])
    }
  }, [mode, commander, sessionId]) // Removed isGeneratingDeck from dependencies to prevent re-triggers

  const handleCommanderSelect = (selectedCommander: string) => {
    setIsGenerating(true)
    
    // Add immediate feedback message
    setMessages(prev => [...prev, {
      type: 'user',
      content: `I choose ${selectedCommander} as my commander. Please build me a complete deck!`
    }, {
      type: 'assistant',
      content: `Excellent choice! ${selectedCommander} is a fantastic commander. Let me build you a complete 100-card deck optimized for ${selectedCommander}'s strategy. This will include the perfect mana base, ramp package, card draw, removal suite, and win conditions that synergize perfectly with your commander.`
    }])
    
    // Use a different approach - generate deck building recommendations
    recommendMutation.mutate({
      sessionId,
      prompt: `Build a complete Commander deck with ${selectedCommander}. I need specific card recommendations for:

1. Mana Base (35-38 lands including utility lands)
2. Ramp Package (8-12 cards for mana acceleration) 
3. Card Draw Engine (8-10 cards for card advantage)
4. Removal Suite (8-10 targeted removal and board wipes)
5. Win Conditions (3-5 cards that can close out games)
6. Synergy Cards (30-40 cards that work with ${selectedCommander}'s abilities)

Please recommend specific cards for each category that work well with ${selectedCommander}'s strategy and color identity. Focus on cards that are readily available and reasonably priced.`,
    })
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((item, index) => (
            <div key={index}>
              {item.type === 'assistant' ? (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 max-w-3xl border border-zinc-700/50">
                    <p className="whitespace-pre-wrap text-zinc-100">{item.content}</p>
                    

                  </div>
                </div>

              ) : null}
            </div>
          ))}
          
          {isGenerating && (
            <div className="max-w-3xl">
              {mode === 'deckGeneration' ? (
                // Professional deck generation UI
                <div className="space-y-6">
                  <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50">
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center animate-pulse">
                        <Bot className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-semibold text-zinc-100 text-center mb-4">
                      Building Your Commander Deck
                    </h3>
                    
                    <p className="text-zinc-300 text-center mb-8">
                      Creating a complete 100-card deck optimized for <span className="font-semibold text-white">{commander}</span>
                    </p>
                    
                    {/* Progress Steps */}
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-100">Analyzing commander synergies</p>
                          <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '35%' }}></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-zinc-700/50 rounded-full flex items-center justify-center">
                          <Circle className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-400">Selecting optimal mana base</p>
                          <div className="mt-1 h-1 bg-zinc-700 rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-zinc-700/50 rounded-full flex items-center justify-center">
                          <Circle className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-400">Adding ramp and card draw</p>
                          <div className="mt-1 h-1 bg-zinc-700 rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-zinc-700/50 rounded-full flex items-center justify-center">
                          <Circle className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-400">Including interaction and removal</p>
                          <div className="mt-1 h-1 bg-zinc-700 rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-zinc-700/50 rounded-full flex items-center justify-center">
                          <Circle className="w-4 h-4 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-400">Finalizing win conditions</p>
                          <div className="mt-1 h-1 bg-zinc-700 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-900/60 rounded-lg p-4 border border-zinc-700/50">
                      <p className="text-sm text-zinc-400 text-center">
                        <span className="text-zinc-300">Estimated time:</span> 30-60 seconds
                      </p>
                      <p className="text-xs text-zinc-500 text-center mt-1">
                        We're optimizing card selections based on your preferences
                      </p>
                    </div>
                  </div>
                  
                  {/* Deck Preferences Summary */}
                  {consultationData && Object.keys(consultationData).length > 0 && (
                    <div className="bg-zinc-800/40 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/30">
                      <h4 className="text-sm font-medium text-zinc-300 mb-3">Building with your preferences:</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {consultationData.bracket && (
                          <div className="flex items-center gap-2">
                            <Trophy className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">Bracket {consultationData.bracket}</span>
                          </div>
                        )}
                        {consultationData.budgetAmount && !consultationData.useCollection && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">${consultationData.budgetAmount} budget</span>
                          </div>
                        )}
                        {consultationData.useCollection && (
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">Using collection only</span>
                          </div>
                        )}
                        {consultationData.winCondition && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">{consultationData.winCondition} win</span>
                          </div>
                        )}
                        {consultationData.interactionLevel && (
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">{consultationData.interactionLevel} interaction</span>
                          </div>
                        )}
                        {consultationData.theme && (
                          <div className="flex items-center gap-2">
                            <Compass className="w-3 h-3 text-zinc-500" />
                            <span className="text-zinc-400">{consultationData.theme}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Commander selection loading state
                <div 
                  className="flex gap-3"
                  data-testid="loading-commander-suggestions"
                  data-loading="true"
                  data-process="commander-suggestions"
                  role="status"
                  aria-live="polite"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500/80 to-blue-500/80 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-zinc-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-zinc-700/50 max-w-lg">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                      <span className="text-zinc-300">Finding perfect commanders for you...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}

// Deck Selector Component
function DeckSelector({ onDeckSelected }: { onDeckSelected: (deck: any) => void }) {
  const { data: decks, isLoading } = trpc.deck.getAll.useQuery()
  const [showAll, setShowAll] = useState(false)

  const displayDecks = showAll ? decks : decks?.slice(0, 3)

  if (isLoading) {
    return (
      <div className="p-8 rounded-xl bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-zinc-700/80 rounded-lg flex items-center justify-center">
          <Package className="w-4 h-4 text-zinc-300" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-100">Continue with Existing Deck</h3>
      </div>
      
      {decks && decks.length > 0 ? (
        <div className="space-y-2">
          {displayDecks?.map((deck) => (
            <button
              key={deck.id}
              onClick={() => onDeckSelected(deck)}
              className="w-full p-3 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors text-left border border-zinc-600/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-100 text-sm">{deck.name}</div>
                  <div className="text-xs text-zinc-400">{deck._count?.cards || 0} cards • {deck.format}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </div>
            </button>
          ))}
          
          {decks.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full p-2 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              {showAll ? 'Show Less' : `Show ${decks.length - 3} More`}
            </button>
          )}
          
          <Link
            href="/decks"
            className="block w-full p-3 rounded-lg bg-zinc-700/30 hover:bg-zinc-600/30 transition-colors text-center border border-zinc-600/20 text-sm text-zinc-300 hover:text-zinc-100"
          >
            Manage All Decks
          </Link>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-zinc-400 text-sm mb-3">No decks found</p>
          <Link
            href="/decks"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary rounded-lg text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Your First Deck
          </Link>
        </div>
      )}
    </div>
  )
}

// Deck Statistics Sidebar Component
function DeckStatsSidebar({ 
  deck, 
  deckCards, 
  deckStats, 
  onRemoveCard 
}: { 
  deck: any
  deckCards: Map<string, number>
  deckStats: any
  onRemoveCard: (cardId: string, quantity?: number) => void
}) {
  const { data: cardDetails } = trpc.collection.getCardDetails.useQuery(
    { cardIds: Array.from(deckCards.keys()) },
    { enabled: deckCards.size > 0 }
  )

  // Calculate enhanced stats with card data
  const enhancedStats = React.useMemo(() => {
    if (!cardDetails) return {
      manaCurve: [0, 0, 0, 0, 0, 0, 0, 0],
      colorDistribution: {},
      typeDistribution: {},
      totalValue: 0
    }

    const manaCurve = [0, 0, 0, 0, 0, 0, 0, 0] // 0, 1, 2, 3, 4, 5, 6, 7+
    const colorDistribution: Record<string, number> = {}
    const typeDistribution: Record<string, number> = {}
    let totalValue = 0

    cardDetails.forEach((card: any) => {
      const quantity = deckCards.get(card.id) || 0
      if (quantity === 0) return

      // Mana curve
      const cmc = Math.min(card.cmc || 0, 7)
      manaCurve[cmc] += quantity

      // Color distribution
      if (card.color_identity) {
        card.color_identity.forEach((color: string) => {
          colorDistribution[color] = (colorDistribution[color] || 0) + quantity
        })
      }

      // Type distribution
      if (card.type_line) {
        const types = card.type_line.split(' — ')[0].split(' ')
        types.forEach((type: string) => {
          if (type && !['Legendary', 'Basic', 'Snow'].includes(type)) {
            typeDistribution[type] = (typeDistribution[type] || 0) + quantity
          }
        })
      }

      // Total value
      const price = parseFloat(card.prices?.usd || '0')
      totalValue += price * quantity
    })

    return { manaCurve, colorDistribution, typeDistribution, totalValue }
  }, [cardDetails, deckCards])

  const colorSymbols: Record<string, string> = {
    W: '⚪', U: '🔵', B: '⚫', R: '🔴', G: '🟢'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-700/50">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">{deck.name}</h2>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{deckStats.totalCards}/100 cards</span>
          <span>${enhancedStats.totalValue.toFixed(0)}</span>
        </div>
      </div>

      {/* Stats Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Mana Curve */}
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Mana Curve</h3>
          <div className="space-y-2">
            {enhancedStats.manaCurve.map((count, cmc) => (
              <div key={cmc} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 w-4">{cmc === 7 ? '7+' : cmc}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-4 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                    style={{ width: `${Math.max(4, (count / Math.max(...enhancedStats.manaCurve)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Color Distribution */}
        {Object.keys(enhancedStats.colorDistribution).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Color Identity</h3>
            <div className="space-y-2">
              {Object.entries(enhancedStats.colorDistribution).map(([color, count]) => (
                <div key={color} className="flex items-center gap-2">
                  <span className="text-sm">{colorSymbols[color] || color}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                      style={{ width: `${(count / Math.max(...Object.values(enhancedStats.colorDistribution))) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type Distribution */}
        {Object.keys(enhancedStats.typeDistribution).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Card Types</h3>
            <div className="space-y-1">
              {Object.entries(enhancedStats.typeDistribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{type}</span>
                  <span className="text-xs text-zinc-300">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-4 border-t border-zinc-700/50">
          <Link 
            href={`/decks/${deck.id}`}
            className="w-full px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-lg border border-zinc-700/50 transition-colors text-sm text-zinc-300 hover:text-zinc-100 flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Edit Deck
          </Link>
        </div>
      </div>
    </div>
  )
}

function TutorPageContent() {
  const { data: session, status } = useSession()
  const { activeDeck, setActiveDeck, deckCards, deckStats, addCardToDeck, removeCardFromDeck, isLoading: deckLoading } = useDeck()
  const [sessionId] = useState(() => generateSessionId())
  const [message, setMessage] = useState('')
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [currentBackground, setCurrentBackground] = useState(0)
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>('welcome')
  
  // Debug consultation mode changes
  useEffect(() => {
    console.log('Consultation mode changed to:', consultationMode)
  }, [consultationMode])
  const [consultationData, setConsultationData] = useState<ConsultationData>({})
  const [selectedCommander, setSelectedCommander] = useState<string>()
  const [showBracketModal, setShowBracketModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const errorToast = useErrorToast()
  const successToast = useSuccessToast()

  const backgrounds = [
    '/images/plains1.png',
    '/images/island1.png', 
    '/images/swamp1.png',
    '/images/mountain1.png',
    '/images/forest1.png'
  ]

  const chatRecommendMutation = trpc.tutor.recommendAndLink.useMutation({
    onSuccess: (data) => {
      setRecommendations(prev => [...prev, ...data])
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

  const commanderMutation = trpc.tutor.getCommanderSuggestions.useMutation({
    onSuccess: (data) => {
      console.log('Commander mutation success:', data)
      setRecommendations(prev => [...prev, {
        type: 'assistant',
        content: `I found ${data.length} commanders that match your preferences! Each one offers a different playstyle and strategy. Choose one to build your deck around:`
      }, ...data])
      
      if (data.length === 0) {
        errorToast('No Commanders Found', 'No commanders match your criteria. Try adjusting your preferences.')
      } else {
        successToast('Commanders Found', `Found ${data.length} commander recommendations`)
      }
    },
    onError: (error) => {
      console.error('Commander suggestion error:', error)
      errorToast(
        'Commander Search Failed',
        'Unable to find commander suggestions. Please try again.',
        {
          label: 'Retry',
          onClick: () => commanderMutation.mutate({ sessionId, prompt: 'Find me commander suggestions' })
        }
      )
    }
  })

  const trackClickMutation = trpc.tutor.trackClick.useMutation({
    onError: (error) => {
      console.warn('Failed to track click:', error)
      // Don't show error toast for tracking failures as they're not user-facing
    }
  })
  
  const createDeckMutation = trpc.deck.create.useMutation({
    onSuccess: (deck) => {
      successToast('Deck Created', `Created new deck: ${deck.name}`)
    },
    onError: (error) => {
      console.error('Failed to create deck:', error)
      errorToast(
        'Deck Creation Failed',
        'Unable to create a new deck. Please try again.',
        {
          label: 'Retry',
          onClick: () => createTempDeck()
        }
      )
    }
  })
  
  const createTempDeck = async () => {
    try {
      const deck = await createDeckMutation.mutateAsync({
        name: "New Commander Deck",
        format: "commander",
        description: "Building with TolarianTutor..."
      })
      // Add missing properties for the Deck type
      const deckWithDefaults = {
        ...deck,
        commander: deck.commander || undefined,
        description: deck.description || undefined,
        powerLevel: deck.powerLevel || undefined,
        budget: deck.budget ? Number(deck.budget) : undefined,
        cards: [],
        _count: { cards: 0 }
      }
      setActiveDeck(deckWithDefaults)
    } catch (error) {
      console.error('Failed to create deck:', error)
      errorToast(
        'Deck Creation Failed',
        'Unable to create a new deck. Please try again or check your connection.'
      )
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [recommendations])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % backgrounds.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [backgrounds.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || chatRecommendMutation.isLoading) return

    const userMessage = message
    setMessage('')
    
    // Add user message to recommendations list
    setRecommendations(prev => [...prev, { type: 'user', content: userMessage }])

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
        cardId: recommendation.id || recommendation.name, // Use ID if available, otherwise name
        affiliateUrl: recommendation.tcgPlayerUrl || recommendation.cardKingdomUrl,
        affiliatePartner: recommendation.tcgPlayerUrl ? 'tcgplayer' : 'cardkingdom',
      })
    }
  }

  const handleConsultationChoice = (choice: string, field: keyof ConsultationData) => {
    setConsultationData(prev => ({ ...prev, [field]: choice }))
    
    // Advance to next step
    switch (consultationMode) {
      case 'commander':
        if (consultationData.buildingFullDeck) {
          // If building full deck, create deck and generate immediately
          createTempDeck().then(() => {
            setConsultationMode('deckGeneration')
          })
        } else {
          setConsultationMode('collection') // Normal consultation flow
        }
        break
      case 'themes':
        setConsultationMode('collection') // Changed from 'budget' to 'collection'
        break
      case 'collection':
        // If they're only using their collection, skip budget and go to power level
        if (consultationData.useCollection === true) {
          setConsultationMode('bracket')
        } else {
          setConsultationMode('budget')
        }
        break
      case 'budget':
        setConsultationMode('bracket')
        break
      case 'bracket':
        setConsultationMode('winCondition') // Changed from 'notes' to 'winCondition'
        break
      case 'winCondition':
        // Handle win condition navigation based on selection
        if (consultationData.winCondition === 'combat') {
          setConsultationMode('winConditionFollowup')
        } else if (consultationData.winCondition === 'combo') {
          setConsultationMode('winConditionFollowup')
        } else if (consultationData.winCondition === 'alternative') {
          setConsultationMode('winConditionFollowup')
        } else {
          setConsultationMode('interaction')
        }
        break
      case 'winConditionFollowup':
        setConsultationMode('interaction')
        break
      case 'interaction':
        if (consultationData.interactionLevel === 'heavy' || consultationData.interactionLevel === 'moderate') {
          setConsultationMode('interactionFollowup')
        } else {
          setConsultationMode('socialDynamics')
        }
        break
      case 'interactionFollowup':
        setConsultationMode('socialDynamics')
        break
      case 'socialDynamics':
        setConsultationMode('restrictions')
        break
      case 'restrictions':
        setConsultationMode('complexity')
        break
      case 'complexity':
        if (consultationData.complexityLevel === 'moderate' || consultationData.complexityLevel === 'high') {
          setConsultationMode('complexityFollowup')
        } else {
          setConsultationMode('specificCards')
        }
        break
      case 'complexityFollowup':
        setConsultationMode('specificCards')
        break
      case 'specificCards':
        setConsultationMode('manaBase')
        break
      case 'manaBase':
        // Handled by the Continue button in manaBase section
        setConsultationMode('manaFollowup')
        break
      case 'manaFollowup':
        setConsultationMode('summary') // Skip meta questions, go straight to summary
        break
      case 'summary':
        console.log('Summary step - needsCommanderSuggestions:', consultationData.needsCommanderSuggestions)
        if (consultationData.needsCommanderSuggestions) {
          console.log('Setting consultation mode to commanderSelection')
          // Generate commander suggestions based on consultation data
          generateCommanderSuggestions()
          setConsultationMode('commanderSelection')
        } else {
          console.log('Setting consultation mode to chat')
          // Generate the consultation prompt and switch to chat
          generateConsultationPrompt()
          setConsultationMode('chat')
        }
        break
    }
  }

  const generateCommanderSuggestions = async () => {
    console.log('generateCommanderSuggestions called')
    console.log('consultationData:', consultationData)
    
    const { 
      theme, budget, budgetAmount, bracket, useCollection,
      winCondition, combatStrategy, comboType, altWinType,
      interactionLevel, interactionTypes, tablePolitics,
      avoidStrategies, avoidCards, complexityLevel,
      colorPreferences, specificColors
    } = consultationData
    
    let prompt = `Based on my deck preferences, please suggest 5 different commanders that would fit my playstyle:\n\n`
    
    if (theme) prompt += `Strategy: ${theme}\n`
    if (budget && budget !== 'no-limit' && !useCollection) {
      prompt += `Budget: ${budget === 'custom' ? `$${budgetAmount}` : budget}\n`
    }
    prompt += `Power Level: Bracket ${bracket}\n`
    if (useCollection) prompt += `Preference: Build with cards from my collection\n`
    
    if (winCondition) prompt += `Win Condition: ${winCondition}\n`
    if (interactionLevel) prompt += `Interaction Level: ${interactionLevel}\n`
    if (tablePolitics && tablePolitics !== 'none') prompt += `Table Politics: ${tablePolitics}\n`
    if (complexityLevel) prompt += `Complexity: ${complexityLevel}\n`
    
    if (colorPreferences && colorPreferences.length > 0) {
      const prefText = colorPreferences.map(pref => 
        pref === 'mono' ? 'Mono-colored' : 
        pref === 'multi' ? 'Multi-colored (2-3 colors)' : 
        'Open to 5 Color'
      ).join(', ')
      prompt += `Color Preference: ${prefText}\n`
      if (specificColors && specificColors.length > 0) {
        prompt += `Preferred Colors: ${specificColors.join(', ')}\n`
      }
    }
    
    prompt += `\nPlease recommend 5 specific Magic: The Gathering commanders that match these preferences. For each commander, explain their strategy and why they fit my playstyle. Include well-known commanders like Atraxa Praetors Voice, Edgar Markov, Meren of Clan Nel Toth, etc.`
    
    try {
      console.log('About to create temp deck')
      // Create temporary deck for the building process
      await createTempDeck()
      
      console.log('Temp deck created, setting recommendations')
      // Add consultation message
      setRecommendations([{ 
        type: 'assistant', 
        content: "Perfect! Based on your preferences, let me suggest some commanders that would be perfect for your playstyle..." 
      }])
      
      console.log('About to call commanderMutation with prompt:', prompt)
      // Send the prompt to specialized commander endpoint
      commanderMutation.mutate({
        sessionId,
        prompt,
        constraints: {
          budget: useCollection ? undefined : budgetAmount,
          ownedOnly: useCollection,
          powerLevel: bracket
        }
      })
    } catch (error) {
      console.error('Error in generateCommanderSuggestions:', error)
      setRecommendations([{ 
        type: 'assistant', 
        content: "I encountered an error while generating commander suggestions. Let me try a different approach. What type of strategy are you most interested in?" 
      }])
    }
  }

  const generateConsultationPrompt = () => {
    const { 
      commander, theme, budget, budgetAmount, bracket, useCollection,
      winCondition, combatStrategy, comboType, altWinType,
      interactionLevel, interactionTypes, tablePolitics,
      avoidStrategies, avoidCards, complexityLevel,
      petCards, houseBans, colorPreferences, specificColors
    } = consultationData
    
    let prompt = `I need help building a Commander deck with the following specifications:\n\n`
    
    if (commander) {
      prompt += `Commander: ${commander}\n`
    } else if (theme) {
      prompt += `Theme/Strategy: ${theme}\n`
    }
    
    // Only include budget if it's set (won't be set if using collection only)
    if (budget && budget !== 'no-limit' && !useCollection) {
      prompt += `Budget: ${budget === 'custom' ? `$${budgetAmount}` : budget}\n`
    } else if (budget === 'no-limit' && !useCollection) {
      prompt += `Budget: No limit\n`
    }
    
    prompt += `Power Level: Bracket ${bracket}\n`
    
    if (useCollection) {
      prompt += `Preference: Build exclusively with cards from my collection\n`
    }
    
    // Win condition details
    if (winCondition) {
      prompt += `\nWin Condition: ${winCondition}\n`
      if (combatStrategy) prompt += `Combat Strategy: ${combatStrategy}\n`
      if (comboType) prompt += `Combo Type: ${comboType}\n`
      if (altWinType) prompt += `Alternative Win: ${altWinType}\n`
    }
    
    // Interaction preferences
    if (interactionLevel) {
      prompt += `\nInteraction Level: ${interactionLevel}\n`
      if (interactionTypes && interactionTypes.length > 0) {
        prompt += `Interaction Types: ${interactionTypes.join(', ')}\n`
      }
    }
    
    // Social dynamics
    if (tablePolitics && tablePolitics !== 'none') {
      prompt += `\nTable Politics: ${tablePolitics}\n`
    }
    
    // Restrictions
    if (avoidStrategies && avoidStrategies.length > 0) {
      prompt += `\nStrategies to Avoid: ${avoidStrategies.join(', ')}\n`
    }
    if (avoidCards) {
      prompt += `Additional Restrictions: ${avoidCards}\n`
    }
    
    // Complexity
    if (complexityLevel) {
      prompt += `\nComplexity Preference: ${complexityLevel}\n`
    }
    
    // Specific cards
    if (petCards) {
      prompt += `\nPet Cards to Include: ${petCards}\n`
    }
    if (houseBans) {
      prompt += `House Rules/Bans: ${houseBans}\n`
    }
    
    // Color preferences
    if (colorPreferences && colorPreferences.length > 0) {
      const prefText = colorPreferences.map(pref => 
        pref === 'mono' ? 'Mono-colored' : 
        pref === 'multi' ? 'Multi-colored (2-3 colors)' : 
        'Open to 5 Color'
      ).join(', ')
      prompt += `\nColor Preference: Open to ${prefText}\n`
      if (specificColors && specificColors.length > 0) {
        if (colorPreferences.includes('mono')) {
          prompt += `Considering Colors: ${specificColors.join(', ')}\n`
        } else {
          prompt += `Must Include Colors: ${specificColors.join(', ')}\n`
        }
      }
    }
    
    prompt += `\nPlease recommend cards that fit these criteria and explain why they work well for this deck.`
    
    // Add consultation message
    setRecommendations([{ 
      type: 'assistant', 
      content: "Great! I've gathered all the information about your deck. Let me analyze your requirements and suggest some perfect cards for your build..." 
    }])
    
    // Send the prompt
    chatRecommendMutation.mutate({
      sessionId,
      prompt,
      constraints: {
        budget: useCollection ? undefined : budgetAmount,
        ownedOnly: useCollection,
        powerLevel: bracket
      }
    })
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-[calc(100vh-73px)] bg-zinc-900 text-zinc-100">
        <main className="relative min-h-[calc(100vh-73px)]">
          {/* Cycling background layers */}
          {backgrounds.map((bg, index) => (
            <div
              key={bg}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentBackground ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80"></div>
          
          <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-73px)]">
            <AuthPrompt
              feature="TolarianTutor"
              description="Get AI-powered card recommendations for your Commander decks."
              benefits={[
                'Personalized suggestions based on your commander',
                'Optimize for casual, focused, or competitive play',
                'Find synergies and hidden gems',
                'Real-time pricing with affiliate links',
              ]}
            />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-73px)] relative">
      {/* Cycling background layers */}
      {backgrounds.map((bg, index) => (
        <div
          key={bg}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentBackground ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      ))}
      {/* Gradient overlay to ensure readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80"></div>
      
      {/* Main Content Area */}
      <div className="relative z-10 h-[calc(100vh-73px)] flex">
        {/* Deck Statistics Sidebar - Only show when in chat mode AND deck has cards */}
        {activeDeck && consultationMode === 'chat' && deckCards.size > 0 && (
          <div className="w-80 bg-zinc-900/80 backdrop-blur-sm border-r border-zinc-700/50 flex flex-col">
            <DeckStatsSidebar 
              deck={activeDeck} 
              deckCards={deckCards}
              deckStats={deckStats}
              onRemoveCard={removeCardFromDeck}
            />
          </div>
        )}
        
        {/* Main Chat/Consultation Area */}
        <div className="flex-1 flex flex-col">
          {consultationMode === 'welcome' && (
          <div className="flex-1 overflow-y-auto">
            <EntryPointSelector
              onDeckBuilding={() => setConsultationMode('deckBuilder')}
              onCardRecommendations={() => setConsultationMode('chat')}
              onNaturalLanguageVision={() => setConsultationMode('naturalLanguageVision')}
            />
            
            {/* Deck Selector - Keep existing functionality */}
            <div className="max-w-6xl mx-auto px-6 pb-12">
              <DeckSelector onDeckSelected={(deck) => {
                setActiveDeck(deck)
                setConsultationMode('chat')
              }} />
            </div>
          </div>
        )}

        {consultationMode === 'commander' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('welcome')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                Do you have a commander in mind?
              </h2>
              
              <div className="space-y-4">
                <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50">
                  <label className="block text-zinc-200 mb-2">Enter your commander's name:</label>
                  <input
                    type="text"
                    placeholder="e.g., Teysa Karlov, Atraxa, Praetors' Voice..."
                    className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        handleConsultationChoice(e.currentTarget.value, 'commander')
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.currentTarget.parentElement?.querySelector('input')
                      if (input?.value) {
                        handleConsultationChoice(input.value, 'commander')
                      }
                    }}
                    className="mt-3 px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-sm"
                  >
                    Continue with this Commander
                  </button>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-transparent text-zinc-400">OR</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setConsultationData(prev => ({ ...prev, commander: undefined }))
                    setConsultationMode('themes')
                  }}
                  className="w-full p-5 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left"
                >
                  <h3 className="text-lg font-semibold mb-1.5 text-zinc-100">
                    I need commander suggestions
                  </h3>
                  <p className="text-zinc-300 text-sm">
                    Tell me about your preferred playstyle and I'll recommend commanders
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'themes' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('commander')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What theme or strategy interests you?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[
                  { value: 'tokens', label: 'Tokens & Go Wide', icon: '👥' },
                  { value: 'aristocrats', label: 'Aristocrats (Sacrifice)', icon: '💀' },
                  { value: 'spellslinger', label: 'Spellslinger', icon: '⚡' },
                  { value: 'voltron', label: 'Voltron (Equipment/Auras)', icon: '⚔️' },
                  { value: 'reanimator', label: 'Reanimator', icon: '⚰️' },
                  { value: 'lands', label: 'Lands Matter', icon: '🏞️' },
                  { value: 'tribal', label: 'Tribal', icon: '🦎' },
                  { value: 'control', label: 'Control', icon: '🛡️' },
                  { value: 'combo', label: 'Combo', icon: '♾️' },
                  { value: 'artifact', label: 'Artifacts', icon: '⚙️' },
                  { value: 'enchantress', label: 'Enchantress', icon: '✨' },
                  { value: 'mill', label: 'Mill', icon: '🌊' },
                  { value: 'lifegain', label: 'Lifegain', icon: '❤️' },
                  { value: 'aggro', label: 'Aggro', icon: '🔥' },
                  { value: 'stax', label: 'Stax', icon: '🔒' },
                  { value: 'superfriends', label: 'Super Friends', icon: '🦸' },
                  { value: 'other', label: 'Something else...', icon: '🎯' }
                ].map(theme => (
                  <button
                    key={theme.value}
                    onClick={() => {
                      if (theme.value === 'other') {
                        // Show custom input for "Something else"
                        setConsultationData(prev => ({ ...prev, theme: 'custom' }))
                      } else {
                        handleConsultationChoice(theme.label, 'theme')
                      }
                    }}
                    className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col items-center gap-2 text-center group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{theme.icon}</span>
                    <span className="text-sm text-zinc-100">{theme.label}</span>
                  </button>
                ))}
              </div>
              
              {consultationData.theme === 'custom' && (
                <div className="mt-6 bg-zinc-800/60 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50">
                  <label className="block text-zinc-200 mb-2">Describe your theme or strategy:</label>
                  <input
                    type="text"
                    placeholder="e.g., Dragon tribal with reanimation, Cascade value engine..."
                    className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100"
                    value={consultationData.themeCustom || ''}
                    onChange={(e) => setConsultationData(prev => ({ ...prev, themeCustom: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        handleConsultationChoice(e.currentTarget.value, 'theme')
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (consultationData.themeCustom) {
                        handleConsultationChoice(consultationData.themeCustom, 'theme')
                      }
                    }}
                    className="mt-3 px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-sm"
                  >
                    Continue with this Theme
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {consultationMode === 'collection' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  if (consultationData.commander) {
                    setConsultationMode('commander')
                  } else {
                    setConsultationMode('themes')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                Do you want to use only cards you own?
              </h2>
              
              <div className="grid gap-3">
                <button
                  onClick={() => {
                    setConsultationData(prev => ({ ...prev, useCollection: true }))
                    setConsultationMode('bracket') // Skip budget if using collection only
                  }}
                  className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
                >
                  <div className="flex items-start gap-3">
                    <Package className="w-5 h-5 text-green-400 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="font-semibold text-zinc-100 mb-1">Yes, only my collection</div>
                      <p className="text-sm text-zinc-400">Build exclusively with cards I already own</p>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setConsultationData(prev => ({ ...prev, useCollection: false }))
                    setConsultationMode('budget')
                  }}
                  className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="font-semibold text-zinc-100 mb-1">I'm open to new cards</div>
                      <p className="text-sm text-zinc-400">Suggest cards whether I own them or not</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'budget' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('collection')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your budget for new cards?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { value: '<100', amount: 100, label: 'Under $100', desc: 'Budget-friendly options', icon: '$' },
                  { value: '100-250', amount: 250, label: '$100 - $250', desc: 'Some room for key pieces', icon: '$$' },
                  { value: '250-500', amount: 500, label: '$250 - $500', desc: 'Good selection available', icon: '$$$' },
                  { value: '500-1000', amount: 1000, label: '$500 - $1000', desc: 'Premium upgrades', icon: '$$$$' },
                  { value: '1000+', amount: 2000, label: '$1000+', desc: 'High-powered options', icon: '$$$$$' },
                  { value: 'no-limit', amount: undefined, label: 'No budget limit', desc: 'The sky\'s the limit', icon: '💰' }
                ].map(budget => (
                  <button
                    key={budget.value}
                    onClick={() => {
                      setConsultationData(prev => ({ 
                        ...prev, 
                        budget: budget.value,
                        budgetAmount: budget.amount 
                      }))
                      setConsultationMode('bracket')
                    }}
                    className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col gap-2 text-center group"
                  >
                    <div className="text-2xl font-bold text-green-400 group-hover:scale-110 transition-transform">{budget.icon}</div>
                    <div>
                      <div className="font-semibold text-zinc-100">{budget.label}</div>
                      <div className="text-xs text-zinc-400 mt-1">{budget.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'bracket' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  // Go back to collection or budget depending on the path
                  if (consultationData.useCollection === true) {
                    setConsultationMode('collection')
                  } else {
                    setConsultationMode('budget')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-3xl font-light text-white drop-shadow-lg">
                  Which bracket are you targeting?
                </h2>
                <button
                  onClick={() => setShowBracketModal(true)}
                  className="p-2 rounded-lg hover:bg-zinc-800/60 transition-all"
                  title="Learn about Commander Brackets"
                >
                  <HelpCircle className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
                </button>
              </div>
              <p className="text-zinc-300 mb-6 text-sm">Commander uses a bracket system to help match decks of similar power</p>
              
              <div className="space-y-2">
                {[
                  { 
                    value: 1, 
                    label: 'Bracket 1: Exhibition', 
                    desc: 'Ultra-casual, unusual builds for fun',
                    restrictions: 'No mass land denial, 2-card combos, or game changers'
                  },
                  { 
                    value: 2, 
                    label: 'Bracket 2: Core', 
                    desc: 'Average preconstructed deck level',
                    restrictions: 'No chaining extra turns or 2-card infinite combos'
                  },
                  { 
                    value: 3, 
                    label: 'Bracket 3: Upgraded', 
                    desc: 'Beyond precon strength',
                    restrictions: 'Late game 2-card combos allowed, 3 game changers max'
                  },
                  { 
                    value: 4, 
                    label: 'Bracket 4: Optimized', 
                    desc: 'High power Commander',
                    restrictions: 'No restrictions beyond banned list'
                  },
                  { 
                    value: 5, 
                    label: 'Bracket 5: cEDH', 
                    desc: 'Competitive EDH with fast combos',
                    restrictions: 'No restrictions, fully optimized'
                  }
                ].map(bracket => (
                  <button
                    key={bracket.value}
                    onClick={() => {
                      setConsultationData(prev => ({ ...prev, bracket: bracket.value }))
                      setConsultationMode('winCondition')
                    }}
                    className="w-full p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        bracket.value === 1 ? 'bg-green-500/20 text-green-400' :
                        bracket.value === 2 ? 'bg-blue-500/20 text-blue-400' :
                        bracket.value === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                        bracket.value === 4 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {bracket.value}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-zinc-100 mb-1">{bracket.label}</div>
                        <div className="text-sm text-zinc-300 mb-1">{bracket.desc}</div>
                        <div className="text-xs text-zinc-500">{bracket.restrictions}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors mt-1 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'winCondition' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('bracket')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                How do you like to win games?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { 
                    value: 'combat', 
                    label: 'Combat Damage', 
                    icon: '⚔️',
                    desc: 'Win through creature combat and damage'
                  },
                  { 
                    value: 'combo', 
                    label: 'Combo', 
                    icon: '♾️',
                    desc: 'Win through powerful card combinations'
                  },
                  { 
                    value: 'alternative', 
                    label: 'Alternative Win Conditions', 
                    icon: '🎯',
                    desc: 'Win through unique conditions or strategies'
                  },
                  { 
                    value: 'mixed', 
                    label: 'Mixed/Flexible', 
                    icon: '🔄',
                    desc: 'Multiple paths to victory'
                  }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setConsultationData(prev => ({ ...prev, winCondition: option.value }))
                      handleConsultationChoice(option.value, 'winCondition')
                    }}
                    className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                      <div>
                        <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                        <p className="text-sm text-zinc-400">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'winConditionFollowup' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('winCondition')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              {consultationData.winCondition === 'combat' && (
                <>
                  <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                    What's your preferred combat strategy?
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { 
                        value: 'goWide', 
                        label: 'Go Wide with Tokens', 
                        icon: '👥',
                        desc: 'Create many small creatures'
                      },
                      { 
                        value: 'voltron', 
                        label: 'Voltron (Go Tall)', 
                        icon: '🛡️',
                        desc: 'One powerful creature with equipment/auras'
                      },
                      { 
                        value: 'tribal', 
                        label: 'Tribal Synergies', 
                        icon: '🦎',
                        desc: 'Creature type matters'
                      },
                      { 
                        value: 'creatureCombos', 
                        label: 'Creature Combos', 
                        icon: '🔄',
                        desc: 'Combat-based synergies'
                      }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setConsultationData(prev => ({ ...prev, combatStrategy: option.value }))
                          setConsultationMode('interaction')
                        }}
                        className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                          <div>
                            <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                            <p className="text-sm text-zinc-400">{option.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              {consultationData.winCondition === 'combo' && (
                <>
                  <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                    What type of combos do you prefer?
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { 
                        value: 'infinite', 
                        label: 'Infinite/Game-ending', 
                        icon: '♾️',
                        desc: 'Win on the spot when assembled'
                      },
                      { 
                        value: 'valueEngines', 
                        label: 'Finite Value Engines', 
                        icon: '⚙️',
                        desc: 'Generate overwhelming advantage'
                      },
                      { 
                        value: 'synergyChains', 
                        label: 'Synergy Chains', 
                        icon: '🔗',
                        desc: 'Multiple cards working together'
                      }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setConsultationData(prev => ({ ...prev, comboType: option.value }))
                          setConsultationMode('interaction')
                        }}
                        className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                          <div>
                            <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                            <p className="text-sm text-zinc-400">{option.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              {consultationData.winCondition === 'alternative' && (
                <>
                  <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                    Which alternative win condition appeals to you?
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { 
                        value: 'mill', 
                        label: 'Mill/Deck Out', 
                        icon: '🌊',
                        desc: 'Empty their libraries'
                      },
                      { 
                        value: 'labman', 
                        label: 'Laboratory Maniac Effects', 
                        icon: '🧪',
                        desc: 'Win by drawing from empty library'
                      },
                      { 
                        value: 'damage', 
                        label: 'Non-combat Damage', 
                        icon: '🔥',
                        desc: 'Direct damage, life loss, etc.'
                      },
                      { 
                        value: 'other', 
                        label: 'Other Conditions', 
                        icon: '✨',
                        desc: 'Unique win conditions'
                      }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setConsultationData(prev => ({ ...prev, altWinType: option.value }))
                          setConsultationMode('interaction')
                        }}
                        className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                          <div>
                            <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                            <p className="text-sm text-zinc-400">{option.desc}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {consultationMode === 'interaction' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => {
                  if (consultationData.winCondition && consultationData.winCondition !== 'mixed') {
                    setConsultationMode('winConditionFollowup')
                  } else {
                    setConsultationMode('winCondition')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                How much do you want to interact with opponents?
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    value: 'high', 
                    label: 'Heavy Control', 
                    icon: '🛡️',
                    desc: 'Lots of counterspells, removal, and disruption'
                  },
                  { 
                    value: 'medium', 
                    label: 'Moderate Interaction', 
                    icon: '⚔️',
                    desc: 'Some protection and key removal'
                  },
                  { 
                    value: 'low', 
                    label: 'Light Interaction', 
                    icon: '🏃',
                    desc: 'Minimal disruption, focus on your own plan'
                  }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setConsultationData(prev => ({ ...prev, interactionLevel: option.value }))
                      handleConsultationChoice(option.value, 'interactionLevel')
                    }}
                    className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                      <div>
                        <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                        <p className="text-sm text-zinc-400">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'interactionFollowup' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('interaction')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What types of interaction do you prefer?
              </h2>
              <p className="text-zinc-300 mb-6 text-sm">Select all that apply</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'counterspells', label: 'Counterspells', icon: '🚫' },
                  { value: 'removal', label: 'Targeted Removal', icon: '🎯' },
                  { value: 'boardwipes', label: 'Board Wipes', icon: '💥' },
                  { value: 'stax', label: 'Stax/Tax Effects', icon: '🔒' },
                  { value: 'protection', label: 'Protection Spells', icon: '🛡️' },
                  { value: 'hand', label: 'Hand Disruption', icon: '✋' }
                ].map(option => {
                  const isSelected = consultationData.interactionTypes?.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setConsultationData(prev => {
                          const current = prev.interactionTypes || []
                          const newTypes = isSelected 
                            ? current.filter(t => t !== option.value)
                            : [...current, option.value]
                          return { ...prev, interactionTypes: newTypes }
                        })
                      }}
                      className={`p-4 rounded-lg backdrop-blur-sm transition-all border ${
                        isSelected 
                          ? 'bg-purple-900/30 border-purple-500/50 hover:bg-purple-800/40' 
                          : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/70'
                      } text-left group`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{option.icon}</span>
                        <span className="text-zinc-100">{option.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-purple-400 ml-auto" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => setConsultationMode('socialDynamics')}
                className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'socialDynamics' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => {
                  if (consultationData.interactionLevel === 'heavy' || consultationData.interactionLevel === 'moderate') {
                    setConsultationMode('interactionFollowup')
                  } else {
                    setConsultationMode('interaction')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your preferred table presence?
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    value: 'archenemy', 
                    label: 'Archenemy/Threat', 
                    icon: '👑',
                    desc: 'Be the obvious threat everyone needs to answer'
                  },
                  { 
                    value: 'under-radar', 
                    label: 'Under the Radar', 
                    icon: '🥷',
                    desc: 'Stay unnoticed until ready to win'
                  },
                  { 
                    value: 'political', 
                    label: 'Political Player', 
                    icon: '🤝',
                    desc: 'Make deals and manipulate the table'
                  },
                  { 
                    value: 'none', 
                    label: 'No Preference', 
                    icon: '🎲',
                    desc: 'Adapt to the situation'
                  }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setConsultationData(prev => ({ ...prev, tablePolitics: option.value }))
                      handleConsultationChoice(option.value, 'tablePolitics')
                    }}
                    className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                      <div>
                        <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                        <p className="text-sm text-zinc-400">{option.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'socialFollowup' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  // Go back to collection or budget depending on the path
                  if (consultationData.useCollection === true) {
                    setConsultationMode('collection')
                  } else {
                    setConsultationMode('budget')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your threat approach?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { value: 'none', label: 'No specific threat approach', icon: '👥' },
                  { value: 'land', label: 'Land denial (e.g., Counterspells, Disenchant)', icon: '🏞️' },
                  { value: 'creature', label: 'Creature removal (e.g., Counterspells, Disenchant)', icon: '🦎' },
                  { value: 'artifact', label: 'Artifact removal (e.g., Counterspells, Disenchant)', icon: '⚙️' },
                  { value: 'spell', label: 'Spell removal (e.g., Counterspells, Disenchant)', icon: '✨' },
                  { value: 'other', label: 'Something else...', icon: '🎯' }
                ].map(threatApproach => (
                  <button
                    key={threatApproach.value}
                    onClick={() => handleConsultationChoice(threatApproach.label, 'threatApproach')}
                    className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col items-center gap-2 text-center group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{threatApproach.icon}</span>
                    <span className="text-sm text-zinc-100">{threatApproach.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'restrictions' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => {
                  if (consultationData.tablePolitics !== 'none') {
                    setConsultationMode('socialFollowup')
                  } else {
                    setConsultationMode('socialDynamics')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                Are there strategies you want to avoid?
              </h2>
              <p className="text-zinc-300 mb-6 text-sm">Select all that apply</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'stax', label: 'Stax/Resource Denial', icon: '🔒' },
                  { value: 'mill', label: 'Mill', icon: '🌊' },
                  { value: 'landDestruction', label: 'Land Destruction', icon: '💥' },
                  { value: 'extraTurns', label: 'Extra Turns', icon: '⏰' },
                  { value: 'chaos', label: 'Chaos', icon: '🎲' },
                  { value: 'groupSlug', label: 'Group Slug', icon: '🔥' },
                  { value: 'theft', label: 'Theft/Control Effects', icon: '🎭' },
                  { value: 'infiniteCombo', label: 'Infinite Combos', icon: '♾️' },
                  { value: 'massDiscard', label: 'Mass Discard', icon: '✋' },
                  { value: 'hardControl', label: 'Hard Control', icon: '🚫' }
                ].map(option => {
                  const isSelected = consultationData.avoidStrategies?.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setConsultationData(prev => {
                          const current = prev.avoidStrategies || []
                          const newStrategies = isSelected 
                            ? current.filter(s => s !== option.value)
                            : [...current, option.value]
                          return { ...prev, avoidStrategies: newStrategies }
                        })
                      }}
                      className={`p-4 rounded-lg backdrop-blur-sm transition-all border ${
                        isSelected 
                          ? 'bg-red-900/30 border-red-500/50 hover:bg-red-800/40' 
                          : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/70'
                      } text-left group`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{option.icon}</span>
                        <span className="text-zinc-100">{option.label}</span>
                        {isSelected && <X className="w-4 h-4 text-red-400 ml-auto" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <div className="mt-6 bg-zinc-800/60 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50">
                <label className="block text-zinc-200 mb-2">Other strategies to avoid:</label>
                <textarea
                  placeholder="Any other strategies or cards you'd like to avoid..."
                  className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100 h-20 resize-none"
                  value={consultationData.avoidCards || ''}
                  onChange={(e) => setConsultationData(prev => ({ ...prev, avoidCards: e.target.value }))}
                />
              </div>
              
              <button
                onClick={() => setConsultationMode('complexity')}
                className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'complexity' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  // Go back to collection or budget depending on the path
                  if (consultationData.useCollection === true) {
                    setConsultationMode('collection')
                  } else {
                    setConsultationMode('budget')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your complexity level?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { value: 'low', label: 'Low (Simple, few decisions)', icon: '👥' },
                  { value: 'moderate', label: 'Moderate (Many decisions, but manageable)', icon: '⚔️' },
                  { value: 'high', label: 'High (Complex, many decisions, hard to optimize)', icon: '💀' }
                ].map(complexityLevel => (
                  <button
                    key={complexityLevel.value}
                    onClick={() => handleConsultationChoice(complexityLevel.label, 'complexityLevel')}
                    className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col items-center gap-2 text-center group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{complexityLevel.icon}</span>
                    <span className="text-sm text-zinc-100">{complexityLevel.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'complexityFollowup' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  // Go back to collection or budget depending on the path
                  if (consultationData.useCollection === true) {
                    setConsultationMode('collection')
                  } else {
                    setConsultationMode('budget')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your decision type?
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { value: 'choice', label: 'Choice (e.g., Ramp vs Control)', icon: '🎯' },
                  { value: 'combo', label: 'Combo (e.g., 2-card combo, 3-card combo)', icon: '⚔️' },
                  { value: 'other', label: 'Something else...', icon: '🎯' }
                ].map(decisionType => (
                  <button
                    key={decisionType.value}
                    onClick={() => handleConsultationChoice(decisionType.label, 'decisionType')}
                    className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col items-center gap-2 text-center group"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">{decisionType.icon}</span>
                    <span className="text-sm text-zinc-100">{decisionType.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {consultationMode === 'specificCards' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => {
                  if (consultationData.complexityLevel === 'moderate' || consultationData.complexityLevel === 'high') {
                    setConsultationMode('complexityFollowup')
                  } else {
                    setConsultationMode('complexity')
                  }
                }}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                Any pet cards you'd love to include?
              </h2>
              
              <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50">
                <label className="block text-zinc-200 mb-3">Cards to include:</label>
                <textarea
                  placeholder="List any specific cards you'd love to build around or include in your deck..."
                  className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100 h-32 resize-none"
                  value={consultationData.petCards || ''}
                  onChange={(e) => setConsultationData(prev => ({ ...prev, petCards: e.target.value }))}
                />
                <p className="text-xs text-zinc-400 mt-2">
                  Optional: Cards you enjoy playing or want to build around
                </p>
              </div>
              
              <div className="mt-6 bg-zinc-800/60 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50">
                <label className="block text-zinc-200 mb-3">House rules or bans:</label>
                <textarea
                  placeholder="Any cards your playgroup has banned or special rules..."
                  className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100 h-20 resize-none"
                  value={consultationData.houseBans || ''}
                  onChange={(e) => setConsultationData(prev => ({ ...prev, houseBans: e.target.value }))}
                />
              </div>
              
              <button
                onClick={() => setConsultationMode('manaBase')}
                className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'manaBase' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('specificCards')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                What's your color preference?
              </h2>
              <p className="text-zinc-300 mb-6 text-sm">Select all that you're open to</p>
              
              <div className="grid grid-cols-1 gap-4">
                {[
                  { 
                    value: 'mono', 
                    label: 'Mono-colored', 
                    icon: '🎯',
                    desc: 'Single color focus for consistency'
                  },
                  { 
                    value: 'multi', 
                    label: 'Multi-colored', 
                    icon: '🌈',
                    desc: '2-3 colors for flexibility'
                  },
                  { 
                    value: 'fiveColor', 
                    label: 'Open to 5 Color', 
                    icon: '✨',
                    desc: 'All colors for maximum options'
                  }
                ].map(option => {
                  const isSelected = consultationData.colorPreferences?.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setConsultationData(prev => {
                          const current = prev.colorPreferences || []
                          const newPrefs = isSelected 
                            ? current.filter(p => p !== option.value)
                            : [...current, option.value]
                          return { ...prev, colorPreferences: newPrefs }
                        })
                      }}
                      className={`p-5 rounded-lg backdrop-blur-sm transition-all border ${
                        isSelected 
                          ? 'bg-purple-900/30 border-purple-500/50 hover:bg-purple-800/40' 
                          : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/70'
                      } text-left group`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl group-hover:scale-110 transition-transform">{option.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-zinc-100 mb-1">{option.label}</div>
                          <p className="text-sm text-zinc-400">{option.desc}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => {
                  if (consultationData.colorPreferences && consultationData.colorPreferences.length > 0) {
                    setConsultationMode('manaFollowup')
                  } else {
                    // If nothing selected, skip to summary
                    setConsultationMode('summary')
                  }
                }}
                className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold"
              >
                {consultationData.colorPreferences?.length 
                  ? 'Continue' 
                  : 'Skip (No Preference)'}
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'manaFollowup' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('manaBase')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                {consultationData.colorPreferences?.includes('mono') 
                  ? 'Which colors are you potentially interested in?' 
                  : 'Are there any specific colors you\'d like to be included?'}
              </h2>
              <p className="text-zinc-300 mb-6 text-sm">
                {consultationData.colorPreferences?.includes('mono')
                  ? 'Select all colors you\'re considering for your mono-colored deck'
                  : 'Select any must-have colors, or none for flexibility'}
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { value: 'W', label: 'White', icon: '⚪', color: 'bg-yellow-100' },
                  { value: 'U', label: 'Blue', icon: '🔵', color: 'bg-blue-500' },
                  { value: 'B', label: 'Black', icon: '⚫', color: 'bg-gray-800' },
                  { value: 'R', label: 'Red', icon: '🔴', color: 'bg-red-500' },
                  { value: 'G', label: 'Green', icon: '🟢', color: 'bg-green-500' }
                ].map(option => {
                  const isSelected = consultationData.specificColors?.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        setConsultationData(prev => {
                          const current = prev.specificColors || []
                          const newColors = isSelected 
                            ? current.filter(c => c !== option.value)
                            : [...current, option.value]
                          return { ...prev, specificColors: newColors }
                        })
                      }}
                      className={`p-4 rounded-lg backdrop-blur-sm transition-all border ${
                        isSelected 
                          ? 'bg-purple-900/30 border-purple-500/50 hover:bg-purple-800/40' 
                          : 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-700/70'
                      } text-center group`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl">{option.icon}</span>
                        <span className="text-sm text-zinc-100">{option.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => setConsultationMode('summary')}
                className="mt-8 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold"
              >
                {consultationData.specificColors?.length 
                  ? 'Continue to Summary' 
                  : consultationData.colorPreferences?.includes('mono')
                    ? 'Skip (Open to Any Color)'
                    : 'Skip to Summary (Any Colors)'}
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'summary' && (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-3xl mx-auto py-12">
              <button
                onClick={() => setConsultationMode('manaFollowup')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-8 text-white drop-shadow-lg">
                Let's review your deck preferences
              </h2>
              
              <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 space-y-4">
                {consultationData.commander && (
                  <div>
                    <span className="text-zinc-400">Commander:</span>
                    <p className="text-zinc-100">{consultationData.commander}</p>
                  </div>
                )}
                
                {consultationData.theme && (
                  <div>
                    <span className="text-zinc-400">Theme:</span>
                    <p className="text-zinc-100">{consultationData.theme}</p>
                  </div>
                )}
                
                {consultationData.useCollection !== undefined && (
                  <div>
                    <span className="text-zinc-400">Collection:</span>
                    <p className="text-zinc-100">
                      {consultationData.useCollection ? 'Only use cards I own' : 'Open to new cards'}
                    </p>
                  </div>
                )}
                
                {consultationData.budget && !consultationData.useCollection && (
                  <div>
                    <span className="text-zinc-400">Budget:</span>
                    <p className="text-zinc-100">
                      {consultationData.budget === '<100' ? 'Under $100' :
                       consultationData.budget === '100-250' ? '$100 - $250' :
                       consultationData.budget === '250-500' ? '$250 - $500' :
                       consultationData.budget === '500-1000' ? '$500 - $1000' :
                       consultationData.budget === '1000+' ? '$1000+' :
                       consultationData.budget === 'no-limit' ? 'No limit' :
                       consultationData.budget === 'custom' && consultationData.budgetAmount ? `$${consultationData.budgetAmount}` :
                       consultationData.budget}
                    </p>
                  </div>
                )}
                
                {consultationData.bracket && (
                  <div>
                    <span className="text-zinc-400">Bracket:</span>
                    <p className="text-zinc-100">Bracket {consultationData.bracket}</p>
                  </div>
                )}
                
                {consultationData.winCondition && (
                  <div>
                    <span className="text-zinc-400">Win Condition:</span>
                    <p className="text-zinc-100">{consultationData.winCondition}</p>
                    {consultationData.combatStrategy && (
                      <p className="text-zinc-100 text-sm mt-1">Strategy: {consultationData.combatStrategy}</p>
                    )}
                    {consultationData.comboType && (
                      <p className="text-zinc-100 text-sm mt-1">Combo Type: {consultationData.comboType}</p>
                    )}
                    {consultationData.altWinType && (
                      <p className="text-zinc-100 text-sm mt-1">Alt Win: {consultationData.altWinType}</p>
                    )}
                  </div>
                )}
                
                {consultationData.interactionLevel && (
                  <div>
                    <span className="text-zinc-400">Interaction Level:</span>
                    <p className="text-zinc-100">{consultationData.interactionLevel}</p>
                    {consultationData.interactionTypes && consultationData.interactionTypes.length > 0 && (
                      <p className="text-zinc-100 text-sm mt-1">
                        Types: {consultationData.interactionTypes.join(', ')}
                      </p>
                    )}
                  </div>
                )}
                
                {consultationData?.tablePolitics && (
                  <div>
                    <span className="text-zinc-400">Table Presence:</span>
                    <p className="text-zinc-100">{consultationData.tablePolitics}</p>
                  </div>
                )}
                
                {consultationData.avoidStrategies && consultationData.avoidStrategies.length > 0 && (
                  <div>
                    <span className="text-zinc-400">Avoid:</span>
                    <p className="text-zinc-100">{consultationData.avoidStrategies.join(', ')}</p>
                  </div>
                )}
                
                {consultationData.avoidCards && (
                  <div>
                    <span className="text-zinc-400">Other Restrictions:</span>
                    <p className="text-zinc-100 text-sm">{consultationData.avoidCards}</p>
                  </div>
                )}
                
                {consultationData.complexityLevel && (
                  <div>
                    <span className="text-zinc-400">Complexity:</span>
                    <p className="text-zinc-100">{consultationData.complexityLevel}</p>
                  </div>
                )}
                
                {consultationData.petCards && (
                  <div>
                    <span className="text-zinc-400">Pet Cards:</span>
                    <p className="text-zinc-100 text-sm">{consultationData.petCards}</p>
                  </div>
                )}
                
                {consultationData.houseBans && (
                  <div>
                    <span className="text-zinc-400">House Rules/Bans:</span>
                    <p className="text-zinc-100 text-sm">{consultationData.houseBans}</p>
                  </div>
                )}
                {consultationData.colorPreferences && consultationData.colorPreferences.length > 0 && (
                  <div>
                    <span className="text-zinc-400">Color Preference:</span>
                    <p className="text-zinc-100">
                      {consultationData.colorPreferences.map(pref => 
                        pref === 'mono' ? 'Mono-colored' :
                        pref === 'multi' ? 'Multi-colored (2-3 colors)' :
                        'Open to 5 Color'
                      ).join(', ')}
                    </p>
                    {consultationData.specificColors && consultationData.specificColors.length > 0 && (
                      <p className="text-zinc-100 text-sm mt-1">
                        {consultationData.colorPreferences.includes('mono') 
                          ? 'Considering: ' 
                          : 'Must include: '}
                        {consultationData.specificColors.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => handleConsultationChoice('', 'additionalNotes')}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold mt-6"
              >
                Start Building My Deck
              </button>
            </div>
          </div>
        )}

        {consultationMode === 'deckBuilder' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-3xl mx-auto py-8">
              <button
                onClick={() => setConsultationMode('welcome')}
                className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                Let's Build Your Commander Deck
              </h2>
              
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setConsultationMode('commander')
                    // Set flag to indicate we're in deck building mode
                    setConsultationData(prev => ({ ...prev, buildingFullDeck: true }))
                  }}
                  className="w-full p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-blue-500/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                        I know my commander
                      </h3>
                      <p className="text-zinc-300 text-sm">
                        I have a specific commander in mind and want a full deck built around them
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors mt-1" />
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setConsultationMode('themes')
                    // Set flag to indicate we're building full deck and need commander suggestions
                    setConsultationData(prev => ({ ...prev, buildingFullDeck: true, needsCommanderSuggestions: true }))
                  }}
                  className="w-full p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-zinc-700/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-6 h-6 text-zinc-200" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                        I need commander suggestions
                      </h3>
                      <p className="text-zinc-300 text-sm">
                        Help me find the perfect commander based on my preferred playstyle and strategy
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors mt-1" />
                  </div>
                </button>
              </div>
            </div>
            

          </div>
        )}

        {consultationMode === 'commanderSelection' && (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-6xl mx-auto">
              <CommanderSelectionGrid
                commanders={recommendations.filter(r => r.type === 'commander') as CommanderRecommendation[]}
                onCommanderSelect={(commanderName) => {
                  console.log('Commander selected:', commanderName)
                  
                  // Update both consultation data and selected commander state
                  setConsultationData(prev => ({ ...prev, commander: commanderName }))
                  setSelectedCommander(commanderName)
                  
                  // Add immediate feedback message
                  setRecommendations(prev => [...prev, {
                    type: 'user',
                    content: `I choose ${commanderName} as my commander. Please build me a complete deck!`
                  }, {
                    type: 'assistant',
                    content: `Excellent choice! ${commanderName} is a fantastic commander. Let me build you a complete 100-card deck optimized for ${commanderName}'s strategy.`
                  }])
                  
                  console.log('Switching to deckGeneration mode')
                  // Switch to deck generation mode
                  setConsultationMode('deckGeneration')
                }}
                sessionId={sessionId}
                isLoading={commanderMutation.isLoading}
                onRequestMore={() => {
                  commanderMutation.mutate({
                    sessionId,
                    prompt: "Please recommend 5 different legendary creatures that can be commanders with varied strategies, colors, and power levels. Include diverse options like aggressive tribal, control, combo, and value engines.",
                    constraints: {
                      budget: consultationData.budgetAmount,
                      powerLevel: consultationData.bracket,
                      ownedOnly: consultationData.useCollection
                    }
                  })
                }}
              />
            </div>
          </div>
        )}

        {consultationMode === 'deckGeneration' && (
          <DeckBuilderChat 
            mode="deckGeneration"
            commander={selectedCommander || consultationData.commander}
            sessionId={sessionId}
            consultationData={consultationData}
          />
        )}

        {consultationMode === 'naturalLanguageVision' && (
          <div className="flex-1 overflow-y-auto">
            <NaturalLanguageVision
              onVisionParsed={(data: any) => {
                // Set consultation data from parsed natural language
                setConsultationData(data)
              }}
              onStartBuilding={(visionText: string, visionSessionId: string) => {
                // Move to chat mode with the vision text
                setConsultationMode('chat')
                
                // Generate recommendations based on the vision text
                const prompt = `Based on my deck vision: "${visionText}"

Please recommend cards that would fit this deck concept and explain why they work well together.`
                
                chatRecommendMutation.mutate({
                  sessionId: visionSessionId,
                  prompt,
                  constraints: {
                    budget: consultationData.budgetAmount,
                    powerLevel: consultationData.bracket,
                    ownedOnly: consultationData.useCollection
                  }
                })
              }}
            />
          </div>
        )}

        {consultationMode === 'chat' && (
          <>
            {/* Deck Status */}
            {activeDeck && (
              <div className="px-6 py-3 bg-zinc-800/30 border-b border-zinc-700/50">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-600/80 rounded-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-white" />
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
                  
                  <button
                    onClick={() => setConsultationMode('welcome')}
                    className="mt-8 text-zinc-400 hover:text-zinc-200 transition-colors text-sm"
                  >
                    ← Back to consultation options
                  </button>
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
        )}
        </div>
      </div>

      {/* Bracket Modal */}
      {showBracketModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowBracketModal(false)}
        >
          <div 
            className="bg-zinc-900 rounded-xl max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-semibold text-zinc-100">Commander Brackets System</h3>
                <button
                  onClick={() => setShowBracketModal(false)}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Placeholder for when the image is available */}
              <div className="bg-zinc-800 rounded-lg p-8 text-center">
                <p className="text-zinc-400 mb-4">
                  The Commander Brackets system helps players find games with decks of similar power levels.
                </p>
                {/* Try both possible filenames with and without typo */}
                <img 
                  src="/images/mtg_brackets.png" 
                  alt="Commander Brackets System"
                  className="w-full rounded-lg"
                  onError={(e) => {
                    // Try with the typo version
                    const img = e.target as HTMLImageElement;
                    if (img.src.includes('mtg_brackets.png')) {
                      img.src = '/images/mtg_breackets.png';
                    } else {
                      // If both fail, hide the image and show placeholder
                      img.style.display = 'none';
                      const placeholder = document.createElement('p');
                      placeholder.className = 'text-sm text-zinc-500';
                      placeholder.textContent = '[Commander Brackets reference image - add mtg_brackets.png or mtg_breackets.png to /public/images/]';
                      img.parentElement?.appendChild(placeholder);
                    }
                  }}
                />
              </div>
              
              <div className="mt-6 space-y-4">
                <p className="text-sm text-zinc-300">
                  The bracket system helps ensure everyone has a fun game by matching decks with similar strategies and power levels.
                </p>
                <a 
                  href="https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  Learn more about Commander Brackets
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TutorPage() {
  return (
    <ErrorBoundary 
      context="Tutor Page"
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        console.error('Tutor page error:', error, errorInfo)
        // In production, you might want to send this to an error reporting service
      }}
    >
      <TutorPageContent />
    </ErrorBoundary>
  )
}
