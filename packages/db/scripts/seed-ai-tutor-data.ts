import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding AI Deck Building Tutor data...')
  
  try {
    // Find or create demo user
    let user = await prisma.user.findUnique({
      where: { email: 'demo@moxmuse.com' }
    })
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'demo@moxmuse.com',
          name: 'Demo User',
          image: null,
        }
      })
    }
    
    // Create sample consultation session
    const consultationSession = await prisma.consultationSession.create({
      data: {
        userId: user.id,
        sessionId: 'demo-session-001',
        consultationData: {
          buildingFullDeck: true,
          needsCommanderSuggestions: false,
          commander: 'Atraxa, Praetors\' Voice',
          commanderColors: ['W', 'U', 'B', 'G'],
          strategy: 'value',
          themes: ['counters', 'proliferate'],
          budget: 200,
          powerLevel: 7,
          useCollection: false,
          colorPreferences: ['W', 'U', 'B', 'G'],
          winConditions: {
            primary: 'combo',
            secondary: ['alternative'],
            comboType: 'synergy'
          },
          interaction: {
            level: 'medium',
            types: ['removal', 'counterspells'],
            timing: 'reactive'
          },
          complexityLevel: 'moderate'
        },
        currentStep: 'completed',
        completed: true
      }
    })
    
    // Create sample generated deck
    const generatedDeck = await prisma.generatedDeck.create({
      data: {
        userId: user.id,
        sessionId: consultationSession.sessionId,
        name: 'Atraxa Superfriends',
        commander: 'Atraxa, Praetors\' Voice',
        format: 'commander',
        strategy: {
          name: 'Superfriends Control',
          description: 'A planeswalker-focused deck that uses Atraxa to proliferate loyalty counters',
          archetype: 'control',
          subthemes: ['planeswalkers', 'counters', 'proliferate']
        },
        winConditions: [
          {
            type: 'planeswalker ultimates',
            description: 'Win through powerful planeswalker ultimate abilities',
            priority: 'primary'
          },
          {
            type: 'combat damage',
            description: 'Beat down with Atraxa and other creatures',
            priority: 'secondary'
          }
        ],
        powerLevel: 7,
        estimatedBudget: 185.50,
        consultationData: consultationSession.consultationData,
        generationPrompt: 'Generate an Atraxa superfriends deck focused on planeswalkers and proliferate synergies',
        status: 'generated'
      }
    })
    
    // Update consultation session with generated deck
    await prisma.consultationSession.update({
      where: { id: consultationSession.id },
      data: { generatedDeckId: generatedDeck.id }
    })
    
    // Create sample deck cards
    const sampleCards = [
      {
        cardId: 'atraxa-praetors-voice',
        quantity: 1,
        category: 'commander',
        role: 'primary',
        reasoning: 'The commander that enables the proliferate strategy'
      },
      {
        cardId: 'jace-the-mind-sculptor',
        quantity: 1,
        category: 'planeswalker',
        role: 'primary',
        reasoning: 'Powerful planeswalker that benefits from proliferate',
        alternatives: ['jace-architect-of-thought', 'jace-vryn-prodigy'],
        upgradeOptions: ['jace-the-mind-sculptor-foil'],
        budgetOptions: ['jace-beleren', 'jace-memory-adept']
      },
      {
        cardId: 'elspeth-suns-champion',
        quantity: 1,
        category: 'planeswalker',
        role: 'primary',
        reasoning: 'Creates tokens and provides board control',
        alternatives: ['elspeth-knight-errant', 'elspeth-tirel'],
        budgetOptions: ['elspeth-undaunted-hero']
      },
      {
        cardId: 'doubling-season',
        quantity: 1,
        category: 'enchantment',
        role: 'primary',
        reasoning: 'Doubles counters and tokens for explosive plays',
        alternatives: ['parallel-lives', 'anointed-procession'],
        budgetOptions: ['primal-vigor', 'hardened-scales']
      },
      {
        cardId: 'sol-ring',
        quantity: 1,
        category: 'ramp',
        role: 'primary',
        reasoning: 'Essential mana acceleration for any Commander deck'
      },
      {
        cardId: 'command-tower',
        quantity: 1,
        category: 'land',
        role: 'primary',
        reasoning: 'Perfect mana fixing for four-color deck'
      }
    ]
    
    for (const card of sampleCards) {
      await prisma.generatedDeckCard.create({
        data: {
          deckId: generatedDeck.id,
          ...card
        }
      })
    }
    
    // Create sample deck analysis
    await prisma.deckAnalysis.create({
      data: {
        deckId: generatedDeck.id,
        statistics: {
          manaCurve: {
            distribution: [5, 8, 12, 15, 18, 12, 8, 5],
            peakCMC: 4,
            averageCMC: 3.2,
            landRatio: 0.37
          },
          colorDistribution: {
            white: 25,
            blue: 20,
            black: 15,
            red: 5,
            green: 20,
            colorless: 10,
            multicolor: 5,
            devotion: { W: 45, U: 40, B: 35, G: 40 }
          },
          typeDistribution: {
            creature: 20,
            planeswalker: 12,
            instant: 8,
            sorcery: 10,
            enchantment: 8,
            artifact: 5,
            land: 37
          },
          rarityDistribution: {
            common: 15,
            uncommon: 25,
            rare: 45,
            mythic: 15
          },
          averageCMC: 3.2,
          totalValue: 185.50,
          landCount: 37,
          nonlandCount: 63
        },
        synergies: [
          {
            cards: ['atraxa-praetors-voice', 'jace-the-mind-sculptor'],
            type: 'proliferate',
            description: 'Atraxa can proliferate Jace\'s loyalty counters',
            strength: 'high'
          },
          {
            cards: ['doubling-season', 'elspeth-suns-champion'],
            type: 'token-doubling',
            description: 'Doubling Season doubles Elspeth\'s token creation',
            strength: 'high'
          }
        ],
        weaknesses: [
          'Vulnerable to mass artifact/enchantment removal',
          'Relies heavily on keeping planeswalkers alive',
          'Expensive mana curve may struggle against fast aggro'
        ],
        strategyDescription: 'This deck focuses on deploying and protecting planeswalkers while using Atraxa to proliferate their loyalty counters. The strategy revolves around incremental advantage through planeswalker abilities.',
        winConditionAnalysis: 'Primary win condition is through planeswalker ultimates, with secondary combat damage from Atraxa and tokens.',
        playPatternDescription: 'Early game focuses on ramp and removal, mid-game deploys planeswalkers, late game protects them while building to ultimates.'
      }
    })
    
    console.log('AI Deck Building Tutor seed data created successfully!')
    console.log(`- Consultation Session: ${consultationSession.id}`)
    console.log(`- Generated Deck: ${generatedDeck.id}`)
    console.log(`- Deck Cards: ${sampleCards.length}`)
    
  } catch (error) {
    console.error('Error seeding AI tutor data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })