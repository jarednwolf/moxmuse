#!/usr/bin/env tsx

import { Command } from 'commander'
import { PrismaClient } from '@prisma/client'
import { cardDatabaseManagementService } from '../../api/src/services/card-database-management'
import { enhancedCardSearchService } from '../../api/src/services/enhanced-card-search'
import { syncJobSchedulerService } from '../../api/src/services/sync-job-scheduler'

const prisma = new PrismaClient()
const program = new Command()

program
  .name('manage-card-database')
  .description('CLI tool for managing the card database')
  .version('1.0.0')

// Import commands
program
  .command('import')
  .description('Perform incremental bulk data import')
  .option('--force', 'Force full reimport even if data is up to date')
  .action(async () => {
    try {
      console.log('🚀 Starting incremental bulk import...')
      
      const result = await cardDatabaseManagementService.performIncrementalImport()
      
      if (result.success) {
        console.log('✅ Import completed successfully!')
        console.log(`   Cards added: ${result.cardsAdded}`)
        console.log(`   Cards updated: ${result.cardsUpdated}`)
        console.log(`   Cards removed: ${result.cardsRemoved}`)
        console.log(`   Duration: ${result.duration}ms`)
        
        if (result.errors.length > 0) {
          console.log(`⚠️  Errors: ${result.errors.length}`)
          result.errors.slice(0, 10).forEach(error => {
            console.log(`   - ${error}`)
          })
        }
      } else {
        console.error('❌ Import failed!')
        result.errors.forEach(error => {
          console.error(`   - ${error}`)
        })
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Import failed:', error)
      process.exit(1)
    }
  })

// Index management commands
program
  .command('create-indexes')
  .description('Create search indexes for optimal performance')
  .action(async () => {
    try {
      console.log('🔧 Creating search indexes...')
      
      await cardDatabaseManagementService.createSearchIndexes()
      
      console.log('✅ Search indexes created successfully!')
    } catch (error) {
      console.error('❌ Index creation failed:', error)
      process.exit(1)
    }
  })

// Health check commands
program
  .command('health')
  .description('Perform comprehensive health check')
  .option('--detailed', 'Show detailed health information')
  .action(async (options) => {
    try {
      console.log('🏥 Performing health check...')
      
      const health = await cardDatabaseManagementService.performHealthCheck()
      
      console.log(`\nOverall Status: ${health.status.toUpperCase()}`)
      console.log(`Total Cards: ${health.summary.totalCards.toLocaleString()}`)
      console.log(`Last Import: ${health.summary.lastImport || 'Never'}`)
      console.log(`Index Health: ${health.summary.indexHealth}`)
      console.log(`Cache Health: ${health.summary.cacheHealth}`)
      
      if (options.detailed) {
        console.log('\nDetailed Checks:')
        health.checks.forEach(check => {
          const status = check.status === 'pass' ? '✅' : 
                        check.status === 'warn' ? '⚠️' : '❌'
          console.log(`${status} ${check.name}: ${check.message} (${check.duration}ms)`)
        })
      } else {
        const failedChecks = health.checks.filter(c => c.status === 'fail')
        const warnChecks = health.checks.filter(c => c.status === 'warn')
        
        if (failedChecks.length > 0) {
          console.log('\nFailed Checks:')
          failedChecks.forEach(check => {
            console.log(`❌ ${check.name}: ${check.message}`)
          })
        }
        
        if (warnChecks.length > 0) {
          console.log('\nWarning Checks:')
          warnChecks.forEach(check => {
            console.log(`⚠️  ${check.name}: ${check.message}`)
          })
        }
      }
      
      if (health.status === 'unhealthy') {
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Health check failed:', error)
      process.exit(1)
    }
  })

// Search testing commands
program
  .command('test-search')
  .description('Test search functionality')
  .argument('<query>', 'Search query to test')
  .option('--limit <number>', 'Number of results to return', '10')
  .action(async (query, options) => {
    try {
      console.log(`🔍 Testing search for: "${query}"`)
      
      const results = await enhancedCardSearchService.searchCards({
        text: query,
        limit: parseInt(options.limit)
      })
      
      console.log(`\nFound ${results.totalCount} cards (showing ${results.cards.length}):`)
      console.log(`Search time: ${results.searchTime}ms`)
      
      results.cards.forEach((card, index) => {
        console.log(`${index + 1}. ${card.name} (${card.manaCost || 'No cost'}) - ${card.typeLine}`)
        if (card.relevanceScore) {
          console.log(`   Relevance: ${card.relevanceScore.toFixed(2)}`)
        }
      })
      
      if (results.suggestions.length > 0) {
        console.log('\nSuggestions:')
        results.suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion}`)
        })
      }
    } catch (error) {
      console.error('❌ Search test failed:', error)
      process.exit(1)
    }
  })

// Sync job management commands
const syncCommand = program
  .command('sync')
  .description('Manage sync jobs')

syncCommand
  .command('status')
  .description('Show status of all sync jobs')
  .action(async () => {
    try {
      await syncJobSchedulerService.initialize()
      
      const statuses = await syncJobSchedulerService.getJobStatuses()
      
      console.log('📊 Sync Job Status:')
      console.log('─'.repeat(80))
      
      statuses.forEach(job => {
        const status = job.enabled ? 
          (job.status === 'running' ? '🔄 Running' : 
           job.status === 'error' ? '❌ Error' : '✅ Ready') :
          '⏸️  Disabled'
        
        console.log(`${status} ${job.name}`)
        console.log(`   Description: ${job.description}`)
        console.log(`   Schedule: ${job.schedule}`)
        console.log(`   Last Run: ${job.lastRun || 'Never'}`)
        console.log(`   Next Run: ${job.nextRun || 'N/A'}`)
        console.log(`   Success Rate: ${job.runCount > 0 ? Math.round((job.successCount / job.runCount) * 100) : 0}%`)
        
        if (job.errorMessage) {
          console.log(`   Error: ${job.errorMessage}`)
        }
        
        console.log()
      })
      
      await syncJobSchedulerService.shutdown()
    } catch (error) {
      console.error('❌ Failed to get sync job status:', error)
      process.exit(1)
    }
  })

syncCommand
  .command('trigger')
  .description('Manually trigger a sync job')
  .argument('<jobName>', 'Name of the job to trigger')
  .action(async (jobName) => {
    try {
      await syncJobSchedulerService.initialize()
      
      console.log(`🚀 Triggering sync job: ${jobName}`)
      
      const result = await syncJobSchedulerService.triggerJob(jobName)
      
      if (result.success) {
        console.log('✅ Job completed successfully!')
        console.log(`   Duration: ${result.duration}ms`)
        console.log(`   Message: ${result.message}`)
        
        if (result.data) {
          console.log('   Data:', JSON.stringify(result.data, null, 2))
        }
      } else {
        console.error('❌ Job failed!')
        console.error(`   Message: ${result.message}`)
        if (result.error) {
          console.error(`   Error: ${result.error}`)
        }
        process.exit(1)
      }
      
      await syncJobSchedulerService.shutdown()
    } catch (error) {
      console.error('❌ Failed to trigger sync job:', error)
      process.exit(1)
    }
  })

syncCommand
  .command('enable')
  .description('Enable a sync job')
  .argument('<jobName>', 'Name of the job to enable')
  .action(async (jobName) => {
    try {
      await syncJobSchedulerService.initialize()
      
      await syncJobSchedulerService.toggleJob(jobName, true)
      
      console.log(`✅ Enabled sync job: ${jobName}`)
      
      await syncJobSchedulerService.shutdown()
    } catch (error) {
      console.error('❌ Failed to enable sync job:', error)
      process.exit(1)
    }
  })

syncCommand
  .command('disable')
  .description('Disable a sync job')
  .argument('<jobName>', 'Name of the job to disable')
  .action(async (jobName) => {
    try {
      await syncJobSchedulerService.initialize()
      
      await syncJobSchedulerService.toggleJob(jobName, false)
      
      console.log(`⏸️  Disabled sync job: ${jobName}`)
      
      await syncJobSchedulerService.shutdown()
    } catch (error) {
      console.error('❌ Failed to disable sync job:', error)
      process.exit(1)
    }
  })

syncCommand
  .command('history')
  .description('Show execution history for a sync job')
  .argument('<jobName>', 'Name of the job')
  .option('--limit <number>', 'Number of history entries to show', '20')
  .action(async (jobName, options) => {
    try {
      await syncJobSchedulerService.initialize()
      
      const history = await syncJobSchedulerService.getJobHistory(
        jobName, 
        parseInt(options.limit)
      )
      
      if (history.length === 0) {
        console.log(`No execution history found for job: ${jobName}`)
        return
      }
      
      console.log(`📊 Execution History for ${jobName}:`)
      console.log('─'.repeat(80))
      
      history.forEach((entry, index) => {
        const status = entry.success ? '✅' : '❌'
        console.log(`${status} ${entry.timestamp.toISOString()}`)
        console.log(`   Duration: ${entry.duration}ms`)
        console.log(`   Message: ${entry.message}`)
        
        if (entry.error) {
          console.log(`   Error: ${entry.error}`)
        }
        
        if (index < history.length - 1) {
          console.log()
        }
      })
      
      await syncJobSchedulerService.shutdown()
    } catch (error) {
      console.error('❌ Failed to get job history:', error)
      process.exit(1)
    }
  })

// Legality validation commands
program
  .command('validate-legality')
  .description('Validate and update format legality for a card')
  .argument('<cardId>', 'UUID of the card to validate')
  .action(async (cardId) => {
    try {
      console.log(`🔍 Validating legality for card: ${cardId}`)
      
      const result = await cardDatabaseManagementService.validateAndUpdateLegality(cardId)
      
      console.log('✅ Legality validation completed!')
      console.log(`Last Updated: ${result.lastUpdated}`)
      
      if (result.changes.length > 0) {
        console.log('\nLegality Changes:')
        result.changes.forEach(change => {
          console.log(`   ${change.format}: ${change.oldStatus} → ${change.newStatus}`)
        })
      } else {
        console.log('No legality changes detected.')
      }
      
      console.log('\nCurrent Legalities:')
      Object.entries(result.legalities).forEach(([format, status]) => {
        const icon = status === 'legal' ? '✅' : 
                    status === 'banned' ? '❌' : 
                    status === 'restricted' ? '⚠️' : '❓'
        console.log(`   ${icon} ${format}: ${status}`)
      })
    } catch (error) {
      console.error('❌ Legality validation failed:', error)
      process.exit(1)
    }
  })

// Statistics commands
program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      console.log('📊 Database Statistics:')
      console.log('─'.repeat(50))
      
      // Total cards
      const totalCards = await prisma.enhancedCardData.count()
      console.log(`Total Cards: ${totalCards.toLocaleString()}`)
      
      // Cards by color identity
      const colorStats = await prisma.enhancedCardData.groupBy({
        by: ['colorIdentity'],
        _count: true,
        orderBy: { _count: { _all: 'desc' } },
        take: 10
      })
      
      console.log('\nTop Color Identities:')
      colorStats.forEach(stat => {
        const colors = stat.colorIdentity.join('') || 'Colorless'
        console.log(`   ${colors}: ${stat._count.toLocaleString()}`)
      })
      
      // Cards by CMC
      const cmcStats = await prisma.enhancedCardData.groupBy({
        by: ['cmc'],
        _count: true,
        orderBy: { cmc: 'asc' },
        take: 15
      })
      
      console.log('\nCards by Mana Cost:')
      cmcStats.forEach(stat => {
        console.log(`   CMC ${stat.cmc}: ${stat._count.toLocaleString()}`)
      })
      
      // Recent updates
      const recentUpdates = await prisma.enhancedCardData.count({
        where: {
          lastUpdated: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
      
      console.log(`\nCards updated in last 24h: ${recentUpdates.toLocaleString()}`)
      
      // Cards with prices
      const cardsWithPrices = await prisma.enhancedCardData.count({
        where: {
          currentPrice: { not: null }
        }
      })
      
      console.log(`Cards with price data: ${cardsWithPrices.toLocaleString()} (${Math.round((cardsWithPrices / totalCards) * 100)}%)`)
      
    } catch (error) {
      console.error('❌ Failed to get statistics:', error)
      process.exit(1)
    }
  })

// Error handling
program.parseAsync(process.argv).catch((error) => {
  console.error('❌ Command failed:', error)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})

export { program }