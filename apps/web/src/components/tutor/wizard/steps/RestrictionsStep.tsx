'use client'

import React, { useState } from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'
import { X, Plus } from 'lucide-react'

interface RestrictionsStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const commonAvoidedStrategies = [
  { value: 'stax', label: 'Stax', description: 'Resource denial and prison effects' },
  { value: 'mass-land-destruction', label: 'Mass Land Destruction', description: 'Destroying multiple lands' },
  { value: 'infinite-combos', label: 'Infinite Combos', description: 'Repeatable loops for instant wins' },
  { value: 'extra-turns', label: 'Extra Turns', description: 'Taking additional turns' },
  { value: 'chaos', label: 'Chaos', description: 'Random and unpredictable effects' },
  { value: 'group-hug', label: 'Group Hug', description: 'Helping all players equally' },
  { value: 'mill', label: 'Mill', description: 'Putting cards from library to graveyard' },
  { value: 'discard', label: 'Discard', description: 'Forcing opponents to discard cards' },
  { value: 'theft', label: 'Theft', description: 'Stealing opponents\' permanents' },
  { value: 'counterspells', label: 'Heavy Counterspells', description: 'Countering many spells' }
]

const commonAvoidedCards = [
  'Armageddon',
  'Winter Orb',
  'Static Orb',
  'Stasis',
  'Teferi\'s Protection',
  'Cyclonic Rift',
  'Sol Ring',
  'Mana Crypt',
  'Rhystic Study',
  'Smothering Tithe',
  'Dockside Extortionist',
  'Thassa\'s Oracle'
]

