'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  ArrowLeft, 
  ChevronRight, 
  HelpCircle, 
  Sparkles,
  Target,
  Zap,
  Users,
  Shield,
  Settings,
  Lightbulb,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  MobileButton, 
  MobileCard, 
  useSwipeGesture, 
  MobileStepper,
  MobileInput,
  MobileSelect,
  MobileSheet
} from '../ui/mobile-optimized'
import { LoadingButton, ProgressIndicator } from '../ui/loading-states'
import { InlineError } from '../ui/error-states'
import { AccessibleHeading, AccessibleField, LiveRegion } from '../ui/accessibility'

export type ConsultationMode = 'welcome' | 'commander' | 'budget' | 'bracket' | 'themes' | 'collection' | 
  'winCondition' | 'interaction' | 'socialDynamics' | 'restrictions' | 'complexity' | 
  'specificCards' | 'manaBase' | 'summary'

export interface ConsultationData {
  commander?: string
  commanderColors?: string[]
  theme?: string
  themeCustom?: string
  budget?: string
  budgetAmount?: number
  bracket?: number
  useCollection?: boolean
  colorPreferences?: string[]
  specificColors?: string[]
  buildingFullDeck?: boolean
  needsCommanderSuggestions?: boolean
  winCondition?: string
  interactionLevel?: string
  tablePolitics?: string
  avoidStrategies?: string[]
  avoidCards?: string
  complexityLevel?: string
  petCards?: string
  manaStrategy?: string
  additionalNotes?: string
}

interface MobileConsultationWizardProps {
  mode: ConsultationMode
  consultationData: ConsultationData
  onModeChange: (mode: ConsultationMode) => void
  onDataChange: (data: Partial<ConsultationData>) => void
  onComplete: () => void
  isFirstTime?: boolean
}

