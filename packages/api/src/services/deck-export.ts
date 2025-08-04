import { GeneratedDeck, ScryfallCard } from '@moxmuse/shared'
import { scryfallService } from './scryfall'

export interface DeckCardWithData {
  cardId: string
  quantity: number
  category: string
  role: string | null
  reasoning: string | null
  alternatives?: string[]
  upgradeOptions?: string[]
  budgetOptions?: string[]
  cardData?: ScryfallCard | null
}

export interface ExportResult {
  format: string
  data: string | object
  filename: string
  mimeType: string
}

export interface ImportResult {
  success: boolean
  deck?: {
    name: string
    commander?: string
    format: string
    cards: ImportedCard[]
    metadata?: Record<string, any>
  }
  errors: string[]
  warnings: string[]
}

export interface ImportedCard {
  name: string
  quantity: number
  category?: string
  cardId?: string
  cardData?: ScryfallCard
}

export interface EnhancedExportOptions {
  includeAIInsights: boolean
  includeAnalysis: boolean
  includePricing: boolean
  includeAlternatives: boolean
  includeUpgradePaths: boolean
  format: 'text' | 'json' | 'moxfield' | 'archidekt' | 'edhrec' | 'mtggoldfish' | 'csv'
  compression?: 'none' | 'zip'
  metadata?: Record<string, any>
}

export interface ShareableLinkOptions {
  includeAnalysis: boolean
  includeStrategy: boolean
  includePricing: boolean
  expirationDays?: number
  password?: string
  allowComments: boolean
}

/**
 * Generate text export with proper categorization
 */
export function generateTextExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  let output = `${deck.name}\n`
  output += `Commander: ${deck.commander}\n`
  output += `Format: ${deck.format.toUpperCase()}\n`
  output += `Power Level: ${deck.powerLevel || 'N/A'}\n`
  if (deck.estimatedBudget) {
    output += `Estimated Budget: $${deck.estimatedBudget.toFixed(2)}\n`
  }
  output += `Generated: ${new Date(deck.createdAt).toLocaleDateString()}\n\n`

  // Add strategy information
  if (deck.strategy) {
    output += `STRATEGY\n`
    output += `${deck.strategy.description || 'AI-generated deck strategy'}\n\n`
  }

  // Group cards by category
  const categories = new Map<string, DeckCardWithData[]>()
  
  for (const card of cardDetails) {
    const category = card.category || 'Other'
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)!.push(card)
  }

  // Sort categories by typical deck order
  const categoryOrder = [
    'Commander',
    'Creatures', 
    'Planeswalkers',
    'Instants',
    'Sorceries', 
    'Artifacts',
    'Enchantments',
    'Lands',
    'Ramp',
    'Draw',
    'Removal',
    'Protection',
    'Win Conditions',
    'Utility',
    'Other'
  ]

  // Output cards by category in order
  for (const categoryName of categoryOrder) {
    const cards = categories.get(categoryName)
    if (!cards || cards.length === 0) continue

    const totalInCategory = cards.reduce((sum, card) => sum + card.quantity, 0)
    output += `${categoryName.toUpperCase()} (${totalInCategory})\n`
    
    // Sort cards alphabetically within category
    cards.sort((a, b) => {
      const nameA = a.cardData?.name || 'Unknown Card'
      const nameB = b.cardData?.name || 'Unknown Card'
      return nameA.localeCompare(nameB)
    })
    
    for (const card of cards) {
      const quantity = card.quantity > 1 ? `${card.quantity}x ` : ''
      const name = card.cardData?.name || 'Unknown Card'
      output += `${quantity}${name}\n`
    }
    output += '\n'
    categories.delete(categoryName)
  }

  // Add any remaining categories not in the standard order
  for (const [categoryName, cards] of Array.from(categories.entries())) {
    const totalInCategory = cards.reduce((sum: number, card: DeckCardWithData) => sum + card.quantity, 0)
    output += `${categoryName.toUpperCase()} (${totalInCategory})\n`
    
    cards.sort((a: DeckCardWithData, b: DeckCardWithData) => {
      const nameA = a.cardData?.name || 'Unknown Card'
      const nameB = b.cardData?.name || 'Unknown Card'
      return nameA.localeCompare(nameB)
    })
    
    for (const card of cards) {
      const quantity = card.quantity > 1 ? `${card.quantity}x ` : ''
      const name = card.cardData?.name || 'Unknown Card'
      output += `${quantity}${name}\n`
    }
    output += '\n'
  }

  // Add deck statistics if available
  if (deck.statistics) {
    output += `STATISTICS\n`
    output += `Total Cards: ${deck.statistics.landCount + deck.statistics.nonlandCount}\n`
    output += `Lands: ${deck.statistics.landCount}\n`
    output += `Nonlands: ${deck.statistics.nonlandCount}\n`
    output += `Average CMC: ${deck.statistics.averageCMC.toFixed(2)}\n`
    if (deck.statistics.totalValue) {
      output += `Total Value: $${deck.statistics.totalValue.toFixed(2)}\n`
    }
    output += '\n'
  }

  // Add AI insights
  if (deck.weaknesses && deck.weaknesses.length > 0) {
    output += `POTENTIAL WEAKNESSES\n`
    deck.weaknesses.forEach((weakness: string) => {
      output += `• ${weakness}\n`
    })
    output += '\n'
  }

  return {
    format: 'text',
    data: output,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
    mimeType: 'text/plain'
  }
}

/**
 * Generate JSON export with full metadata and analysis
 */
export function generateJSONExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  const exportData = {
    metadata: {
      name: deck.name,
      commander: deck.commander,
      format: deck.format,
      powerLevel: deck.powerLevel,
      estimatedBudget: deck.estimatedBudget,
      generatedAt: deck.createdAt,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    },
    strategy: deck.strategy || {},
    winConditions: deck.winConditions || [],
    consultationData: deck.consultationData || {},
    cards: cardDetails.map(card => ({
      cardId: card.cardId,
      name: card.cardData?.name || 'Unknown Card',
      quantity: card.quantity,
      category: card.category,
      role: card.role || 'support',
      reasoning: card.reasoning || 'AI-generated card selection',
      alternatives: card.alternatives || [],
      upgradeOptions: card.upgradeOptions || [],
      budgetOptions: card.budgetOptions || [],
      cardData: card.cardData ? {
        name: card.cardData.name,
        mana_cost: card.cardData.mana_cost,
        cmc: card.cardData.cmc,
        type_line: card.cardData.type_line,
        oracle_text: card.cardData.oracle_text,
        colors: card.cardData.colors,
        color_identity: card.cardData.color_identity,
        set: card.cardData.set,
        set_name: card.cardData.set_name,
        rarity: card.cardData.rarity,
        prices: card.cardData.prices,
        image_uris: card.cardData.image_uris
      } : null
    })),
    statistics: deck.statistics || {},
    synergies: deck.synergies || [],
    weaknesses: deck.weaknesses || [],
    analysis: deck.analysis ? {
      strategyDescription: deck.analysis.strategyDescription,
      winConditionAnalysis: deck.analysis.winConditionAnalysis,
      playPatternDescription: deck.analysis.playPatternDescription
    } : null
  }

  return {
    format: 'json',
    data: exportData,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`,
    mimeType: 'application/json'
  }
}

/**
 * Generate Moxfield-compatible export format
 */
export function generateMoxfieldExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  const moxfieldData = {
    name: deck.name,
    description: deck.strategy?.description || 'AI-generated deck',
    format: 'commander',
    visibility: 'public',
    publicUrl: '',
    publicId: '',
    likeCount: 0,
    viewCount: 0,
    commentCount: 0,
    areCommentsEnabled: true,
    createdByUser: {
      userName: 'DeckForge',
      displayName: 'DeckForge AI'
    },
    createdAtUtc: deck.createdAt,
    lastUpdatedAtUtc: new Date().toISOString(),
    mainboard: {} as Record<string, any>,
    sideboard: {} as Record<string, any>,
    maybeboard: {} as Record<string, any>,
    commanders: {} as Record<string, any>,
    hubs: [],
    tokens: []
  }

  // Process cards into Moxfield format
  for (const card of cardDetails) {
    if (!card.cardData) continue

    const moxfieldCard = {
      quantity: card.quantity,
      boardType: card.cardId === deck.commander ? 'commanders' : 'mainboard',
      finish: 'Normal',
      isAlter: false,
      isProxy: false,
      card: {
        id: card.cardData.id,
        uniqueCardId: card.cardData.id,
        scryfall_id: card.cardData.id,
        set: card.cardData.set,
        set_name: card.cardData.set_name,
        name: card.cardData.name,
        cn: card.cardData.collector_number,
        layout: 'normal',
        cmc: card.cardData.cmc,
        type: card.cardData.type_line,
        type_line: card.cardData.type_line,
        oracle_text: card.cardData.oracle_text,
        mana_cost: card.cardData.mana_cost,
        colors: card.cardData.colors,
        color_identity: card.cardData.color_identity,
        legalities: card.cardData.legalities,
        frame: '2015',
        reserved: false,
        digital: false,
        foil: false,
        nonfoil: true,
        oversized: false,
        promo: false,
        reprint: false,
        variation: false,
        set_id: card.cardData.set,
        set_type: 'expansion',
        rarity: card.cardData.rarity,
        flavor_text: '',
        artist: '',
        border_color: 'black',
        frame_effects: [],
        full_art: false,
        story_spotlight: false,
        prices: card.cardData.prices,
        related_uris: {},
        purchase_uris: {},
        image_uris: card.cardData.image_uris
      }
    }

    if (card.cardId === deck.commander) {
      moxfieldData.commanders[card.cardData.id] = moxfieldCard
    } else {
      moxfieldData.mainboard[card.cardData.id] = moxfieldCard
    }
  }

  return {
    format: 'moxfield',
    data: moxfieldData,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_moxfield.json`,
    mimeType: 'application/json'
  }
}

/**
 * Generate Archidekt-compatible export format
 */
export function generateArchidektExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  const archidektData = {
    name: deck.name,
    description: deck.strategy?.description || 'AI-generated deck',
    format: 1, // Commander format ID in Archidekt
    featured: '',
    private: false,
    featuredCard: deck.commander,
    cards: [] as any[],
    categories: [] as any[]
  }

  // Create categories map
  const categoriesMap = new Map<string, number>()
  let categoryId = 1

  // Process cards
  for (const card of cardDetails) {
    if (!card.cardData) continue

    // Get or create category
    let categoryIdForCard = categoriesMap.get(card.category)
    if (!categoryIdForCard) {
      categoryIdForCard = categoryId++
      categoriesMap.set(card.category, categoryIdForCard)
      archidektData.categories.push({
        id: categoryIdForCard,
        name: card.category,
        includedInDeck: true,
        includedInPrice: true,
        isPremier: false
      })
    }

    archidektData.cards.push({
      id: card.cardData.id,
      qty: card.quantity,
      categories: [categoryIdForCard],
      label: '',
      modifier: '',
      card: {
        id: card.cardData.id,
        oracleCard: {
          id: card.cardData.id,
          name: card.cardData.name,
          layout: 'normal',
          cmc: card.cardData.cmc,
          colors: card.cardData.colors,
          colorIdentity: card.cardData.color_identity,
          type: card.cardData.type_line,
          supertypes: [],
          types: card.cardData.type_line.split(' — ')[0].split(' '),
          subtypes: card.cardData.type_line.includes(' — ') 
            ? card.cardData.type_line.split(' — ')[1].split(' ')
            : [],
          text: card.cardData.oracle_text,
          power: null,
          toughness: null,
          loyalty: null,
          manaCost: card.cardData.mana_cost,
          legalities: Object.entries(card.cardData.legalities).map(([format, legality]) => ({
            format,
            legality
          }))
        },
        set: card.cardData.set,
        setName: card.cardData.set_name,
        collectorNumber: card.cardData.collector_number,
        rarity: card.cardData.rarity,
        lang: 'en',
        finish: 'nonfoil',
        imageUrl: card.cardData.image_uris?.normal || '',
        price: parseFloat(card.cardData.prices?.usd || '0')
      }
    })
  }

  return {
    format: 'archidekt',
    data: archidektData,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_archidekt.json`,
    mimeType: 'application/json'
  }
}

/**
 * Generate shareable deck link data
 */
export function generateShareableLink(deck: any, cardDetails: DeckCardWithData[]): {
  url: string
  embedData: object
} {
  const embedData = {
    name: deck.name,
    commander: deck.commander,
    format: deck.format,
    powerLevel: deck.powerLevel,
    strategy: deck.strategy?.name || 'Custom Strategy',
    description: deck.strategy?.description || 'AI-generated deck',
    cardCount: cardDetails.reduce((sum, card) => sum + card.quantity, 0),
    estimatedBudget: deck.estimatedBudget,
    colors: getCommanderColors(cardDetails.find(c => c.cardId === deck.commander)?.cardData),
    keyCards: cardDetails
      .filter(card => card.role === 'key' || card.category === 'Win Conditions')
      .slice(0, 5)
      .map(card => card.cardData?.name)
      .filter(Boolean),
    generatedAt: deck.createdAt
  }

  // In a real implementation, this would generate a proper shareable URL
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/decks/${deck.id}/share`

  return {
    url,
    embedData
  }
}

/**
 * Generate print-friendly deck list formatting
 */
export function generatePrintFriendlyExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  let output = `${deck.name}\n`
  output += `${'='.repeat(deck.name.length)}\n\n`
  
  output += `Commander: ${deck.commander}\n`
  output += `Format: ${deck.format.toUpperCase()}\n`
  output += `Power Level: ${deck.powerLevel || 'N/A'}\n`
  if (deck.estimatedBudget) {
    output += `Budget: $${deck.estimatedBudget.toFixed(0)}\n`
  }
  output += `Date: ${new Date().toLocaleDateString()}\n\n`

  // Strategy summary for print
  if (deck.strategy?.description) {
    output += `STRATEGY\n`
    output += `${'-'.repeat(8)}\n`
    output += `${deck.strategy.description}\n\n`
  }

  // Group and sort cards for print layout
  const categories = new Map<string, DeckCardWithData[]>()
  
  for (const card of cardDetails) {
    const category = card.category || 'Other'
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)!.push(card)
  }

  // Print-optimized category order
  const printOrder = [
    'Commander',
    'Creatures',
    'Instants', 
    'Sorceries',
    'Artifacts',
    'Enchantments',
    'Planeswalkers',
    'Lands'
  ]

  let totalCards = 0

  for (const categoryName of printOrder) {
    const cards = categories.get(categoryName)
    if (!cards || cards.length === 0) continue

    const categoryTotal = cards.reduce((sum, card) => sum + card.quantity, 0)
    totalCards += categoryTotal
    
    output += `${categoryName.toUpperCase()} (${categoryTotal})\n`
    output += `${'-'.repeat(categoryName.length + 5)}\n`
    
    // Sort alphabetically and format for print
    cards.sort((a, b) => {
      const nameA = a.cardData?.name || 'Unknown Card'
      const nameB = b.cardData?.name || 'Unknown Card'
      return nameA.localeCompare(nameB)
    })
    
    for (const card of cards) {
      const quantity = card.quantity > 1 ? `${card.quantity}x ` : '   '
      const name = card.cardData?.name || 'Unknown Card'
      const cmc = card.cardData?.cmc !== undefined ? ` (${card.cardData.cmc})` : ''
      output += `${quantity}${name}${cmc}\n`
    }
    output += '\n'
    categories.delete(categoryName)
  }

  // Add remaining categories
  for (const [categoryName, cards] of Array.from(categories.entries())) {
    const categoryTotal = cards.reduce((sum: number, card: DeckCardWithData) => sum + card.quantity, 0)
    totalCards += categoryTotal
    
    output += `${categoryName.toUpperCase()} (${categoryTotal})\n`
    output += `${'-'.repeat(categoryName.length + 5)}\n`
    
    cards.sort((a: DeckCardWithData, b: DeckCardWithData) => {
      const nameA = a.cardData?.name || 'Unknown Card'
      const nameB = b.cardData?.name || 'Unknown Card'
      return nameA.localeCompare(nameB)
    })
    
    for (const card of cards) {
      const quantity = card.quantity > 1 ? `${card.quantity}x ` : '   '
      const name = card.cardData?.name || 'Unknown Card'
      const cmc = card.cardData?.cmc !== undefined ? ` (${card.cardData.cmc})` : ''
      output += `${quantity}${name}${cmc}\n`
    }
    output += '\n'
  }

  output += `TOTAL CARDS: ${totalCards}\n`

  return {
    format: 'print',
    data: output,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_print.txt`,
    mimeType: 'text/plain'
  }
}

/**
 * Enhanced export with AI insights and analysis
 */
export async function generateEnhancedExport(
  deck: any,
  cardDetails: DeckCardWithData[],
  options: EnhancedExportOptions
): Promise<ExportResult> {
  // Enhance card details with additional data if requested
  const enhancedCardDetails = await enhanceCardDetailsForExport(cardDetails, options)
  
  // Add AI insights if requested
  let enhancedDeck = { ...deck }
  if (options.includeAIInsights) {
    enhancedDeck = await addAIInsightsToExport(enhancedDeck, enhancedCardDetails)
  }

  // Generate export based on format
  switch (options.format) {
    case 'text':
      return generateTextExport(enhancedDeck, enhancedCardDetails)
    case 'json':
      return generateEnhancedJSONExport(enhancedDeck, enhancedCardDetails, options)
    case 'moxfield':
      return generateMoxfieldExport(enhancedDeck, enhancedCardDetails)
    case 'archidekt':
      return generateArchidektExport(enhancedDeck, enhancedCardDetails)
    case 'edhrec':
      return generateEDHRECExport(enhancedDeck, enhancedCardDetails)
    case 'mtggoldfish':
      return generateMTGGoldfishExport(enhancedDeck, enhancedCardDetails)
    case 'csv':
      return generateCSVExport(enhancedDeck, enhancedCardDetails, options)
    default:
      return generateJSONExport(enhancedDeck, enhancedCardDetails)
  }
}

/**
 * Generate EDHREC-compatible export format
 */
export function generateEDHRECExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  let output = `// ${deck.name}\n`
  output += `// Commander: ${deck.commander}\n`
  output += `// Generated by DeckForge AI\n\n`

  // EDHREC format is simple text with quantities
  const sortedCards = [...cardDetails].sort((a, b) => {
    const nameA = a.cardData?.name || 'Unknown Card'
    const nameB = b.cardData?.name || 'Unknown Card'
    return nameA.localeCompare(nameB)
  })

  for (const card of sortedCards) {
    const quantity = card.quantity > 1 ? `${card.quantity} ` : ''
    const name = card.cardData?.name || 'Unknown Card'
    output += `${quantity}${name}\n`
  }

  return {
    format: 'edhrec',
    data: output,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_edhrec.txt`,
    mimeType: 'text/plain'
  }
}

/**
 * Generate MTGGoldfish-compatible export format
 */
export function generateMTGGoldfishExport(deck: any, cardDetails: DeckCardWithData[]): ExportResult {
  let output = `// ${deck.name}\n`
  output += `// Format: ${deck.format}\n\n`

  // Group by category for MTGGoldfish
  const categories = new Map<string, DeckCardWithData[]>()
  
  for (const card of cardDetails) {
    const category = card.category || 'Other'
    if (!categories.has(category)) {
      categories.set(category, [])
    }
    categories.get(category)!.push(card)
  }

  // MTGGoldfish category order
  const goldfishOrder = [
    'Creatures',
    'Planeswalkers', 
    'Instants',
    'Sorceries',
    'Artifacts',
    'Enchantments',
    'Lands'
  ]

  for (const categoryName of goldfishOrder) {
    const cards = categories.get(categoryName)
    if (!cards || cards.length === 0) continue

    output += `// ${categoryName}\n`
    
    cards.sort((a, b) => {
      const nameA = a.cardData?.name || 'Unknown Card'
      const nameB = b.cardData?.name || 'Unknown Card'
      return nameA.localeCompare(nameB)
    })
    
    for (const card of cards) {
      const quantity = card.quantity
      const name = card.cardData?.name || 'Unknown Card'
      output += `${quantity} ${name}\n`
    }
    output += '\n'
    categories.delete(categoryName)
  }

  return {
    format: 'mtggoldfish',
    data: output,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}_mtggoldfish.txt`,
    mimeType: 'text/plain'
  }
}

/**
 * Generate CSV export format
 */
export function generateCSVExport(
  deck: any,
  cardDetails: DeckCardWithData[],
  options: EnhancedExportOptions
): ExportResult {
  const headers = ['Name', 'Quantity', 'Category', 'CMC', 'Type', 'Colors', 'Rarity']
  
  if (options.includePricing) {
    headers.push('Price (USD)')
  }
  
  if (options.includeAIInsights) {
    headers.push('Role', 'Reasoning')
  }
  
  if (options.includeAlternatives) {
    headers.push('Alternatives')
  }

  let csvContent = headers.join(',') + '\n'

  for (const card of cardDetails) {
    const row = [
      `"${card.cardData?.name || 'Unknown Card'}"`,
      card.quantity.toString(),
      `"${card.category || 'Other'}"`,
      (card.cardData?.cmc || 0).toString(),
      `"${card.cardData?.type_line || 'Unknown'}"`,
      `"${(card.cardData?.colors || []).join('')}"`,
      `"${card.cardData?.rarity || 'common'}"`
    ]

    if (options.includePricing) {
      row.push((parseFloat(card.cardData?.prices?.usd || '0')).toFixed(2))
    }

    if (options.includeAIInsights) {
      row.push(`"${card.role || 'support'}"`)
      row.push(`"${card.reasoning || 'AI-generated selection'}"`)
    }

    if (options.includeAlternatives) {
      row.push(`"${(card.alternatives || []).join('; ')}"`)
    }

    csvContent += row.join(',') + '\n'
  }

  return {
    format: 'csv',
    data: csvContent,
    filename: `${deck.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
    mimeType: 'text/csv'
  }
}

/**
 * Generate enhanced JSON export with full AI analysis
 */
function generateEnhancedJSONExport(
  deck: any,
  cardDetails: DeckCardWithData[],
  options: EnhancedExportOptions
): ExportResult {
  const baseExport = generateJSONExport(deck, cardDetails)
  const exportData = baseExport.data as any

  // Add enhanced features based on options
  if (options.includeAnalysis && deck.aiAnalysis) {
    exportData.aiAnalysis = deck.aiAnalysis
  }

  if (options.includePricing) {
    exportData.pricing = {
      totalValue: cardDetails.reduce((sum, card) => 
        sum + (parseFloat(card.cardData?.prices?.usd || '0') * card.quantity), 0
      ),
      cardPrices: cardDetails.map(card => ({
        cardId: card.cardId,
        name: card.cardData?.name,
        price: parseFloat(card.cardData?.prices?.usd || '0'),
        quantity: card.quantity,
        totalValue: parseFloat(card.cardData?.prices?.usd || '0') * card.quantity
      })),
      lastUpdated: new Date().toISOString()
    }
  }

  if (options.includeUpgradePaths) {
    exportData.upgradePaths = cardDetails
      .filter(card => card.upgradeOptions && card.upgradeOptions.length > 0)
      .map(card => ({
        cardId: card.cardId,
        name: card.cardData?.name,
        currentRole: card.role,
        upgradeOptions: card.upgradeOptions,
        reasoning: card.reasoning
      }))
  }

  if (options.metadata) {
    exportData.customMetadata = options.metadata
  }

  return {
    ...baseExport,
    data: exportData
  }
}

/**
 * Generate shareable link with enhanced options
 */
export async function generateEnhancedShareableLink(
  deck: any,
  cardDetails: DeckCardWithData[],
  options: ShareableLinkOptions
): Promise<{ url: string; embedData: object; shareId: string }> {
  const shareId = generateShareId()
  
  const embedData = {
    shareId,
    name: deck.name,
    commander: deck.commander,
    format: deck.format,
    powerLevel: deck.powerLevel,
    cardCount: cardDetails.reduce((sum, card) => sum + card.quantity, 0),
    colors: getCommanderColors(cardDetails.find(c => c.cardId === deck.commander)?.cardData),
    generatedAt: deck.createdAt,
    sharedAt: new Date().toISOString(),
    expiresAt: options.expirationDays 
      ? new Date(Date.now() + options.expirationDays * 24 * 60 * 60 * 1000).toISOString()
      : null,
    hasPassword: !!options.password,
    allowComments: options.allowComments
  }

  if (options.includeStrategy && deck.strategy) {
    (embedData as any).strategy = {
      name: deck.strategy.name,
      description: deck.strategy.description
    }
  }

  if (options.includeAnalysis && deck.analysis) {
    (embedData as any).analysis = deck.analysis
  }

  if (options.includePricing) {
    (embedData as any).estimatedValue = cardDetails.reduce((sum, card) => 
      sum + (parseFloat(card.cardData?.prices?.usd || '0') * card.quantity), 0
    )
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareId}`

  return {
    url,
    embedData,
    shareId
  }
}

/**
 * Import deck from various formats
 */
export async function importDeckFromText(
  textContent: string,
  format: 'text' | 'moxfield' | 'archidekt' | 'edhrec' | 'mtggoldfish' = 'text'
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: []
  }

  try {
    switch (format) {
      case 'text':
        return await importFromPlainText(textContent)
      case 'moxfield':
        return await importFromMoxfield(textContent)
      case 'archidekt':
        return await importFromArchidekt(textContent)
      case 'edhrec':
        return await importFromEDHREC(textContent)
      case 'mtggoldfish':
        return await importFromMTGGoldfish(textContent)
      default:
        result.errors.push(`Unsupported import format: ${format}`)
        return result
    }
  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return result
  }
}

/**
 * Import from plain text format
 */
async function importFromPlainText(textContent: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: []
  }

  const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const cards: ImportedCard[] = []
  let deckName = 'Imported Deck'
  let commander: string | undefined
  let currentCategory = 'Other'

  for (const line of lines) {
    // Skip comments
    if (line.startsWith('//') || line.startsWith('#')) continue

    // Check for deck name (first non-comment line)
    if (cards.length === 0 && !line.includes('x ') && !line.match(/^\d+\s/)) {
      deckName = line
      continue
    }

    // Check for category headers
    if (line.toUpperCase() === line && line.includes('(') && line.includes(')')) {
      currentCategory = line.split('(')[0].trim()
      continue
    }

    // Parse card line
    const cardMatch = line.match(/^(\d+)?\s*x?\s*(.+)$/)
    if (cardMatch) {
      const quantity = cardMatch[1] ? parseInt(cardMatch[1]) : 1
      const cardName = cardMatch[2].trim()

      if (cardName) {
        // Try to get card data from Scryfall
        try {
          const cardData = await scryfallService.search(`!"${cardName}"`, { maxResults: 1 }).then(cards => cards[0])
          
          const importedCard: ImportedCard = {
            name: cardName,
            quantity,
            category: currentCategory,
            cardId: cardData?.id,
            cardData: cardData || undefined
          }

          cards.push(importedCard)

          // Detect commander
          if (currentCategory.toLowerCase().includes('commander') || 
              (cards.length === 1 && quantity === 1)) {
            commander = cardName
          }
        } catch (error) {
          result.warnings.push(`Could not find card data for: ${cardName}`)
          cards.push({
            name: cardName,
            quantity,
            category: currentCategory
          })
        }
      }
    }
  }

  if (cards.length === 0) {
    result.errors.push('No cards found in import text')
    return result
  }

  result.success = true
  result.deck = {
    name: deckName,
    commander,
    format: 'commander',
    cards,
    metadata: {
      importedAt: new Date().toISOString(),
      importFormat: 'text'
    }
  }

  return result
}

/**
 * Import from Moxfield JSON format
 */
async function importFromMoxfield(jsonContent: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: []
  }

  try {
    const moxfieldData = JSON.parse(jsonContent)
    const cards: ImportedCard[] = []

    // Process commanders
    if (moxfieldData.commanders) {
      for (const [cardId, data] of Object.entries(moxfieldData.commanders as any)) {
        const cardData = data as any
        cards.push({
          name: cardData.card.name,
          quantity: cardData.quantity,
          category: 'Commander',
          cardId: cardData.card.scryfall_id || cardId,
          cardData: cardData.card
        })
      }
    }

    // Process mainboard
    if (moxfieldData.mainboard) {
      for (const [cardId, data] of Object.entries(moxfieldData.mainboard as any)) {
        const cardData = data as any
        cards.push({
          name: cardData.card.name,
          quantity: cardData.quantity,
          category: 'Mainboard',
          cardId: cardData.card.scryfall_id || cardId,
          cardData: cardData.card
        })
      }
    }

    result.success = true
    result.deck = {
      name: moxfieldData.name || 'Imported Moxfield Deck',
      commander: cards.find(c => c.category === 'Commander')?.name,
      format: 'commander',
      cards,
      metadata: {
        importedAt: new Date().toISOString(),
        importFormat: 'moxfield',
        originalData: {
          description: moxfieldData.description,
          createdAt: moxfieldData.createdAtUtc,
          lastUpdated: moxfieldData.lastUpdatedAtUtc
        }
      }
    }

    return result
  } catch (error) {
    result.errors.push(`Failed to parse Moxfield JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return result
  }
}

/**
 * Import from Archidekt JSON format
 */
async function importFromArchidekt(jsonContent: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    errors: [],
    warnings: []
  }

  try {
    const archidektData = JSON.parse(jsonContent)
    const cards: ImportedCard[] = []
    const categoryMap = new Map<number, string>()

    // Build category map
    if (archidektData.categories) {
      for (const category of archidektData.categories) {
        categoryMap.set(category.id, category.name)
      }
    }

    // Process cards
    if (archidektData.cards) {
      for (const cardEntry of archidektData.cards) {
        const categoryName = cardEntry.categories && cardEntry.categories.length > 0
          ? categoryMap.get(cardEntry.categories[0]) || 'Other'
          : 'Other'

        cards.push({
          name: cardEntry.card.oracleCard.name,
          quantity: cardEntry.qty,
          category: categoryName,
          cardId: cardEntry.card.id,
          cardData: cardEntry.card.oracleCard
        })
      }
    }

    result.success = true
    result.deck = {
      name: archidektData.name || 'Imported Archidekt Deck',
      commander: archidektData.featuredCard,
      format: 'commander',
      cards,
      metadata: {
        importedAt: new Date().toISOString(),
        importFormat: 'archidekt',
        originalData: {
          description: archidektData.description,
          private: archidektData.private
        }
      }
    }

    return result
  } catch (error) {
    result.errors.push(`Failed to parse Archidekt JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return result
  }
}

/**
 * Import from EDHREC format
 */
async function importFromEDHREC(textContent: string): Promise<ImportResult> {
  // EDHREC format is similar to plain text but simpler
  return await importFromPlainText(textContent)
}

/**
 * Import from MTGGoldfish format
 */
async function importFromMTGGoldfish(textContent: string): Promise<ImportResult> {
  // MTGGoldfish format is similar to plain text with categories
  return await importFromPlainText(textContent)
}

/**
 * Helper functions
 */
async function enhanceCardDetailsForExport(
  cardDetails: DeckCardWithData[],
  options: EnhancedExportOptions
): Promise<DeckCardWithData[]> {
  // Add pricing data if requested
  if (options.includePricing) {
    // This would integrate with price service to get current prices
    // For now, we'll use existing price data from Scryfall
  }

  // Add alternatives if requested
  if (options.includeAlternatives) {
    // This would use AI to generate alternatives
    // For now, we'll use existing alternatives data
  }

  return cardDetails
}

async function addAIInsightsToExport(deck: any, cardDetails: DeckCardWithData[]): Promise<any> {
  // This would integrate with AI analysis service
  // For now, return deck as-is
  return deck
}

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Helper function to extract commander colors
function getCommanderColors(commanderCard?: ScryfallCard | null): string[] {
  if (!commanderCard) return []
  return commanderCard.color_identity || []
}
