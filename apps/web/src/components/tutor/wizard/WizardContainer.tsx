'use client'

import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'

interface WizardContainerProps {
  children: React.ReactNode
  onBack?: () => void
  showBackButton?: boolean
  className?: string
}

export const WizardContainer: React.FC<WizardContainerProps> = ({
  children,
  onBack,
  showBackButton = true,
  className = ''
}) => {
  const { isMobile, isTablet } = useMobile()

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 min-h-screen ${className}`}>
      {/* Header with back button */}
      {showBackButton && onBack && (
        <div className={`mb-6 sm:mb-8 ${isMobile ? 'sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10 -mx-4 px-4 py-3 border-b border-zinc-800' : ''}`}>
          <button
            onClick={onBack}
            className={`flex items-center gap-2 text-zinc-400 hover:text-zinc-300 transition-colors ${
              isMobile ? 'text-base py-2' : 'text-sm'
            }`}
          >
            <ArrowLeft className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
            {isMobile ? 'Back' : 'Back to Entry Selection'}
          </button>
        </div>
      )}
      
      {/* Main wizard content */}
      <div className={`space-y-6 sm:space-y-8 ${isMobile ? 'pb-20' : ''}`}>
        {children}
      </div>
    </div>
  )
}