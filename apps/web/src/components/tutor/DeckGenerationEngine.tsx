'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { trpc } from '@/lib/trpc/client'
import { GeneratedDeck, ConsultationData, GeneratedDeckCard } from '@moxmuse/shared'
import { GenerationProgress } from './GenerationProgress'

import { ErrorBoundary } from '@/components/ui/error-boundary'
import { RetryHandler } from '@/components/ui/retry-handler'
import { useErrorToast } from '@/components/ui/toaster'

interface DeckGenerationEngineProps {
  consultationData: ConsultationData
  commander: string
  onDeckGenerated: (deck: GeneratedDeck) => void
  onError?: (error: string) => void
  sessionId: string
}

interface GenerationPhase {
  name: string
  description: string
  progress: number
}

const GENERATION_PHASES: GenerationPhase[] = [
  {
    name: 'Analyzing Strategy',
    description: 'Analyzing commander abilities and strategy preferences...',
    progress: 10
  },
  {
    name: 'Generating Cards',
    description: 'Generating 99-card recommendations optimized for Commander...',
    progress: 30
  },
  {
    name: 'Assembling Deck',
    description: 'Assembling 100-card Commander deck structure...',
    progress: 60
  },
  {
    name: 'Calculating Statistics',
    description: 'Calculating mana curve, synergies, and multiplayer balance...',
    progress: 80
  },
  {
    name: 'Finalizing',
    description: 'Finalizing Commander deck analysis and recommendations...',
    progress: 100
  }
]

