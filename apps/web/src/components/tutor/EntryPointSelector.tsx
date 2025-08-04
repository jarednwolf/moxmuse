'use client'

import React from 'react'
import { Bot, Package, Sparkles } from 'lucide-react'

interface EntryPointSelectorProps {
  onDeckBuilding: () => void
  onCardRecommendations: () => void
  onNaturalLanguageVision: () => void
}

export function EntryPointSelector({ onDeckBuilding, onCardRecommendations, onNaturalLanguageVision }: EntryPointSelectorProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500/80 to-blue-500/80 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light mb-4 text-white drop-shadow-lg">AI Deck Building Tutor</h1>
          <p className="text-xl text-zinc-200 drop-shadow">I'm here to help you build amazing Commander decks</p>
        </div>

        <div className="grid gap-6 max-w-4xl">
          {/* Featured Option - Guided Deck Building */}
          <button
            onClick={onDeckBuilding}
            className="p-8 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm hover:from-purple-500/30 hover:to-blue-500/30 transition-all border border-purple-500/50 text-left group relative overflow-hidden"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                  Guided Deck Building
                </h3>
                <p className="text-zinc-300 text-lg">
                  Step-by-step wizard to build a complete 100-card Commander deck
                </p>
                <p className="text-xs text-purple-300 mt-2">
                  Answer questions about your playstyle and get a fully optimized deck
                </p>
              </div>
            </div>
          </button>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={onCardRecommendations}
              className="p-8 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-700/80 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-6 h-6 text-zinc-200" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                    Card Recommendations
                  </h3>
                  <p className="text-zinc-300">
                    Chat with me about your existing deck and get specific card suggestions
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={onNaturalLanguageVision}
              className="p-8 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left group relative overflow-hidden"
            >
              <div className="absolute top-3 right-3">
                <div className="px-2 py-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full text-xs text-white font-medium">
                  BETA
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-blue-500/80 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-zinc-100 group-hover:text-white transition-colors">
                    Describe Your Vision
                  </h3>
                  <p className="text-zinc-300">
                    Simply tell me your deck idea in natural language and I'll build it for you
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-zinc-400">
            Powered by advanced AI with knowledge of thousands of Commander decks
          </p>
        </div>
      </div>
    </div>
  )
}
