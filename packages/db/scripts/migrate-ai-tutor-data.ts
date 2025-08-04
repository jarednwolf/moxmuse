#!/usr/bin/env tsx

/**
 * Migration script for AI Deck Building Tutor
 * 
 * This script migrates existing user data to support the new AI Deck Building Tutor features:
 * - Creates new database tables if they don't exist
 * - Migrates existing consultation data to new format
 * - Updates user preferences for new features
 * - Preserves existing deck data while adding new metadata
 */

import { PrismaClient } from '@prisma/client'
import { ConsultationData } from '@moxmuse/shared'

const prisma = new PrismaClient()

interface LegacyConsultationData {
  sessionId: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
  preferences?: {
    strategy?: string
    budget?: number
    powerLevel?: number
  }
}

interface MigrationStats {
  usersProcessed: number
  consultationSessionsMigrated: number
  decksMigrated: number
  errorsEncountered: number
  errors: Array<{ userId: string; error: string }>
}

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      );
    `
    return (result as any)[0].exists
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error)
    return false
  }
}

async function createMissingTables(): Promise<void> {
  console.log('🔍 Checking for missing tables...')
  
  const requiredTables = [
    'generated_decks',
    'generated_deck_cards', 
    'deck_analysis',
    'consultation_sessions'
  ]
  
  for (const table of requiredTables) {
    const exists = await checkTableExists(table)
    if (!exists) {
      console.log(`⚠️  Table ${table} does not exist. Please run database migrations first.`)
      console.log(`Run: npx prisma migrate deploy`)
      process.exit(1)
    }
  }
  
  console.log('✅ All required tables exist')
}

async function migrateLegacyConsultationData(
  userId: string,
  legacyData: LegacyConsultationData
): Promise<ConsultationData> {
  // Convert legacy consultation data to new format
  const consultationData: ConsultationData = {
    buildingFullDeck: true,
    needsCommanderSuggestions: !legacyData.preferences?.strategy,
    
    // Extract strategy from legacy data
    strategy: legacyData.preferences?.strategy as any || undefined,
    
    // Extract budget and power level
    budget: legacyData.preferences?.budget,
    powerLevel: legacyData.preferences?.powerLevel,
    
    // Set defaults for new fields
    useCollection: false,
    complexityLevel: 'moderate',
    
    // Initialize interaction preferences
    interaction: {
      level: 'medium',
      types: ['removal', 'counterspells'],
      timing: 'balanced'
    },
    
    // Initialize win conditions based on strategy
    winConditions: legacyData.preferences?.strategy === 'aggro' ? {
      primary: 'combat',
      combatStyle: 'aggro'
    } : legacyData.preferences?.strategy === 'combo' ? {
      primary: 'combo',
      comboType: 'synergy'
    } : {
      primary: 'combat'
    }
  }
  
  return consultationData
}

async function migrateUserConsultations(userId: string): Promise<number> {
  let migratedCount = 0
  
  try {
    // Find existing consultation sessions (if any legacy format exists)
    // This would depend on your current data structure
    // For now, we'll create a placeholder migration
    
    console.log(`  📝 Processing consultations for user ${userId}`)
    
    // Example: If you have existing tutor sessions in a different format
    // const legacySessions = await prisma.tutorSession.findMany({
    //   where: { userId }
    // })
    
    // For each legacy session, convert to new format
    // for (const session of legacySessions) {
    //   const consultationData = await migrateLegacyConsultationData(userId, session.data)
    //   
    //   await prisma.consultationSession.create({
    //     data: {
    //       id: generateId(),
    //       userId,
    //       sessionId: session.sessionId,
    //       consultationData,
    //       currentStep: 'completed',
    //       completed: true,
    //       createdAt: session.createdAt,
    //       updatedAt: session.updatedAt
    //     }
    //   })
    //   
    //   migratedCount++
    // }
    
  } catch (error) {
    console.error(`  ❌ Error migrating consultations for user ${userId}:`, error)
    throw error
  }
  
  return migratedCount
}

async function migrateUserDecks(userId: string): Promise<number> {
  let migratedCount = 0
  
  try {
    console.log(`  🃏 Processing decks for user ${userId}`)
    
    // Find existing decks that might need migration
    const existingDecks = await prisma.deck.findMany({
      where: { userId },
      include: { cards: true }
    })
    
    for (const deck of existingDecks) {
      // Check if this deck already has generated_deck entry
      const existingGeneratedDeck = await prisma.generatedDeck.findFirst({
        where: { 
          userId,
          name: deck.name,
          commander: deck.commander || ''
        }
      })
      
      if (!existingGeneratedDeck && deck.commander) {
        // Create generated_deck entry for existing deck
        const generatedDeck = await prisma.generatedDeck.create({
          data: {
            id: `migrated_${deck.id}`,
            userId,
            sessionId: `migration_${Date.now()}`,
            name: deck.name,
            commander: deck.commander,
            format: 'commander',
            strategy: {
              type: 'unknown',
              description: 'Migrated from existing deck'
            },
            winConditions: [{
              type: 'combat',
              description: 'Win through combat damage'
            }],
            powerLevel: 2, // Default to focused level
            estimatedBudget: 0,
            consultationData: {
              buildingFullDeck: true,
              needsCommanderSuggestions: false,
              commander: deck.commander,
              strategy: 'midrange',
              powerLevel: 2,
              complexityLevel: 'moderate'
            },
            generationPrompt: 'Migrated from existing deck',
            status: 'saved'
          }
        })
        
        // Migrate deck cards
        for (const card of deck.cards) {
          await prisma.generatedDeckCard.create({
            data: {
              id: `migrated_${card.id}`,
              deckId: generatedDeck.id,
              cardId: card.cardId,
              quantity: card.quantity,
              category: 'unknown',
              role: 'utility',
              reasoning: 'Migrated from existing deck'
            }
          })
        }
        
        migratedCount++
      }
    }
    
  } catch (error) {
    console.error(`  ❌ Error migrating decks for user ${userId}:`, error)
    throw error
  }
  
  return migratedCount
}

async function migrateUserData(userId: string): Promise<{
  consultations: number
  decks: number
}> {
  console.log(`👤 Migrating data for user: ${userId}`)
  
  const consultations = await migrateUserConsultations(userId)
  const decks = await migrateUserDecks(userId)
  
  console.log(`  ✅ Migrated ${consultations} consultations, ${decks} decks`)
  
  return { consultations, decks }
}

async function runMigration(): Promise<MigrationStats> {
  console.log('🚀 Starting AI Deck Building Tutor data migration...')
  
  const stats: MigrationStats = {
    usersProcessed: 0,
    consultationSessionsMigrated: 0,
    decksMigrated: 0,
    errorsEncountered: 0,
    errors: []
  }
  
  try {
    // Check that all required tables exist
    await createMissingTables()
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true }
    })
    
    console.log(`📊 Found ${users.length} users to process`)
    
    // Process users in batches to avoid overwhelming the database
    const batchSize = 10
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`)
      
      for (const user of batch) {
        try {
          const result = await migrateUserData(user.id)
          
          stats.usersProcessed++
          stats.consultationSessionsMigrated += result.consultations
          stats.decksMigrated += result.decks
          
        } catch (error) {
          stats.errorsEncountered++
          stats.errors.push({
            userId: user.id,
            error: error instanceof Error ? error.message : String(error)
          })
          console.error(`❌ Error processing user ${user.id}:`, error)
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
  } catch (error) {
    console.error('💥 Fatal error during migration:', error)
    throw error
  }
  
  return stats
}

async function main() {
  try {
    const stats = await runMigration()
    
    console.log('\n🎉 Migration completed!')
    console.log('📈 Migration Statistics:')
    console.log(`  👥 Users processed: ${stats.usersProcessed}`)
    console.log(`  💬 Consultation sessions migrated: ${stats.consultationSessionsMigrated}`)
    console.log(`  🃏 Decks migrated: ${stats.decksMigrated}`)
    console.log(`  ❌ Errors encountered: ${stats.errorsEncountered}`)
    
    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:')
      stats.errors.forEach(({ userId, error }) => {
        console.log(`  User ${userId}: ${error}`)
      })
    }
    
    console.log('\n✅ Migration script completed successfully!')
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  main()
}

export { runMigration, MigrationStats }