export function MobileConsultationWizard({
  mode,
  consultationData,
  onModeChange,
  onDataChange,
  onComplete,
  isFirstTime = false
}: MobileConsultationWizardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showHelp, setShowHelp] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  
  // Define consultation steps for mobile flow
  const consultationSteps = [
    { id: 'commander', title: 'Commander', icon: '👑', completed: !!consultationData.commander || !!consultationData.theme },
    { id: 'collection', title: 'Collection', icon: '📚', completed: consultationData.useCollection !== undefined },
    { id: 'budget', title: 'Budget', icon: '💰', completed: consultationData.useCollection || !!consultationData.budget },
    { id: 'bracket', title: 'Power', icon: '⚡', completed: !!consultationData.bracket },
    { id: 'winCondition', title: 'Win Con', icon: '🎯', completed: !!consultationData.winCondition },
    { id: 'interaction', title: 'Control', icon: '🛡️', completed: !!consultationData.interactionLevel },
    { id: 'socialDynamics', title: 'Social', icon: '👥', completed: !!consultationData.tablePolitics },
    { id: 'restrictions', title: 'Limits', icon: '🚫', completed: consultationData.avoidStrategies !== undefined },
    { id: 'complexity', title: 'Complex', icon: '🧩', completed: !!consultationData.complexityLevel },
    { id: 'specificCards', title: 'Cards', icon: '🃏', completed: consultationData.petCards !== undefined },
    { id: 'manaBase', title: 'Mana', icon: '💎', completed: !!consultationData.manaStrategy },
    { id: 'summary', title: 'Review', icon: '✅', completed: false }
  ]
  
  // Update current step index when mode changes
  useEffect(() => {
    const stepIndex = consultationSteps.findIndex(step => step.id === mode)
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex)
    }
  }, [mode])
  
  // Touch gesture handlers for navigation
  const swipeHandlers = useSwipeGesture(
    () => handleNext(), // Swipe left = next
    () => handlePrevious(), // Swipe right = previous
    undefined,
    undefined,
    75 // Increased threshold for better mobile experience
  )
  
  const handleChoice = async (choice: string, field: keyof ConsultationData) => {
    setIsLoading(true)
    setError(null)
    setValidationErrors({})
    
    try {
      // Validate the choice
      const validation = validateChoice(choice, field)
      if (!validation.isValid) {
        setValidationErrors({ [field]: validation.error! })
        return
      }
      
      onDataChange({ [field]: choice })
      
      // Haptic feedback for mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
      
      // Auto-advance with smooth transition
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Navigate to next step
      const nextMode = getNextMode(mode, consultationData)
      if (nextMode) {
        onModeChange(nextMode)
      } else {
        onComplete()
      }
    } catch (err) {
      setError('An error occurred while processing your choice. Please try again.')
      console.error('Consultation error:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const validateChoice = (choice: string, field: keyof ConsultationData) => {
    if (!choice || choice.trim() === '') {
      return { isValid: false, error: 'Please make a selection' }
    }
    
    if (field === 'budgetAmount' && isNaN(Number(choice))) {
      return { isValid: false, error: 'Please enter a valid number' }
    }
    
    return { isValid: true }
  }
  
  const getNextMode = (currentMode: ConsultationMode, data: ConsultationData): ConsultationMode | null => {
    switch (currentMode) {
      case 'commander':
        return data.buildingFullDeck ? null : 'collection'
      case 'themes':
        return 'collection'
      case 'collection':
        return data.useCollection === true ? 'bracket' : 'budget'
      case 'budget':
        return 'bracket'
      case 'bracket':
        return 'winCondition'
      case 'winCondition':
        return 'interaction'
      case 'interaction':
        return 'socialDynamics'
      case 'socialDynamics':
        return 'restrictions'
      case 'restrictions':
        return 'complexity'
      case 'complexity':
        return 'specificCards'
      case 'specificCards':
        return 'manaBase'
      case 'manaBase':
        return 'summary'
      case 'summary':
        return null
      default:
        return null
    }
  }
  
  const handleNext = () => {
    if (currentStepIndex < consultationSteps.length - 1) {
      const nextStep = consultationSteps[currentStepIndex + 1]
      onModeChange(nextStep.id as ConsultationMode)
    }
  }
  
  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const prevStep = consultationSteps[currentStepIndex - 1]
      onModeChange(prevStep.id as ConsultationMode)
    }
  }
  
  const getHelpContent = (mode: ConsultationMode) => {
    const helpContent = {
      commander: {
        title: 'Commander Selection',
        content: 'Your commander defines your deck\'s strategy and colors. If you\'re unsure, our AI can suggest commanders based on your preferred playstyle.'
      },
      themes: {
        title: 'Deck Themes',
        content: 'Choose a strategy that matches your playstyle. Each theme has different strengths and approaches to winning games.'
      },
      collection: {
        title: 'Card Collection',
        content: 'Tell us if you want to use only cards you already own, or if you\'re open to purchasing new cards for your deck.'
      },
      budget: {
        title: 'Budget Planning',
        content: 'Set a budget range to help us recommend cards that fit your spending preferences. This helps balance power level with cost.'
      },
      bracket: {
        title: 'Power Level',
        content: 'Power brackets help match your deck against similar strength opponents. Higher brackets include more powerful and expensive cards.'
      },
      winCondition: {
        title: 'Win Conditions',
        content: 'How do you prefer to win games? Combat damage, infinite combos, or alternative win conditions each create different deck styles.'
      },
      interaction: {
        title: 'Interaction Level',
        content: 'How much do you want to interact with opponents? More interaction means more counterspells, removal, and control elements.'
      },
      socialDynamics: {
        title: 'Table Politics',
        content: 'Commander is a social format. Choose how you prefer to navigate multiplayer politics and threat assessment.'
      },
      restrictions: {
        title: 'Deck Restrictions',
        content: 'Tell us about any strategies or cards you want to avoid. This helps us tailor recommendations to your preferences.'
      },
      complexity: {
        title: 'Complexity Level',
        content: 'How complex do you want your deck to be? Simple decks are easier to pilot, while complex decks offer more decision points.'
      },
      specificCards: {
        title: 'Specific Cards',
        content: 'Include any pet cards or favorites you want in the deck, or mention cards you specifically want to avoid.'
      },
      manaBase: {
        title: 'Mana Base',
        content: 'Your mana base determines how consistently you can cast your spells. We can optimize for speed, budget, or reliability.'
      },
      summary: {
        title: 'Final Review',
        content: 'Review all your preferences before we generate your deck. You can go back to change any selections if needed.'
      }
    }
    
    return helpContent[mode] || { title: 'Help', content: 'No help available for this step.' }
  }
  
  // Commander selection step
  if (mode === 'commander') {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" {...swipeHandlers}>
        {/* Mobile header with progress */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <MobileButton
              variant="ghost"
              onClick={() => onModeChange('welcome')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </MobileButton>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Step {currentStepIndex + 1} of {consultationSteps.length}</span>
              <MobileButton
                variant="ghost"
                onClick={() => setShowHelp(true)}
                className="p-2"
              >
                <HelpCircle className="w-5 h-5" />
              </MobileButton>
            </div>
          </div>
          
          {/* Progress bar */}
          <ProgressIndicator 
            progress={(currentStepIndex / (consultationSteps.length - 1)) * 100}
            className="h-2"
          />
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">👑</div>
              <AccessibleHeading level={2} className="text-2xl font-bold mb-2 text-white">
                Do you have a commander in mind?
              </AccessibleHeading>
              <p className="text-zinc-400 text-sm">
                Your commander defines your deck's colors and strategy
              </p>
            </div>
            
            {error && (
              <InlineError 
                message={error}
                action={{
                  label: 'Retry',
                  action: () => setError(null)
                }}
              />
            )}
            
            <MobileCard padding="lg">
              <MobileInput
                label="Commander name"
                placeholder="e.g., Teysa Karlov, Atraxa..."
                error={validationErrors.commander}
                helperText="Start typing to search for your commander"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleChoice(e.currentTarget.value, 'commander')
                  }
                }}
              />
              
              <LoadingButton
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.querySelector('input')
                  if (input?.value) {
                    handleChoice(input.value, 'commander')
                  }
                }}
                isLoading={isLoading}
                loadingText="Processing..."
                className="mt-4 w-full"
                size="lg"
              >
                Continue with this Commander
              </LoadingButton>
            </MobileCard>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-zinc-900 text-zinc-400">OR</span>
              </div>
            </div>
            
            <MobileCard 
              interactive
              onClick={() => {
                onDataChange({ commander: undefined, needsCommanderSuggestions: true })
                onModeChange('themes')
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
                  <Lightbulb className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1 text-zinc-100">
                    I need suggestions
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Get personalized commander recommendations
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </div>
            </MobileCard>
          </div>
        </div>
        
        {/* Help sheet */}
        <MobileSheet
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title={getHelpContent(mode).title}
          position="bottom"
          size="md"
        >
          <div className="p-4">
            <p className="text-zinc-300 leading-relaxed">
              {getHelpContent(mode).content}
            </p>
          </div>
        </MobileSheet>
        
        <LiveRegion>
          {isLoading && 'Processing your commander selection...'}
          {error && `Error: ${error}`}
        </LiveRegion>
      </div>
    )
  }
  
  // Theme selection step
  if (mode === 'themes') {
    const themes = [
      { value: 'tokens', label: 'Tokens', icon: '👥', description: 'Create many creatures' },
      { value: 'aristocrats', label: 'Aristocrats', icon: '💀', description: 'Sacrifice for value' },
      { value: 'spellslinger', label: 'Spells', icon: '⚡', description: 'Cast many spells' },
      { value: 'voltron', label: 'Voltron', icon: '⚔️', description: 'One big creature' },
      { value: 'reanimator', label: 'Reanimate', icon: '⚰️', description: 'Graveyard value' },
      { value: 'lands', label: 'Lands', icon: '🏞️', description: 'Land synergies' },
      { value: 'tribal', label: 'Tribal', icon: '🦎', description: 'Creature types' },
      { value: 'control', label: 'Control', icon: '🛡️', description: 'Counter & control' },
      { value: 'combo', label: 'Combo', icon: '♾️', description: 'Powerful combos' },
      { value: 'artifact', label: 'Artifacts', icon: '⚙️', description: 'Artifact synergies' },
      { value: 'enchantress', label: 'Enchants', icon: '✨', description: 'Enchantment value' },
      { value: 'mill', label: 'Mill', icon: '🌊', description: 'Library destruction' },
      { value: 'lifegain', label: 'Lifegain', icon: '❤️', description: 'Life matters' },
      { value: 'aggro', label: 'Aggro', icon: '🔥', description: 'Fast & aggressive' },
      { value: 'stax', label: 'Stax', icon: '🔒', description: 'Resource denial' },
      { value: 'superfriends', label: 'Walkers', icon: '🦸', description: 'Planeswalkers' }
    ]
    
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" {...swipeHandlers}>
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <MobileButton
              variant="ghost"
              onClick={handlePrevious}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </MobileButton>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Step {currentStepIndex + 1} of {consultationSteps.length}</span>
              <MobileButton
                variant="ghost"
                onClick={() => setShowHelp(true)}
                className="p-2"
              >
                <HelpCircle className="w-5 h-5" />
              </MobileButton>
            </div>
          </div>
          
          <ProgressIndicator 
            progress={(currentStepIndex / (consultationSteps.length - 1)) * 100}
            className="h-2"
          />
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🎯</div>
              <AccessibleHeading level={2} className="text-2xl font-bold mb-2 text-white">
                What strategy interests you?
              </AccessibleHeading>
              <p className="text-zinc-400 text-sm">
                Choose a theme that matches your playstyle
              </p>
            </div>
            
            {error && (
              <InlineError 
                message={error}
                action={{
                  label: 'Retry',
                  action: () => setError(null)
                }}
              />
            )}
            
            <div className="grid grid-cols-2 gap-3">
              {themes.map(theme => (
                <MobileCard
                  key={theme.value}
                  interactive
                  onClick={() => handleChoice(theme.label, 'theme')}
                  className="cursor-pointer text-center"
                  padding="md"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{theme.icon}</span>
                    <span className="text-sm text-zinc-100 font-medium">{theme.label}</span>
                    <span className="text-xs text-zinc-400">{theme.description}</span>
                  </div>
                </MobileCard>
              ))}
            </div>
            
            <MobileCard padding="lg">
              <MobileInput
                label="Custom strategy"
                placeholder="Describe your own strategy..."
                helperText="e.g., Dragon tribal with reanimation"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleChoice(e.currentTarget.value, 'theme')
                  }
                }}
              />
              
              <LoadingButton
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.querySelector('input')
                  if (input?.value) {
                    handleChoice(input.value, 'theme')
                  }
                }}
                isLoading={isLoading}
                loadingText="Processing..."
                className="mt-4 w-full"
                size="lg"
              >
                Continue with Custom Theme
              </LoadingButton>
            </MobileCard>
          </div>
        </div>
        
        {/* Help sheet */}
        <MobileSheet
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          title={getHelpContent(mode).title}
          position="bottom"
          size="md"
        >
          <div className="p-4">
            <p className="text-zinc-300 leading-relaxed">
              {getHelpContent(mode).content}
            </p>
          </div>
        </MobileSheet>
        
        <LiveRegion>
          {isLoading && 'Processing your theme selection...'}
          {error && `Error: ${error}`}
        </LiveRegion>
      </div>
    )
  }
  
  // Summary step
  if (mode === 'summary') {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" {...swipeHandlers}>
        {/* Mobile header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/50 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <MobileButton
              variant="ghost"
              onClick={handlePrevious}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </MobileButton>
            
            <span className="text-sm text-zinc-400">Final Review</span>
          </div>
          
          <ProgressIndicator 
            progress={100}
            className="h-2"
          />
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <AccessibleHeading level={2} className="text-2xl font-bold mb-2 text-white">
                Ready to build your deck!
              </AccessibleHeading>
              <p className="text-zinc-400 text-sm">
                Review your preferences before we start
              </p>
            </div>
            
            <MobileCard padding="lg" className="space-y-4">
              {consultationData.commander && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Commander:</span>
                  <span className="text-zinc-100 font-medium">{consultationData.commander}</span>
                </div>
              )}
              
              {consultationData.theme && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Theme:</span>
                  <span className="text-zinc-100 font-medium">{consultationData.theme}</span>
                </div>
              )}
              
              {consultationData.useCollection !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Collection:</span>
                  <span className="text-zinc-100 font-medium">
                    {consultationData.useCollection ? 'Use owned cards' : 'Open to new cards'}
                  </span>
                </div>
              )}
              
              {consultationData.budget && !consultationData.useCollection && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Budget:</span>
                  <span className="text-zinc-100 font-medium">{consultationData.budget}</span>
                </div>
              )}
              
              {consultationData.bracket && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Power Level:</span>
                  <span className="text-zinc-100 font-medium">Bracket {consultationData.bracket}</span>
                </div>
              )}
            </MobileCard>
            
            <LoadingButton
              onClick={() => handleChoice('complete', 'additionalNotes')}
              isLoading={isLoading}
              loadingText="Starting deck generation..."
              className="w-full"
              size="xl"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Building My Deck
            </LoadingButton>
          </div>
        </div>
        
        <LiveRegion>
          {isLoading && 'Starting deck generation process...'}
        </LiveRegion>
      </div>
    )
  }
  
  // Default fallback
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-4xl mb-4">🚧</div>
        <p className="text-zinc-400">This step is not yet implemented</p>
        <MobileButton
          onClick={handleNext}
          className="mt-4"
        >
          Continue
        </MobileButton>
      </div>
    </div>
  )
}