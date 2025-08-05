'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { trpc } from '@/lib/trpc/client'
import { generateSessionId, type CommanderRecommendation } from '@moxmuse/shared'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AuthPrompt } from '@/components/auth-prompt'
import { useDeck } from '@/contexts/DeckContext'
import { EntryPointSelector } from '@/components/tutor/EntryPointSelector'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { useErrorToast, useSuccessToast } from '@/components/ui/toaster'
import CommanderSelection from '../../components/tutor/CommanderSelection'
import { NaturalLanguageVision } from '@/components/tutor/NaturalLanguageVision'
import { ConsultationWizard, type ConsultationMode, type ConsultationData } from '@/components/tutor/ConsultationWizard'
import { DeckGenerationEngine } from '@/components/tutor/DeckGenerationEngine'
import { DeckEditor } from '@/components/tutor/DeckEditor'
import { AnalysisPanel } from '@/components/tutor/AnalysisPanel'
import { DeckSelector } from '@/components/tutor/DeckSelector'
import React from 'react'

function TutorPageContent() {
  const { data: session, status } = useSession()
  const { activeDeck, setActiveDeck, deckCards, deckStats, isLoading: deckLoading } = useDeck()
  const [sessionId] = useState(() => generateSessionId())
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [currentBackground, setCurrentBackground] = useState(0)
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>('welcome')
  const [consultationData, setConsultationData] = useState<ConsultationData>({})
  const [selectedCommander, setSelectedCommander] = useState<string>()
  const [showBracketModal, setShowBracketModal] = useState(false)
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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % backgrounds.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [backgrounds.length])

  const generateCommanderSuggestions = async () => {
    console.log('generateCommanderSuggestions called')
    
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
      const prefText = colorPreferences.map((pref: string) =>
        pref === 'mono' ? 'Mono-colored' :
        pref === 'multi' ? 'Multi-colored (2-3 colors)' :
        'Open to 5 Color'
      ).join(', ')
      prompt += `Color Preference: ${prefText}\n`
      if (specificColors && specificColors.length > 0) {
        prompt += `Preferred Colors: ${specificColors.join(', ')}\n`
      }
    }
    
    prompt += `\nPlease recommend 5 specific Magic: The Gathering commanders that match these preferences. For each commander, explain their strategy and why they fit my playstyle.`
    
    try {
      await createTempDeck()
      
      setRecommendations([{ 
        type: 'assistant', 
        content: "Perfect! Based on your preferences, let me suggest some commanders that would be perfect for your playstyle..." 
      }])
      
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

  const handleConsultationComplete = () => {
    console.log('Consultation complete - needsCommanderSuggestions:', consultationData.needsCommanderSuggestions)
    if (consultationData.needsCommanderSuggestions) {
      generateCommanderSuggestions()
      setConsultationMode('commanderSelection')
    } else {
      setConsultationMode('chat')
    }
  }

  const handleConsultationDataChange = (data: Partial<ConsultationData>) => {
    setConsultationData((prev: ConsultationData) => ({ ...prev, ...data }))
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
            <AnalysisPanel 
              deck={activeDeck} 
              deckCards={deckCards}
              deckStats={deckStats}
              onRemoveCard={() => {}} // Implement if needed
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
              
              {/* Deck Selector */}
              <div className="max-w-6xl mx-auto px-6 pb-12">
                <DeckSelector onDeckSelected={(deck: any) => {
                  setActiveDeck(deck)
                  setConsultationMode('chat')
                }} />
              </div>
            </div>
          )}

          {(consultationMode === 'commander' || 
            consultationMode === 'themes' || 
            consultationMode === 'collection' ||
            consultationMode === 'budget' ||
            consultationMode === 'bracket' ||
            consultationMode === 'summary') && (
            <ConsultationWizard
              mode={consultationMode}
              consultationData={consultationData}
              onModeChange={setConsultationMode}
              onDataChange={handleConsultationDataChange}
              onComplete={handleConsultationComplete}
              showBracketModal={showBracketModal}
              onShowBracketModal={setShowBracketModal}
            />
          )}

          {consultationMode === 'deckBuilder' && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="max-w-3xl mx-auto py-8">
                <button
                  onClick={() => setConsultationMode('welcome')}
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
                >
                  ← Back
                </button>
                
                <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
                  Let's Build Your Commander Deck
                </h2>
                
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setConsultationMode('commander')
                      setConsultationData((prev: ConsultationData) => ({ ...prev, buildingFullDeck: true }))
                    }}
                    className="w-full p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                  >
                    <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                      I know my commander
                    </h3>
                    <p className="text-zinc-300 text-sm">
                      I have a specific commander in mind and want a full deck built around them
                    </p>
                  </button>
                  
                  <button
                    onClick={() => {
                      setConsultationMode('themes')
                      setConsultationData((prev: ConsultationData) => ({ ...prev, buildingFullDeck: true, needsCommanderSuggestions: true }))
                    }}
                    className="w-full p-6 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
                  >
                    <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                      I need commander suggestions
                    </h3>
                    <p className="text-zinc-300 text-sm">
                      Help me find the perfect commander based on my preferred playstyle and strategy
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {consultationMode === 'commanderSelection' && (
            <div className="flex-1 overflow-y-auto">
              <CommanderSelection
                consultationData={consultationData}
                onCommanderSelect={(commanderId: string, commanderName: string) => {
                  console.log('Commander selected:', commanderName, commanderId)
                  
                  setConsultationData((prev: ConsultationData) => ({ ...prev, commander: commanderName }))
                  setSelectedCommander(commanderName)
                  
                  setRecommendations(prev => [...prev, {
                    type: 'user',
                    content: `I choose ${commanderName} as my commander. Please build me a complete deck!`
                  }, {
                    type: 'assistant',
                    content: `Excellent choice! ${commanderName} is a fantastic commander. Let me build you a complete 100-card deck optimized for ${commanderName}'s strategy.`
                  }])
                  
                  setConsultationMode('deckGeneration')
                }}
                onBack={() => setConsultationMode('deckBuilder')}
              />
            </div>
          )}

          {consultationMode === 'deckGeneration' && (
            <DeckGenerationEngine
              mode="deckGeneration"
              commander={selectedCommander || consultationData.commander}
              sessionId={sessionId}
              consultationData={consultationData}
              initialRecommendations={recommendations}
            />
          )}

          {consultationMode === 'naturalLanguageVision' && (
            <div className="flex-1 overflow-y-auto">
              <NaturalLanguageVision
                onVisionParsed={(data: any) => {
                  setConsultationData(data)
                }}
                onStartBuilding={(visionText: string, visionSessionId: string) => {
                  setConsultationMode('chat')
                  // Could add vision-based recommendations here
                }}
              />
            </div>
          )}

          {consultationMode === 'chat' && (
            <DeckEditor
              sessionId={sessionId}
              recommendations={recommendations}
              onRecommendationsChange={setRecommendations}
              activeDeck={activeDeck}
            />
          )}
        </div>
      </div>
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
      }}
    >
      <TutorPageContent />
    </ErrorBoundary>
  )
}