export const DeckGenerationEngine: React.FC<DeckGenerationEngineProps> = ({
  consultationData,
  commander,
  onDeckGenerated,
  onError,
  sessionId
}) => {
  const [currentPhase, setCurrentPhase] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [hasGenerated, setHasGenerated] = useState(false)

  const errorToast = useErrorToast()

  const generateDeckMutation = trpc.tutor.generateFullDeck.useMutation({
    onSuccess: async (data: { deckId: string; cardCount: number }) => {
      if (hasGenerated) {
        console.log('⚠️ Deck already generated, ignoring duplicate success callback')
        return
      }
      
      console.log('✅ Deck generation successful!', {
        deckId: data.deckId,
        cardCount: data.cardCount
      })
      setHasGenerated(true)
      
      try {
        setCurrentPhase(2) // Assembling deck
        
        // Create a simple generated deck structure matching the expected type
        const generatedDeck: GeneratedDeck = {
          id: data.deckId,
          name: `${commander} - ${consultationData.strategy || 'Value'} Deck`,
          commander: commander,
          powerLevel: consultationData.powerLevel || 2,
          winConditions: [
            {
              type: 'combat' as const,
              description: 'Win through combat damage with your creatures',
              keyCards: [],
              probability: 0.6
            },
            {
              type: 'alternative' as const,
              description: 'Win through value accumulation and attrition',
              keyCards: [],
              probability: 0.3
            }
          ],
          format: 'commander' as const,
          weaknesses: ['Vulnerable to board wipes', 'Mana intensive', 'Slow early game'],
          estimatedBudget: consultationData.budget || 100,
          synergies: [],
          strategy: {
            name: consultationData.strategy || 'value',
            description: 'AI-generated deck strategy',
            archetype: 'value' as const,
            themes: consultationData.themes || [],
            gameplan: 'Execute your commander\'s strategy to victory',
            strengths: ['Synergy', 'Consistency'],
            weaknesses: ['Speed']
          },
          cards: [],
          categories: [
            {
              name: 'Lands',
              description: 'Mana base for the deck',
              cards: [],
              targetCount: 35,
              actualCount: 35
            },
            {
              name: 'Creatures',
              description: 'Creature spells',
              cards: [],
              targetCount: 30,
              actualCount: 30
            },
            {
              name: 'Removal',
              description: 'Removal and interaction',
              cards: [],
              targetCount: 10,
              actualCount: 10
            },
            {
              name: 'Draw',
              description: 'Card draw and advantage',
              cards: [],
              targetCount: 10,
              actualCount: 10
            },
            {
              name: 'Ramp',
              description: 'Mana acceleration',
              cards: [],
              targetCount: 10,
              actualCount: 10
            },
            {
              name: 'Other',
              description: 'Other spells',
              cards: [],
              targetCount: 5,
              actualCount: 5
            }
          ],
          statistics: {
            averageCMC: 3.0,
            manaCurve: {
              distribution: [0, 8, 12, 15, 10, 8, 5, 2],
              peakCMC: 3,
              averageCMC: 3.0,
              landRatio: 0.35
            },
            colorDistribution: {
              white: 0,
              blue: 0,
              black: 0,
              red: 0,
              green: 0,
              colorless: 0,
              multicolor: 0,
              devotion: {}
            },
            typeDistribution: {
              creature: 30,
              artifact: 10,
              enchantment: 8,
              instant: 10,
              sorcery: 7,
              planeswalker: 0,
              land: 35,
              other: 0
            },
            rarityDistribution: {
              common: 40,
              uncommon: 30,
              rare: 25,
              mythic: 5
            },
            totalValue: 100,
            landCount: 35,
            nonlandCount: 65
          },
          consultationData: consultationData,
          generatedAt: new Date()
        }
        
        setCurrentPhase(4) // Finalizing
        
        // Small delay for UX
        setTimeout(() => {
          console.log('✅ Deck generation complete, calling onDeckGenerated')
          setIsGenerating(false)
          setError(null)
          onDeckGenerated(generatedDeck)
        }, 500)
        
      } catch (error) {
        console.error('❌ Error in deck assembly:', error)
        const assemblyError = error instanceof Error ? error : new Error('Failed to assemble deck')
        setError(assemblyError)
        setIsGenerating(false)
        setHasGenerated(false) // Reset so retry can work
        onError?.(assemblyError.message)
        
        errorToast(
          'Deck Assembly Failed',
          'There was an error assembling your deck. Please try again.',
          {
            label: 'Retry',
            onClick: () => handleRetry()
          }
        )
      }
    },
    onError: (error) => {
      console.error('❌ Deck generation error:', error)
      const generationError = new Error(error.message || 'Failed to generate deck')
      setError(generationError)
      setIsGenerating(false)
      setHasGenerated(false) // Reset so retry can work
      onError?.(generationError.message)
      
      // Don't show toast here as RetryHandler will handle it
    }
  })

  const generateDeck = useCallback(async () => {
    if (isGenerating) return
    
    setIsGenerating(true)
    setError(null)
    setCurrentPhase(0)
    
    try {
      // Phase 1: Analyzing strategy
      setCurrentPhase(0)
      await new Promise(resolve => setTimeout(resolve, 800)) // Small delay for UX
      
      // Phase 2: Generate cards with AI
      setCurrentPhase(1)
      
      generateDeckMutation.mutate({
        sessionId,
        consultationData,
        commander,
        constraints: {
          budget: consultationData.budget,
          powerLevel: consultationData.powerLevel,
          useCollection: consultationData.useCollection
        }
      })
      
    } catch (error) {
      console.error('Generation initiation error:', error)
      const initError = error instanceof Error ? error : new Error('Failed to start generation')
      setError(initError)
      setIsGenerating(false)
      onError?.(initError.message)
    }
  }, [consultationData, commander, sessionId, isGenerating, onError]) // Removed generateDeckMutation from dependencies

  const handleRetry = useCallback(async () => {
    console.log('🔄 Retrying deck generation...')
    setRetryCount(prev => prev + 1)
    
    if (isGenerating || hasGenerated) return
    
    setIsGenerating(true)
    setError(null)
    setCurrentPhase(0)
    setHasGenerated(false) // Reset generation flag
    
    try {
      // Phase 1: Analyzing strategy
      setCurrentPhase(0)
      await new Promise(resolve => setTimeout(resolve, 800)) // Small delay for UX
      
      // Phase 2: Generate cards with AI
      setCurrentPhase(1)
      
      generateDeckMutation.mutate({
        sessionId,
        consultationData,
        commander,
        constraints: {
          budget: consultationData.budget,
          powerLevel: consultationData.powerLevel,
          useCollection: consultationData.useCollection
        }
      })
      
    } catch (error) {
      console.error('❌ Generation retry error:', error)
      const retryError = error instanceof Error ? error : new Error('Failed to retry generation')
      setError(retryError)
      setIsGenerating(false)
      onError?.(retryError.message)
    }
  }, [consultationData, commander, sessionId, isGenerating, hasGenerated, onError])

  // Auto-start generation when component mounts
  useEffect(() => {
    let mounted = true
    let hasStarted = false
    
    const startGeneration = async () => {
      if (!mounted || isGenerating || hasStarted || hasGenerated) return
      
      hasStarted = true
      console.log('🚀 Starting deck generation...')
      
      setIsGenerating(true)
      setError(null)
      setCurrentPhase(0)
      
      try {
        // Phase 1: Analyzing strategy
        setCurrentPhase(0)
        await new Promise(resolve => setTimeout(resolve, 800)) // Small delay for UX
        
        if (!mounted) return
        
        // Phase 2: Generate cards with AI
        setCurrentPhase(1)
        console.log('🤖 Calling generateDeckMutation...')
        
        generateDeckMutation.mutate({
          sessionId,
          consultationData,
          commander,
          constraints: {
            budget: consultationData.budget,
            powerLevel: consultationData.powerLevel,
            useCollection: consultationData.useCollection
          }
        })
        
      } catch (error) {
        if (!mounted) return
        console.error('❌ Generation initiation error:', error)
        const initError = error instanceof Error ? error : new Error('Failed to start generation')
        setError(initError)
        setIsGenerating(false)
        onError?.(initError.message)
      }
    }
    
    startGeneration()
    
    return () => {
      mounted = false
    }
  }, [sessionId, commander]) // Only depend on essential props that shouldn't change

  const currentPhaseData = GENERATION_PHASES[currentPhase] || GENERATION_PHASES[0]

  if (error) {
    return (
      <ErrorBoundary
        context="Deck Generation"
        fallback={(error, retry) => (
          <RetryHandler
            error={error}
            onRetry={handleRetry}
            config={{
              maxAttempts: 3,
              baseDelay: 2000,
              retryCondition: (err) => {
                // Retry on network errors, timeouts, and AI service errors
                return (
                  err.message.includes('Network Error') ||
                  err.message.includes('timeout') ||
                  err.message.includes('fetch') ||
                  err.message.includes('AI service') ||
                  err.message.includes('generation failed')
                )
              }
            }}
            autoRetry={retryCount < 2} // Auto-retry first 2 attempts
          >
            <div className="text-center mt-4">
              <p className="text-sm text-zinc-400">
                Having trouble? Try adjusting your preferences or check your connection.
              </p>
            </div>
          </RetryHandler>
        )}
      >
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <RetryHandler
            error={error}
            onRetry={handleRetry}
            config={{
              maxAttempts: 3,
              baseDelay: 2000,
              retryCondition: (err) => {
                // Retry on network errors, timeouts, and AI service errors
                return (
                  err.message.includes('Network Error') ||
                  err.message.includes('timeout') ||
                  err.message.includes('fetch') ||
                  err.message.includes('AI service') ||
                  err.message.includes('generation failed')
                )
              }
            }}
            autoRetry={retryCount < 2} // Auto-retry first 2 attempts
          >
            <div className="text-center mt-4">
              <p className="text-sm text-zinc-400">
                Having trouble? Try adjusting your preferences or check your connection.
              </p>
            </div>
          </RetryHandler>
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary context="Deck Generation">
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <GenerationProgress
          phase={currentPhaseData.name}
          description={currentPhaseData.description}
          progress={currentPhaseData.progress}
          isGenerating={isGenerating}
          commander={commander}
          consultationData={consultationData}
        />
      </div>
    </ErrorBoundary>
  )
}
