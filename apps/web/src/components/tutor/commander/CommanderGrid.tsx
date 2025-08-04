'use client'

import React from 'react'
import { CommanderRecommendation } from '@moxmuse/shared'
import { CommanderCard } from './CommanderCard'

interface CommanderGridProps {
  commanders: CommanderRecommendation[]
  onSelect: (commander: CommanderRecommendation) => void
  selectedCommanderId?: string
  isLoading?: boolean
}

export const CommanderGrid: React.FC<CommanderGridProps> = ({
  commanders,
  onSelect,
  selectedCommanderId,
  isLoading = false
}) => {
  console.log('🎯 CommanderGrid render - commanders:', commanders)
  console.log('🎯 CommanderGrid render - isLoading:', isLoading)
  console.log('🎯 CommanderGrid render - commanders length:', commanders?.length)
  
  // Show loading state with 5 skeleton cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <CommanderCard
            key={`loading-${index}`}
            commander={{} as CommanderRecommendation}
            onSelect={() => {}}
            isLoading={true}
          />
        ))}
      </div>
    )
  }

  // Show empty state if no commanders
  if (commanders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🤔</div>
        <h3 className="text-lg font-semibold text-zinc-200 mb-2">
          No commanders found
        </h3>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          We couldn't find any commanders matching your preferences. 
          Try adjusting your criteria or request more options.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {commanders.map((commander) => (
        <CommanderCard
          key={commander.cardId}
          commander={commander}
          onSelect={onSelect}
          isSelected={selectedCommanderId === commander.cardId}
        />
      ))}
    </div>
  )
}