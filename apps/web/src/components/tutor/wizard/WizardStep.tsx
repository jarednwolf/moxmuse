'use client'

import React, { useRef, useEffect } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'
import { useSwipeGestures } from '@/hooks/useSwipeGestures'

interface WizardStepProps {
  title: string
  description?: string
  children: React.ReactNode
  onNext?: () => void
  onBack?: () => void
  onComplete?: () => void
  nextLabel?: string
  backLabel?: string
  completeLabel?: string
  canProceed?: boolean
  isFirstStep?: boolean
  isLastStep?: boolean
  hideNextButton?: boolean
  className?: string
}

export const WizardStep: React.FC<WizardStepProps> = ({
  title,
  description,
  children,
  onNext,
  onBack,
  onComplete,
  nextLabel = 'Next',
  backLabel = 'Back',
  completeLabel = 'Complete',
  canProceed = true,
  isFirstStep = false,
  isLastStep = false,
  hideNextButton = false,
  className = ''
}) => {
  const { isMobile, isTablet } = useMobile()
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePrimaryAction = () => {
    if (isLastStep && onComplete) {
      onComplete()
    } else if (onNext) {
      onNext()
    }
  }

  // Set up swipe gestures for mobile navigation
  const { attachListeners } = useSwipeGestures({
    onSwipeLeft: () => {
      if (canProceed && (onNext || onComplete)) {
        handlePrimaryAction()
      }
    },
    onSwipeRight: () => {
      if (!isFirstStep && onBack) {
        onBack()
      }
    },
    threshold: 100 // Require a longer swipe to prevent accidental navigation
  })

  useEffect(() => {
    if (isMobile && containerRef.current) {
      return attachListeners(containerRef.current)
    }
  }, [isMobile, attachListeners])

  return (
    <div 
      ref={containerRef}
      className={`space-y-6 sm:space-y-8 ${className}`}
    >
      {/* Step header */}
      <div className="text-center space-y-3">
        <h2 className={`font-bold text-zinc-100 ${
          isMobile ? 'text-xl' : isTablet ? 'text-xl' : 'text-2xl'
        }`}>
          {title}
        </h2>
        {description && (
          <p className={`text-zinc-400 max-w-2xl mx-auto ${
            isMobile ? 'text-sm px-2' : 'text-base'
          }`}>
            {description}
          </p>
        )}
      </div>
      
      {/* Step content */}
      <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'px-1' : ''}`}>
        {children}
      </div>
      
      {/* Mobile swipe hint */}
      {isMobile && (
        <div className="text-center py-2">
          <p className="text-xs text-zinc-500">
            Swipe left to continue • Swipe right to go back
          </p>
        </div>
      )}
      
      {/* Navigation buttons */}
      <div className={`flex items-center justify-between pt-4 sm:pt-6 border-t border-zinc-700/50 ${
        isMobile ? 'sticky bottom-0 bg-zinc-900/95 backdrop-blur-sm -mx-4 px-4 py-4' : ''
      }`}>
        <div>
          {!isFirstStep && onBack && (
            <button
              onClick={onBack}
              className={`flex items-center gap-2 text-zinc-400 hover:text-zinc-300 transition-colors ${
                isMobile ? 'px-3 py-3 text-base' : 'px-4 py-2 text-sm'
              }`}
            >
              <ChevronLeft className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
              {isMobile ? 'Back' : backLabel}
            </button>
          )}
        </div>
        
        <div>
          {!hideNextButton && (onNext || onComplete) && (
            <button
              onClick={handlePrimaryAction}
              disabled={!canProceed}
              className={`flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                isMobile 
                  ? 'px-6 py-3 text-base min-w-[120px] justify-center' 
                  : 'px-6 py-3 text-sm'
              }`}
            >
              {isLastStep ? completeLabel : (isMobile ? 'Next' : nextLabel)}
              {!isLastStep && <ChevronRight className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}