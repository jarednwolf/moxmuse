import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Global test setup
beforeAll(async () => {
  console.log('🚀 Setting up comprehensive test environment...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
  process.env.OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || 'test-key'
  
  // Mock external services for testing
  setupServiceMocks()
  
  // Initialize test database
  await setupTestDatabase()
  
  // Initialize test cache
  await setupTestCache()
  
  console.log('✅ Test environment setup complete')
})

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
  
  // Clean up test database
  await cleanupTestDatabase()
  
  // Clean up test cache
  await cleanupTestCache()
  
  console.log('✅ Test environment cleanup complete')
})

beforeEach(async () => {
  // Reset mocks before each test
  vi.clearAllMocks()
  
  // Clear test data
  await clearTestData()
})

afterEach(async () => {
  // Additional cleanup after each test if needed
  vi.restoreAllMocks()
})

// Service mocks setup
function setupServiceMocks() {
  // Mock OpenAI API
  vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  commander: 'Atraxa, Praetors\' Voice',
                  cards: generateMockCardList(99),
                  strategy: 'counters',
                  winConditions: ['planeswalker ultimate', 'combat damage'],
                  synergies: generateMockSynergies()
                })
              }
            }]
          })
        }
      }
    }))
  }))
  
  // Mock Scryfall API
  vi.mock('@/services/scryfall', () => ({
    ScryfallService: vi.fn().mockImplementation(() => ({
      getCard: vi.fn().mockResolvedValue(generateMockCard()),
      searchCards: vi.fn().mockResolvedValue({
        data: [generateMockCard()],
        total_cards: 1
      }),
      getBulkData: vi.fn().mockResolvedValue({
        data: Array.from({ length: 100 }, () => generateMockCard())
      })
    }))
  }))
  
  // Mock Redis for caching
  vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      flushdb: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK')
    }))
  }))
  
  // Mock Sentry for error tracking
  vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn()
  }))
}

// Database setup
async function setupTestDatabase() {
  try {
    // Run database migrations
    await execAsync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    })
    
    // Seed test data
    await seedTestData()
    
    console.log('✅ Test database initialized')
  } catch (error) {
    console.error('❌ Failed to setup test database:', error)
    throw error
  }
}

async function cleanupTestDatabase() {
  try {
    // Clean up test data
    await execAsync('npx prisma db push --force-reset', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    })
    
    console.log('✅ Test database cleaned up')
  } catch (error) {
    console.error('❌ Failed to cleanup test database:', error)
  }
}

async function seedTestData() {
  // Import Prisma client
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
  
  try {
    // Create test users
    await prisma.user.createMany({
      data: [
        {
          id: 'test-user-1',
          email: 'test1@example.com',
          name: 'Test User 1'
        },
        {
          id: 'test-user-2',
          email: 'test2@example.com',
          name: 'Test User 2'
        }
      ],
      skipDuplicates: true
    })
    
    // Create test cards
    const testCards = Array.from({ length: 50 }, (_, i) => ({
      id: `test-card-${i}`,
      name: `Test Card ${i}`,
      manaCost: `{${Math.floor(Math.random() * 8)}}`,
      cmc: Math.floor(Math.random() * 8),
      typeLine: 'Creature — Test',
      oracleText: `Test card ${i} oracle text`,
      colors: ['W'],
      colorIdentity: ['W'],
      legalities: { commander: 'legal' },
      imageUris: { normal: `https://example.com/card-${i}.jpg` },
      prices: { usd: (Math.random() * 50).toFixed(2) }
    }))
    
    await prisma.card.createMany({
      data: testCards,
      skipDuplicates: true
    })
    
    console.log('✅ Test data seeded')
  } catch (error) {
    console.error('❌ Failed to seed test data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function clearTestData() {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
  
  try {
    // Clear test-specific data
    await prisma.generatedDeck.deleteMany({
      where: {
        sessionId: {
          startsWith: 'test-'
        }
      }
    })
    
    await prisma.consultationSession.deleteMany({
      where: {
        id: {
          startsWith: 'test-'
        }
      }
    })
  } catch (error) {
    console.error('❌ Failed to clear test data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Cache setup
async function setupTestCache() {
  // Redis setup is handled by mocks
  console.log('✅ Test cache initialized')
}

async function cleanupTestCache() {
  // Redis cleanup is handled by mocks
  console.log('✅ Test cache cleaned up')
}

// Mock data generators
function generateMockCard() {
  const id = Math.random().toString(36).substring(7)
  return {
    id,
    name: `Mock Card ${id}`,
    mana_cost: '{2}{W}',
    cmc: 3,
    type_line: 'Creature — Human Soldier',
    oracle_text: 'A mock card for testing purposes.',
    colors: ['W'],
    color_identity: ['W'],
    legalities: { commander: 'legal' },
    image_uris: { normal: `https://example.com/mock-${id}.jpg` },
    prices: { usd: (Math.random() * 20).toFixed(2) }
  }
}

function generateMockCardList(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-card-${i}`,
    name: `Mock Card ${i}`,
    quantity: 1,
    cmc: Math.floor(Math.random() * 8),
    types: ['Creature'],
    colors: ['W']
  }))
}

function generateMockSynergies() {
  return [
    {
      cards: ['Atraxa, Praetors\' Voice', 'Doubling Season'],
      type: 'combo',
      description: 'Atraxa proliferates the loyalty counters doubled by Doubling Season'
    },
    {
      cards: ['Atraxa, Praetors\' Voice', 'Planeswalker cards'],
      type: 'synergy',
      description: 'Atraxa helps planeswalkers reach their ultimate abilities faster'
    }
  ]
}

// Performance monitoring for tests
let testStartTime: number
let memoryUsageStart: NodeJS.MemoryUsage

beforeEach(() => {
  testStartTime = Date.now()
  memoryUsageStart = process.memoryUsage()
})

afterEach(() => {
  const testEndTime = Date.now()
  const testDuration = testEndTime - testStartTime
  const memoryUsageEnd = process.memoryUsage()
  const memoryDelta = memoryUsageEnd.heapUsed - memoryUsageStart.heapUsed
  
  // Log performance metrics for long-running tests
  if (testDuration > 10000) { // 10 seconds
    console.log(`⚠️  Long-running test: ${testDuration}ms`)
  }
  
  if (memoryDelta > 50 * 1024 * 1024) { // 50MB
    console.log(`⚠️  High memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`)
  }
})

// Global error handlers for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})