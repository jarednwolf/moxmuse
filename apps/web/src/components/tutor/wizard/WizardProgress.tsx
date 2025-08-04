'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'

interface WizardProgressProps {
  currentStep: number
  totalSteps: number
  stepTitles?: string[]
  className?: string
}

export const WizardProgress: React.FC<WizardProgressProps> = ({
  currentStep,
  totalSteps,
  stepTitles = [],
  className = ''
}) => {
  const { isMobile, isTablet } = useMobile()
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress bar */}
      <div className="relative">
        <div className={`w-full bg-zinc-800 rounded-full overflow-hidden ${isMobile ? 'h-3' : 'h-2'}`}>
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Step indicators - simplified for mobile */}
        {isMobile ? (
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }, (_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index < currentStep
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                      : index === currentStep
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 ring-1 ring-purple-400/50'
                      : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-between mt-3">
            {Array.from({ length: totalSteps }, (_, index) => (
              <div
                key={index}
                className="flex flex-col items-center"
              >
                <div
                  className={`${isTablet ? 'w-7 h-7' : 'w-8 h-8'} rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    index < currentStep
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : index === currentStep
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white ring-2 ring-purple-400/50'
                      : 'bg-zinc-700 text-zinc-400'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className={`${isTablet ? 'w-3 h-3' : 'w-4 h-4'}`} />
                  ) : (
                    index + 1
                  )}
                </div>
                
                {/* Step title */}
                {stepTitles[index] && (
                  <span
                    className={`mt-2 text-xs text-center ${isTablet ? 'max-w-16' : 'max-w-20'} leading-tight transition-colors ${
                      index <= currentStep ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {stepTitles[index]}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Current step info */}
      <div className="text-center">
        <p className={`${isMobile ? 'text-base' : 'text-sm'} text-zinc-400`}>
          Step {currentStep + 1} of {totalSteps}
          {stepTitles[currentStep] && !isMobile && (
            <span className="text-zinc-300"> • {stepTitles[currentStep]}</span>
          )}
        </p>
        {/* Show current step title on mobile */}
        {isMobile && stepTitles[currentStep] && (
          <p className="text-sm text-zinc-300 mt-1">
            {stepTitles[currentStep]}
          </p>
        )}
      </div>
    </div>
  )
}