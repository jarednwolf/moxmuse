#!/usr/bin/env tsx

/**
 * Moxfield Parity + AI Enhancement Data Migration Script
 * 
 * This script migrates existing data to work with the new comprehensive schema.
 * It handles:
 * - Creating default user profiles for existing users
 * - Setting up default folder structures
 * - Migrating existing deck data to enhanced format
 * - Creating initial platform adapter configurations
 * - Setting up performance monitoring baselines
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting Moxfield Parity + AI Enhancement data migration...')

  try {
    // Step 1: Create user profiles for existing users
    await createUserProfiles()
    
    // Step 2: Create default folder structures
    await createDefaultFolders()
    
    // Step 3: Set up platform adapters
    await setupPlatformAdapters()
    
    // Step 4: Initialize performance monitoring
    await initializePerformanceMonitoring()
    
    // Step 5: Create default deck templates
    await createDefaultTemplates()
    
    // Step 6: Initialize trending data
    await initializeTrendingData()
    
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

async function createUserProfiles() {
  console.log('📝 Creating user profiles for existing users...')
  
  const users = await prisma.user.findMany({
    where: {
      userProfile: null
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  })
  
  console.log(`Found ${users.length} users without profiles`)
  
  for (const user of users) {
    // Generate a unique username from email or name
    const baseUsername = user.name 
      ? user.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      : user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
    
    let username = baseUsername
    let counter = 1
    
    // Ensure username uniqueness
    while (await prisma.userProfile.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`
      counter++
    }
    
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        username,
        displayName: user.name || username,
        bio: 'MTG deck builder and enthusiast',
        favoriteFormats: ['commander'],
        favoriteArchetypes: [],
        brewingStyle: ['casual'],
        achievements: [],
        isPublic: true,
        lastActive: new Date()
      }
    })
  }
  
  console.log(`✅ Created ${users.length} user profiles`)
}

async function createDefaultFolders() {
  console.log('📁 Creating default folder structures...')
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      deckFolders: true
    }
  })
  
  for (const user of users) {
    if (user.deckFolders.length === 0) {
      // Create default folder structure
      const folders = [
        {
          name: 'Commander Decks',
          description: 'My Commander/EDH decks',
          color: '#8b5cf6'
        },
        {
          name: 'Work in Progress',
          description: 'Decks I\'m currently building',
          color: '#f59e0b'
        },
        {
          name: 'Competitive',
          description: 'High-power competitive decks',
          color: '#ef4444'
        },
        {
          name: 'Casual',
          description: 'Fun casual decks for kitchen table',
          color: '#10b981'
        }
      ]
      
      for (let i = 0; i < folders.length; i++) {
        await prisma.deckFolder.create({
          data: {
            userId: user.id,
            name: folders[i].name,
            description: folders[i].description,
            color: folders[i].color,
            sortOrder: i
          }
        })
      }
    }
  }
  
  console.log('✅ Created default folder structures')
}

async function setupPlatformAdapters() {
  console.log('🔌 Setting up platform adapters...')
  
  const adapters = [
    {
      id: 'moxfield',
      name: 'Moxfield',
      type: 'both',
      isActive: true,
      configuration: {
        baseUrl: 'https://api.moxfield.com',
        supportedFormats: ['commander', 'standard', 'modern', 'legacy', 'vintage'],
        rateLimit: 100,
        timeout: 30000
      },
      supportedFormats: ['commander', 'standard', 'modern', 'legacy', 'vintage']
    },
    {
      id: 'archidekt',
      name: 'Archidekt',
      type: 'both',
      isActive: true,
      configuration: {
        baseUrl: 'https://archidekt.com/api',
        supportedFormats: ['commander', 'standard', 'modern'],
        rateLimit: 60,
        timeout: 30000
      },
      supportedFormats: ['commander', 'standard', 'modern']
    },
    {
      id: 'tappedout',
      name: 'TappedOut',
      type: 'import',
      isActive: true,
      configuration: {
        baseUrl: 'https://tappedout.net',
        supportedFormats: ['commander', 'standard', 'modern', 'legacy'],
        rateLimit: 30,
        timeout: 45000
      },
      supportedFormats: ['commander', 'standard', 'modern', 'legacy']
    },
    {
      id: 'edhrec',
      name: 'EDHREC',
      type: 'import',
      isActive: true,
      configuration: {
        baseUrl: 'https://edhrec.com/api',
        supportedFormats: ['commander'],
        rateLimit: 120,
        timeout: 30000
      },
      supportedFormats: ['commander']
    },
    {
      id: 'mtggoldfish',
      name: 'MTGGoldfish',
      type: 'import',
      isActive: true,
      configuration: {
        baseUrl: 'https://www.mtggoldfish.com',
        supportedFormats: ['commander', 'standard', 'modern', 'legacy', 'vintage'],
        rateLimit: 60,
        timeout: 30000
      },
      supportedFormats: ['commander', 'standard', 'modern', 'legacy', 'vintage']
    },
    {
      id: 'csv',
      name: 'CSV Import',
      type: 'import',
      isActive: true,
      configuration: {
        supportedColumns: ['name', 'quantity', 'set', 'collector_number', 'condition'],
        delimiter: ',',
        encoding: 'utf-8'
      },
      supportedFormats: ['all']
    },
    {
      id: 'text',
      name: 'Text List',
      type: 'import',
      isActive: true,
      configuration: {
        supportedFormats: ['simple', 'detailed', 'arena'],
        autoDetectFormat: true
      },
      supportedFormats: ['all']
    }
  ]
  
  for (const adapter of adapters) {
    await prisma.platformAdapter.upsert({
      where: { id: adapter.id },
      update: adapter,
      create: adapter
    })
  }
  
  console.log(`✅ Set up ${adapters.length} platform adapters`)
}

async function initializePerformanceMonitoring() {
  console.log('📊 Initializing performance monitoring...')
  
  // Create initial system health entries
  const components = [
    'database',
    'api',
    'ai-analysis',
    'import-export',
    'cache',
    'background-jobs'
  ]
  
  for (const component of components) {
    await prisma.systemHealth.create({
      data: {
        component,
        status: 'healthy',
        metrics: {
          uptime: 100,
          responseTime: 0,
          errorRate: 0
        },
        message: 'System initialized'
      }
    })
  }
  
  console.log('✅ Initialized performance monitoring')
}

async function createDefaultTemplates() {
  console.log('📋 Creating default deck templates...')
  
  const templates = [
    {
      name: 'Commander Deck Template',
      description: 'Standard Commander deck structure with balanced categories',
      format: 'commander',
      archetype: 'midrange',
      isPublic: true,
      powerLevel: 6,
      estimatedBudget: 200,
      tags: ['commander', 'balanced', 'midrange'],
      categories: [
        { name: 'Ramp', description: 'Mana acceleration', targetCount: 10, minCount: 8, maxCount: 12, priority: 1 },
        { name: 'Draw', description: 'Card advantage', targetCount: 10, minCount: 8, maxCount: 12, priority: 2 },
        { name: 'Removal', description: 'Interaction and answers', targetCount: 10, minCount: 8, maxCount: 12, priority: 3 },
        { name: 'Threats', description: 'Win conditions', targetCount: 15, minCount: 12, maxCount: 18, priority: 4 },
        { name: 'Utility', description: 'Support cards', targetCount: 15, minCount: 10, maxCount: 20, priority: 5 },
        { name: 'Lands', description: 'Mana base', targetCount: 37, minCount: 35, maxCount: 39, priority: 6 }
      ],
      coreCards: [],
      flexSlots: [
        { category: 'Ramp', count: 3, criteria: 'CMC <= 3', suggestions: [] },
        { category: 'Draw', count: 3, criteria: 'Card advantage engines', suggestions: [] },
        { category: 'Removal', count: 5, criteria: 'Flexible removal spells', suggestions: [] }
      ]
    },
    {
      name: 'Budget Commander Template',
      description: 'Budget-friendly Commander deck under $50',
      format: 'commander',
      archetype: 'budget',
      isPublic: true,
      powerLevel: 4,
      estimatedBudget: 50,
      tags: ['commander', 'budget', 'casual'],
      categories: [
        { name: 'Ramp', description: 'Budget mana acceleration', targetCount: 8, minCount: 6, maxCount: 10, priority: 1 },
        { name: 'Draw', description: 'Budget card draw', targetCount: 8, minCount: 6, maxCount: 10, priority: 2 },
        { name: 'Removal', description: 'Budget removal', targetCount: 8, minCount: 6, maxCount: 10, priority: 3 },
        { name: 'Threats', description: 'Budget threats', targetCount: 20, minCount: 18, maxCount: 22, priority: 4 },
        { name: 'Utility', description: 'Budget utility', targetCount: 18, minCount: 15, maxCount: 20, priority: 5 },
        { name: 'Lands', description: 'Basic lands and budget duals', targetCount: 37, minCount: 35, maxCount: 39, priority: 6 }
      ],
      coreCards: [],
      flexSlots: []
    },
    {
      name: 'Competitive Commander Template',
      description: 'High-power competitive Commander deck',
      format: 'commander',
      archetype: 'competitive',
      isPublic: true,
      powerLevel: 9,
      estimatedBudget: 1000,
      tags: ['commander', 'competitive', 'cedh'],
      categories: [
        { name: 'Fast Mana', description: 'Explosive mana acceleration', targetCount: 12, minCount: 10, maxCount: 15, priority: 1 },
        { name: 'Card Selection', description: 'Tutors and selection', targetCount: 8, minCount: 6, maxCount: 10, priority: 2 },
        { name: 'Interaction', description: 'Counterspells and removal', targetCount: 12, minCount: 10, maxCount: 15, priority: 3 },
        { name: 'Win Conditions', description: 'Combo pieces and finishers', targetCount: 8, minCount: 6, maxCount: 10, priority: 4 },
        { name: 'Card Advantage', description: 'Draw engines', targetCount: 6, minCount: 4, maxCount: 8, priority: 5 },
        { name: 'Lands', description: 'Optimized mana base', targetCount: 30, minCount: 28, maxCount: 32, priority: 6 }
      ],
      coreCards: [],
      flexSlots: []
    }
  ]
  
  // Create templates for the first admin user (if exists)
  const adminUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' }
  })
  
  if (adminUser) {
    for (const template of templates) {
      await prisma.deckTemplate.create({
        data: {
          ...template,
          userId: adminUser.id,
          categories: JSON.stringify(template.categories),
          coreCards: JSON.stringify(template.coreCards),
          flexSlots: JSON.stringify(template.flexSlots)
        }
      })
    }
  }
  
  console.log(`✅ Created ${templates.length} default templates`)
}

async function initializeTrendingData() {
  console.log('📈 Initializing trending data...')
  
  // Create some sample trending data
  const trendingItems = [
    { type: 'commander', itemId: 'commander-1', itemName: 'Atraxa, Praetors\' Voice', score: 95.5, timeframe: 'week' },
    { type: 'commander', itemId: 'commander-2', itemName: 'Edgar Markov', score: 89.2, timeframe: 'week' },
    { type: 'commander', itemId: 'commander-3', itemName: 'Meren of Clan Nel Toth', score: 84.7, timeframe: 'week' },
    { type: 'archetype', itemId: 'archetype-1', itemName: 'Superfriends', score: 78.3, timeframe: 'week' },
    { type: 'archetype', itemId: 'archetype-2', itemName: 'Aristocrats', score: 72.1, timeframe: 'week' },
    { type: 'archetype', itemId: 'archetype-3', itemName: 'Voltron', score: 68.9, timeframe: 'week' }
  ]
  
  for (const item of trendingItems) {
    await prisma.trendingData.create({
      data: item
    })
  }
  
  console.log(`✅ Initialized trending data with ${trendingItems.length} items`)
}

// Run the migration
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })