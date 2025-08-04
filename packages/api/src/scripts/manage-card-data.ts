#!/usr/bin/env tsx

import { Command } from 'commander'
import { enhancedCardDataService } from '../services/enhanced-card-data'
import { cardDataSyncService } from '../services/card-data-sync'
import { logger } from '../services/core/logging'
import { db } from '@moxmuse/db'

const program = new Command()

program
  .name('manage-card-data')
  .description('CLI tool for managing enhanced card data')
  .version('1.0.0')

// Bulk data update command
program
  .command('update-bulk')
  .description('Update card data from Scryfall bulk data')
  .option('-f, --force', 'Force update even if data is current')
  .action(async (options) => {
    try {
      console.log('Starting bulk data update...')
      
      const result = await enhancedCardDataService.updateFromBulkData()
      
      if (result.success) {
        console.log(`✅ Bulk update completed successfully`)
        console.log(`   Cards updated: ${result.cardsUpdated}`)
        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`)
          result.errors.slice(0, 5).forEach(error => {
            console.log(`   - ${error}`)
          })
          if (result.errors.length > 5) {
            console.log(`   ... and ${result.errors.length - 5} more errors`)
          }
        }
      } else {
        console.error('❌ Bulk update failed')
        result.errors.forEach(error => {
          console.error(`   - ${error}`)
        })
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Bulk update failed:', error.message)
      process.exit(1)
    }
  })

// Search cards command
program
  .command('search')
  .description('Search for cards with enhanced data')
  .requiredOption('-q, --query <query>', 'Search query')
  .option('-l, --limit <number>', 'Limit results', '10')
  .option('-c, --colors <colors>', 'Filter by colors (e.g., RG)')
  .option('--cmc-min <number>', 'Minimum CMC')
  .option('--cmc-max <number>', 'Maximum CMC')
  .option('--format <format>', 'Filter by format legality')
  .action(async (options) => {
    try {
      const searchQuery: any = {
        text: options.query,
        limit: parseInt(options.limit)
      }
      
      if (options.colors) {
        searchQuery.colors = options.colors.split('')
      }
      
      if (options.cmcMin || options.cmcMax) {
        searchQuery.cmcRange = [
          options.cmcMin ? parseInt(options.cmcMin) : 0,
          options.cmcMax ? parseInt(options.cmcMax) : 20
        ]
      }
      
      if (options.format) {
        searchQuery.formats = [options.format]
      }
      
      console.log(`Searching for cards: "${options.query}"`)
      
      const result = await enhancedCardDataService.searchCards(searchQuery)
      
      console.log(`\n📊 Found ${result.totalCount} cards (showing ${result.cards.length})`)
      console.log('─'.repeat(80))
      
      result.cards.forEach((card, index) => {
        console.log(`${index + 1}. ${card.name} ${card.manaCost || ''}`)
        console.log(`   ${card.typeLine}`)
        if (card.oracleText) {
          const text = card.oracleText.length > 100 
            ? card.oracleText.substring(0, 100) + '...'
            : card.oracleText
          console.log(`   ${text}`)
        }
        if (card.currentPrice) {
          console.log(`   💰 $${card.currentPrice.toFixed(2)}`)
        }
        console.log(`   📈 Popularity: ${card.popularityScore.toFixed(1)}`)
        console.log()
      })
      
      if (result.hasMore) {
        console.log(`... and ${result.totalCount - result.cards.length} more results`)
      }
    } catch (error) {
      console.error('❌ Search failed:', error.message)
      process.exit(1)
    }
  })

// Get card details command
program
  .command('get')
  .description('Get detailed information about a specific card')
  .requiredOption('-i, --id <cardId>', 'Scryfall card ID')
  .option('-r, --refresh', 'Force refresh card data')
  .action(async (options) => {
    try {
      console.log(`Getting card data for: ${options.id}`)
      
      const card = await enhancedCardDataService.getEnhancedCard(options.id)
      
      if (!card) {
        console.error('❌ Card not found')
        process.exit(1)
      }
      
      console.log('\n📄 Card Details')
      console.log('─'.repeat(50))
      console.log(`Name: ${card.name}`)
      console.log(`Mana Cost: ${card.manaCost || 'N/A'}`)
      console.log(`CMC: ${card.cmc}`)
      console.log(`Type: ${card.typeLine}`)
      
      if (card.power && card.toughness) {
        console.log(`P/T: ${card.power}/${card.toughness}`)
      }
      
      console.log(`Colors: ${card.colors.join(', ') || 'Colorless'}`)
      console.log(`Color Identity: ${card.colorIdentity.join(', ') || 'Colorless'}`)
      
      if (card.oracleText) {
        console.log(`\nOracle Text:`)
        console.log(card.oracleText)
      }
      
      console.log(`\n📊 Statistics`)
      console.log(`EDHREC Rank: ${card.edhrecRank || 'N/A'}`)
      console.log(`Popularity Score: ${card.popularityScore.toFixed(1)}`)
      
      if (card.currentPrice) {
        console.log(`Current Price: $${card.currentPrice.toFixed(2)}`)
      }
      
      console.log(`\n🏷️  Synergy Tags: ${card.synergyTags.join(', ') || 'None'}`)
      
      console.log(`\n📅 Data Info`)
      console.log(`Last Updated: ${new Date(card.lastUpdated).toLocaleString()}`)
      console.log(`Printings: ${card.printings.length}`)
      console.log(`Rulings: ${card.rulings.length}`)
      console.log(`Related Cards: ${card.relatedCards.length}`)
      
      // Show legalities
      console.log(`\n⚖️  Format Legalities`)
      Object.entries(card.legalities).forEach(([format, legality]) => {
        const emoji = legality === 'legal' ? '✅' : legality === 'banned' ? '❌' : '⚠️'
        console.log(`${emoji} ${format}: ${legality}`)
      })
      
    } catch (error) {
      console.error('❌ Failed to get card:', error.message)
      process.exit(1)
    }
  })

// Validate card data command
program
  .command('validate')
  .description('Validate card data integrity')
  .option('-i, --id <cardId>', 'Validate specific card')
  .option('-a, --all', 'Validate all cards (sample)')
  .option('-s, --sample <number>', 'Sample size for validation', '100')
  .action(async (options) => {
    try {
      if (options.id) {
        console.log(`Validating card: ${options.id}`)
        
        const card = await enhancedCardDataService.getEnhancedCard(options.id)
        if (!card) {
          console.error('❌ Card not found')
          process.exit(1)
        }
        
        const validated = await enhancedCardDataService.validateCardData(card)
        
        if (validated) {
          console.log('✅ Card data is valid')
        } else {
          console.log('❌ Card data validation failed')
          process.exit(1)
        }
      } else {
        const sampleSize = parseInt(options.sample)
        console.log(`Validating sample of ${sampleSize} cards...`)
        
        // Get random sample of cards
        const cards = await db.enhancedCardData.findMany({
          take: sampleSize,
          orderBy: { lastUpdated: 'desc' }
        })
        
        console.log(`Found ${cards.length} cards to validate`)
        
        let validCount = 0
        let invalidCount = 0
        const errors: string[] = []
        
        for (const dbCard of cards) {
          try {
            const card = await enhancedCardDataService.getEnhancedCard(dbCard.cardId)
            if (card) {
              const validated = await enhancedCardDataService.validateCardData(card)
              if (validated) {
                validCount++
              } else {
                invalidCount++
                errors.push(`${dbCard.name} (${dbCard.cardId})`)
              }
            }
          } catch (error) {
            invalidCount++
            errors.push(`${dbCard.name}: ${error.message}`)
          }
        }
        
        console.log(`\n📊 Validation Results`)
        console.log(`✅ Valid: ${validCount}`)
        console.log(`❌ Invalid: ${invalidCount}`)
        
        if (errors.length > 0) {
          console.log(`\n❌ Validation Errors:`)
          errors.slice(0, 10).forEach(error => {
            console.log(`   - ${error}`)
          })
          if (errors.length > 10) {
            console.log(`   ... and ${errors.length - 10} more errors`)
          }
        }
        
        const successRate = (validCount / (validCount + invalidCount)) * 100
        console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}%`)
        
        if (successRate < 95) {
          console.log('⚠️  Success rate is below 95%, consider running data cleanup')
        }
      }
    } catch (error) {
      console.error('❌ Validation failed:', error.message)
      process.exit(1)
    }
  })

