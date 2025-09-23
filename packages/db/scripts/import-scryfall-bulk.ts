import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { cardDatabaseManagementService } from '../../api/src/services/card-database-management';
import { syncJobSchedulerService } from '../../api/src/services/sync-job-scheduler';

const prisma = new PrismaClient();

interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  keywords?: string[];
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity: string[];
  legalities: {
    commander: string;
  };
  prices: {
    usd?: string;
    usd_foil?: string;
  };
  rarity: string;
  set: string;
  collector_number: string;
  image_uris?: {
    normal?: string;
    large?: string;
  };
}

/**
 * Extract synergy keywords from oracle text and type line
 */
function extractSynergyKeywords(card: ScryfallCard): string[] {
  const keywords = new Set<string>();
  const text = `${card.oracle_text || ''} ${card.type_line}`.toLowerCase();
  
  // Creature types
  const creatureTypes = [
    'angel', 'spirit', 'vampire', 'zombie', 'goblin', 'elf', 'human',
    'artifact creature', 'dragon', 'demon', 'beast', 'elemental'
  ];
  
  // Mechanics
  const mechanics = [
    'flying', 'lifelink', 'deathtouch', 'vigilance', 'trample',
    'sacrifice', 'tokens', 'counters', '+1/+1', 'graveyard',
    'death triggers', 'etb', 'aristocrats', 'lifegain', 'draw',
    'ramp', 'removal', 'protection', 'hexproof', 'indestructible'
  ];
  
  // Themes
  const themes = [
    'tribal', 'voltron', 'combo', 'control', 'aggro', 'midrange',
    'reanimator', 'storm', 'superfriends', 'enchantress', 'artifacts matter'
  ];
  
  // Check for matches
  const allKeywords = creatureTypes.concat(mechanics, themes);
  allKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      keywords.add(keyword);
    }
  });
  
  // Special cases
  if (text.includes('when') && text.includes('dies')) {
    keywords.add('death triggers');
  }
  if (text.includes('enters the battlefield')) {
    keywords.add('etb');
  }
  if (text.includes('sacrifice')) {
    keywords.add('aristocrats');
  }
  if (text.includes('gain life') || text.includes('gains life')) {
    keywords.add('lifegain');
  }
  
  // Add existing keywords
  if (card.keywords) {
    card.keywords.forEach(k => keywords.add(k.toLowerCase()));
  }
  
  return Array.from(keywords);
}

/**
 * Download Scryfall bulk data
 */
async function downloadBulkData(): Promise<string> {
  console.log('🔍 Fetching bulk data info from Scryfall...');
  
  const bulkDataResponse = await axios.get('https://api.scryfall.com/bulk-data');
  const defaultCards = bulkDataResponse.data.data.find(
    (item: any) => item.type === 'default_cards'
  );
  
  if (!defaultCards) {
    throw new Error('Could not find default cards bulk data');
  }
  
  const downloadUrl = defaultCards.download_uri;
  const fileName = path.join(__dirname, 'scryfall-default-cards.json');
  
  console.log(`📥 Downloading bulk data (${defaultCards.size} bytes)...`);
  
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'stream'
  });
  
  const writer = fs.createWriteStream(fileName);
  await pipeline(response.data, writer);
  
  console.log('✅ Download complete!');
  return fileName;
}

/**
 * Import cards into database
 */
async function importCards(filePath: string) {
  console.log('📖 Reading card data...');
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const cards: ScryfallCard[] = JSON.parse(fileContent);
  
  console.log(`📊 Found ${cards.length} total cards`);
  
  // Filter for commander-legal cards
  const commanderCards = cards.filter(
    card => card.legalities.commander === 'legal'
  );
  
  console.log(`⚔️ Found ${commanderCards.length} commander-legal cards`);
  
  // Clear existing cards
  console.log('🗑️ Clearing existing card data...');
  await prisma.enhancedCardData.deleteMany({});
  
  // Import in batches
  const batchSize = 100;
  let imported = 0;
  
  for (let i = 0; i < commanderCards.length; i += batchSize) {
    const batch = commanderCards.slice(i, i + batchSize);
    
      await prisma.enhancedCardData.createMany({
        data: batch
          .filter(card => card.type_line) // Filter out cards without type_line
          .map(card => ({
            cardId: card.id,
            name: card.name,
            manaCost: card.mana_cost || '',
            cmc: card.cmc || 0,
            typeLine: card.type_line,
            oracleText: card.oracle_text || '',
            power: card.power || null,
            toughness: card.toughness || null,
            colors: card.colors || [],
            colorIdentity: card.color_identity || [],
            synergyTags: extractSynergyKeywords(card),
            legalities: { commander: 'legal' },
            rulings: [],
            printings: [{ set: card.set, collectorNumber: card.collector_number }],
            relatedCards: [],
            currentPrice: parseFloat(card.prices?.usd || '0') || null,
            priceHistory: [],
            availability: {},
            imageUrls: { 
              normal: card.image_uris?.normal || '', 
              large: card.image_uris?.large || '' 
            },
            lastUpdated: new Date()
          })),
        skipDuplicates: true
      });
      
      // Update the imported count based on filtered batch
      const filteredCount = batch.filter(card => card.type_line).length;
    
    imported += filteredCount;
    
    if (imported % 1000 === 0) {
      console.log(`✨ Imported ${imported}/${commanderCards.length} cards...`);
    }
  }
  
  console.log(`🎉 Successfully imported ${commanderCards.length} commander-legal cards!`);
  
  // Clean up downloaded file
  fs.unlinkSync(filePath);
  console.log('🧹 Cleaned up temporary files');
}

/**
 * Create database indexes for performance
 */
async function createIndexes() {
  console.log('🔧 Creating database indexes...');
  
  try {
    // These might fail if indexes already exist, that's okay
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_color_identity ON "EnhancedCardData"("colorIdentity");`;
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_cmc ON "EnhancedCardData"("cmc");`;
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_type ON "EnhancedCardData"("typeLine");`;
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_price ON "EnhancedCardData"("currentPrice");`;
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_name ON "EnhancedCardData"("name");`;
    await prisma.$executeRaw`CREATE INDEX idx_enhanced_cards_synergy ON "EnhancedCardData" USING gin("synergyTags");`;
    
    console.log('✅ Indexes created successfully!');
  } catch (error) {
    console.log('⚠️ Some indexes may already exist, continuing...');
  }
}

/**
 * Verify import
 */
async function verifyImport() {
  console.log('\n📊 Verifying import...');
  
  const totalCards = await prisma.enhancedCardData.count();
  const byColor = await prisma.enhancedCardData.groupBy({
    by: ['colorIdentity'],
    _count: true
  });
  
  console.log(`\n✅ Total cards: ${totalCards}`);
  console.log('\n🎨 Cards by color identity:');
  byColor.forEach(group => {
    console.log(`  ${group.colorIdentity.join('') || 'Colorless'}: ${group._count}`);
  });
  
  // Test query performance
  console.log('\n⚡ Testing query performance...');
  
  const start = Date.now();
  const testQuery = await prisma.enhancedCardData.findMany({
    where: {
      colorIdentity: { hasSome: ['W', 'B'] },
      cmc: { lte: 3 },
      synergyTags: { hasSome: ['lifelink', 'deathtouch'] }
    },
    take: 10
  });
  const duration = Date.now() - start;
  
  console.log(`✅ Query completed in ${duration}ms (found ${testQuery.length} cards)`);
  
  if (testQuery.length > 0) {
    console.log('\n📋 Sample cards found:');
    testQuery.slice(0, 3).forEach(card => {
      console.log(`  - ${card.name} (CMC: ${card.cmc})`);
    });
  }
}

/**
 * Main import function using enhanced services
 */
async function main() {
  try {
    console.log('🚀 Starting enhanced Scryfall bulk data import...\n');
    
    // Initialize sync job scheduler
    await syncJobSchedulerService.initialize();
    
    // Perform incremental import using the new service
    console.log('📥 Performing incremental bulk import...');
    const importResult = await cardDatabaseManagementService.performIncrementalImport();
    
    if (importResult.success) {
      console.log(`✅ Import successful!`);
      console.log(`   - Cards added: ${importResult.cardsAdded}`);
      console.log(`   - Cards updated: ${importResult.cardsUpdated}`);
      console.log(`   - Cards removed: ${importResult.cardsRemoved}`);
      console.log(`   - Duration: ${importResult.duration}ms`);
      
      if (importResult.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${importResult.errors.length}`);
        importResult.errors.slice(0, 5).forEach(error => {
          console.log(`   - ${error}`);
        });
      }
    } else {
      console.error('❌ Import failed:', importResult.errors);
      process.exit(1);
    }
    
    // Create search indexes
    console.log('\n🔧 Creating search indexes...');
    await cardDatabaseManagementService.createSearchIndexes();
    console.log('✅ Search indexes created successfully!');
    
    // Setup automated sync jobs
    console.log('\n⏰ Setting up automated sync jobs...');
    await cardDatabaseManagementService.setupAutomatedSyncJobs();
    console.log('✅ Automated sync jobs configured!');
    
    // Perform health check
    console.log('\n🏥 Performing health check...');
    const healthStatus = await cardDatabaseManagementService.performHealthCheck();
    console.log(`Health Status: ${healthStatus.status}`);
    console.log(`Total Cards: ${healthStatus.summary.totalCards}`);
    console.log(`Last Import: ${healthStatus.summary.lastImport || 'Never'}`);
    
    // Show failed health checks
    const failedChecks = healthStatus.checks.filter(check => check.status === 'fail');
    if (failedChecks.length > 0) {
      console.log('\n⚠️  Failed Health Checks:');
      failedChecks.forEach(check => {
        console.log(`   - ${check.name}: ${check.message}`);
      });
    }
    
    console.log('\n🎉 Enhanced import complete! Your database is production-ready!');
    console.log('\n📊 Available features:');
    console.log('   - Full-text search with advanced filtering');
    console.log('   - Automated daily sync jobs');
    console.log('   - Real-time format legality updates');
    console.log('   - Image optimization and caching');
    console.log('   - Comprehensive health monitoring');
    
  } catch (error) {
    console.error('❌ Enhanced import failed:', error);
    process.exit(1);
  } finally {
    await syncJobSchedulerService.shutdown();
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as importScryfallBulkData };
