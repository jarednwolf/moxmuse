'use client'

import React, { useState, useMemo } from 'react'
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield,
  Coins,
  Clock,
  Users,
  Star,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileCard, MobileTabs, MobileSheet } from '../ui/mobile-optimized'
import { AccessibleHeading } from '../ui/accessibility'

interface DeckCard {
  id: string
  name: string
  manaCost: string
  cmc: number
  types: string[]
  colors: string[]
  price?: number
  category?: 'ramp' | 'draw' | 'removal' | 'threat' | 'utility' | 'land'
}

interface DeckStatistics {
  totalCards: number
  averageCmc: number
  totalPrice: number
  colorDistribution: Record<string, number>
  typeDistribution: Record<string, number>
  categoryDistribution: Record<string, number>
  manaCurve: Record<number, number>
  priceDistribution: {
    budget: number // < $5
    moderate: number // $5-20
    expensive: number // > $20
  }
}

interface MobileStatisticsProps {
  cards: DeckCard[]
  className?: string
}

export function MobileStatistics({ cards, className }: MobileStatisticsProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']))
  const [showDetails, setShowDetails] = useState(false)
  const [selectedChart, setSelectedChart] = useState<string | null>(null)
  
  // Calculate statistics
  const statistics = useMemo((): DeckStatistics => {
    const totalCards = cards.length
    const totalCmc = cards.reduce((sum, card) => sum + card.cmc, 0)
    const averageCmc = totalCards > 0 ? totalCmc / totalCards : 0
    const totalPrice = cards.reduce((sum, card) => sum + (card.price || 0), 0)
    
    // Color distribution
    const colorDistribution: Record<string, number> = {}
    cards.forEach(card => {
      card.colors.forEach(color => {
        colorDistribution[color] = (colorDistribution[color] || 0) + 1
      })
    })
    
    // Type distribution
    const typeDistribution: Record<string, number> = {}
    cards.forEach(card => {
      card.types.forEach(type => {
        typeDistribution[type] = (typeDistribution[type] || 0) + 1
      })
    })
    
    // Category distribution
    const categoryDistribution: Record<string, number> = {}
    cards.forEach(card => {
      if (card.category) {
        categoryDistribution[card.category] = (categoryDistribution[card.category] || 0) + 1
      }
    })
    
    // Mana curve
    const manaCurve: Record<number, number> = {}
    cards.forEach(card => {
      const cmc = Math.min(card.cmc, 7) // Cap at 7+ for display
      manaCurve[cmc] = (manaCurve[cmc] || 0) + 1
    })
    
    // Price distribution
    const priceDistribution = {
      budget: cards.filter(card => (card.price || 0) < 5).length,
      moderate: cards.filter(card => (card.price || 0) >= 5 && (card.price || 0) <= 20).length,
      expensive: cards.filter(card => (card.price || 0) > 20).length
    }
    
    return {
      totalCards,
      averageCmc,
      totalPrice,
      colorDistribution,
      typeDistribution,
      categoryDistribution,
      manaCurve,
      priceDistribution
    }
  }, [cards])
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }
  
  // Color mapping for charts
  const colorMap = {
    W: { name: 'White', color: '#FFFBD5', icon: '☀️' },
    U: { name: 'Blue', color: '#0E68AB', icon: '💧' },
    B: { name: 'Black', color: '#150B00', icon: '💀' },
    R: { name: 'Red', color: '#D3202A', icon: '🔥' },
    G: { name: 'Green', color: '#00733E', icon: '🌿' },
    C: { name: 'Colorless', color: '#CAC5C0', icon: '⚪' }
  }
  
  const categoryMap = {
    ramp: { name: 'Ramp', color: '#10B981', icon: '🚀' },
    draw: { name: 'Card Draw', color: '#3B82F6', icon: '📚' },
    removal: { name: 'Removal', color: '#EF4444', icon: '💥' },
    threat: { name: 'Threats', color: '#F59E0B', icon: '⚔️' },
    utility: { name: 'Utility', color: '#8B5CF6', icon: '🔧' },
    land: { name: 'Lands', color: '#6B7280', icon: '🏞️' }
  }
  
  // Mobile-optimized bar chart component
  const MobileBarChart = ({ data, title, colorKey }: { 
    data: Record<string, number>
    title: string
    colorKey?: 'color' | 'category'
  }) => {
    const maxValue = Math.max(...Object.values(data))
    const entries = Object.entries(data).sort(([,a], [,b]) => b - a)
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          {title}
        </h4>
        <div className="space-y-2">
          {entries.map(([key, value]) => {
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
            const colorInfo = colorKey === 'color' ? colorMap[key as keyof typeof colorMap] : 
                             colorKey === 'category' ? categoryMap[key as keyof typeof categoryMap] : null
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-300">
                    {colorInfo?.icon}
                    {colorInfo?.name || key}
                  </span>
                  <span className="text-zinc-400">{value}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: colorInfo?.color || '#3B82F6'
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  
  // Mobile-optimized pie chart component (using CSS)
  const MobilePieChart = ({ data, title, colorKey }: { 
    data: Record<string, number>
    title: string
    colorKey?: 'color' | 'category'
  }) => {
    const total = Object.values(data).reduce((sum, value) => sum + value, 0)
    const entries = Object.entries(data).sort(([,a], [,b]) => b - a)
    
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <PieChart className="w-4 h-4" />
          {title}
        </h4>
        
        {/* Simple donut chart using CSS */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-zinc-800"></div>
            {/* This would be enhanced with a proper chart library in production */}
            <div className="absolute inset-4 rounded-full bg-zinc-900 flex items-center justify-center">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{total}</div>
                <div className="text-xs text-zinc-400">cards</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {entries.map(([key, value]) => {
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
            const colorInfo = colorKey === 'color' ? colorMap[key as keyof typeof colorMap] : 
                             colorKey === 'category' ? categoryMap[key as keyof typeof categoryMap] : null
            
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorInfo?.color || '#3B82F6' }}
                />
                <span className="text-zinc-300 truncate">
                  {colorInfo?.name || key}
                </span>
                <span className="text-zinc-400 ml-auto">
                  {percentage}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  
  // Mana curve chart
  const ManaCurveChart = () => {
    const maxValue = Math.max(...Object.values(statistics.manaCurve))
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Mana Curve
        </h4>
        <div className="flex items-end justify-between gap-1 h-24">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => {
            const count = statistics.manaCurve[cmc] || 0
            const height = maxValue > 0 ? (count / maxValue) * 100 : 0
            
            return (
              <div key={cmc} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-xs text-zinc-400">{count}</div>
                <div 
                  className="w-full bg-blue-500 rounded-t transition-all duration-500"
                  style={{ height: `${height}%` }}
                />
                <div className="text-xs text-zinc-300">
                  {cmc === 7 ? '7+' : cmc}
                </div>
              </div>
            )
          })}
        </div>
        <div className="text-center text-xs text-zinc-400">
          Average CMC: {statistics.averageCmc.toFixed(1)}
        </div>
      </div>
    )
  }
  
  // Key metrics cards
  const MetricCard = ({ icon, label, value, subtitle, color = 'blue' }: {
    icon: React.ReactNode
    label: string
    value: string | number
    subtitle?: string
    color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  }) => {
    const colorClasses = {
      blue: 'bg-blue-500/20 text-blue-400',
      green: 'bg-green-500/20 text-green-400',
      yellow: 'bg-yellow-500/20 text-yellow-400',
      red: 'bg-red-500/20 text-red-400',
      purple: 'bg-purple-500/20 text-purple-400'
    }
    
    return (
      <MobileCard padding="md" className="text-center">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2', colorClasses[color])}>
          {icon}
        </div>
        <div className="text-lg font-bold text-white">{value}</div>
        <div className="text-sm text-zinc-300">{label}</div>
        {subtitle && <div className="text-xs text-zinc-400 mt-1">{subtitle}</div>}
      </MobileCard>
    )
  }
  
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={<Target className="w-5 h-5" />}
              label="Total Cards"
              value={statistics.totalCards}
              color="blue"
            />
            <MetricCard
              icon={<Zap className="w-5 h-5" />}
              label="Avg CMC"
              value={statistics.averageCmc.toFixed(1)}
              color="yellow"
            />
            <MetricCard
              icon={<Coins className="w-5 h-5" />}
              label="Total Price"
              value={`$${statistics.totalPrice.toFixed(0)}`}
              color="green"
            />
            <MetricCard
              icon={<Star className="w-5 h-5" />}
              label="Avg Price"
              value={`$${(statistics.totalPrice / Math.max(statistics.totalCards, 1)).toFixed(1)}`}
              subtitle="per card"
              color="purple"
            />
          </div>
          
          {/* Mana curve */}
          <MobileCard padding="lg">
            <ManaCurveChart />
          </MobileCard>
          
          {/* Quick insights */}
          <MobileCard padding="lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Quick Insights
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Most expensive card:</span>
                <span className="text-zinc-200">
                  ${Math.max(...cards.map(c => c.price || 0)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Budget cards (&lt;$5):</span>
                <span className="text-zinc-200">
                  {statistics.priceDistribution.budget} ({((statistics.priceDistribution.budget / Math.max(statistics.totalCards, 1)) * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Highest CMC:</span>
                <span className="text-zinc-200">
                  {Math.max(...cards.map(c => c.cmc))}
                </span>
              </div>
            </div>
          </MobileCard>
        </div>
      )
    },
    {
      id: 'colors',
      label: 'Colors',
      content: (
        <div className="space-y-6">
          <MobileCard padding="lg">
            <MobileBarChart 
              data={statistics.colorDistribution} 
              title="Color Distribution"
              colorKey="color"
            />
          </MobileCard>
          
          <MobileCard padding="lg">
            <MobilePieChart 
              data={statistics.colorDistribution} 
              title="Color Breakdown"
              colorKey="color"
            />
          </MobileCard>
        </div>
      )
    },
    {
      id: 'types',
      label: 'Types',
      content: (
        <div className="space-y-6">
          <MobileCard padding="lg">
            <MobileBarChart 
              data={statistics.typeDistribution} 
              title="Card Types"
            />
          </MobileCard>
          
          {Object.keys(statistics.categoryDistribution).length > 0 && (
            <MobileCard padding="lg">
              <MobileBarChart 
                data={statistics.categoryDistribution} 
                title="Deck Categories"
                colorKey="category"
              />
            </MobileCard>
          )}
        </div>
      )
    },
    {
      id: 'budget',
      label: 'Budget',
      content: (
        <div className="space-y-6">
          {/* Price distribution */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={<Coins className="w-5 h-5" />}
              label="Budget"
              value={statistics.priceDistribution.budget}
              subtitle="< $5"
              color="green"
            />
            <MetricCard
              icon={<Coins className="w-5 h-5" />}
              label="Moderate"
              value={statistics.priceDistribution.moderate}
              subtitle="$5-20"
              color="yellow"
            />
            <MetricCard
              icon={<Coins className="w-5 h-5" />}
              label="Expensive"
              value={statistics.priceDistribution.expensive}
              subtitle="> $20"
              color="red"
            />
          </div>
          
          <MobileCard padding="lg">
            <MobilePieChart 
              data={{
                'Budget (<$5)': statistics.priceDistribution.budget,
                'Moderate ($5-20)': statistics.priceDistribution.moderate,
                'Expensive (>$20)': statistics.priceDistribution.expensive
              }} 
              title="Price Distribution"
            />
          </MobileCard>
          
          {/* Most expensive cards */}
          <MobileCard padding="lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">Most Expensive Cards</h4>
            <div className="space-y-2">
              {cards
                .sort((a, b) => (b.price || 0) - (a.price || 0))
                .slice(0, 5)
                .map(card => (
                  <div key={card.id} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-300 truncate">{card.name}</span>
                    <span className="text-zinc-400 ml-2">${(card.price || 0).toFixed(2)}</span>
                  </div>
                ))}
            </div>
          </MobileCard>
        </div>
      )
    }
  ]
  
  return (
    <div className={cn('w-full', className)}>
      <MobileTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scrollable
      />
    </div>
  )
}