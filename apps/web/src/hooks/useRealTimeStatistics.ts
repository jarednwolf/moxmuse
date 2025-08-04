import { useMemo } from 'react'
import { GeneratedDeck, DeckStatistics, ManaCurveData, ColorDistribution, TypeDistribution, RarityDistribution } from '@moxmuse/shared'

interface UseRealTimeStatisticsOptions {
  deck: GeneratedDeck
  filters?: {
    cmc?: number
    color?: string
    type?: string
    rarity?: string
    cardId?: string
  }
}

export function useRealTimeStatistics({ deck, filters = {} }: UseRealTimeStatisticsOptions) {
  return useMemo(() => {
    // Filter cards based on current filters
    let filteredCards = deck.cards

    // Apply filters to get subset of cards for statistics
    if (filters.cardId) {
      const selectedCardSynergies = deck.synergies
        .filter(synergy => 
          filters.cardId && (
            synergy.cardId === filters.cardId || 
            synergy.relatedCardIds.includes(filters.cardId)
          )
        )
        .flatMap(synergy => [synergy.cardId, ...synergy.relatedCardIds])
      
      filteredCards = filteredCards.filter(card => 
        card.cardId === filters.cardId || 
        selectedCardSynergies.includes(card.cardId)
      )
    }

    // Calculate real-time statistics from filtered cards
    const totalCards = filteredCards.reduce((sum, card) => sum + card.quantity, 0)
    const nonlandCards = filteredCards.filter(card => !card.category.toLowerCase().includes('land'))
    const landCards = filteredCards.filter(card => card.category.toLowerCase().includes('land'))

    // Mana Curve Calculation (mock implementation)
    const manaCurveDistribution = [0, 0, 0, 0, 0, 0, 0, 0] // [0, 1, 2, 3, 4, 5, 6, 7+]
    
    // Mock CMC assignment based on category
    filteredCards.forEach(card => {
      let cmc = 0
      
      // Mock CMC assignment - in real implementation would use actual card CMC
      if (card.category.toLowerCase().includes('land')) cmc = 0
      else if (card.category.toLowerCase().includes('ramp')) cmc = Math.random() < 0.7 ? 1 : 2
      else if (card.category.toLowerCase().includes('removal')) cmc = Math.random() < 0.5 ? 2 : 3
      else if (card.category.toLowerCase().includes('draw')) cmc = Math.random() < 0.6 ? 2 : 3
      else if (card.category.toLowerCase().includes('creature')) cmc = Math.floor(Math.random() * 4) + 2 // 2-5
      else if (card.category.toLowerCase().includes('win condition')) cmc = Math.floor(Math.random() * 3) + 5 // 5-7
      else cmc = Math.floor(Math.random() * 6) + 1 // 1-6
      
      const cmcIndex = Math.min(cmc, 7)
      manaCurveDistribution[cmcIndex] += card.quantity
    })

    const averageCMC = manaCurveDistribution.reduce((sum, count, cmc) => sum + (count * cmc), 0) / 
                      manaCurveDistribution.reduce((sum, count) => sum + count, 0) || 0

    const manaCurve: ManaCurveData = {
      distribution: manaCurveDistribution,
      peakCMC: manaCurveDistribution.indexOf(Math.max(...manaCurveDistribution)),
      averageCMC,
      landRatio: landCards.reduce((sum, card) => sum + card.quantity, 0) / totalCards
    }

    // Color Distribution Calculation (mock implementation)
    const colorDistribution: ColorDistribution = {
      white: 0,
      blue: 0,
      black: 0,
      red: 0,
      green: 0,
      colorless: 0,
      multicolor: 0,
      devotion: {}
    }

    // Mock color assignment based on category
    filteredCards.forEach(card => {
      const quantity = card.quantity
      
      if (card.category.toLowerCase().includes('land') || 
          card.category.toLowerCase().includes('artifact')) {
        colorDistribution.colorless += quantity
      } else if (card.category.toLowerCase().includes('removal')) {
        // White or black removal
        if (Math.random() < 0.6) {
          colorDistribution.white += quantity
        } else {
          colorDistribution.black += quantity
        }
      } else if (card.category.toLowerCase().includes('draw')) {
        colorDistribution.blue += quantity
      } else if (card.category.toLowerCase().includes('ramp')) {
        colorDistribution.green += quantity
      } else if (card.category.toLowerCase().includes('win condition')) {
        colorDistribution.multicolor += quantity
      } else {
        // Random color assignment for other cards
        const colors = ['white', 'blue', 'black', 'red', 'green'] as const
        const randomColor = colors[Math.floor(Math.random() * colors.length)]
        colorDistribution[randomColor] += quantity
      }
    })

    // Type Distribution Calculation (mock implementation)
    const typeDistribution: TypeDistribution = {
      creature: 0,
      instant: 0,
      sorcery: 0,
      artifact: 0,
      enchantment: 0,
      planeswalker: 0,
      land: 0,
      other: 0
    }

    // Mock type assignment based on category
    filteredCards.forEach(card => {
      const quantity = card.quantity
      
      if (card.category.toLowerCase().includes('land')) {
        typeDistribution.land += quantity
      } else if (card.category.toLowerCase().includes('creature')) {
        typeDistribution.creature += quantity
      } else if (card.category.toLowerCase().includes('artifact')) {
        typeDistribution.artifact += quantity
      } else if (card.category.toLowerCase().includes('enchantment')) {
        typeDistribution.enchantment += quantity
      } else if (card.category.toLowerCase().includes('planeswalker')) {
        typeDistribution.planeswalker += quantity
      } else if (card.category.toLowerCase().includes('removal') || 
                 card.category.toLowerCase().includes('counterspell')) {
        // Mix of instants and sorceries
        if (Math.random() < 0.7) {
          typeDistribution.instant += quantity
        } else {
          typeDistribution.sorcery += quantity
        }
      } else if (card.category.toLowerCase().includes('ramp') || 
                 card.category.toLowerCase().includes('draw')) {
        typeDistribution.sorcery += quantity
      } else {
        typeDistribution.other += quantity
      }
    })

    // Rarity Distribution Calculation (mock implementation)
    const rarityDistribution: RarityDistribution = {
      common: 0,
      uncommon: 0,
      rare: 0,
      mythic: 0
    }

    // Mock rarity assignment based on category and role
    filteredCards.forEach(card => {
      const quantity = card.quantity
      
      if (card.category.toLowerCase().includes('land') || 
          card.role.toLowerCase().includes('support')) {
        rarityDistribution.common += quantity
      } else if (card.category.toLowerCase().includes('removal') || 
                 card.category.toLowerCase().includes('draw')) {
        rarityDistribution.uncommon += quantity
      } else if (card.category.toLowerCase().includes('creature') || 
                 card.category.toLowerCase().includes('artifact')) {
        rarityDistribution.rare += quantity
      } else if (card.category.toLowerCase().includes('win condition') || 
                 card.category.toLowerCase().includes('planeswalker')) {
        rarityDistribution.mythic += quantity
      } else {
        // Random rarity for other cards
        const rarities = ['common', 'uncommon', 'rare', 'mythic'] as const
        const weights = [0.4, 0.3, 0.2, 0.1] // Common is most likely
        const random = Math.random()
        let cumulativeWeight = 0
        
        for (let i = 0; i < rarities.length; i++) {
          cumulativeWeight += weights[i]
          if (random <= cumulativeWeight) {
            rarityDistribution[rarities[i]] += quantity
            break
          }
        }
      }
    })

    // Calculate total value (mock implementation)
    const totalValue = filteredCards.reduce((sum, card) => {
      // Mock price calculation based on rarity and category
      let basePrice = 0.5 // Common base price
      
      if (card.category.toLowerCase().includes('win condition')) basePrice = 15
      else if (card.category.toLowerCase().includes('planeswalker')) basePrice = 8
      else if (card.category.toLowerCase().includes('creature')) basePrice = 3
      else if (card.category.toLowerCase().includes('removal')) basePrice = 2
      else if (card.category.toLowerCase().includes('land')) basePrice = 1
      
      return sum + (basePrice * card.quantity)
    }, 0)

    const statistics: DeckStatistics = {
      manaCurve,
      colorDistribution,
      typeDistribution,
      rarityDistribution,
      averageCMC,
      totalValue,
      landCount: landCards.reduce((sum, card) => sum + card.quantity, 0),
      nonlandCount: nonlandCards.reduce((sum, card) => sum + card.quantity, 0)
    }

    return {
      statistics,
      filteredCardCount: totalCards,
      originalCardCount: deck.cards.reduce((sum, card) => sum + card.quantity, 0),
      isFiltered: Object.keys(filters).some(key => filters[key as keyof typeof filters] !== undefined)
    }
  }, [deck.cards, deck.synergies, filters])
}

