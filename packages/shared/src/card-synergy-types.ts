import { z } from 'zod'

// Core synergy detection types
export const CardSynergySchema = z.object({
  cardA: z.string(),
  cardB: z.string(),
  synergyType: z.enum(['combo', 'support', 'engine', 'protection', 'enabler', 'alternative', 'upgrade']),
  strength: z.number().min(1).max(10),
  description: z.string(),
  explanation: z.string(),
  researchSources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  contextTags: z.array(z.string()).optional(),
})

export type CardSynergy = z.infer<typeof CardSynergySchema>

export const RelatedCardSchema = z.object({
  cardId: z.string(),
  cardName: z.string(),
  relationship: z.enum(['synergy', 'alternative', 'upgrade', 'combo', 'support']),
  strength: z.number().min(1).max(10),
  explanation: z.string(),
  priceComparison: z.object({
    currentCard: z.number().optional(),
    relatedCard: z.number().optional(),
    budgetFriendly: z.boolean(),
  }).optional(),
  researchBacking: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export type RelatedCard = z.infer<typeof RelatedCardSchema>

export const ComboDetectionSchema = z.object({
  cards: z.array(z.string()),
  comboName: z.string(),
  description: z.string(),
  setupSteps: z.array(z.string()),
  winCondition: z.boolean(),
  manaRequired: z.number().optional(),
  turnsToSetup: z.number().optional(),
  interruptionPoints: z.array(z.string()),
  counterplay: z.array(z.string()),
  researchSources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export type ComboDetection = z.infer<typeof ComboDetectionSchema>

export const UpgradePathSchema = z.object({
  currentCard: z.string(),
  upgrades: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    upgradeType: z.enum(['direct', 'functional', 'power_level', 'budget']),
    improvementAreas: z.array(z.string()),
    priceIncrease: z.number().optional(),
    reasoning: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    budgetTier: z.enum(['budget', 'mid', 'high', 'premium']),
    researchBacking: z.array(z.string()),
  })),
  budgetConsiderations: z.object({
    totalUpgradeCost: z.number().optional(),
    budgetAlternatives: z.array(z.string()),
    costEffectiveUpgrades: z.array(z.string()),
  }),
})

export type UpgradePath = z.infer<typeof UpgradePathSchema>

export const SynergyAnalysisRequestSchema = z.object({
  cards: z.array(z.object({
    cardId: z.string(),
    cardName: z.string(),
    quantity: z.number(),
    category: z.string().optional(),
    cmc: z.number().optional(),
    types: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
  })),
  commander: z.string(),
  strategy: z.string().optional(),
  format: z.enum(['commander', 'standard', 'modern', 'legacy']).default('commander'),
  analysisDepth: z.enum(['shallow', 'moderate', 'deep']).default('moderate'),
  budgetConstraints: z.object({
    maxBudget: z.number().optional(),
    ownedCards: z.array(z.string()).optional(),
    prioritizeBudget: z.boolean().default(false),
  }).optional(),
  userId: z.string().optional(),
})

export type SynergyAnalysisRequest = z.infer<typeof SynergyAnalysisRequestSchema>

export const ComprehensiveSynergyAnalysisSchema = z.object({
  cardSynergies: z.array(CardSynergySchema),
  relatedCardSuggestions: z.array(RelatedCardSchema),
  comboDetections: z.array(ComboDetectionSchema),
  upgradePaths: z.array(UpgradePathSchema),
  synergyScore: z.number().min(0).max(10),
  analysisMetadata: z.object({
    analysisDepth: z.string(),
    confidenceScore: z.number().min(0).max(1),
    researchSources: z.array(z.string()),
    analysisTimestamp: z.date(),
    modelVersion: z.string(),
  }),
})

export type ComprehensiveSynergyAnalysis = z.infer<typeof ComprehensiveSynergyAnalysisSchema>

// UI-specific types
export interface SynergyDisplayProps {
  synergy: CardSynergy
  onCardClick?: (cardName: string) => void
  showDetails?: boolean
  compact?: boolean
}

export interface RelatedCardDisplayProps {
  relatedCard: RelatedCard
  onAddCard?: (cardName: string) => void
  onViewCard?: (cardName: string) => void
  showPricing?: boolean
}

export interface ComboDisplayProps {
  combo: ComboDetection
  onCardClick?: (cardName: string) => void
  expanded?: boolean
  onToggleExpanded?: () => void
}

export interface UpgradeDisplayProps {
  upgradePath: UpgradePath
  onSelectUpgrade?: (cardName: string) => void
  onViewCard?: (cardName: string) => void
  budgetMode?: boolean
}

export interface SynergyAnalysisDisplayProps {
  analysis: ComprehensiveSynergyAnalysis
  onCardClick?: (cardName: string) => void
  onAddCard?: (cardName: string) => void
  onSelectUpgrade?: (cardName: string) => void
  compact?: boolean
  sections?: {
    synergies?: boolean
    relatedCards?: boolean
    combos?: boolean
    upgrades?: boolean
  }
}

// Filter and sorting types
export interface SynergyFilters {
  synergyTypes?: CardSynergy['synergyType'][]
  minStrength?: number
  maxStrength?: number
  minConfidence?: number
  relationships?: RelatedCard['relationship'][]
  budgetFriendlyOnly?: boolean
  winConditionsOnly?: boolean
  upgradeTypes?: UpgradePath['upgrades'][0]['upgradeType'][]
  budgetTiers?: UpgradePath['upgrades'][0]['budgetTier'][]
}

export interface SynergySortOptions {
  field: 'strength' | 'confidence' | 'name' | 'price'
  direction: 'asc' | 'desc'
}

// Analysis state types
export interface SynergyAnalysisState {
  isLoading: boolean
  analysis: ComprehensiveSynergyAnalysis | null
  error: string | null
  filters: SynergyFilters
  sortOptions: SynergySortOptions
  selectedCards: Set<string>
  expandedCombos: Set<string>
}

// Feedback types
export interface SynergyFeedback {
  suggestionId: string
  deckId?: string
  feedback: 'accepted' | 'rejected' | 'modified' | 'ignored'
  reason?: string
  alternativeChosen?: string
  satisfactionRating?: number
  context?: Record<string, any>
}

// Statistics types
export interface SynergyStats {
  feedbackSummary: Record<string, number>
  recentAnalyses: number
  totalFeedback: number
  acceptanceRate: number
}

// Utility functions
export const getSynergyTypeColor = (type: CardSynergy['synergyType']): string => {
  const colors = {
    combo: '#ef4444', // red
    support: '#3b82f6', // blue
    engine: '#8b5cf6', // purple
    protection: '#10b981', // green
    enabler: '#f59e0b', // amber
    alternative: '#6b7280', // gray
    upgrade: '#ec4899', // pink
  }
  return colors[type] || colors.support
}

export const getRelationshipIcon = (relationship: RelatedCard['relationship']): string => {
  const icons = {
    synergy: '🔗',
    alternative: '↔️',
    upgrade: '⬆️',
    combo: '⚡',
    support: '🛡️',
  }
  return icons[relationship] || icons.synergy
}

export const getUpgradeTypeIcon = (type: UpgradePath['upgrades'][0]['upgradeType']): string => {
  const icons = {
    direct: '➡️',
    functional: '🔄',
    power_level: '⚡',
    budget: '💰',
  }
  return icons[type] || icons.functional
}

export const getBudgetTierColor = (tier: UpgradePath['upgrades'][0]['budgetTier']): string => {
  const colors = {
    budget: '#10b981', // green
    mid: '#f59e0b', // amber
    high: '#ef4444', // red
    premium: '#8b5cf6', // purple
  }
  return colors[tier] || colors.mid
}

export const formatSynergyStrength = (strength: number): string => {
  if (strength >= 9) return 'Exceptional'
  if (strength >= 7) return 'Strong'
  if (strength >= 5) return 'Moderate'
  if (strength >= 3) return 'Weak'
  return 'Minimal'
}

export const formatConfidence = (confidence: number): string => {
  if (confidence >= 0.9) return 'Very High'
  if (confidence >= 0.7) return 'High'
  if (confidence >= 0.5) return 'Medium'
  if (confidence >= 0.3) return 'Low'
  return 'Very Low'
}

// Validation helpers
export const validateSynergyAnalysisRequest = (request: unknown): SynergyAnalysisRequest => {
  return SynergyAnalysisRequestSchema.parse(request)
}

export const validateCardSynergy = (synergy: unknown): CardSynergy => {
  return CardSynergySchema.parse(synergy)
}

export const validateRelatedCard = (card: unknown): RelatedCard => {
  return RelatedCardSchema.parse(card)
}

export const validateComboDetection = (combo: unknown): ComboDetection => {
  return ComboDetectionSchema.parse(combo)
}

export const validateUpgradePath = (path: unknown): UpgradePath => {
  return UpgradePathSchema.parse(path)
}

export const validateComprehensiveSynergyAnalysis = (analysis: unknown): ComprehensiveSynergyAnalysis => {
  return ComprehensiveSynergyAnalysisSchema.parse(analysis)
}

console.log('🔗 Card Synergy Types initialized')
console.log('Available types:')
console.log('  📊 CardSynergy - Individual card synergy data')
console.log('  💡 RelatedCard - Related card suggestions')
console.log('  ⚡ ComboDetection - Combo analysis results')
console.log('  📈 UpgradePath - Upgrade recommendations')
console.log('  🎯 ComprehensiveSynergyAnalysis - Complete analysis')
console.log('  🎨 UI Display Props - Component interfaces')
console.log('  🔍 Filters and Sorting - Analysis customization')
console.log('  📝 Feedback Types - User interaction tracking')