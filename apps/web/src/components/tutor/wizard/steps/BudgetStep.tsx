'use client'

import React, { useState } from 'react'
import { ConsultationData } from '@moxmuse/shared'
import { WizardStep } from '../WizardStep'

interface BudgetStepProps {
  data: ConsultationData
  onChange: (data: Partial<ConsultationData>) => void
  onNext: () => void
  onBack: () => void
  isFirstStep: boolean
}

const budgetPresets = [
  { 
    value: 50, 
    label: 'Budget', 
    description: 'Under $50',
    details: 'Focus on budget-friendly cards and reprints',
    icon: '💰'
  },
  { 
    value: 150, 
    label: 'Casual', 
    description: '$50 - $150',
    details: 'Mix of budget cards with some higher-value pieces',
    icon: '🎯'
  },
  { 
    value: 300, 
    label: 'Focused', 
    description: '$150 - $300',
    details: 'Include powerful cards and efficient mana base',
    icon: '⭐'
  },
  { 
    value: 500, 
    label: 'Optimized', 
    description: '$300+',
    details: 'No budget constraints, focus on optimal cards',
    icon: '💎'
  },
]

export const BudgetStep: React.FC<BudgetStepProps> = ({ 
  data, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}) => {
  const [customBudget, setCustomBudget] = useState<string>('')
  const [showSlider, setShowSlider] = useState(false)

  const handlePresetSelect = (budget: number) => {
    onChange({ budget })
    setCustomBudget('')
    setTimeout(onNext, 100)
  }

  const handleCustomBudget = (value: string) => {
    setCustomBudget(value)
    const numValue = parseInt(value)
    if (!isNaN(numValue) && numValue > 0) {
      onChange({ budget: numValue })
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    onChange({ budget: value })
    setCustomBudget(value.toString())
  }

  return (
    <WizardStep
      title="Budget Constraints"
      description="What's your budget for this deck?"
      onNext={onNext}
      onBack={onBack}
      isFirstStep={isFirstStep}
      canProceed={data.budget !== undefined}
    >
      <div className="space-y-8">
        {/* Budget presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {budgetPresets.map((budget) => (
            <button
              key={budget.value}
              onClick={() => handlePresetSelect(budget.value)}
              className={`p-5 rounded-xl border-2 transition-all text-center hover:scale-[1.02] group ${
                data.budget === budget.value
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                  : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              <div className="space-y-3">
                <div className="text-3xl">{budget.icon}</div>
                <h3 className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
                  {budget.label}
                </h3>
                <p className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  {budget.description}
                </p>
                <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {budget.details}
                </p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Custom budget section */}
        <div className="text-center space-y-4">
          <div className="flex items-center gap-4 justify-center">
            <div className="h-px bg-zinc-700 flex-1 max-w-20"></div>
            <p className="text-sm text-zinc-500">Or set a custom budget</p>
            <div className="h-px bg-zinc-700 flex-1 max-w-20"></div>
          </div>
          
          <div className="max-w-xs mx-auto space-y-4">
            {/* Custom input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 text-lg">$</span>
              <input
                type="number"
                placeholder="0"
                value={customBudget}
                onChange={(e) => handleCustomBudget(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-zinc-100 placeholder-zinc-400 text-center text-lg transition-all"
                min="0"
                max="2000"
              />
            </div>
            
            {/* Toggle slider */}
            <button
              onClick={() => setShowSlider(!showSlider)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              {showSlider ? 'Hide' : 'Show'} slider
            </button>
            
            {/* Budget slider */}
            {showSlider && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <input
                  type="range"
                  min="25"
                  max="1000"
                  step="25"
                  value={data.budget || 100}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>$25</span>
                  <span>$1000+</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Collection toggle */}
        <div className="max-w-md mx-auto p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.useCollection || false}
              onChange={(e) => onChange({ useCollection: e.target.checked })}
              className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/50 focus:ring-2"
            />
            <div>
              <span className="text-zinc-200 font-medium">Use my collection</span>
              <p className="text-sm text-zinc-400">Prioritize cards I already own</p>
            </div>
          </label>
        </div>
        
        {/* Budget display */}
        {data.budget && (
          <div className="text-center p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-purple-300">
              Target budget: <span className="font-semibold">${data.budget}</span>
              {data.useCollection && (
                <span className="text-sm block mt-1">+ prioritizing owned cards</span>
              )}
            </p>
          </div>
        )}
      </div>
      
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #8b5cf6, #3b82f6);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #8b5cf6, #3b82f6);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        }
      `}</style>
    </WizardStep>
  )
}