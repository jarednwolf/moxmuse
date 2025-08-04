#!/usr/bin/env tsx

/**
 * Moxfield Parity + AI Enhancement Seed Data Script
 * 
 * This script populates the database with sample data for testing and development:
 * - Sample users with profiles and folders
 * - Sample decks with analytics
 * - Sample community content (public decks, comments)
 * - Sample import/export jobs
 * - Sample performance metrics
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting Moxfield Parity + AI Enhancement data seeding...')

  try {
    // Create sample users
    const users = await createSampleUsers()
    
    // Create sample folders and templates
    await createSampleFoldersAndTemplates(users)
    
    // Create sample decks with analytics
    await createSampleDecksWithAnalytics(users)
    
    // Create sample community content
    await createSampleCommunityContent(users)
    
    // Create sample import/export jobs
    await createSampleImportExportJobs(users)
    
    // Create sample performance data
    await createSamplePerformanceData(users)
    
    // Create sample trending data
    await createSampleTrendingData()
    
    console.log('✅ Seeding completed successfully!')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

async function createSampleUsers() {
  console.log('👥 Creating sample users...')
  
  const sampleUsers = [
    {
      email: 'alice@example.com',
      name: 'Alice Commander',
      profile: {
        username: 'alicecommander',
        displayName: 'Alice Commander',
        bio: 'Competitive EDH player and deck builder. Love brewing unique strategies!',
        favoriteFormats: ['commander'],
        favoriteArchetypes: ['combo', 'control'],
        brewingStyle: ['competitive', 'innovative']
      }
    },
    {
      email: 'bob@example.com',
      name: 'Bob Brewer',
      profile: {
        username: 'bobbrewer',
        displayName: 'Bob the Brewer',
        bio: 'Casual player who enjoys building thematic decks on a budget.',
        favoriteFormats: ['commander'],
        favoriteArchetypes: ['tribal', 'voltron'],
        brewingStyle: ['casual', 'thematic']
      }
    },
    {
      email: 'charlie@example.com',
      name: 'Charlie Spike',
      profile: {
        username: 'charliespike',
        displayName: 'Charlie Spike',
        bio: 'Tournament grinder always looking for the next meta deck.',
        favoriteFormats: ['commander', 'modern'],
        favoriteArchetypes: ['aggro', 'midrange'],
        brewingStyle: ['competitive', 'meta']
      }
    }
  ]
  
  const createdUsers = []
  
  for (const userData of sampleUsers) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        userProfile: {
          create: userData.profile
        }
      },
      include: {
        userProfile: true
      }
    })
    
    createdUsers.push(user)
  }
  
  console.log(`✅ Created ${createdUsers.length} sample users`)
  return createdUsers
}

async function createSampleFoldersAndTemplates(users: any[]) {
  console.log('📁 Creating sample folders and templates...')
  
  for (const user of users) {
    // Create folder structure
    const competitiveFolder = await prisma.deckFolder.create({
      data: {
        userId: user.id,
        name: 'Competitive Decks',
        description: 'High-power competitive builds',
        color: '#ef4444',
        sortOrder: 0
      }
    })
    
    const casualFolder = await prisma.deckFolder.create({
      data: {
        userId: user.id,
        name: 'Casual Decks',
        description: 'Fun casual builds for kitchen table',
        color: '#10b981',
        sortOrder: 1
      }
    })
    
    const wipFolder = await prisma.deckFolder.create({
      data: {
        userId: user.id,
        name: 'Work in Progress',
        description: 'Decks I\'m currently building',
        color: '#f59e0b',
        sortOrder: 2
      }
    })
    
    // Create a subfolder
    await prisma.deckFolder.create({
      data: {
        userId: user.id,
        name: 'cEDH Builds',
        description: 'Competitive EDH decks',
        color: '#dc2626',
        parentId: competitiveFolder.id,
        sortOrder: 0
      }
    })
    
    // Create a custom template
    await prisma.deckTemplate.create({
      data: {
        userId: user.id,
        name: `${user.name}'s Combo Template`,
        description: 'My personal combo deck template',
        format: 'commander',
        archetype: 'combo',
        isPublic: true,
        powerLevel: 8,
        estimatedBudget: 500,
        tags: ['combo', 'competitive'],
        categories: JSON.stringify([
          { name: 'Fast Mana', description: 'Mana acceleration', targetCount: 10, minCount: 8, maxCount: 12, priority: 1 },
          { name: 'Tutors', description: 'Card selection', targetCount: 8, minCount: 6, maxCount: 10, priority: 2 },
          { name: 'Combo Pieces', description: 'Win conditions', targetCount: 12, minCount: 10, maxCount: 15, priority: 3 },
          { name: 'Protection', description: 'Counterspells and protection', targetCount: 10, minCount: 8, maxCount: 12, priority: 4 },
          { name: 'Card Draw', description: 'Card advantage', targetCount: 8, minCount: 6, maxCount: 10, priority: 5 },
          { name: 'Lands', description: 'Optimized mana base', targetCount: 30, minCount: 28, maxCount: 32, priority: 6 }
        ]),
        coreCards: JSON.stringify([]),
        flexSlots: JSON.stringify([])
      }
    })
  }
  
  console.log('✅ Created sample folders and templates')
}

async function createSampleDecksWithAnalytics(users: any[]) {
  console.log('🃏 Creating sample decks with analytics...')
  
  const sampleDecks = [
    {
      name: 'Atraxa Superfriends',
      commander: 'Atraxa, Praetors\' Voice',
      description: 'Planeswalker tribal deck with Atraxa',
      powerLevel: 7,
      budget: 450,
      tags: ['superfriends', 'planeswalkers', 'midrange']
    },
    {
      name: 'Edgar Markov Vampires',
      commander: 'Edgar Markov',
      description: 'Aggressive vampire tribal',
      powerLevel: 8,
      budget: 600,
      tags: ['tribal', 'vampires', 'aggro']
    },
    {
      name: 'Meren Reanimator',
      commander: 'Meren of Clan Nel Toth',
      description: 'Graveyard value engine',
      powerLevel: 7,
      budget: 350,
      tags: ['reanimator', 'graveyard', 'value']
    }
  ]
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const deckData = sampleDecks[i % sampleDecks.length]
    
    const deck = await prisma.deck.create({
      data: {
        userId: user.id,
        name: deckData.name,
        commander: deckData.commander,
        description: deckData.description,
        powerLevel: deckData.powerLevel,
        budget: deckData.budget,
        tags: deckData.tags,
        isPublic: true
      }
    })
    
    // Create analytics for the deck
    await prisma.deckAnalytics.create({
      data: {
        deckId: deck.id,
        manaAnalysis: JSON.stringify({
          colorRequirements: { W: 15, U: 12, B: 18, R: 8, G: 10 },
          manaEfficiency: 0.85,
          colorConsistency: { W: 0.9, U: 0.8, B: 0.95, R: 0.7, G: 0.85 }
        }),
        consistencyMetrics: JSON.stringify({
          keepableHands: 0.78,
          mulliganRate: 0.22,
          gameplayConsistency: 0.82,
          simulationRuns: 1000
        }),
        metaAnalysis: JSON.stringify({
          archetype: deckData.tags[0],
          metaShare: 0.12,
          winRate: 0.65,
          popularityTrend: 'stable'
        }),
        performanceData: JSON.stringify({
          gamesPlayed: 25,
          winRate: 0.68,
          averageGameLength: 45
        }),
        optimizationSuggestions: JSON.stringify([
          {
            type: 'add',
            cardId: 'card-123',
            category: 'ramp',
            reasoning: 'Improve mana consistency',
            impact: 0.8,
            confidence: 0.9
          }
        ]),
        analysisVersion: '1.0.0'
      }
    })
    
    // Create a goldfish simulation
    await prisma.goldfishSimulation.create({
      data: {
        deckId: deck.id,
        userId: user.id,
        simulationRuns: 1000,
        openingHandStats: JSON.stringify({
          averageCMC: 3.2,
          landCount: { 2: 0.15, 3: 0.35, 4: 0.25, 5: 0.15, 6: 0.08, 7: 0.02 },
          keepablePercentage: 0.78
        }),
        earlyGameStats: JSON.stringify({
          averageTurnToFirstSpell: 2.1,
          averageTurnToCommander: 4.2,
          earlyGameThreats: 1.8,
          earlyGameAnswers: 2.3
        }),
        keepableHands: 0.78,
        averageTurnToPlay: JSON.stringify({
          'turn-1': 0.15,
          'turn-2': 0.35,
          'turn-3': 0.25,
          'turn-4': 0.15
        }),
        mulliganRate: 0.22,
        gameplayConsistency: 0.82,
        simulationParameters: JSON.stringify({
          iterations: 1000,
          mulliganStrategy: 'balanced',
          playPattern: 'midrange',
          opponentPressure: 'medium'
        })
      }
    })
    
    // Create some game results
    for (let j = 0; j < 5; j++) {
      await prisma.gameResult.create({
        data: {
          userId: user.id,
          deckId: deck.id,
          opponent: `Opponent ${j + 1}`,
          opponentDeck: `Random Deck ${j + 1}`,
          result: Math.random() > 0.4 ? 'win' : 'loss',
          gameLength: Math.floor(Math.random() * 60) + 30,
          format: 'commander',
          notes: `Game ${j + 1} notes`,
          playedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        }
      })
    }
  }
  
  console.log('✅ Created sample decks with analytics')
}

async function createSampleCommunityContent(users: any[]) {
  console.log('🌟 Creating sample community content...')
  
  // Get some decks to make public
  const decks = await prisma.deck.findMany({
    take: 3,
    include: { user: true }
  })
  
  for (const deck of decks) {
    // Create public deck
    const publicDeck = await prisma.publicDeck.create({
      data: {
        deckId: deck.id,
        userId: deck.userId,
        name: deck.name,
        description: deck.description || 'A great deck for competitive play',
        commander: deck.commander || 'Unknown Commander',
        format: deck.format,
        cardCount: 100,
        estimatedBudget: deck.budget,
        powerLevel: deck.powerLevel,
        archetype: deck.tags[0] || 'midrange',
        tags: deck.tags,
        views: Math.floor(Math.random() * 500) + 50,
        likes: Math.floor(Math.random() * 50) + 5,
        comments: Math.floor(Math.random() * 20) + 2,
        copies: Math.floor(Math.random() * 30) + 3,
        rating: Math.random() * 2 + 3 // 3-5 rating
      }
    })
    
    // Create some comments
    for (let i = 0; i < 3; i++) {
      const commenter = users[Math.floor(Math.random() * users.length)]
      
      await prisma.deckComment.create({
        data: {
          publicDeckId: publicDeck.id,
          userId: commenter.id,
          content: `Great deck! I really like the ${deck.tags[0] || 'strategy'} approach. Have you considered adding more interaction?`,
          likes: Math.floor(Math.random() * 10)
        }
      })
    }
    
    // Create some likes
    for (const user of users) {
      if (Math.random() > 0.3) { // 70% chance to like
        await prisma.deckLike.create({
          data: {
            userId: user.id,
            publicDeckId: publicDeck.id
          }
        })
      }
    }
  }
  
  // Create some user follows
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (i !== j && Math.random() > 0.5) { // 50% chance to follow
        try {
          await prisma.userFollow.create({
            data: {
              followerId: users[i].id,
              followingId: users[j].id
            }
          })
        } catch (error) {
          // Ignore duplicate follow errors
        }
      }
    }
  }
  
  console.log('✅ Created sample community content')
}

async function createSampleImportExportJobs(users: any[]) {
  console.log('📥 Creating sample import/export jobs...')
  
  for (const user of users) {
    // Create import job
    await prisma.importJob.create({
      data: {
        userId: user.id,
        source: 'moxfield',
        status: 'completed',
        sourceUrl: 'https://moxfield.com/decks/sample-deck',
        decksFound: 1,
        decksImported: 1,
        errors: JSON.stringify([]),
        warnings: JSON.stringify([]),
        processingTime: 2500,
        completedAt: new Date()
      }
    })
    
    // Create export job
    await prisma.exportJob.create({
      data: {
        userId: user.id,
        deckIds: ['deck-1', 'deck-2'],
        format: JSON.stringify({
          id: 'moxfield',
          name: 'Moxfield Format',
          fileExtension: 'json',
          mimeType: 'application/json'
        }),
        options: JSON.stringify({
          includeCommander: true,
          includeSideboard: false,
          includeTokens: true,
          includeBasicLands: true,
          groupByCategory: true,
          includeQuantities: true,
          includePrices: false
        }),
        status: 'completed',
        downloadUrl: 'https://example.com/download/export-123.json',
        fileSize: 15420,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })
  }
  
  console.log('✅ Created sample import/export jobs')
}

async function createSamplePerformanceData(users: any[]) {
  console.log('📊 Creating sample performance data...')
  
  // Create performance metrics
  const operations = ['deck-analysis', 'card-search', 'import-deck', 'export-deck', 'goldfish-simulation']
  
  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const operation = operations[Math.floor(Math.random() * operations.length)]
    
    await prisma.performanceMetric.create({
      data: {
        userId: user.id,
        operation,
        duration: Math.floor(Math.random() * 5000) + 100, // 100-5100ms
        success: Math.random() > 0.1, // 90% success rate
        errorMessage: Math.random() > 0.9 ? 'Sample error message' : null,
        metadata: JSON.stringify({
          userAgent: 'Mozilla/5.0 (compatible; test)',
          endpoint: `/api/${operation}`,
          method: 'POST'
        }),
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }
    })
  }
  
  // Create cache entries
  const cacheKeys = ['popular-commanders', 'trending-cards', 'meta-analysis', 'card-prices']
  
  for (const key of cacheKeys) {
    await prisma.cacheEntry.create({
      data: {
        key,
        value: JSON.stringify({ data: `cached-${key}`, timestamp: Date.now() }),
        tags: ['system', 'popular'],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        hitCount: Math.floor(Math.random() * 100),
        lastAccessed: new Date()
      }
    })
  }
  
  // Create background jobs
  const jobTypes = ['deck-analysis', 'price-update', 'meta-sync', 'cache-cleanup']
  
  for (const jobType of jobTypes) {
    await prisma.backgroundJob.create({
      data: {
        type: jobType,
        status: 'completed',
        priority: Math.floor(Math.random() * 10),
        data: JSON.stringify({ jobType, parameters: {} }),
        result: JSON.stringify({ success: true, processed: Math.floor(Math.random() * 100) }),
        attempts: 1,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date()
      }
    })
  }
  
  // Create system health entries
  const components = ['database', 'api', 'ai-analysis', 'import-export', 'cache']
  
  for (const component of components) {
    await prisma.systemHealth.create({
      data: {
        component,
        status: 'healthy',
        metrics: JSON.stringify({
          uptime: Math.random() * 10 + 95, // 95-105% (over 100 for redundancy)
          responseTime: Math.random() * 100 + 50, // 50-150ms
          errorRate: Math.random() * 0.05, // 0-5%
          throughput: Math.random() * 1000 + 500 // 500-1500 req/min
        }),
        message: `${component} is operating normally`
      }
    })
  }
  
  console.log('✅ Created sample performance data')
}

async function createSampleTrendingData() {
  console.log('📈 Creating sample trending data...')
  
  const trendingItems = [
    // Trending commanders
    { type: 'commander', itemId: 'atraxa-praetors-voice', itemName: 'Atraxa, Praetors\' Voice', score: 95.5, timeframe: 'week' },
    { type: 'commander', itemId: 'edgar-markov', itemName: 'Edgar Markov', score: 89.2, timeframe: 'week' },
    { type: 'commander', itemId: 'meren-of-clan-nel-toth', itemName: 'Meren of Clan Nel Toth', score: 84.7, timeframe: 'week' },
    { type: 'commander', itemId: 'the-ur-dragon', itemName: 'The Ur-Dragon', score: 82.1, timeframe: 'week' },
    { type: 'commander', itemId: 'korvold-fae-cursed-king', itemName: 'Korvold, Fae-Cursed King', score: 79.8, timeframe: 'week' },
    
    // Trending cards
    { type: 'card', itemId: 'rhystic-study', itemName: 'Rhystic Study', score: 92.3, timeframe: 'week' },
    { type: 'card', itemId: 'smothering-tithe', itemName: 'Smothering Tithe', score: 88.7, timeframe: 'week' },
    { type: 'card', itemId: 'cyclonic-rift', itemName: 'Cyclonic Rift', score: 85.4, timeframe: 'week' },
    { type: 'card', itemId: 'sol-ring', itemName: 'Sol Ring', score: 98.9, timeframe: 'week' },
    { type: 'card', itemId: 'command-tower', itemName: 'Command Tower', score: 96.2, timeframe: 'week' },
    
    // Trending archetypes
    { type: 'archetype', itemId: 'superfriends', itemName: 'Superfriends', score: 78.3, timeframe: 'week' },
    { type: 'archetype', itemId: 'aristocrats', itemName: 'Aristocrats', score: 72.1, timeframe: 'week' },
    { type: 'archetype', itemId: 'voltron', itemName: 'Voltron', score: 68.9, timeframe: 'week' },
    { type: 'archetype', itemId: 'tribal', itemName: 'Tribal', score: 75.6, timeframe: 'week' },
    { type: 'archetype', itemId: 'combo', itemName: 'Combo', score: 81.2, timeframe: 'week' }
  ]
  
  for (const item of trendingItems) {
    await prisma.trendingData.create({
      data: {
        ...item,
        metadata: JSON.stringify({
          previousScore: item.score - (Math.random() * 10 - 5), // +/- 5 points
          trend: Math.random() > 0.5 ? 'up' : 'down',
          changePercent: (Math.random() * 20 - 10).toFixed(1) // +/- 10%
        })
      }
    })
  }
  
  console.log(`✅ Created ${trendingItems.length} trending data entries`)
}

// Run the seeding
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })