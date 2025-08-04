'use client'

import React from 'react'
import { MessageSquare, Search, Lightbulb, Zap, ChevronRight } from 'lucide-react'

interface CardRecommendationOptionProps {
  onClick: () => void
}

export const CardRecommendationOption: React.FC<CardRecommendationOptionProps> = ({ onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-gradient-to-br from-emerald-900/20 to-teal-900/20 backdrop-blur-sm rounded-2xl p-8 border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-emerald-500/10"
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-teal-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 group-hover:text-white transition-colors">
              Get Card Recommendations
            </h2>
            <p className="text-sm text-emerald-300/80">
              Individual card suggestions
            </p>
          </div>
        </div>
        
        <p className="text-zinc-300 leading-relaxed">
          Chat with me about specific cards, strategies, or improvements for your existing deck. 
          Perfect for targeted advice and exploring new card options.
        </p>
      </div>

      {/* Features */}
      <div className="relative z-10 space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Search className="w-3 h-3 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-200 mb-1">Targeted Card Search</h4>
            <p className="text-xs text-zinc-400">Find specific cards for removal, ramp, card draw, or any other deck needs</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lightbulb className="w-3 h-3 text-teal-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-200 mb-1">Deck Improvement Ideas</h4>
            <p className="text-xs text-zinc-400">Get suggestions to upgrade your existing deck or explore new strategies</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap className="w-3 h-3 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-zinc-200 mb-1">Interactive Chat</h4>
            <p className="text-xs text-zinc-400">Ask follow-up questions and refine recommendations through natural conversation</p>
          </div>
        </div>
      </div>

      {/* Example queries */}
      <div className="relative z-10 mb-6">
        <div className="space-y-2 mb-3">
          <div className="text-xs bg-zinc-800/40 rounded-lg px-3 py-2 border border-zinc-700/30">
            <span className="text-zinc-400">"I need better card draw for my Atraxa deck"</span>
          </div>
          <div className="text-xs bg-zinc-800/40 rounded-lg px-3 py-2 border border-zinc-700/30">
            <span className="text-zinc-400">"What's the best removal for artifact decks?"</span>
          </div>
          <div className="text-xs bg-zinc-800/40 rounded-lg px-3 py-2 border border-zinc-700/30">
            <span className="text-zinc-400">"Show me budget alternatives to expensive cards"</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Ask me anything about Magic cards and deck building
        </p>
      </div>

      {/* Action button */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          Instant responses
        </div>
        <div className="flex items-center gap-2 text-emerald-400 group-hover:text-emerald-300 transition-colors">
          <span className="text-sm font-medium">Start Chatting</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Hover effect indicator */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-emerald-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  )
}