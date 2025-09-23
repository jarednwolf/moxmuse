'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw,
  CheckCircle,
  Circle,
  Lightbulb,
  Target,
  Zap,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LoadingButton } from './loading-states'

// Onboarding step interface
export interface OnboardingStep {
  id: string
  title: string
  description: string
  content: React.ReactNode
  target?: string // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  skippable?: boolean
  required?: boolean
  action?: {
    label: string
    onClick: () => void | Promise<void>
  }
}

export interface OnboardingTourProps {
  steps: OnboardingStep[]
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  onStepChange?: (stepIndex: number) => void
  showProgress?: boolean
  allowSkip?: boolean
  autoAdvance?: boolean
  autoAdvanceDelay?: number
}

// Main onboarding tour component
export function OnboardingTour({
  steps,
  isOpen,
  onClose,
  onComplete,
  onStepChange,
  showProgress = true,
  allowSkip = true,
  autoAdvance = false,
  autoAdvanceDelay = 5000
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoAdvance)
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null)
  const autoAdvanceTimer = useRef<NodeJS.Timeout>()
  
  const step = steps[currentStep]
  
  // Handle auto-advance
  useEffect(() => {
    if (isPlaying && isOpen && currentStep < steps.length - 1) {
      autoAdvanceTimer.current = setTimeout(() => {
        handleNext()
      }, autoAdvanceDelay)
    }
    
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current)
      }
    }
  }, [currentStep, isPlaying, isOpen, autoAdvanceDelay])
  
  // Handle element highlighting
  useEffect(() => {
    if (step?.target) {
      const element = document.querySelector(step.target)
      if (element) {
        setHighlightedElement(element)
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setHighlightedElement(null)
    }
  }, [step])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current)
      }
    }
  }, [])
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)
      onStepChange?.(nextStep)
    } else {
      handleComplete()
    }
  }
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)
      onStepChange?.(prevStep)
    }
  }
  
  const handleComplete = () => {
    onComplete()
    onClose()
  }
  
  const handleSkip = () => {
    onClose()
  }
  
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }
  
  const restartTour = () => {
    setCurrentStep(0)
    setIsPlaying(autoAdvance)
    onStepChange?.(0)
  }
  
  if (!isOpen || !step) return null
  
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
      
      {/* Highlight overlay */}
      {highlightedElement && (
        <HighlightOverlay element={highlightedElement} />
      )}
      
      {/* Tour content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-xl max-w-lg w-full border border-zinc-700/50 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-zinc-100">
                {step.title}
              </h2>
              {autoAdvance && (
                <button
                  onClick={togglePlayPause}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors"
                  title={isPlaying ? 'Pause tour' : 'Play tour'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <Play className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {allowSkip && (
                <button
                  onClick={handleSkip}
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Skip tour
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>
          
          {/* Progress indicator */}
          {showProgress && (
            <div className="px-4 py-2 border-b border-zinc-700/50">
              <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                <span>Step {currentStep + 1} of {steps.length}</span>
                <button
                  onClick={restartTour}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
                  title="Restart tour"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restart
                </button>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-1">
                <div 
                  className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Content */}
          <div className="p-6">
            <p className="text-zinc-300 mb-4 leading-relaxed">
              {step.description}
            </p>
            
            {step.content && (
              <div className="mb-4">
                {step.content}
              </div>
            )}
            
            {step.action && (
              <div className="mb-4">
                <LoadingButton
                  onClick={step.action.onClick}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {step.action.label}
                </LoadingButton>
              </div>
            )}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-zinc-700/50">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentStep(index)
                    onStepChange?.(index)
                  }}
                  className="p-1"
                  title={`Go to step ${index + 1}`}
                >
                  {index === currentStep ? (
                    <CheckCircle className="w-3 h-3 text-blue-400" />
                  ) : index < currentStep ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <Circle className="w-3 h-3 text-zinc-600" />
                  )}
                </button>
              ))}
            </div>
            
            <button
              onClick={currentStep === steps.length - 1 ? handleComplete : handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Highlight overlay component
function HighlightOverlay({ element }: { element: Element }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  
  useEffect(() => {
    const updateRect = () => {
      setRect(element.getBoundingClientRect())
    }
    
    updateRect()
    
    const resizeObserver = new ResizeObserver(updateRect)
    resizeObserver.observe(element)
    
    window.addEventListener('scroll', updateRect)
    window.addEventListener('resize', updateRect)
    
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('scroll', updateRect)
      window.removeEventListener('resize', updateRect)
    }
  }, [element])
  
  if (!rect) return null
  
  return (
    <div
      className="fixed z-45 pointer-events-none"
      style={{
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        border: '2px solid #3b82f6',
        borderRadius: '8px',
        boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
        animation: 'pulse 2s infinite'
      }}
    />
  )
}

