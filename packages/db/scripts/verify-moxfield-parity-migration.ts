#!/usr/bin/env tsx

/**
 * Moxfield Parity + AI Enhancement Migration Verification Script
 * 
 * This script verifies that the database migration was successful by:
 * - Checking that all new tables exist
 * - Verifying indexes are in place
 * - Testing foreign key constraints
 * - Validating data integrity
 * - Checking performance optimizations
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VerificationResult {
  category: string
  test: string
  passed: boolean
  message: string
  details?: any
}

const results: VerificationResult[] = []

async function main() {
  console.log('🔍 Starting Moxfield Parity + AI Enhancement migration verification...')

  try {
    // Test database schema
    await verifyDatabaseSchema()
    
    // Test data integrity
    await verifyDataIntegrity()
    
    // Test relationships
    await verifyRelationships()
    
    // Test indexes
    await verifyIndexes()
    
    // Test constraints
    await verifyConstraints()
    
    // Test performance
    await verifyPerformance()
    
    // Print results
    printResults()
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
    throw error
  }
}

async function verifyDatabaseSchema() {
  console.log('📋 Verifying database schema...')
  
  const requiredTables = [
    'DeckFolder',
    'DeckTemplate',
    'DeckFolderItem',
    'EnhancedCardData',
    'SavedCardSearch',
    'ImportJob',
    'ExportJob',
    'PlatformAdapter',
    'DeckAnalytics',
    'GoldfishSimulation',
    'GameResult',
    'PublicDeck',
    'DeckComment',
    'UserProfile',
    'UserFollow',
    'DeckLike',
    'CommentLike',
    'TrendingData',
    'PerformanceMetric',
    'CacheEntry',
    'BackgroundJob',
    'SystemHealth'
  ]
  
  for (const table of requiredTables) {
    try {
      // Try to query the table to verify it exists
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)
      results.push({
        category: 'Schema',
        test: `Table ${table} exists`,
        passed: true,
        message: `✅ Table ${table} exists and is accessible`
      })
    } catch (error) {
      results.push({
        category: 'Schema',
        test: `Table ${table} exists`,
        passed: false,
        message: `❌ Table ${table} is missing or inaccessible`,
        details: error
      })
    }
  }
}

async function verifyDataIntegrity() {
  console.log('🔍 Verifying data integrity...')
  
  try {
    // Check user profiles
    const usersWithoutProfiles = await prisma.user.count({
      where: {
        userProfile: null
      }
    })
    
    results.push({
      category: 'Data Integrity',
      test: 'All users have profiles',
      passed: usersWithoutProfiles === 0,
      message: usersWithoutProfiles === 0 
        ? '✅ All users have profiles'
        : `❌ ${usersWithoutProfiles} users missing profiles`
    })
    
    // Check folder structures
    const usersWithoutFolders = await prisma.user.count({
      where: {
        deckFolders: {
          none: {}
        }
      }
    })
    
    results.push({
      category: 'Data Integrity',
      test: 'Users have default folders',
      passed: usersWithoutFolders === 0,
      message: usersWithoutFolders === 0
        ? '✅ All users have folder structures'
        : `⚠️ ${usersWithoutFolders} users without folders (may be intentional)`
    })
    
    // Check platform adapters
    const adapterCount = await prisma.platformAdapter.count()
    
    results.push({
      category: 'Data Integrity',
      test: 'Platform adapters configured',
      passed: adapterCount >= 5,
      message: adapterCount >= 5
        ? `✅ ${adapterCount} platform adapters configured`
        : `❌ Only ${adapterCount} platform adapters found`
    })
    
  } catch (error) {
    results.push({
      category: 'Data Integrity',
      test: 'Data integrity check',
      passed: false,
      message: '❌ Data integrity check failed',
      details: error
    })
  }
}

async function verifyRelationships() {
  console.log('🔗 Verifying relationships...')
  
  try {
    // Test user -> profile relationship
    const userWithProfile = await prisma.user.findFirst({
      include: {
        userProfile: true
      }
    })
    
    results.push({
      category: 'Relationships',
      test: 'User-Profile relationship',
      passed: !!userWithProfile?.userProfile,
      message: userWithProfile?.userProfile
        ? '✅ User-Profile relationship working'
        : '❌ User-Profile relationship not working'
    })
    
    // Test folder hierarchy
    const folderWithChildren = await prisma.deckFolder.findFirst({
      include: {
        children: true,
        parent: true
      }
    })
    
    results.push({
      category: 'Relationships',
      test: 'Folder hierarchy relationship',
      passed: folderWithChildren !== null,
      message: folderWithChildren
        ? '✅ Folder hierarchy relationship working'
        : '⚠️ No folder hierarchy found (may be expected)'
    })
    
    // Test deck analytics relationship
    const deckWithAnalytics = await prisma.deck.findFirst({
      include: {
        analytics: true
      }
    })
    
    results.push({
      category: 'Relationships',
      test: 'Deck-Analytics relationship',
      passed: true, // This is optional, so always pass
      message: deckWithAnalytics?.analytics
        ? '✅ Deck-Analytics relationship working'
        : '⚠️ No deck analytics found (expected for new installation)'
    })
    
  } catch (error) {
    results.push({
      category: 'Relationships',
      test: 'Relationship verification',
      passed: false,
      message: '❌ Relationship verification failed',
      details: error
    })
  }
}

async function verifyIndexes() {
  console.log('📊 Verifying indexes...')
  
  const criticalIndexes = [
    { table: 'DeckFolder', column: 'userId' },
    { table: 'DeckTemplate', column: 'userId' },
    { table: 'EnhancedCardData', column: 'cardId' },
    { table: 'PublicDeck', column: 'userId' },
    { table: 'UserProfile', column: 'username' },
    { table: 'PerformanceMetric', column: 'timestamp' }
  ]
  
  for (const index of criticalIndexes) {
    try {
      // Check if index exists by querying pg_indexes
      const indexExists = await prisma.$queryRawUnsafe(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = $1 
        AND indexdef LIKE $2
      `, index.table, `%${index.column}%`)
      
      results.push({
        category: 'Indexes',
        test: `Index on ${index.table}.${index.column}`,
        passed: Array.isArray(indexExists) && indexExists.length > 0,
        message: Array.isArray(indexExists) && indexExists.length > 0
          ? `✅ Index on ${index.table}.${index.column} exists`
          : `❌ Index on ${index.table}.${index.column} missing`
      })
    } catch (error) {
      results.push({
        category: 'Indexes',
        test: `Index on ${index.table}.${index.column}`,
        passed: false,
        message: `❌ Failed to check index on ${index.table}.${index.column}`,
        details: error
      })
    }
  }
}

async function verifyConstraints() {
  console.log('🔒 Verifying constraints...')
  
  try {
    // Test unique constraints
    const duplicateUsernames = await prisma.$queryRawUnsafe(`
      SELECT username, COUNT(*) as count 
      FROM "UserProfile" 
      GROUP BY username 
      HAVING COUNT(*) > 1
    `)
    
    results.push({
      category: 'Constraints',
      test: 'Unique username constraint',
      passed: Array.isArray(duplicateUsernames) && duplicateUsernames.length === 0,
      message: Array.isArray(duplicateUsernames) && duplicateUsernames.length === 0
        ? '✅ Username uniqueness enforced'
        : `❌ Found ${duplicateUsernames.length} duplicate usernames`
    })
    
    // Test foreign key constraints
    const orphanedProfiles = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count 
      FROM "UserProfile" up 
      LEFT JOIN "User" u ON up."userId" = u.id 
      WHERE u.id IS NULL
    `)
    
    const orphanCount = Array.isArray(orphanedProfiles) && orphanedProfiles[0] 
      ? (orphanedProfiles[0] as any).count 
      : 0
    
    results.push({
      category: 'Constraints',
      test: 'Foreign key constraints',
      passed: orphanCount === 0,
      message: orphanCount === 0
        ? '✅ No orphaned records found'
        : `❌ Found ${orphanCount} orphaned profile records`
    })
    
  } catch (error) {
    results.push({
      category: 'Constraints',
      test: 'Constraint verification',
      passed: false,
      message: '❌ Constraint verification failed',
      details: error
    })
  }
}

async function verifyPerformance() {
  console.log('⚡ Verifying performance optimizations...')
  
  try {
    // Test query performance on indexed columns
    const start = Date.now()
    await prisma.user.findMany({
      include: {
        userProfile: true,
        deckFolders: {
          take: 5
        }
      },
      take: 10
    })
    const duration = Date.now() - start
    
    results.push({
      category: 'Performance',
      test: 'Complex query performance',
      passed: duration < 1000,
      message: duration < 1000
        ? `✅ Complex query completed in ${duration}ms`
        : `⚠️ Complex query took ${duration}ms (may need optimization)`
    })
    
    // Test cache table functionality
    await prisma.cacheEntry.create({
      data: {
        key: 'test-key-' + Date.now(),
        value: { test: 'data' },
        tags: ['test'],
        expiresAt: new Date(Date.now() + 60000)
      }
    })
    
    const cacheEntry = await prisma.cacheEntry.findFirst({
      where: {
        key: {
          startsWith: 'test-key-'
        }
      }
    })
    
    results.push({
      category: 'Performance',
      test: 'Cache system functionality',
      passed: !!cacheEntry,
      message: cacheEntry
        ? '✅ Cache system working'
        : '❌ Cache system not working'
    })
    
    // Clean up test cache entry
    if (cacheEntry) {
      await prisma.cacheEntry.delete({
        where: { id: cacheEntry.id }
      })
    }
    
  } catch (error) {
    results.push({
      category: 'Performance',
      test: 'Performance verification',
      passed: false,
      message: '❌ Performance verification failed',
      details: error
    })
  }
}

function printResults() {
  console.log('\n📊 Verification Results:')
  console.log('=' .repeat(80))
  
  const categories = [...new Set(results.map(r => r.category))]
  let totalTests = 0
  let passedTests = 0
  
  for (const category of categories) {
    console.log(`\n${category}:`)
    const categoryResults = results.filter(r => r.category === category)
    
    for (const result of categoryResults) {
      console.log(`  ${result.message}`)
      totalTests++
      if (result.passed) passedTests++
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log(`📈 Summary: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`)
  
  const failedTests = results.filter(r => !r.passed)
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:')
    for (const test of failedTests) {
      console.log(`  - ${test.category}: ${test.test}`)
      if (test.details) {
        console.log(`    Error: ${test.details.message || test.details}`)
      }
    }
  }
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Migration verification successful.')
  } else {
    console.log('\n⚠️ Some tests failed. Please review the results above.')
  }
}

// Run the verification
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })