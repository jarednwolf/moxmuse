import { AffiliatePartner } from './types'
import { AFFILIATE_CONFIG } from './constants'

// Generate affiliate URLs
export function generateAffiliateUrl(
  partner: AffiliatePartner,
  productId: string,
  affiliateId: string
): string {
  const config = AFFILIATE_CONFIG[partner]
  const url = new URL(`${config.baseUrl}${productId}`)
  url.searchParams.set(config.affiliateParam, affiliateId)
  return url.toString()
}

// Format card prices
export function formatPrice(cents: number | string | null): string {
  if (!cents) return 'N/A'
  const price = typeof cents === 'string' ? parseFloat(cents) : cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

// Calculate deck statistics
export function calculateDeckStats(cards: Array<{ mana_cost: string; type_line: string }>) {
  const stats = {
    totalCards: cards.length,
    averageCMC: 0,
    colorDistribution: {} as Record<string, number>,
    typeDistribution: {} as Record<string, number>,
    manaCurve: {} as Record<number, number>,
  }

  let totalCMC = 0
  
  cards.forEach(card => {
    // Calculate CMC
    const cmc = calculateCMC(card.mana_cost)
    totalCMC += cmc
    stats.manaCurve[cmc] = (stats.manaCurve[cmc] || 0) + 1

    // Type distribution
    const mainType = extractMainType(card.type_line)
    stats.typeDistribution[mainType] = (stats.typeDistribution[mainType] || 0) + 1

    // Color distribution
    const colors = extractColors(card.mana_cost)
    colors.forEach(color => {
      stats.colorDistribution[color] = (stats.colorDistribution[color] || 0) + 1
    })
  })

  stats.averageCMC = totalCMC / cards.length

  return stats
}

// Calculate converted mana cost from mana cost string
export function calculateCMC(manaCost: string): number {
  if (!manaCost) return 0
  
  const matches = manaCost.match(/\{([^}]+)\}/g)
  if (!matches) return 0

  return matches.reduce((total, match) => {
    const value = match.slice(1, -1)
    // Handle numeric values
    if (/^\d+$/.test(value)) {
      return total + parseInt(value, 10)
    }
    // Handle X
    if (value === 'X') {
      return total // X counts as 0 for CMC
    }
    // All other symbols count as 1
    return total + 1
  }, 0)
}

// Extract main card type
export function extractMainType(typeLine: string): string {
  const types = ['Land', 'Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Instant', 'Sorcery']
  
  for (const type of types) {
    if (typeLine.includes(type)) {
      return type
    }
  }
  
  return 'Other'
}

// Extract colors from mana cost
export function extractColors(manaCost: string): string[] {
  if (!manaCost) return []
  
  const colors = new Set<string>()
  const colorMap = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green',
  }

  const matches = manaCost.match(/\{([^}]+)\}/g)
  if (!matches) return []

  matches.forEach(match => {
    const value = match.slice(1, -1)
    Object.entries(colorMap).forEach(([symbol, color]) => {
      if (value.includes(symbol)) {
        colors.add(color)
      }
    })
  })

  return Array.from(colors)
}

// Debounce function for search
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Format large numbers
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

// Generate session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// CSV parsing for collection import
export interface ParsedCard {
  name: string
  quantity: number
  foilQuantity?: number
  setCode?: string
  collectorNumber?: string
  condition?: string
  language?: string
  purchasePrice?: number
}

export function parseCollectionCSV(csv: string): ParsedCard[] {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  // Try to detect CSV format by headers
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
  const cards: ParsedCard[] = []

  // Common header mappings
  const nameHeaders = ['name', 'card name', 'card', 'cardname']
  const quantityHeaders = ['quantity', 'qty', 'count', 'amount', 'regular']
  const foilHeaders = ['foil', 'foil qty', 'foil quantity', 'foils']
  const setHeaders = ['set', 'edition', 'set code', 'setcode']
  const numberHeaders = ['number', 'collector number', 'cn', 'collectornumber']
  const conditionHeaders = ['condition', 'cond', 'grade']
  const languageHeaders = ['language', 'lang']
  const priceHeaders = ['price', 'purchase price', 'purchaseprice', 'cost']

  // Find column indices
  const findIndex = (headers: string[], options: string[]) => {
    return headers.findIndex(h => options.includes(h))
  }

  const nameIdx = findIndex(headers, nameHeaders)
  const qtyIdx = findIndex(headers, quantityHeaders)
  const foilIdx = findIndex(headers, foilHeaders)
  const setIdx = findIndex(headers, setHeaders)
  const numIdx = findIndex(headers, numberHeaders)
  const condIdx = findIndex(headers, conditionHeaders)
  const langIdx = findIndex(headers, languageHeaders)
  const priceIdx = findIndex(headers, priceHeaders)

  if (nameIdx === -1) {
    throw new Error('Could not find card name column in CSV')
  }

  // Parse each row
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    
    const name = values[nameIdx]
    if (!name) continue

    const card: ParsedCard = {
      name,
      quantity: qtyIdx !== -1 ? parseInt(values[qtyIdx]) || 1 : 1,
    }

    if (foilIdx !== -1 && values[foilIdx]) {
      card.foilQuantity = parseInt(values[foilIdx]) || 0
    }

    if (setIdx !== -1 && values[setIdx]) {
      card.setCode = values[setIdx].toUpperCase()
    }

    if (numIdx !== -1 && values[numIdx]) {
      card.collectorNumber = values[numIdx]
    }

    if (condIdx !== -1 && values[condIdx]) {
      card.condition = normalizeCondition(values[condIdx])
    }

    if (langIdx !== -1 && values[langIdx]) {
      card.language = values[langIdx].toLowerCase().slice(0, 2)
    }

    if (priceIdx !== -1 && values[priceIdx]) {
      const price = parseFloat(values[priceIdx].replace(/[$,]/g, ''))
      if (!isNaN(price)) {
        card.purchasePrice = price
      }
    }

    cards.push(card)
  }

  return cards
}

function normalizeCondition(condition: string): string {
  const cond = condition.toUpperCase()
  const conditionMap: Record<string, string> = {
    'NM': 'NM',
    'NEAR MINT': 'NM',
    'LP': 'LP',
    'LIGHTLY PLAYED': 'LP',
    'MP': 'MP',
    'MODERATELY PLAYED': 'MP',
    'HP': 'HP',
    'HEAVILY PLAYED': 'HP',
    'DMG': 'DMG',
    'DAMAGED': 'DMG',
  }
  return conditionMap[cond] || 'NM'
} 