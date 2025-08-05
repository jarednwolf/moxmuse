'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { Send, Loader2, Bot, User, Circle, TrendingUp, TrendingDown, MessageSquare, Compass, DollarSign, Trophy, Package } from 'lucide-react'
import { useSuccessToast } from '@/components/ui/toaster'
import type { ConsultationData } from './ConsultationWizard'

interface DeckGenerationEngineProps {
  mode: 'commanderSelection' | 'deckGeneration'
  commander?: string
  initialRecommendations?: any[]
  sessionId: string
  consultationData?: ConsultationData
}

export function DeckGenerationEngine({ 
  mode, 
  commander, 
  initialRecommendations = [],
  sessionId,
  consultationData
}: DeckGenerationEngineProps) {
  console.log('DeckGenerationEngine rendered with:', { mode, commander, sessionId })
  
  const [messages, setMessages] = useState<any[]>(initialRecommendations)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false)
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
    console.log('DeckGenerationEngine useEffect triggered:', { 
      mode, 
      commander, 
      sessionId, 
      hasTriggered: hasTriggeredGeneration.current, 
      isGeneratingDeck, 
      isGenerationInProgress: isGenerationInProgress.current 
    })
    
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