export const RestrictionsStep: React.FC<RestrictionsStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const [customStrategy, setCustomStrategy] = useState('')
  const [customCard, setCustomCard] = useState('')

  const handleAvoidStrategy = (strategy: string) => {
    const currentStrategies = data.avoidStrategies || []
    const newStrategies = currentStrategies.includes(strategy)
      ? currentStrategies.filter(s => s !== strategy)
      : [...currentStrategies, strategy]
    
    onChange({ avoidStrategies: newStrategies })
  }

  const handleAddCustomStrategy = () => {
    if (customStrategy.trim()) {
      const currentStrategies = data.avoidStrategies || []
      if (!currentStrategies.includes(customStrategy.trim())) {
        onChange({ 
          avoidStrategies: [...currentStrategies, customStrategy.trim()] 
        })
      }
      setCustomStrategy('')
    }
  }

  const handleRemoveStrategy = (strategy: string) => {
    const currentStrategies = data.avoidStrategies || []
    onChange({ 
      avoidStrategies: currentStrategies.filter(s => s !== strategy) 
    })
  }

  const handleAvoidCard = (card: string) => {
    const currentCards = data.avoidCards || []
    const newCards = currentCards.includes(card)
      ? currentCards.filter(c => c !== card)
      : [...currentCards, card]
    
    onChange({ avoidCards: newCards })
  }

  const handleAddCustomCard = () => {
    if (customCard.trim()) {
      const currentCards = data.avoidCards || []
      if (!currentCards.includes(customCard.trim())) {
        onChange({ 
          avoidCards: [...currentCards, customCard.trim()] 
        })
      }
      setCustomCard('')
    }
  }

  const handleRemoveCard = (card: string) => {
    const currentCards = data.avoidCards || []
    onChange({ 
      avoidCards: currentCards.filter(c => c !== card) 
    })
  }

  const handlePetCards = (petCardsText: string) => {
    const petCards = petCardsText.split(',').map(s => s.trim()).filter(s => s.length > 0)
    onChange({ petCards: petCards.length > 0 ? petCards : undefined })
  }

  // This step is always valid since restrictions are optional
  const canProceed = true

  return (
    <WizardStep
      title="Restrictions & Preferences"
      description="Are there any strategies or cards you want to avoid? Any favorites you want to include?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={canProceed}
    >
      <div className="space-y-8">
        {/* Avoided strategies */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Strategies to Avoid</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Select strategies you don't want in your deck (optional):
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {commonAvoidedStrategies.map((strategy) => {
              const isSelected = data.avoidStrategies?.includes(strategy.value) || false
              return (
                <button
                  key={strategy.value}
                  onClick={() => handleAvoidStrategy(strategy.value)}
                  className={`p-4 rounded-lg border transition-all text-left hover:scale-[1.01] ${
                    isSelected
                      ? 'border-red-400 bg-red-400/10'
                      : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 transition-all ${
                      isSelected 
                        ? 'bg-red-500 border-red-500' 
                        : 'border-zinc-500'
                    }`}>
                      {isSelected && (
                        <div className="w-full h-full flex items-center justify-center">
                          <X className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-zinc-200 mb-1">{strategy.label}</h4>
                      <p className="text-sm text-zinc-400">{strategy.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Custom strategy input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom strategy to avoid..."
              value={customStrategy}
              onChange={(e) => setCustomStrategy(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomStrategy()}
              className="flex-1 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all"
            />
            <button
              onClick={handleAddCustomStrategy}
              disabled={!customStrategy.trim()}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Custom strategies display */}
          {data.avoidStrategies && data.avoidStrategies.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Strategies to Avoid:</h4>
              <div className="flex flex-wrap gap-2">
                {data.avoidStrategies.map((strategy) => (
                  <span
                    key={strategy}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-300 rounded-full text-sm"
                  >
                    {strategy}
                    <button
                      onClick={() => handleRemoveStrategy(strategy)}
                      className="hover:text-red-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avoided cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Cards to Avoid</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Select specific cards you don't want in your deck (optional):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {commonAvoidedCards.map((card) => {
              const isSelected = data.avoidCards?.includes(card) || false
              return (
                <button
                  key={card}
                  onClick={() => handleAvoidCard(card)}
                  className={`p-3 rounded-lg border transition-all text-left hover:scale-[1.01] text-sm ${
                    isSelected
                      ? 'border-red-400 bg-red-400/10 text-red-300'
                      : 'border-zinc-600 hover:border-zinc-500 bg-zinc-800/30 text-zinc-300'
                  }`}
                >
                  {card}
                </button>
              )
            })}
          </div>

          {/* Custom card input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add custom card to avoid..."
              value={customCard}
              onChange={(e) => setCustomCard(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomCard()}
              className="flex-1 px-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all"
            />
            <button
              onClick={handleAddCustomCard}
              disabled={!customCard.trim()}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Custom cards display */}
          {data.avoidCards && data.avoidCards.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Cards to Avoid:</h4>
              <div className="flex flex-wrap gap-2">
                {data.avoidCards.map((card) => (
                  <span
                    key={card}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-300 rounded-full text-sm"
                  >
                    {card}
                    <button
                      onClick={() => handleRemoveCard(card)}
                      className="hover:text-red-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pet cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-zinc-200">Pet Cards</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Any favorite cards you'd like to include if they fit the strategy?
          </p>
          <textarea
            placeholder="e.g., Lightning Bolt, Counterspell, Doubling Season"
            value={data.petCards?.join(', ') || ''}
            onChange={(e) => handlePetCards(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 transition-all resize-none"
            rows={3}
          />
          <p className="text-xs text-zinc-500">
            Separate multiple cards with commas. These will be included if they fit your deck's strategy and budget.
          </p>
        </div>

        {/* Restrictions summary */}
        {((data.avoidStrategies && data.avoidStrategies.length > 0) || 
          (data.avoidCards && data.avoidCards.length > 0) || 
          (data.petCards && data.petCards.length > 0)) && (
          <div className="p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
            <h4 className="text-lg font-medium text-zinc-200 mb-3">Restrictions Summary</h4>
            <div className="space-y-2 text-sm">
              {data.avoidStrategies && data.avoidStrategies.length > 0 && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Avoided Strategies:</span> {data.avoidStrategies.join(', ')}
                </p>
              )}
              {data.avoidCards && data.avoidCards.length > 0 && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Avoided Cards:</span> {data.avoidCards.join(', ')}
                </p>
              )}
              {data.petCards && data.petCards.length > 0 && (
                <p className="text-zinc-300">
                  <span className="text-zinc-400">Pet Cards:</span> {data.petCards.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  )
}