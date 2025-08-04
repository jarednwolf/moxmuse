'use client'

import React, { useState, useEffect } from 'react'
import { CommanderRecommendation } from '@moxmuse/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, TrendingUp, TrendingDown, DollarSign, Target, Zap, Shield, Users, Star } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'

interface CommanderDetailModalProps {
  commander: CommanderRecommendation
  isOpen: boolean
  onClose: () => void
  onSelect?: (commander: CommanderRecommendation) => void
}

interface CommanderAnalysis {
  strategy: {
    description: string
    archetype: string
    themes: string[]
    gameplan: string
  }
  winConditions: {
    primary: string
    secondary: string[]
    description: string
  }
  powerLevel: {
    rating: number
    explanation: string
    bracket: string
  }
  playstyle: {
    complexity: 'simple' | 'moderate' | 'complex'
    interactionLevel: 'low' | 'medium' | 'high'
    gameLength: 'fast' | 'medium' | 'long'
    politicalNature: 'low' | 'medium' | 'high'
    description: string
  }
  budget: {
    commander: number
    budget: number
    competitive: number
    keyCards: Array<{
      name: string
      price: number
      category: string
    }>
  }
  metaPosition: {
    popularity: number
    winRate: number
    strengths: string[]
    weaknesses: string[]
    goodAgainst: string[]
    weakAgainst: string[]
  }
  typicalGamePattern: {
    earlyGame: string
    midGame: string
    lateGame: string
    keyTurns: string[]
  }
}

export const CommanderDetailModal: React.FC<CommanderDetailModalProps> = ({
  commander,
  isOpen,
  onClose,
  onSelect
}) => {
  const [analysis, setAnalysis] = useState<CommanderAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mock analysis generation - in real implementation, this would call an API
  const generateAnalysis = async (commander: CommanderRecommendation): Promise<CommanderAnalysis> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Mock data based on commander characteristics
    const mockAnalysis: CommanderAnalysis = {
      strategy: {
        description: `${commander.name} is a versatile commander that excels at building value through incremental advantages. This commander rewards careful resource management and strategic timing, making it ideal for players who enjoy making meaningful decisions each turn.`,
        archetype: commander.colorIdentity.length > 2 ? 'value' : 'midrange',
        themes: ['Card Advantage', 'Incremental Value', 'Flexible Answers'],
        gameplan: `Establish early board presence, accumulate resources through ${commander.name}'s abilities, then leverage accumulated advantages for decisive plays in the mid-to-late game.`
      },
      winConditions: {
        primary: 'Combat Damage',
        secondary: ['Value Engine', 'Combo Finish'],
        description: 'Primarily wins through combat damage after establishing board control, with backup plans involving value engines or opportunistic combo finishes.'
      },
      powerLevel: {
        rating: Math.floor(commander.confidence * 4) + 1,
        explanation: `This commander operates at a ${Math.floor(commander.confidence * 4) + 1}/4 power level, offering strong gameplay without being oppressive. Perfect for focused casual to optimized play.`,
        bracket: `Power Level ${Math.floor(commander.confidence * 4) + 1}`
      },
      playstyle: {
        complexity: commander.colorIdentity.length > 3 ? 'complex' : commander.colorIdentity.length > 1 ? 'moderate' : 'simple',
        interactionLevel: 'medium',
        gameLength: 'medium',
        politicalNature: commander.colorIdentity.includes('W') || commander.colorIdentity.includes('U') ? 'medium' : 'low',
        description: `This commander offers ${commander.colorIdentity.length > 2 ? 'complex decision trees with multiple viable lines of play' : 'straightforward gameplay with clear decision points'}, making it ${commander.colorIdentity.length > 2 ? 'perfect for experienced players' : 'accessible to newer players'}.`
      },
      budget: {
        commander: parseFloat(commander.price),
        budget: 150,
        competitive: 500,
        keyCards: [
          { name: 'Sol Ring', price: 2, category: 'Ramp' },
          { name: 'Command Tower', price: 1, category: 'Mana Base' },
          { name: 'Arcane Signet', price: 3, category: 'Ramp' },
          { name: 'Swords to Plowshares', price: 2, category: 'Removal' }
        ]
      },
      metaPosition: {
        popularity: Math.floor(commander.confidence * 100),
        winRate: Math.floor((commander.confidence * 0.3 + 0.4) * 100),
        strengths: ['Consistent Performance', 'Multiple Win Paths', 'Good Card Selection'],
        weaknesses: ['Vulnerable to Targeted Removal', 'Mana Intensive', 'Slow Start'],
        goodAgainst: ['Aggressive Strategies', 'Linear Combo Decks'],
        weakAgainst: ['Heavy Control', 'Fast Combo']
      },
      typicalGamePattern: {
        earlyGame: 'Focus on ramping and establishing mana base while deploying early utility creatures or artifacts.',
        midGame: `Deploy ${commander.name} and begin accumulating value through its abilities while maintaining board presence.`,
        lateGame: 'Leverage accumulated resources and board state to close out the game through combat or alternative win conditions.',
        keyTurns: ['Turn 3-4: Deploy Commander', 'Turn 6-8: Establish Engine', 'Turn 10+: Close Game']
      }
    }

    return mockAnalysis
  }

  // Load analysis when modal opens
  useEffect(() => {
    if (isOpen && !analysis) {
      setIsLoading(true)
      setError(null)
      
      generateAnalysis(commander)
        .then(setAnalysis)
        .catch((err) => {
          console.error('Failed to generate commander analysis:', err)
          setError('Failed to load commander analysis')
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, commander, analysis])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAnalysis(null)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const colorIdentityColors = {
    W: { name: 'White', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    U: { name: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    B: { name: 'Black', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    R: { name: 'Red', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    G: { name: 'Green', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  }

  return (
    <ErrorBoundary context="Commander Detail Modal">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200 transition-all"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-700">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-zinc-700 rounded-lg overflow-hidden flex-shrink-0">
                {commander.imageUrl ? (
                  <img
                    src={commander.imageUrl}
                    alt={commander.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    🃏
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">{commander.name}</h2>
                <p className="text-zinc-400">{commander.typeLine}</p>
                
                {/* Color Identity */}
                <div className="flex gap-1 mt-2">
                  {commander.colorIdentity.map((color) => {
                    const colorInfo = colorIdentityColors[color as keyof typeof colorIdentityColors]
                    return colorInfo ? (
                      <Badge
                        key={color}
                        variant="outline"
                        className={`text-xs px-2 py-1 ${colorInfo.bg} ${colorInfo.text} ${colorInfo.border}`}
                      >
                        {color}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {onSelect && (
                <Button
                  onClick={() => onSelect(commander)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Select Commander
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {isLoading && (
              <div className="p-8">
                <LoadingState
                  message="Analyzing Commander..."
                />
              </div>
            )}

            {error && (
              <div className="p-8 text-center">
                <div className="text-red-400 mb-4">⚠️ {error}</div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError(null)
                    setIsLoading(true)
                    generateAnalysis(commander)
                      .then(setAnalysis)
                      .catch((err) => setError('Failed to load commander analysis'))
                      .finally(() => setIsLoading(false))
                  }}
                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                >
                  Retry Analysis
                </Button>
              </div>
            )}

            {analysis && (
              <div className="p-6 space-y-6">
                {/* Strategy Overview */}
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-zinc-100">
                      <Target className="w-5 h-5 text-purple-400" />
                      Strategy Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-zinc-300 leading-relaxed">
                      {analysis.strategy.description}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2">Archetype</h4>
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                          {analysis.strategy.archetype}
                        </Badge>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2">Key Themes</h4>
                        <div className="flex flex-wrap gap-1">
                          {analysis.strategy.themes.map((theme, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-zinc-600 text-zinc-300">
                              {theme}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-zinc-200 mb-2">Game Plan</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {analysis.strategy.gameplan}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Win Conditions & Power Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-100">
                        <Zap className="w-5 h-5 text-yellow-400" />
                        Win Conditions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-1">Primary</h4>
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                          {analysis.winConditions.primary}
                        </Badge>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2">Secondary</h4>
                        <div className="flex flex-wrap gap-1">
                          {analysis.winConditions.secondary.map((condition, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-zinc-600 text-zinc-300">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {analysis.winConditions.description}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-100">
                        <Star className="w-5 h-5 text-blue-400" />
                        Power Level
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-blue-400">
                          {analysis.powerLevel.rating}
                        </div>
                        <div>
                          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                            {analysis.powerLevel.bracket}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {analysis.powerLevel.explanation}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Playstyle & Typical Game Pattern */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-100">
                        <Users className="w-5 h-5 text-green-400" />
                        Playstyle
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-zinc-400">Complexity:</span>
                          <div className="font-medium text-zinc-200 capitalize">{analysis.playstyle.complexity}</div>
                        </div>
                        <div>
                          <span className="text-zinc-400">Interaction:</span>
                          <div className="font-medium text-zinc-200 capitalize">{analysis.playstyle.interactionLevel}</div>
                        </div>
                        <div>
                          <span className="text-zinc-400">Game Length:</span>
                          <div className="font-medium text-zinc-200 capitalize">{analysis.playstyle.gameLength}</div>
                        </div>
                        <div>
                          <span className="text-zinc-400">Politics:</span>
                          <div className="font-medium text-zinc-200 capitalize">{analysis.playstyle.politicalNature}</div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {analysis.playstyle.description}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-zinc-100">
                        <Target className="w-5 h-5 text-orange-400" />
                        Typical Game Pattern
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-zinc-200">Early Game:</span>
                          <p className="text-zinc-400 text-xs mt-1">{analysis.typicalGamePattern.earlyGame}</p>
                        </div>
                        <div>
                          <span className="font-medium text-zinc-200">Mid Game:</span>
                          <p className="text-zinc-400 text-xs mt-1">{analysis.typicalGamePattern.midGame}</p>
                        </div>
                        <div>
                          <span className="font-medium text-zinc-200">Late Game:</span>
                          <p className="text-zinc-400 text-xs mt-1">{analysis.typicalGamePattern.lateGame}</p>
                        </div>
                      </div>
                      
                      <div>
                        <span className="font-medium text-zinc-200 text-sm">Key Turns:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {analysis.typicalGamePattern.keyTurns.map((turn, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-zinc-600 text-zinc-300">
                              {turn}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Budget Breakdown */}
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-zinc-100">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      Budget Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-zinc-700/30 rounded-lg">
                        <div className="text-2xl font-bold text-green-400">${analysis.budget.budget}</div>
                        <div className="text-sm text-zinc-400">Budget Build</div>
                      </div>
                      <div className="text-center p-3 bg-zinc-700/30 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-400">${analysis.budget.competitive}</div>
                        <div className="text-sm text-zinc-400">Competitive Build</div>
                      </div>
                      <div className="text-center p-3 bg-zinc-700/30 rounded-lg">
                        <div className="text-2xl font-bold text-purple-400">${commander.price}</div>
                        <div className="text-sm text-zinc-400">Commander Cost</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-zinc-200 mb-3">Key Cards</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {analysis.budget.keyCards.map((card, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-zinc-700/20 rounded">
                            <div>
                              <div className="font-medium text-zinc-200 text-sm">{card.name}</div>
                              <div className="text-xs text-zinc-400">{card.category}</div>
                            </div>
                            <div className="text-sm font-medium text-green-400">${card.price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Meta Position & Pros/Cons */}
                <Card className="bg-zinc-800/50 border-zinc-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-zinc-100">
                      <Shield className="w-5 h-5 text-red-400" />
                      Meta Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-zinc-700/30 rounded-lg">
                        <div className="text-2xl font-bold text-blue-400">{analysis.metaPosition.popularity}%</div>
                        <div className="text-sm text-zinc-400">Popularity</div>
                      </div>
                      <div className="text-center p-3 bg-zinc-700/30 rounded-lg">
                        <div className="text-2xl font-bold text-green-400">{analysis.metaPosition.winRate}%</div>
                        <div className="text-sm text-zinc-400">Win Rate</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {analysis.metaPosition.strengths.map((strength, index) => (
                            <li key={index} className="text-sm text-zinc-400 flex items-center gap-2">
                              <div className="w-1 h-1 bg-green-400 rounded-full" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2 flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-red-400" />
                          Weaknesses
                        </h4>
                        <ul className="space-y-1">
                          {analysis.metaPosition.weaknesses.map((weakness, index) => (
                            <li key={index} className="text-sm text-zinc-400 flex items-center gap-2">
                              <div className="w-1 h-1 bg-red-400 rounded-full" />
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2">Good Against</h4>
                        <div className="flex flex-wrap gap-1">
                          {analysis.metaPosition.goodAgainst.map((matchup, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-green-600 text-green-300">
                              {matchup}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-zinc-200 mb-2">Weak Against</h4>
                        <div className="flex flex-wrap gap-1">
                          {analysis.metaPosition.weakAgainst.map((matchup, index) => (
                            <Badge key={index} variant="outline" className="text-xs border-red-600 text-red-300">
                              {matchup}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