// Welcome screen component
export interface WelcomeScreenProps {
  title: string
  description: string
  features: Array<{
    icon: React.ReactNode
    title: string
    description: string
  }>
  onStart: () => void
  onSkip?: () => void
  showSkip?: boolean
}

export function WelcomeScreen({
  title,
  description,
  features,
  onStart,
  onSkip,
  showSkip = true
}: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl max-w-2xl w-full border border-zinc-700/50 shadow-2xl">
        <div className="p-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-100 mb-4">
            {title}
          </h1>
          <p className="text-zinc-300 mb-8 leading-relaxed">
            {description}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onStart}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Start Tour
            </button>
            {showSkip && onSkip && (
              <button
                onClick={onSkip}
                className="px-6 py-3 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Quick tips component for contextual help
export interface QuickTipProps {
  title: string
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  isVisible: boolean
  onDismiss: () => void
  target?: string
}

export function QuickTip({
  title,
  content,
  position = 'top',
  isVisible,
  onDismiss,
  target
}: QuickTipProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  
  useEffect(() => {
    if (target && isVisible) {
      const element = document.querySelector(target)
      if (element) {
        setRect(element.getBoundingClientRect())
      }
    }
  }, [target, isVisible])
  
  if (!isVisible) return null
  
  const getPositionStyles = () => {
    if (!rect) return {}
    
    const offset = 12
    
    switch (position) {
      case 'top':
        return {
          top: rect.top - offset,
          left: rect.left + rect.width / 2,
          transform: 'translate(-50%, -100%)'
        }
      case 'bottom':
        return {
          top: rect.bottom + offset,
          left: rect.left + rect.width / 2,
          transform: 'translate(-50%, 0)'
        }
      case 'left':
        return {
          top: rect.top + rect.height / 2,
          left: rect.left - offset,
          transform: 'translate(-100%, -50%)'
        }
      case 'right':
        return {
          top: rect.top + rect.height / 2,
          left: rect.right + offset,
          transform: 'translate(0, -50%)'
        }
      default:
        return {}
    }
  }
  
  return (
    <div
      className="fixed z-50 max-w-xs"
      style={getPositionStyles()}
    >
      <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-zinc-100 mb-1">
              {title}
            </h4>
            <p className="text-xs text-zinc-300">
              {content}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Predefined onboarding flows
export const tutorOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to TolarianTutor',
    description: 'Let\'s take a quick tour of how to build amazing Commander decks with AI assistance.',
    content: (
      <div className="bg-zinc-800/60 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <span className="font-medium text-zinc-100">Pro Tip</span>
        </div>
        <p className="text-sm text-zinc-300">
          This tour will show you the key features and help you build your first deck in minutes.
        </p>
      </div>
    )
  },
  {
    id: 'consultation',
    title: 'AI Consultation Wizard',
    description: 'Start by telling us about your preferred playstyle, budget, and power level. Our AI will use this to create the perfect deck for you.',
    target: '[data-tour="consultation-wizard"]',
    content: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Target className="w-4 h-4 text-blue-400" />
          <span>Answer a few questions about your preferences</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span>Get personalized commander suggestions</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Users className="w-4 h-4 text-green-400" />
          <span>Build decks that match your playgroup</span>
        </div>
      </div>
    )
  },
  {
    id: 'deck-generation',
    title: 'AI Deck Generation',
    description: 'Watch as our AI builds a complete 100-card deck tailored to your specifications. You\'ll see real-time progress and can make adjustments.',
    target: '[data-tour="deck-generation"]'
  },
  {
    id: 'deck-analysis',
    title: 'Deck Analysis & Statistics',
    description: 'Review your generated deck with comprehensive statistics, mana curve analysis, and strategic insights.',
    target: '[data-tour="deck-analysis"]'
  },
  {
    id: 'deck-editor',
    title: 'Fine-tune Your Deck',
    description: 'Make adjustments, swap cards, and get AI suggestions for improvements. Your deck, your way.',
    target: '[data-tour="deck-editor"]'
  }
]