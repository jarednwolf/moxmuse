'use client'

import { useState } from 'react'
import { Search, Plus, Filter, Grid, List } from 'lucide-react'
import Link from 'next/link'

export default function LotusListPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-light mb-2">LotusList</h1>
            <p className="text-zinc-400">Interactive deck builder with real-time synergy scoring</p>
          </div>
          
          <Link
            href="/decks/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Deck
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search decks by name, commander, or strategy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
          
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors">
              <Filter className="w-5 h-5" />
              Filters
            </button>
            
            <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Coming Soon Message */}
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">LotusList Coming Soon</h2>
            <p className="text-zinc-400 mb-8">
              The interactive deck builder with real-time synergy scoring is currently in development. 
              In the meantime, you can use our AI-powered TolarianTutor for deck recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/tutor"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                Try TolarianTutor
              </Link>
              <Link
                href="/decks"
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-medium transition-colors"
              >
                Browse Decks
              </Link>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <h3 className="text-lg font-medium mb-3">Synergy Scoring</h3>
            <p className="text-zinc-400 text-sm">
              Real-time analysis of card synergies based on tournament data and community insights.
            </p>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <h3 className="text-lg font-medium mb-3">Power Level Estimation</h3>
            <p className="text-zinc-400 text-sm">
              Automatic power level calculation (1-10) to help you build balanced decks for your playgroup.
            </p>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <h3 className="text-lg font-medium mb-3">Budget Alternatives</h3>
            <p className="text-zinc-400 text-sm">
              Smart suggestions for budget-friendly alternatives that maintain your deck's strategy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}