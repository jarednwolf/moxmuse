'use client'

import Link from 'next/link'
import { ArrowRight, Bot, BarChart, DollarSign, Users, Zap, Circle, Import, Search, Sparkles, ExternalLink, Database, Hammer } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const { data: session } = useSession()
  const [currentBackground, setCurrentBackground] = useState(0)
  
  const backgrounds = [
    '/images/plains1.png',
    '/images/island1.png', 
    '/images/swamp1.png',
    '/images/mountain1.png',
    '/images/forest1.png'
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBackground((prev) => (prev + 1) % backgrounds.length)
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [backgrounds.length])

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/* Hero Section with Cycling Backgrounds */}
      <section className="relative min-h-[calc(100vh-73px)] flex items-center overflow-hidden">
        {/* Cycling background images */}
        {backgrounds.map((bg, index) => (
          <div
            key={bg}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentBackground ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${bg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          />
        ))}
        
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80" />
        
        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6">
          <div className="max-w-4xl">
            {/* Mox Circles */}
            <div className="flex -space-x-3 mb-8">
              <Circle className="w-12 h-12 text-white fill-white/20 border-2 border-zinc-600" />
              <Circle className="w-12 h-12 text-blue-400 fill-blue-900/40 border-2 border-blue-700" />
              <Circle className="w-12 h-12 text-zinc-400 fill-black/40 border-2 border-zinc-500" />
              <Circle className="w-12 h-12 text-red-500 fill-red-900/40 border-2 border-red-700" />
              <Circle className="w-12 h-12 text-green-500 fill-green-900/40 border-2 border-green-700" />
            </div>
            
            <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-6 text-white drop-shadow-2xl">
              Build Winning Commander Decks
              <span className="text-purple-400"> 65% Faster</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-200 mb-8 leading-relaxed drop-shadow-lg">
              Advanced deck analysis engine powered by GPT-4. Real-time price tracking, 
              collection management, and synergy scoring from 100K+ tournament games.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={session ? "/tutor" : "/auth/signin"}
                className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/solsync"
                className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-800/80 backdrop-blur-sm hover:bg-zinc-700/80 rounded-lg font-medium text-lg transition-all border border-zinc-700"
              >
                Import Collection
                <Database className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 bg-zinc-900/95 backdrop-blur-sm border-y border-zinc-800">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-purple-400 mb-2">65%</div>
              <div className="text-zinc-400">Faster Deck Building</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-green-400 mb-2">20%</div>
              <div className="text-zinc-400">Average Savings</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400 mb-2">100K+</div>
              <div className="text-zinc-400">Games Analyzed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-red-400 mb-2">50K+</div>
              <div className="text-zinc-400">Community Decks</div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="relative py-24 bg-zinc-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light mb-4">
              Three Powerful Tools, One Platform
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Everything you need to build, optimize, and buy cards for your Commander decks.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* SolSync */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50 hover:border-zinc-600 transition-all hover:shadow-xl hover:scale-105">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6">
                <Import className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4">SolSync</h3>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                Import your collection from Moxfield, Archidekt, or CSV in seconds. Track 
                ownership, conditions, and languages across all your cards.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">One-click import from major platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Real-time collection value tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Automatic deduplication</span>
                </li>
              </ul>
              <Link
                href="/solsync"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sync Collection
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* LotusList */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50 hover:border-zinc-600 transition-all hover:shadow-xl hover:scale-105">
              <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center mb-6">
                <Search className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4">LotusList</h3>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                Interactive deck builder with real-time synergy scoring. Build better 
                decks with data from thousands of tournament results.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <BarChart className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Synergy scores for every card pair</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Power level estimation (1-10)</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Budget alternatives for every card</span>
                </li>
              </ul>
              <Link
                href="/lotuslist"
                className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium transition-colors"
              >
                Build Deck
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* TolarianTutor */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50 hover:border-zinc-600 transition-all hover:shadow-xl hover:scale-105">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6">
                <Sparkles className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4">TolarianTutor</h3>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                AI-powered card recommendations using GPT-4. Get personalized suggestions 
                based on your strategy, budget, and playstyle.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <Bot className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Natural language deck requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <Bot className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Context-aware recommendations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Bot className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Affiliate links for easy ordering</span>
                </li>
              </ul>
              <Link
                href="/tutor"
                className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Ask AI
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* DeckForge */}
            <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/50 hover:border-zinc-600 transition-all hover:shadow-xl hover:scale-105">
              <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center mb-6">
                <Hammer className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-2xl font-medium mb-4">DeckForge</h3>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                Professional deck editor with interactive statistics, mana curve analysis, 
                and advanced deck building tools.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <BarChart className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Interactive mana curve & statistics</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Real-time deck analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <ExternalLink className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Export to Moxfield & Archidekt</span>
                </li>
              </ul>
              <div className="flex items-center gap-4">
                <Link
                  href="/decks"
                  className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition-colors"
                >
                  Build Decks
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/deckforge/demo"
                  className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Try Demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative py-24 bg-zinc-800/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-light mb-4">
              Built for Competitive Players
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Professional tools used by tournament grinders and content creators.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="flex gap-4">
              <DollarSign className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div>
                <h3 className="font-medium mb-2">Real-Time Pricing</h3>
                <p className="text-sm text-zinc-400">
                  Track prices across TCGPlayer, Card Kingdom, and more. Get alerts when cards drop.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <BarChart className="w-8 h-8 text-blue-400 flex-shrink-0" />
              <div>
                <h3 className="font-medium mb-2">Meta Analysis</h3>
                <p className="text-sm text-zinc-400">
                  See what's winning in cEDH and high-power pods. Track format trends.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Users className="w-8 h-8 text-purple-400 flex-shrink-0" />
              <div>
                <h3 className="font-medium mb-2">Community Decks</h3>
                <p className="text-sm text-zinc-400">
                  Browse 50K+ decks from the community. Fork and customize any list.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-b from-zinc-900 to-purple-900/20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-light mb-4">
            Ready to Build Better Decks?
          </h2>
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Join thousands of players building smarter, faster, and cheaper.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={session ? "/tutor" : "/auth/signin"}
              className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="https://github.com/yourusername/moxmuse"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium text-lg transition-all"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 bg-zinc-900 border-t border-zinc-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-zinc-500">
              © 2024 MoxMuse. Not affiliated with Wizards of the Coast.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-zinc-400 hover:text-zinc-300">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-zinc-400 hover:text-zinc-300">
                Terms
              </Link>
              <Link href="/discord" className="text-sm text-zinc-400 hover:text-zinc-300">
                Discord
              </Link>
              <Link href="/api" className="text-sm text-zinc-400 hover:text-zinc-300">
                API
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 