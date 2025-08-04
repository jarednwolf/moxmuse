#!/usr/bin/env tsx

/**
 * Verification script for AI Deck Building Tutor migration
 * 
 * This script verifies that the migration was successful by checking:
 * - All required tables exist
 * - Data integrity is maintained
 * - Indexes are properly created
 * - Sample data can be queried
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VerificationResult {
  passed: boolean
  message: string
  details?: any
}

async function verifyTableExists(tableName: string): Promise<VerificationResult> {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      );
    `
    
    const exists = (result as any)[0].exists
    
    return {
      passed: exists,
      message: exists 
        ? `✅ Table ${tableName} exists`
        : `❌ Table ${tableName} is missing`
    }
  } catch (error) {
    return {
      passed: false,
      message: `❌ Error checking table ${tableName}: ${error}`
    }
  }
}

async function verifyTableStructure(tableName: string, expectedColumns: string[]): Promise<VerificationResult> {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
      ORDER BY column_name;
    `
    
    const actualColumns = (result as any).map((row: any) => row.column_name)
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col))
    
    if (missingColumns.length === 0) {
      return {
        passed: true,
        message: `✅ Table ${tableName} has all required columns`,
        details: { actualColumns }
      }
    } else {
      return {
        passed: false,
        message: `❌ Table ${tableName} is missing columns: ${missingColumns.join(', ')}`,
        details: { actualColumns, missingColumns }
      }
    }
  } catch (error) {
    return {
      passed: false,
      message: `❌ Error checking table structure for ${tableName}: ${error}`
    }
  }
}

async function verifyIndexes(tableName: string, expectedIndexes: string[]): Promise<VerificationResult> {
  try {
    const result = await prisma.$queryRaw`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = ${tableName}
      AND schemaname = 'public';
    `
    
    const actualIndexes = (result as any).map((row: any) => row.indexname)
    const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.some(actual => actual.includes(idx)))
    
    if (missingIndexes.length === 0) {
      return {
        passed: true,
        message: `✅ Table ${tableName} has all required indexes`,
        details: { actualIndexes }
      }
    } else {
      return {
        passed: false,
        message: `⚠️  Table ${tableName} may be missing indexes: ${missingIndexes.join(', ')}`,
        details: { actualIndexes, missingIndexes }
      }
    }
  } catch (error) {
    return {
      passed: false,
      message: `❌ Error checking indexes for ${tableName}: ${error}`
    }
  }
}

async function verifyDataIntegrity(): Promise<VerificationResult> {
  try {
    // Check for orphaned records
    const orphanedCards = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM generated_deck_cards gdc
      LEFT JOIN generated_decks gd ON gdc.deck_id = gd.id
      WHERE gd.id IS NULL;
    `
    
    const orphanedAnalysis = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM deck_analysis da
      LEFT JOIN generated_decks gd ON da.deck_id = gd.id
      WHERE gd.id IS NULL;
    `
    
    const orphanedCardCount = (orphanedCards as any)[0].count
    const orphanedAnalysisCount = (orphanedAnalysis as any)[0].count
    
    if (orphanedCardCount === 0 && orphanedAnalysisCount === 0) {
      return {
        passed: true,
        message: '✅ No orphaned records found - data integrity is good'
      }
    } else {
      return {
        passed: false,
        message: `❌ Found orphaned records: ${orphanedCardCount} cards, ${orphanedAnalysisCount} analyses`,
        details: { orphanedCardCount, orphanedAnalysisCount }
      }
    }
  } catch (error) {
    return {
      passed: false,
      message: `❌ Error checking data integrity: ${error}`
    }
  }
}

async function verifySampleQueries(): Promise<VerificationResult> {
  try {
    // Test basic queries that the application will use
    const deckCount = await prisma.generatedDeck.count()
    const cardCount = await prisma.generatedDeckCard.count()
    const sessionCount = await prisma.consultationSession.count()
    
    // Test a complex query
    const decksWithCards = await prisma.generatedDeck.findMany({
      take: 1,
      include: {
        cards: true,
        analysis: true
      }
    })
    
    return {
      passed: true,
      message: '✅ Sample queries executed successfully',
      details: {
        deckCount,
        cardCount,
        sessionCount,
        sampleDeckFound: decksWithCards.length > 0
      }
    }
  } catch (error) {
    return {
      passed: false,
      message: `❌ Error executing sample queries: ${error}`
    }
  }
}

async function runVerification(): Promise<void> {
  console.log('🔍 Starting AI Deck Building Tutor migration verification...\n')
  
  const results: VerificationResult[] = []
  
  // Check required tables exist
  console.log('📋 Checking required tables...')
  const requiredTables = [
    'generated_decks',
    'generated_deck_cards',
    'deck_analysis',
    'consultation_sessions'
  ]
  
  for (const table of requiredTables) {
    const result = await verifyTableExists(table)
    results.push(result)
    console.log(`  ${result.message}`)
  }
  
  console.log()
  
  // Check table structures
  console.log('🏗️  Checking table structures...')
  
  const tableStructures = {
    generated_decks: [
      'id', 'user_id', 'session_id', 'name', 'commander', 'format',
      'strategy', 'win_conditions', 'power_level', 'estimated_budget',
      'consultation_data', 'generation_prompt', 'status',
      'created_at', 'updated_at'
    ],
    generated_deck_cards: [
      'id', 'deck_id', 'card_id', 'quantity', 'category', 'role',
      'reasoning', 'alternatives', 'upgrade_options', 'budget_options',
      'created_at'
    ],
    deck_analysis: [
      'id', 'deck_id', 'statistics', 'synergies', 'weaknesses',
      'strategy_description', 'win_condition_analysis',
      'play_pattern_description', 'analyzed_at'
    ],
    consultation_sessions: [
      'id', 'user_id', 'session_id', 'consultation_data',
      'current_step', 'completed', 'generated_deck_id',
      'created_at', 'updated_at'
    ]
  }
  
  for (const [table, columns] of Object.entries(tableStructures)) {
    const result = await verifyTableStructure(table, columns)
    results.push(result)
    console.log(`  ${result.message}`)
  }
  
  console.log()
  
  // Check indexes
  console.log('📊 Checking database indexes...')
  
  const expectedIndexes = {
    generated_decks: ['user_id', 'session_id', 'commander'],
    generated_deck_cards: ['deck_id', 'card_id'],
    deck_analysis: ['deck_id'],
    consultation_sessions: ['user_id', 'session_id']
  }
  
  for (const [table, indexes] of Object.entries(expectedIndexes)) {
    const result = await verifyIndexes(table, indexes)
    results.push(result)
    console.log(`  ${result.message}`)
  }
  
  console.log()
  
  // Check data integrity
  console.log('🔗 Checking data integrity...')
  const integrityResult = await verifyDataIntegrity()
  results.push(integrityResult)
  console.log(`  ${integrityResult.message}`)
  
  console.log()
  
  // Test sample queries
  console.log('🧪 Testing sample queries...')
  const queryResult = await verifySampleQueries()
  results.push(queryResult)
  console.log(`  ${queryResult.message}`)
  if (queryResult.details) {
    console.log(`    - Generated decks: ${queryResult.details.deckCount}`)
    console.log(`    - Deck cards: ${queryResult.details.cardCount}`)
    console.log(`    - Consultation sessions: ${queryResult.details.sessionCount}`)
  }
  
  console.log()
  
  // Summary
  const passedCount = results.filter(r => r.passed).length
  const totalCount = results.length
  const warningCount = results.filter(r => !r.passed && r.message.includes('⚠️')).length
  const errorCount = results.filter(r => !r.passed && r.message.includes('❌')).length
  
  console.log('📈 Verification Summary:')
  console.log(`  ✅ Passed: ${passedCount}/${totalCount}`)
  if (warningCount > 0) {
    console.log(`  ⚠️  Warnings: ${warningCount}`)
  }
  if (errorCount > 0) {
    console.log(`  ❌ Errors: ${errorCount}`)
  }
  
  if (errorCount === 0) {
    console.log('\n🎉 Migration verification completed successfully!')
    console.log('The AI Deck Building Tutor is ready for use.')
  } else {
    console.log('\n⚠️  Migration verification found issues.')
    console.log('Please review the errors above and fix them before proceeding.')
    process.exit(1)
  }
}

async function main() {
  try {
    await runVerification()
  } catch (error) {
    console.error('💥 Verification failed with error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  main()
}

export { runVerification }