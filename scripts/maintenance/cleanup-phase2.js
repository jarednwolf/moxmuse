#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Starting MoxMuse Phase 2 Cleanup...\n');

// Files to move from root
const ROOT_FILES_TO_MOVE = {
  'docs/implementation': [
    '100_PERCENT_TEST_COVERAGE_PLAN.md',
    'AI_FIRST_BROWSER_TEST_GUIDE.md',
    'DECK_GENERATION_FIX_SUMMARY.md',
    'DECK_GENERATION_FIXES_IMPLEMENTED.md',
    'DECK_GENERATION_OPTIMIZATION_COMPLETE.md',
    'DECK_GENERATION_UI_TEST_RESULTS.md'
  ],
  'docs/guides': [
    'DECK_GENERATION_TESTING_GUIDE.md'
  ],
  'docs/reports': [
    'DECK_GENERATION_ACTION_PLAN.md',
    'DECK_GENERATION_COMPLETE_STATUS.md',
    'DECK_GENERATION_FINAL_STATUS.md',
    'TEST_PROGRESS_SUMMARY.md',
    'TESTING_PROGRESS_FINAL.md'
  ]
};

// Old deck generator files to remove from packages/api/src/services
const OLD_DECK_GENERATORS = [
  'deck-generator-v2.ts',
  'deck-generator-v2-validated.ts',
  'deck-generator-v3.ts',
  'deck-generator-v3-research.ts',
  'deck-generator-v4-robust.ts',
  'deck-generator-ai-first.ts', // Keep only ai-first-v2
  'personalization-engine.ts',
  'personalization-engine-research.ts',
  'deck-templates.ts'
];

// Test scripts to remove from packages/db/scripts
const TEST_SCRIPTS_TO_REMOVE = [
  'test-enhanced-card-schema.ts',
  'test-ai-first-deck-generation.ts',
  'test-v3-research-generator.ts',
  'test-v4-generator.ts',
  'validate-commander-deck.ts',
  'update-demo-password.ts',
  'check-deck-cards.ts'
];

// Utility functions
function moveFile(filename, targetDir) {
  const sourcePath = path.join(process.cwd(), filename);
  const targetPath = path.join(process.cwd(), targetDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    if (!fs.existsSync(path.join(process.cwd(), targetDir))) {
      fs.mkdirSync(path.join(process.cwd(), targetDir), { recursive: true });
    }
    fs.renameSync(sourcePath, targetPath);
    console.log(`📁 Moved ${filename} → ${targetDir}/`);
    return true;
  }
  return false;
}

function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

// Main cleanup function
async function cleanup() {
  let movedCount = 0;
  let deletedCount = 0;
  
  console.log('📊 Phase 2: Cleaning up remaining files...\n');
  
  // Move remaining root files
  console.log('📁 Moving remaining documentation files...');
  for (const [targetDir, files] of Object.entries(ROOT_FILES_TO_MOVE)) {
    for (const file of files) {
      if (moveFile(file, targetDir)) {
        movedCount++;
      }
    }
  }
  
  // Clean up old deck generators
  console.log('\n🧹 Removing old deck generator versions...');
  const servicesPath = path.join(process.cwd(), 'packages/api/src/services');
  for (const file of OLD_DECK_GENERATORS) {
    const filePath = path.join(servicesPath, file);
    if (deleteFile(filePath)) {
      deletedCount++;
    }
  }
  
  // Clean up test scripts
  console.log('\n🧹 Removing test scripts from packages/db/scripts...');
  const dbScriptsPath = path.join(process.cwd(), 'packages/db/scripts');
  for (const file of TEST_SCRIPTS_TO_REMOVE) {
    const filePath = path.join(dbScriptsPath, file);
    if (deleteFile(filePath)) {
      deletedCount++;
    }
  }
  
  console.log('\n📈 Phase 2 Cleanup Summary:');
  console.log(`   📁 Moved to subdirectories: ${movedCount} files`);
  console.log(`   🗑️  Deleted: ${deletedCount} files`);
  console.log('\n✨ Phase 2 cleanup complete!\n');
  
  // Update the cleanup summary
  const summaryPath = path.join(process.cwd(), 'CLEANUP_SUMMARY.md');
  const existingSummary = fs.readFileSync(summaryPath, 'utf-8');
  
  const updatedSummary = existingSummary + `
## Phase 2 Cleanup
Date: ${new Date().toISOString()}

### Additional Actions
- Moved ${movedCount} remaining documentation files
- Deleted ${deletedCount} old implementation files
- Removed old deck generator versions (v2, v3, v4)
- Cleaned up test scripts from packages

### Final Production Files
- **AI-First V2 Deck Generator**: \`packages/api/src/services/deck-generator-ai-first-v2.ts\`
- **Card Database**: \`packages/api/src/services/card-database-complete.ts\`
- **OpenAI Services**: \`packages/api/src/services/openai.ts\` and \`openai-enhanced.ts\`
- **Scryfall Batch**: \`packages/api/src/services/scryfall-batch.ts\`

### Root Directory Status
The root directory now contains only essential project files:
- Configuration files (package.json, .gitignore, etc.)
- README.md
- DEPLOYMENT_GUIDE.md
- ENV_SETUP_INSTRUCTIONS.md
- CLEANUP_SUMMARY.md
`;
  
  fs.writeFileSync(summaryPath, updatedSummary);
  console.log('📝 Updated CLEANUP_SUMMARY.md\n');
}

// Run cleanup
cleanup().catch(console.error);
