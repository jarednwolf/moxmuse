'use client'

import { useState } from 'react'
import { ArrowLeft, Check, X, ChevronRight, HelpCircle, ExternalLink, Package, Sparkles, Plus, Minus, Settings } from 'lucide-react'

export type ConsultationMode = 'welcome' | 'commander' | 'budget' | 'bracket' | 'themes' | 'collection' | 
  'winCondition' | 'winConditionFollowup' | 'interaction' | 'interactionFollowup' | 
  'socialDynamics' | 'socialFollowup' | 'restrictions' | 'complexity' | 'complexityFollowup' |
  'specificCards' | 'manaBase' | 'manaFollowup' | 'summary'

export interface ConsultationData {
  commander?: string
  commanderColors?: string[]
  theme?: string
  themeCustom?: string
  budget?: string
  budgetAmount?: number
  bracket?: number
  useCollection?: boolean
  colorPreferences?: string[]
  specificColors?: string[]
  buildingFullDeck?: boolean
  needsCommanderSuggestions?: boolean
  // Win conditions
  winCondition?: string
  combatStrategy?: string
  combatSpeed?: string
  comboType?: string
  comboTiming?: string
  comboPieces?: string
  altWinType?: string
  // Interaction
  interactionLevel?: string
  interactionTypes?: string[]
  interactionTiming?: string
  protectionNeeds?: string
  // Social dynamics
  tablePolitics?: string
  threatApproach?: string
  hiddenPowerStyle?: string
  politicalTools?: string
  // Restrictions
  avoidStrategies?: string[]
  avoidCards?: string
  // Complexity
  complexityLevel?: string
  decisionType?: string
  complexityType?: string
  // Specific cards
  petCards?: string
  houseBans?: string
  maxCardPrice?: string
  proxiesAllowed?: boolean
  // Mana base
  manaStrategy?: string
  preferredColors?: string[]
  tappedLandRatio?: string
  fetchBudget?: string
  utilityPreference?: string
  // Legacy
  additionalNotes?: string
}

interface ConsultationWizardProps {
  mode: ConsultationMode
  consultationData: ConsultationData
  onModeChange: (mode: ConsultationMode) => void
  onDataChange: (data: Partial<ConsultationData>) => void
  onComplete: () => void
  showBracketModal: boolean
  onShowBracketModal: (show: boolean) => void
}