// Hook for calculating statistics changes in real-time
export function useStatisticsComparison(originalDeck: GeneratedDeck, modifiedDeck: GeneratedDeck) {
  return useMemo(() => {
    const originalStats = originalDeck.statistics
    const modifiedStats = modifiedDeck.statistics

    const changes = {
      manaCurve: {
        averageCMCChange: modifiedStats.averageCMC - originalStats.averageCMC,
        distributionChanges: modifiedStats.manaCurve.distribution.map(
          (count, index) => count - originalStats.manaCurve.distribution[index]
        )
      },
      colorDistribution: {
        whiteChange: modifiedStats.colorDistribution.white - originalStats.colorDistribution.white,
        blueChange: modifiedStats.colorDistribution.blue - originalStats.colorDistribution.blue,
        blackChange: modifiedStats.colorDistribution.black - originalStats.colorDistribution.black,
        redChange: modifiedStats.colorDistribution.red - originalStats.colorDistribution.red,
        greenChange: modifiedStats.colorDistribution.green - originalStats.colorDistribution.green,
        colorlessChange: modifiedStats.colorDistribution.colorless - originalStats.colorDistribution.colorless,
        multicolorChange: modifiedStats.colorDistribution.multicolor - originalStats.colorDistribution.multicolor
      },
      typeDistribution: {
        creatureChange: modifiedStats.typeDistribution.creature - originalStats.typeDistribution.creature,
        instantChange: modifiedStats.typeDistribution.instant - originalStats.typeDistribution.instant,
        sorceryChange: modifiedStats.typeDistribution.sorcery - originalStats.typeDistribution.sorcery,
        artifactChange: modifiedStats.typeDistribution.artifact - originalStats.typeDistribution.artifact,
        enchantmentChange: modifiedStats.typeDistribution.enchantment - originalStats.typeDistribution.enchantment,
        planeswalkerChange: modifiedStats.typeDistribution.planeswalker - originalStats.typeDistribution.planeswalker,
        landChange: modifiedStats.typeDistribution.land - originalStats.typeDistribution.land,
        otherChange: modifiedStats.typeDistribution.other - originalStats.typeDistribution.other
      },
      totalValueChange: modifiedStats.totalValue - originalStats.totalValue,
      cardCountChange: modifiedStats.landCount + modifiedStats.nonlandCount - 
                      (originalStats.landCount + originalStats.nonlandCount)
    }

    return changes
  }, [originalDeck.statistics, modifiedDeck.statistics])
}