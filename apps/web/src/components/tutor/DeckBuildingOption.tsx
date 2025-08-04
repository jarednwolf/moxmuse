'use client'

import React from 'react'
import { Sparkles, Zap, Target, TrendingUp, ChevronRight } from 'lucide-react'
import { useMobile } from '@/hooks/useMobile'

interface DeckBuildingOptionProps {
  onClick: () => void
}

export const DeckBuildingOption: React.FC<DeckBuildingOptionProps> = ({ onClick }) => {
  const { isMobile, isTablet } = useMobile()

  return (
    <div 
      onClick={onClick}
      className={`group relative bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm rounded-2xl border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-purple-500/10 ${
        isMobile 
          ? 'p-6 active:scale-[0.98]' 
          : isTablet 
            ? 'p-7 hover:scale-[1.01]' 
            : 'p-8 hover:scale-[1.02]'
      }`}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-blue-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className={`relative z-10 ${isMobile ? 'mb-4' : 'mb-6'}`}>
        <div className={`flex items-center gap-3 ${isMobile ? 'mb-3' : 'mb-4'}`}>
          <div className={`bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ${
            isMobile ? 'w-10 h-10' : 'w-12 h-12'
          }`}>
            <Sparkles className={`text-white ${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
          </div>
          <div>
            <h2 className={`font-bold text-zinc-100 group-hover:text-white transition-colors ${
              isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-2xl'
            }`}>
              Build Complete Deck
            </h2>
            <p className={`text-purple-300/80 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Full 100-card Commander deck
            </p>
          </div>
        </div>
        
        <p className={`text-zinc-300 leading-relaxed ${
          isMobile ? 'text-sm' : 'text-base'
        }`}>
          Let me guide you through building a complete, optimized Commander deck from scratch. 
          I'll help you choose a commander, define your strategy, and create a perfectly balanced 100-card deck.
        </p>
      </div>

      {/* Features */}
      <div className={`relative z-10 space-y-3 ${isMobile ? 'mb-4' : 'mb-8'}`}>
        <div className="flex items-start gap-3">
          <div className={`bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isMobile ? 'w-5 h-5' : 'w-6 h-6'
          }`}>
            <Target className={`text-purple-400 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          </div>
          <div>
            <h4 className={`font-semibold text-zinc-200 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Guided Strategy Selection
            </h4>
            <p className={`text-zinc-400 ${isMobile ? 'text-xs leading-tight' : 'text-xs'}`}>
              Choose your playstyle, power level, and win conditions through an interactive wizard
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className={`bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isMobile ? 'w-5 h-5' : 'w-6 h-6'
          }`}>
            <Zap className={`text-blue-400 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          </div>
          <div>
            <h4 className={`font-semibold text-zinc-200 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              AI Commander Suggestions
            </h4>
            <p className={`text-zinc-400 ${isMobile ? 'text-xs leading-tight' : 'text-xs'}`}>
              Get personalized commander recommendations or build around your favorite legendary creature
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className={`bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isMobile ? 'w-5 h-5' : 'w-6 h-6'
          }`}>
            <TrendingUp className={`text-green-400 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          </div>
          <div>
            <h4 className={`font-semibold text-zinc-200 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Complete Deck Analysis
            </h4>
            <p className={`text-zinc-400 ${isMobile ? 'text-xs leading-tight' : 'text-xs'}`}>
              Receive a fully optimized deck with mana curve, statistics, and strategic analysis
            </p>
          </div>
        </div>
      </div>

      {/* Preview cards - hide on mobile to save space */}
      {!isMobile && (
        <div className="relative z-10 mb-6">
          <div className="flex -space-x-2 mb-3">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i}
                className="w-8 h-11 bg-gradient-to-b from-zinc-700 to-zinc-800 rounded border border-zinc-600/50 flex items-center justify-center text-xs text-zinc-400 group-hover:border-zinc-500/50 transition-colors"
                style={{ transform: `rotate(${(i - 2.5) * 3}deg)` }}
              >
                {i === 1 ? '🏰' : i === 2 ? '⚔️' : i === 3 ? '🔮' : '🌟'}
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Includes commander, lands, ramp, removal, win conditions, and synergistic cards
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="relative z-10 flex items-center justify-between">
        <div className={`text-zinc-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
          {isMobile ? '~15 min' : '~15-20 minutes'}
        </div>
        <div className="flex items-center gap-2 text-purple-400 group-hover:text-purple-300 transition-colors">
          <span className={`font-medium ${isMobile ? 'text-sm' : 'text-sm'}`}>
            Start Building
          </span>
          <ChevronRight className={`group-hover:translate-x-1 transition-transform ${
            isMobile ? 'w-4 h-4' : 'w-4 h-4'
          }`} />
        </div>
      </div>

      {/* Hover effect indicator */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )
}