// Sync service commands
program
  .command('sync')
  .description('Manage card data synchronization')
  .option('--start', 'Start sync services')
  .option('--stop', 'Stop sync services')
  .option('--status', 'Show sync status')
  .option('--trigger <type>', 'Trigger specific sync (bulk|price|popularity)')
  .action(async (options) => {
    try {
      if (options.start) {
        console.log('Starting sync services...')
        cardDataSyncService.startJobs()
        console.log('✅ Sync services started')
      } else if (options.stop) {
        console.log('Stopping sync services...')
        cardDataSyncService.stopJobs()
        console.log('✅ Sync services stopped')
      } else if (options.status) {
        console.log('Getting sync status...')
        const status = await cardDataSyncService.getSyncStatus()
        
        if (status) {
          console.log(`\n📊 Current Sync Job`)
          console.log(`ID: ${status.id}`)
          console.log(`Status: ${status.status}`)
          console.log(`Started: ${status.startedAt.toLocaleString()}`)
          if (status.completedAt) {
            console.log(`Completed: ${status.completedAt.toLocaleString()}`)
          }
          console.log(`Progress: ${status.progress}%`)
          console.log(`Cards Processed: ${status.cardsProcessed}`)
          if (status.errors.length > 0) {
            console.log(`Errors: ${status.errors.length}`)
          }
        } else {
          console.log('No active sync job')
        }
      } else if (options.trigger) {
        const syncType = options.trigger as 'bulk' | 'price' | 'popularity'
        console.log(`Triggering ${syncType} sync...`)
        
        const result = await cardDataSyncService.triggerSync(syncType)
        
        if (syncType === 'bulk' && result) {
          console.log(`✅ Bulk sync completed`)
          console.log(`   Cards updated: ${result.cardsProcessed}`)
          console.log(`   Errors: ${result.errors.length}`)
        } else {
          console.log(`✅ ${syncType} sync triggered`)
        }
      } else {
        console.log('Please specify an action: --start, --stop, --status, or --trigger <type>')
      }
    } catch (error) {
      console.error('❌ Sync operation failed:', error.message)
      process.exit(1)
    }
  })

// Statistics command
program
  .command('stats')
  .description('Show card data statistics')
  .action(async () => {
    try {
      console.log('Gathering card data statistics...')
      
      // Get basic counts
      const totalCards = await db.enhancedCardData.count()
      
      const recentlyUpdated = await db.enhancedCardData.count({
        where: {
          lastUpdated: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
      
      const needsUpdate = await db.enhancedCardData.count({
        where: {
          lastUpdated: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
          }
        }
      })
      
      const withPrices = await db.enhancedCardData.count({
        where: {
          currentPrice: { not: null }
        }
      })
      
      const popularCards = await db.enhancedCardData.findMany({
        orderBy: { popularityScore: 'desc' },
        take: 5,
        select: { name: true, popularityScore: true, currentPrice: true }
      })
      
      console.log(`\n📊 Card Data Statistics`)
      console.log('─'.repeat(50))
      console.log(`Total Cards: ${totalCards.toLocaleString()}`)
      console.log(`Recently Updated (24h): ${recentlyUpdated.toLocaleString()}`)
      console.log(`Needs Update (>7 days): ${needsUpdate.toLocaleString()}`)
      console.log(`With Price Data: ${withPrices.toLocaleString()} (${((withPrices/totalCards)*100).toFixed(1)}%)`)
      
      console.log(`\n🔥 Most Popular Cards`)
      popularCards.forEach((card, index) => {
        const price = card.currentPrice ? ` - $${Number(card.currentPrice).toFixed(2)}` : ''
        console.log(`${index + 1}. ${card.name} (${Number(card.popularityScore).toFixed(1)})${price}`)
      })
      
      const updateRate = ((recentlyUpdated / totalCards) * 100).toFixed(1)
      console.log(`\n📈 Update Rate: ${updateRate}% updated in last 24h`)
      
      if (needsUpdate > totalCards * 0.1) {
        console.log(`⚠️  ${needsUpdate.toLocaleString()} cards need updates (>${((needsUpdate/totalCards)*100).toFixed(1)}%)`)
        console.log('   Consider running: npm run manage-card-data sync --trigger bulk')
      }
      
    } catch (error) {
      console.error('❌ Failed to get statistics:', error.message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// Handle case where no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}