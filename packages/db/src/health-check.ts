import { prisma } from './index'

export async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test basic connection
    await prisma.$connect()
    console.log('✅ Database connection established')
    
    // Test user table access
    const userCount = await prisma.user.count()
    console.log(`✅ User table accessible. Total users: ${userCount}`)
    
    // Test if we can create a test query
    const testQuery = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Raw queries working:', testQuery)
    
    return {
      success: true,
      userCount,
      message: 'Database connection healthy'
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database connection failed'
    }
  } finally {
    await prisma.$disconnect()
  }
}

export async function createTestUser() {
  try {
    console.log('🧪 Creating test user...')
    
    const testUser = await prisma.user.create({
      data: {
        email: 'test@moxmuse.com',
        name: 'Test User',
        password: '$2a$10$test.hash.for.development.only' // bcrypt hash of "password123"
      }
    })
    
    console.log('✅ Test user created:', testUser.email)
    return testUser
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log('ℹ️ Test user already exists')
      return await prisma.user.findUnique({
        where: { email: 'test@moxmuse.com' }
      })
    }
    console.error('❌ Failed to create test user:', error)
    throw error
  }
}