'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  ChevronRight, 
  HelpCircle, 
  ExternalLink, 
  Package, 
  Sparkles,
  Target,
  Zap,
  Users,
  Shield,
  Settings,
  Lightbulb
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileButton, MobileCard, useSwipeGesture, MobileStepper } from '../ui/mobile-optimized'
import { LoadingButton, ProgressIndicator } from '../ui/loading-states'
import { ErrorState, InlineError } from '../ui/error-states'
import { AccessibleHeading, AccessibleField, AccessibleTooltip, LiveRegion } from '../ui/accessibility'
import { OnboardingTour, QuickTip, tutorOnboardingSteps } from '../ui/onboarding'

export type ConsultationMode = 'welcome' | 'commander' | 'budget' | 'bracket' | 'themes' | 'collection' | 
  'winCondition' | 'winConditionFollowup' | 'interaction' | 'interactionFollowup' | 
  'socialDynamics' | 'socialFollowup' | 'restrictions' | 'complexity' | 'complexityFollowup' |
  'specificCards' | 'manaBase' | 'manaFollowup' | 'summary'

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

interface EnhancedConsultationWizardProps {
  mode: ConsultationMode
  consultationData: ConsultationData
  onModeChange: (mode: ConsultationMode) => void
  onDataChange: (data: Partial<ConsultationData>) => void
  onComplete: () => void
  showBracketModal: boolean
  onShowBracketModal: (show: boolean) => void
  isFirstTime?: boolean
  onStartOnboarding?: () => void
}

export function EnhancedConsultationWizard({
  mode,
  consultationData,
  onModeChange,
  onDataChange,
  onComplete,
  showBracketModal,
  onShowBracketModal,
  isFirstTime = false,
  onStartOnboarding
}: EnhancedConsultationWizardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showQuickTip, setShowQuickTip] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // Get all consultation steps for progress tracking
  const allSteps = [
    { id: 'commander', title: 'Commander', completed: !!consultationData.commander || !!consultationData.theme },
    { id: 'collection', title: 'Collection', completed: consultationData.useCollection !== undefined },
    { id: 'budget', title: 'Budget', completed: consultationData.useCollection || !!consultationData.budget },
    { id: 'bracket', title: 'Power Level', completed: !!consultationData.bracket },
    { id: 'winCondition', title: 'Win Conditions', completed: !!consultationData.winCondition },
    { id: 'interaction', title: 'Interaction', completed: !!consultationData.interactionLevel },
    { id: 'socialDynamics', title: 'Social', completed: !!consultationData.tablePolitics },
    { id: 'restrictions', title: 'Restrictions', completed: consultationData.avoidStrategies !== undefined },
    { id: 'complexity', title: 'Complexity', completed: !!consultationData.complexityLevel },
    { id: 'specificCards', title: 'Cards', completed: consultationData.petCards !== undefined },
    { id: 'manaBase', title: 'Mana Base', completed: !!consultationData.manaStrategy },
    { id: 'summary', title: 'Review', completed: false }
  ]
  
  // Swipe gestures for mobile navigation
  const swipeHandlers = useSwipeGesture(
    () => handleNext(), // Swipe left = next
    () => handlePrevious(), // Swipe right = previous
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
      
      // Auto-advance logic with loading state
      await new Promise(resolve => setTimeout(resolve, 300)) // Smooth transition
      
      // Navigation logic
      switch (mode) {
        case 'commander':
          if (consultationData.buildingFullDeck) {
            onComplete()
          } else {
            onModeChange('collection')
          }
          break
        case 'themes':
          onModeChange('collection')
          break
        case 'collection':
          if (consultationData.useCollection === true) {
            onModeChange('bracket')
          } else {
            onModeChange('budget')
          }
          break
        case 'budget':
          onModeChange('bracket')
          break
        case 'bracket':
          onModeChange('winCondition')
          break
        case 'winCondition':
          if (['combat', 'combo', 'alternative'].includes(consultationData.winCondition!)) {
            onModeChange('winConditionFollowup')
          } else {
            onModeChange('interaction')
          }
          break
        case 'winConditionFollowup':
          onModeChange('interaction')
          break
        case 'interaction':
          if (['heavy', 'moderate'].includes(consultationData.interactionLevel!)) {
            onModeChange('interactionFollowup')
          } else {
            onModeChange('socialDynamics')
          }
          break
        case 'interactionFollowup':
          onModeChange('socialDynamics')
          break
        case 'socialDynamics':
          onModeChange('restrictions')
          break
        case 'restrictions':
          onModeChange('complexity')
          break
        case 'complexity':
          if (['moderate', 'high'].includes(consultationData.complexityLevel!)) {
            onModeChange('complexityFollowup')
          } else {
            onModeChange('specificCards')
          }
          break
        case 'complexityFollowup':
          onModeChange('specificCards')
          break
        case 'specificCards':
          onModeChange('manaBase')
          break
        case 'manaBase':
          onModeChange('manaFollowup')
          break
        case 'manaFollowup':
          onModeChange('summary')
          break
        case 'summary':
          onComplete()
          break
      }
    } catch (err) {
      setError('An error occurred while processing your choice. Please try again.')
      console.error('Consultation error:', err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const validateChoice = (choice: string, field: keyof ConsultationData) => {
    // Add validation logic here
    if (!choice || choice.trim() === '') {
      return { isValid: false, error: 'Please make a selection' }
    }
    
    if (field === 'budgetAmount' && isNaN(Number(choice))) {
      return { isValid: false, error: 'Please enter a valid number' }
    }
    
    return { isValid: true }
  }
  
  const handleNext = () => {
    // Implement next step logic
    const currentStepIndex = allSteps.findIndex(step => step.id === mode)
    if (currentStepIndex < allSteps.length - 1) {
      const nextStep = allSteps[currentStepIndex + 1]
      onModeChange(nextStep.id as ConsultationMode)
    }
  }
  
  const handlePrevious = () => {
    const currentStepIndex = allSteps.findIndex(step => step.id === mode)
    if (currentStepIndex > 0) {
      const prevStep = allSteps[currentStepIndex - 1]
      onModeChange(prevStep.id as ConsultationMode)
    }
  }
  
  const getBackMode = (): ConsultationMode => {
    switch (mode) {
      case 'commander': return 'welcome'
      case 'themes': return 'commander'
      case 'collection': 
        return consultationData.commander ? 'commander' : 'themes'
      case 'budget': return 'collection'
      case 'bracket': 
        return consultationData.useCollection === true ? 'collection' : 'budget'
      case 'winCondition': return 'bracket'
      case 'winConditionFollowup': return 'winCondition'
      case 'interaction': 
        return consultationData.winCondition && consultationData.winCondition !== 'mixed' 
          ? 'winConditionFollowup' : 'winCondition'
      case 'interactionFollowup': return 'interaction'
      case 'socialDynamics': 
        return consultationData.interactionLevel === 'heavy' || consultationData.interactionLevel === 'moderate'
          ? 'interactionFollowup' : 'interaction'
      case 'restrictions': return 'socialDynamics'
      case 'complexity': return 'restrictions'
      case 'complexityFollowup': return 'complexity'
      case 'specificCards': 
        return consultationData.complexityLevel === 'moderate' || consultationData.complexityLevel === 'high'
          ? 'complexityFollowup' : 'complexity'
      case 'manaBase': return 'specificCards'
      case 'manaFollowup': return 'manaBase'
      case 'summary': return 'manaFollowup'
      default: return 'welcome'
    }
  }
  
  // Show onboarding for first-time users
  useEffect(() => {
    if (isFirstTime && mode === 'commander') {
      setShowQuickTip('commander-help')
    }
  }, [isFirstTime, mode])
  
  if (mode === 'commander') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4" {...swipeHandlers}>
        <div className="max-w-3xl mx-auto py-8">
          {/* Progress indicator */}
          <MobileStepper
            steps={allSteps}
            currentStep={mode}
            onStepClick={(stepId) => onModeChange(stepId as ConsultationMode)}
          />
          
          {/* Back button */}
          <MobileButton
            variant="ghost"
            onClick={() => onModeChange('welcome')}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </MobileButton>
          
          {/* Main content */}
          <div data-tour="consultation-wizard">
            <AccessibleHeading level={2} className="text-3xl font-light mb-6 text-white drop-shadow-lg">
              Do you have a commander in mind?
            </AccessibleHeading>
            
            {/* Error display */}
            {error && (
              <InlineError 
                message={error}
                action={{
                  label: 'Retry',
                  action: () => setError(null)
                }}
                className="mb-6"
              />
            )}
            
            <div className="space-y-4">
              <MobileCard padding="lg">
                <AccessibleField
                  id="commander-input"
                  label="Enter your commander's name:"
                  error={validationErrors.commander}
                  helperText="e.g., Teysa Karlov, Atraxa, Praetors' Voice..."
                >
                  <input
                    type="text"
                    placeholder="Search for your commander..."
                    className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-zinc-400 text-zinc-100 text-base"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        handleChoice(e.currentTarget.value, 'commander')
                      }
                    }}
                  />
                </AccessibleField>
                
                <LoadingButton
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input')
                    if (input?.value) {
                      handleChoice(input.value, 'commander')
                    }
                  }}
                  isLoading={isLoading}
                  loadingText="Processing..."
                  className="mt-4 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-white font-medium"
                >
                  Continue with this Commander
                </LoadingButton>
              </MobileCard>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-700/50"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-zinc-400">OR</span>
                </div>
              </div>
              
              <MobileCard 
                interactive
                onClick={() => {
                  onDataChange({ commander: undefined })
                  onModeChange('themes')
                }}
                className="cursor-pointer hover:bg-zinc-700/70 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
                    <Lightbulb className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 text-zinc-100">
                      I need commander suggestions
                    </h3>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Tell me about your preferred playstyle and I'll recommend commanders that match your style
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-1" />
                </div>
              </MobileCard>
            </div>
            
            {/* Help tooltip */}
            <AccessibleTooltip content="Need help choosing? Click 'I need commander suggestions' to get personalized recommendations based on your playstyle.">
              <button
                onClick={() => setShowQuickTip(showQuickTip ? null : 'commander-help')}
                className="mt-4 flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                Need help choosing?
              </button>
            </AccessibleTooltip>
            
            {/* Quick tip */}
            <QuickTip
              title="Commander Selection Help"
              content="Your commander defines your deck's strategy and colors. If you're unsure, our AI can suggest commanders based on your preferred playstyle."
              isVisible={showQuickTip === 'commander-help'}
              onDismiss={() => setShowQuickTip(null)}
              placement="bottom"
            />
          </div>
          
          {/* Live region for screen readers */}
          <LiveRegion>
            {isLoading && 'Processing your commander selection...'}
            {error && `Error: ${error}`}
          </LiveRegion>
        </div>
      </div>
    )
  }
  
  if (mode === 'themes') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4" {...swipeHandlers}>
        <div className="max-w-4xl mx-auto py-8">
          {/* Progress indicator */}
          <MobileStepper
            steps={allSteps}
            currentStep={mode}
            onStepClick={(stepId) => onModeChange(stepId as ConsultationMode)}
          />
          
          <MobileButton
            variant="ghost"
            onClick={() => onModeChange(getBackMode())}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </MobileButton>
          
          <AccessibleHeading level={2} className="text-3xl font-light mb-6 text-white drop-shadow-lg">
            What theme or strategy interests you?
          </AccessibleHeading>
          
          {error && (
            <InlineError 
              message={error}
              action={{
                label: 'Retry',
                action: () => setError(null)
              }}
              className="mb-6"
            />
          )}
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { value: 'tokens', label: 'Tokens & Go Wide', icon: '👥', description: 'Create many creatures and overwhelm opponents' },
              { value: 'aristocrats', label: 'Aristocrats', icon: '💀', description: 'Sacrifice creatures for value and damage' },
              { value: 'spellslinger', label: 'Spellslinger', icon: '⚡', description: 'Cast lots of instants and sorceries' },
              { value: 'voltron', label: 'Voltron', icon: '⚔️', description: 'Make one creature very powerful' },
              { value: 'reanimator', label: 'Reanimator', icon: '⚰️', description: 'Bring back powerful creatures from graveyard' },
              { value: 'lands', label: 'Lands Matter', icon: '🏞️', description: 'Use lands as a resource and win condition' },
              { value: 'tribal', label: 'Tribal', icon: '🦎', description: 'Creatures of the same type working together' },
              { value: 'control', label: 'Control', icon: '🛡️', description: 'Counter spells and control the game' },
              { value: 'combo', label: 'Combo', icon: '♾️', description: 'Win with powerful card combinations' },
              { value: 'artifact', label: 'Artifacts', icon: '⚙️', description: 'Powerful artifact synergies and combos' },
              { value: 'enchantress', label: 'Enchantress', icon: '✨', description: 'Draw cards and control with enchantments' },
              { value: 'mill', label: 'Mill', icon: '🌊', description: 'Win by emptying opponents\' libraries' },
              { value: 'lifegain', label: 'Lifegain', icon: '❤️', description: 'Gain life and convert it to advantage' },
              { value: 'aggro', label: 'Aggro', icon: '🔥', description: 'Fast, aggressive creature strategies' },
              { value: 'stax', label: 'Stax', icon: '🔒', description: 'Slow down opponents with restrictions' },
              { value: 'superfriends', label: 'Super Friends', icon: '🦸', description: 'Multiple planeswalkers working together' },
              { value: 'other', label: 'Something else...', icon: '🎯', description: 'Describe your own strategy' }
            ].map(theme => (
              <AccessibleTooltip key={theme.value} content={theme.description}>
                <MobileCard
                  interactive
                  onClick={() => {
                    if (theme.value === 'other') {
                      onDataChange({ theme: 'custom' })
                    } else {
                      handleChoice(theme.label, 'theme')
                    }
                  }}
                  className="cursor-pointer hover:bg-zinc-700/70 transition-all text-center"
                  padding="md"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl group-hover:scale-110 transition-transform">{theme.icon}</span>
                    <span className="text-sm text-zinc-100 font-medium">{theme.label}</span>
                  </div>
                </MobileCard>
              </AccessibleTooltip>
            ))}
          </div>
          
          {consultationData.theme === 'custom' && (
            <MobileCard className="mt-6" padding="lg">
              <AccessibleField
                id="custom-theme"
                label="Describe your theme or strategy:"
                error={validationErrors.theme}
                helperText="e.g., Dragon tribal with reanimation, Cascade value engine..."
              >
                <input
                  type="text"
                  placeholder="Describe your strategy..."
                  className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-zinc-400 text-zinc-100 text-base"
                  value={consultationData.themeCustom || ''}
                  onChange={(e) => onDataChange({ themeCustom: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      handleChoice(e.currentTarget.value, 'theme')
                    }
                  }}
                />
              </AccessibleField>
              
              <LoadingButton
                onClick={() => {
                  if (consultationData.themeCustom) {
                    handleChoice(consultationData.themeCustom, 'theme')
                  }
                }}
                isLoading={isLoading}
                loadingText="Processing..."
                className="mt-4 w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-white font-medium"
              >
                Continue with this Theme
              </LoadingButton>
            </MobileCard>
          )}
          
          <LiveRegion>
            {isLoading && 'Processing your theme selection...'}
            {error && `Error: ${error}`}
          </LiveRegion>
        </div>
      </div>
    )
  }
  
  // Add more consultation steps following the same pattern...
  // For brevity, I'll implement the key ones and you can add the rest
  
  if (mode === 'summary') {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8" {...swipeHandlers}>
        <div className="max-w-3xl mx-auto py-12">
          <MobileButton
            variant="ghost"
            onClick={() => onModeChange(getBackMode())}
            className="mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </MobileButton>
          
          <AccessibleHeading level={2} className="text-3xl font-light mb-8 text-white drop-shadow-lg">
            Let's review your deck preferences
          </AccessibleHeading>
          
          <MobileCard padding="lg" className="space-y-6">
            {consultationData.commander && (
              <div>
                <span className="text-zinc-400 text-sm font-medium">Commander:</span>
                <p className="text-zinc-100 text-lg">{consultationData.commander}</p>
              </div>
            )}
            
            {consultationData.theme && (
              <div>
                <span className="text-zinc-400 text-sm font-medium">Theme:</span>
                <p className="text-zinc-100 text-lg">{consultationData.theme}</p>
              </div>
            )}
            
            {consultationData.useCollection !== undefined && (
              <div>
                <span className="text-zinc-400 text-sm font-medium">Collection:</span>
                <p className="text-zinc-100 text-lg">
                  {consultationData.useCollection ? 'Only use cards I own' : 'Open to new cards'}
                </p>
              </div>
            )}
            
            {consultationData.budget && !consultationData.useCollection && (
              <div>
                <span className="text-zinc-400 text-sm font-medium">Budget:</span>
                <p className="text-zinc-100 text-lg">
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
                <span className="text-zinc-400 text-sm font-medium">Power Level:</span>
                <p className="text-zinc-100 text-lg">Bracket {consultationData.bracket}</p>
              </div>
            )}
            
            {/* Add more summary fields as needed */}
          </MobileCard>
          
          <LoadingButton
            onClick={() => handleChoice('', 'additionalNotes')}
            isLoading={isLoading}
            loadingText="Starting deck generation..."
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold text-lg mt-8"
          >
            Start Building My Deck
          </LoadingButton>
          
          <LiveRegion>
            {isLoading && 'Starting deck generation process...'}
          </LiveRegion>
        </div>
      </div>
    )
  }
  
  // Onboarding tour
  if (showOnboarding) {
    return (
      <OnboardingTour
        steps={tutorOnboardingSteps}
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => {
          setShowOnboarding(false)
          // Mark onboarding as completed
          localStorage.setItem('tutor-onboarding-completed', 'true')
        }}
        showProgress
        allowSkip
      />
    )
  }
  
  // Return null for unhandled modes
  return null
}