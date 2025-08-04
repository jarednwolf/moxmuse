import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding demo user...')
  
  try {
    // Check if demo user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    })
    
    if (existingUser) {
      console.log('✅ Demo user already exists')
      return
    }
    
    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10)
    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        password: hashedPassword,
        name: 'Demo User',
        emailVerified: new Date()
      }
    })
    
    console.log('✅ Demo user created:', demoUser.email)
    
    // Create a sample deck for the demo user
    const sampleDeck = await prisma.deck.create({
      data: {
        userId: demoUser.id,
        name: 'Sample Commander Deck',
        format: 'commander',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    console.log('✅ Sample deck created:', sampleDeck.name)
    
  } catch (error) {
    console.error('❌ Error seeding demo user:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