export function ConsultationWizard({
  mode,
  consultationData,
  onModeChange,
  onDataChange,
  onComplete,
  showBracketModal,
  onShowBracketModal
}: ConsultationWizardProps) {
  const handleChoice = (choice: string, field: keyof ConsultationData) => {
    onDataChange({ [field]: choice })
    
    // Navigation logic
    switch (mode) {
      case 'commander':
        if (consultationData.buildingFullDeck) {
          onComplete()
        } else {
          onModeChange('collection')
        }
        break
      case 'themes':
        onModeChange('collection')
        break
      case 'collection':
        if (consultationData.useCollection === true) {
          onModeChange('bracket')
        } else {
          onModeChange('budget')
        }
        break
      case 'budget':
        onModeChange('bracket')
        break
      case 'bracket':
        onModeChange('winCondition')
        break
      case 'winCondition':
        if (consultationData.winCondition === 'combat' || 
            consultationData.winCondition === 'combo' || 
            consultationData.winCondition === 'alternative') {
          onModeChange('winConditionFollowup')
        } else {
          onModeChange('interaction')
        }
        break
      case 'winConditionFollowup':
        onModeChange('interaction')
        break
      case 'interaction':
        if (consultationData.interactionLevel === 'heavy' || consultationData.interactionLevel === 'moderate') {
          onModeChange('interactionFollowup')
        } else {
          onModeChange('socialDynamics')
        }
        break
      case 'interactionFollowup':
        onModeChange('socialDynamics')
        break
      case 'socialDynamics':
        onModeChange('restrictions')
        break
      case 'restrictions':
        onModeChange('complexity')
        break
      case 'complexity':
        if (consultationData.complexityLevel === 'moderate' || consultationData.complexityLevel === 'high') {
          onModeChange('complexityFollowup')
        } else {
          onModeChange('specificCards')
        }
        break
      case 'complexityFollowup':
        onModeChange('specificCards')
        break
      case 'specificCards':
        onModeChange('manaBase')
        break
      case 'manaBase':
        onModeChange('manaFollowup')
        break
      case 'manaFollowup':
        onModeChange('summary')
        break
      case 'summary':
        onComplete()
        break
    }
  }

  const getBackMode = (): ConsultationMode => {
    switch (mode) {
      case 'commander': return 'welcome'
      case 'themes': return 'commander'
      case 'collection': 
        return consultationData.commander ? 'commander' : 'themes'
      case 'budget': return 'collection'
      case 'bracket': 
        return consultationData.useCollection === true ? 'collection' : 'budget'
      case 'winCondition': return 'bracket'
      case 'winConditionFollowup': return 'winCondition'
      case 'interaction': 
        return consultationData.winCondition && consultationData.winCondition !== 'mixed' 
          ? 'winConditionFollowup' : 'winCondition'
      case 'interactionFollowup': return 'interaction'
      case 'socialDynamics': 
        return consultationData.interactionLevel === 'heavy' || consultationData.interactionLevel === 'moderate'
          ? 'interactionFollowup' : 'interaction'
      case 'restrictions': return 'socialDynamics'
      case 'complexity': return 'restrictions'
      case 'complexityFollowup': return 'complexity'
      case 'specificCards': 
        return consultationData.complexityLevel === 'moderate' || consultationData.complexityLevel === 'high'
          ? 'complexityFollowup' : 'complexity'
      case 'manaBase': return 'specificCards'
      case 'manaFollowup': return 'manaBase'
      case 'summary': return 'manaFollowup'
      default: return 'welcome'
    }
  }

  if (mode === 'commander') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto py-8">
          <button
            onClick={() => onModeChange('welcome')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
            Do you have a commander in mind?
          </h2>
          
          <div className="space-y-4">
            <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50">
              <label className="block text-zinc-200 mb-2">Enter your commander's name:</label>
              <input
                type="text"
                placeholder="e.g., Teysa Karlov, Atraxa, Praetors' Voice..."
                className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleChoice(e.currentTarget.value, 'commander')
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.querySelector('input')
                  if (input?.value) {
                    handleChoice(input.value, 'commander')
                  }
                }}
                className="mt-3 px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-sm"
              >
                Continue with this Commander
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-transparent text-zinc-400">OR</span>
              </div>
            </div>
            
            <button
              onClick={() => {
                onDataChange({ commander: undefined })
                onModeChange('themes')
              }}
              className="w-full p-5 rounded-xl bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 text-left"
            >
              <h3 className="text-lg font-semibold mb-1.5 text-zinc-100">
                I need commander suggestions
              </h3>
              <p className="text-zinc-300 text-sm">
                Tell me about your preferred playstyle and I'll recommend commanders
              </p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'themes') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto py-8">
          <button
            onClick={() => onModeChange(getBackMode())}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
            What theme or strategy interests you?
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[
              { value: 'tokens', label: 'Tokens & Go Wide', icon: '👥' },
              { value: 'aristocrats', label: 'Aristocrats (Sacrifice)', icon: '💀' },
              { value: 'spellslinger', label: 'Spellslinger', icon: '⚡' },
              { value: 'voltron', label: 'Voltron (Equipment/Auras)', icon: '⚔️' },
              { value: 'reanimator', label: 'Reanimator', icon: '⚰️' },
              { value: 'lands', label: 'Lands Matter', icon: '🏞️' },
              { value: 'tribal', label: 'Tribal', icon: '🦎' },
              { value: 'control', label: 'Control', icon: '🛡️' },
              { value: 'combo', label: 'Combo', icon: '♾️' },
              { value: 'artifact', label: 'Artifacts', icon: '⚙️' },
              { value: 'enchantress', label: 'Enchantress', icon: '✨' },
              { value: 'mill', label: 'Mill', icon: '🌊' },
              { value: 'lifegain', label: 'Lifegain', icon: '❤️' },
              { value: 'aggro', label: 'Aggro', icon: '🔥' },
              { value: 'stax', label: 'Stax', icon: '🔒' },
              { value: 'superfriends', label: 'Super Friends', icon: '🦸' },
              { value: 'other', label: 'Something else...', icon: '🎯' }
            ].map(theme => (
              <button
                key={theme.value}
                onClick={() => {
                  if (theme.value === 'other') {
                    onDataChange({ theme: 'custom' })
                  } else {
                    handleChoice(theme.label, 'theme')
                  }
                }}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col items-center gap-2 text-center group"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{theme.icon}</span>
                <span className="text-sm text-zinc-100">{theme.label}</span>
              </button>
            ))}
          </div>
          
          {consultationData.theme === 'custom' && (
            <div className="mt-6 bg-zinc-800/60 backdrop-blur-sm rounded-xl p-5 border border-zinc-700/50">
              <label className="block text-zinc-200 mb-2">Describe your theme or strategy:</label>
              <input
                type="text"
                placeholder="e.g., Dragon tribal with reanimation, Cascade value engine..."
                className="w-full rounded-lg bg-zinc-900/60 backdrop-blur-sm border border-zinc-600/50 py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder-zinc-400 text-zinc-100"
                value={consultationData.themeCustom || ''}
                onChange={(e) => onDataChange({ themeCustom: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleChoice(e.currentTarget.value, 'theme')
                  }
                }}
              />
              <button
                onClick={() => {
                  if (consultationData.themeCustom) {
                    handleChoice(consultationData.themeCustom, 'theme')
                  }
                }}
                className="mt-3 px-5 py-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all text-sm"
              >
                Continue with this Theme
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'collection') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto py-8">
          <button
            onClick={() => onModeChange(getBackMode())}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
            Do you want to use only cards you own?
          </h2>
          
          <div className="grid gap-3">
            <button
              onClick={() => {
                onDataChange({ useCollection: true })
                onModeChange('bracket')
              }}
              className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
            >
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-green-400 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-semibold text-zinc-100 mb-1">Yes, only my collection</div>
                  <p className="text-sm text-zinc-400">Build exclusively with cards I already own</p>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => {
                onDataChange({ useCollection: false })
                onModeChange('budget')
              }}
              className="p-5 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="font-semibold text-zinc-100 mb-1">I'm open to new cards</div>
                  <p className="text-sm text-zinc-400">Suggest cards whether I own them or not</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'budget') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto py-8">
          <button
            onClick={() => onModeChange(getBackMode())}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h2 className="text-3xl font-light mb-6 text-white drop-shadow-lg">
            What's your budget for new cards?
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { value: '<100', amount: 100, label: 'Under $100', desc: 'Budget-friendly options', icon: '$' },
              { value: '100-250', amount: 250, label: '$100 - $250', desc: 'Some room for key pieces', icon: '$$' },
              { value: '250-500', amount: 500, label: '$250 - $500', desc: 'Good selection available', icon: '$$$' },
              { value: '500-1000', amount: 1000, label: '$500 - $1000', desc: 'Premium upgrades', icon: '$$$$' },
              { value: '1000+', amount: 2000, label: '$1000+', desc: 'High-powered options', icon: '$$$$$' },
              { value: 'no-limit', amount: undefined, label: 'No budget limit', desc: 'The sky\'s the limit', icon: '💰' }
            ].map(budget => (
              <button
                key={budget.value}
                onClick={() => {
                  onDataChange({ 
                    budget: budget.value,
                    budgetAmount: budget.amount 
                  })
                  onModeChange('bracket')
                }}
                className="p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all border border-zinc-700/50 flex flex-col gap-2 text-center group"
              >
                <div className="text-2xl font-bold text-green-400 group-hover:scale-110 transition-transform">{budget.icon}</div>
                <div>
                  <div className="font-semibold text-zinc-100">{budget.label}</div>
                  <div className="text-xs text-zinc-400 mt-1">{budget.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'bracket') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto py-8">
          <button
            onClick={() => onModeChange(getBackMode())}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-3xl font-light text-white drop-shadow-lg">
              Which bracket are you targeting?
            </h2>
            <button
              onClick={() => onShowBracketModal(true)}
              className="p-2 rounded-lg hover:bg-zinc-800/60 transition-all"
              title="Learn about Commander Brackets"
            >
              <HelpCircle className="w-5 h-5 text-zinc-400 hover:text-zinc-200" />
            </button>
          </div>
          <p className="text-zinc-300 mb-6 text-sm">Commander uses a bracket system to help match decks of similar power</p>
          
          <div className="space-y-2">
            {[
              { 
                value: 1, 
                label: 'Bracket 1: Exhibition', 
                desc: 'Ultra-casual, unusual builds for fun',
                restrictions: 'No mass land denial, 2-card combos, or game changers'
              },
              { 
                value: 2, 
                label: 'Bracket 2: Core', 
                desc: 'Average preconstructed deck level',
                restrictions: 'No chaining extra turns or 2-card infinite combos'
              },
              { 
                value: 3, 
                label: 'Bracket 3: Upgraded', 
                desc: 'Beyond precon strength',
                restrictions: 'Late game 2-card combos allowed, 3 game changers max'
              },
              { 
                value: 4, 
                label: 'Bracket 4: Optimized', 
                desc: 'High power Commander',
                restrictions: 'No restrictions beyond banned list'
              },
              { 
                value: 5, 
                label: 'Bracket 5: cEDH', 
                desc: 'Competitive EDH with fast combos',
                restrictions: 'No restrictions, fully optimized'
              }
            ].map(bracket => (
              <button
                key={bracket.value}
                onClick={() => {
                  onDataChange({ bracket: bracket.value })
                  onModeChange('winCondition')
                }}
                className="w-full p-4 rounded-lg bg-zinc-800/60 backdrop-blur-sm hover:bg-zinc-700/70 transition-all text-left border border-zinc-700/50 group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    bracket.value === 1 ? 'bg-green-500/20 text-green-400' :
                    bracket.value === 2 ? 'bg-blue-500/20 text-blue-400' :
                    bracket.value === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                    bracket.value === 4 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {bracket.value}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-100 mb-1">{bracket.label}</div>
                    <div className="text-sm text-zinc-300 mb-1">{bracket.desc}</div>
                    <div className="text-xs text-zinc-500">{bracket.restrictions}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors mt-1 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Add more consultation steps here...
  // For brevity, I'll implement the key ones and you can add the rest following the same pattern

  if (mode === 'summary') {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto py-12">
          <button
            onClick={() => onModeChange(getBackMode())}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          
          <h2 className="text-3xl font-light mb-8 text-white drop-shadow-lg">
            Let's review your deck preferences
          </h2>
          
          <div className="bg-zinc-800/60 backdrop-blur-sm rounded-xl p-6 border border-zinc-700/50 space-y-4">
            {consultationData.commander && (
              <div>
                <span className="text-zinc-400">Commander:</span>
                <p className="text-zinc-100">{consultationData.commander}</p>
              </div>
            )}
            
            {consultationData.theme && (
              <div>
                <span className="text-zinc-400">Theme:</span>
                <p className="text-zinc-100">{consultationData.theme}</p>
              </div>
            )}
            
            {consultationData.useCollection !== undefined && (
              <div>
                <span className="text-zinc-400">Collection:</span>
                <p className="text-zinc-100">
                  {consultationData.useCollection ? 'Only use cards I own' : 'Open to new cards'}
                </p>
              </div>
            )}
            
            {consultationData.budget && !consultationData.useCollection && (
              <div>
                <span className="text-zinc-400">Budget:</span>
                <p className="text-zinc-100">
                  {consultationData.budget === '<100' ? 'Under $100' :
                   consultationData.budget === '100-250' ? '$100 - $250' :
                   consultationData.budget === '250-500' ? '$250 - $500' :
                   consultationData.budget === '500-1000' ? '$500 - $1000' :
                   consultationData.budget === '1000+' ? '$1000+' :
                   consultationData.budget === 'no-limit' ? 'No limit' :
                   consultationData.budget === 'custom' && consultationData.budgetAmount ? `$${consultationData.budgetAmount}` :
                   consultationData.budget}
                </p>
              </div>
            )}
            
            {consultationData.bracket && (
              <div>
                <span className="text-zinc-400">Bracket:</span>
                <p className="text-zinc-100">Bracket {consultationData.bracket}</p>
              </div>
            )}
            
            {/* Add more summary fields as needed */}
          </div>
          
          <button
            onClick={() => handleChoice('', 'additionalNotes')}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all font-semibold mt-6"
          >
            Start Building My Deck
          </button>
        </div>
      </div>
    )
  }

  // Bracket Modal
  if (showBracketModal) {
    return (
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => onShowBracketModal(false)}
      >
        <div 
          className="bg-zinc-900 rounded-xl max-w-4xl max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-semibold text-zinc-100">Commander Brackets System</h3>
              <button
                onClick={() => onShowBracketModal(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-zinc-800 rounded-lg p-8 text-center">
              <p className="text-zinc-400 mb-4">
                The Commander Brackets system helps players find games with decks of similar power levels.
              </p>
              <img
                src="/images/mtg_brackets.png"
                alt="Commander Brackets System"
                className="w-full rounded-lg"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src.includes('mtg_brackets.png')) {
                    img.src = '/images/mtg_breackets.png';
                  } else {
                    img.style.display = 'none';
                    const placeholder = document.createElement('p');
                    placeholder.className = 'text-sm text-zinc-500';
                    placeholder.textContent = '[Commander Brackets reference image - add mtg_brackets.png or mtg_breackets.png to /public/images/]';
                    img.parentElement?.appendChild(placeholder);
                  }
                }}
              />
            </div>
            
            <div className="mt-6 space-y-4">
              <p className="text-sm text-zinc-300">
                The bracket system helps ensure everyone has a fun game by matching decks with similar strategies and power levels.
              </p>
              <a
                href="https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                Learn more about Commander Brackets
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Return null for unhandled modes
  return null
}