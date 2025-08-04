#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Starting MoxMuse Project Cleanup...\n');

// Files to keep in root
const KEEP_IN_ROOT = [
  '.gitignore',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'README.md',
  'DEPLOYMENT_GUIDE.md',
  'ENV_SETUP_INSTRUCTIONS.md',
  'env.example',
  '.env.local'
];

// Files to move to specific directories
const FILES_TO_MOVE = {
  'docs/architecture': [
    'DECK_BUILDING_ARCHITECTURE.md',
    'SCALABLE_DECK_ARCHITECTURE_PLAN.md',
    'AI_FIRST_DECK_GENERATION_IMPLEMENTATION.md',
    'AI_FIRST_IMPLEMENTATION_GUIDE.md',
    'DEEP_RESEARCH_ARCHITECTURE_PROPOSAL.md',
    'O3_DEEP_RESEARCH_ANALYSIS.md'
  ],
  'docs/implementation': [
    'AI_FIRST_99_CARD_ACCURACY_PLAN.md',
    'AI_FIRST_99_CARD_SOLUTION.md',
    'AI_FIRST_BROWSER_TEST_RESULTS.md',
    'AI_FIRST_DECK_GENERATION_SUMMARY.md',
    'AI_FIRST_DYNAMIC_DECK_COMPOSITION.md',
    'DECK_GENERATION_ARCHITECTURE_DECISIONS.md',
    'ENVIRONMENT_SETUP_COMPLETE.md'
  ],
  'docs/guides': [
    'AUTHENTICATION_FIX_GUIDE.md',
    'MANUAL_BROWSER_TESTING_GUIDE.md',
    'TESTING_GUIDE.md',
    'TESTING_BEST_PRACTICES_GUIDE.md',
    'ENV_CONSOLIDATION_GUIDE.md',
    'STYLE_GUIDE.md'
  ],
  'docs/setup': [
    'AFFILIATE_SETUP.md',
    'MOXFIELD_OAUTH_SETUP.md',
    'OPENAI_SETUP.md',
    'MONITORING_INFRASTRUCTURE_UPDATE.md'
  ],
  'docs/planning': [
    'PROJECT_ROADMAP_SUMMARY.md',
    'PROJECT_STATUS_UPDATE.md',
    'IMPLEMENTATION_ROADMAP.md',
    'STRATEGIC_VISION.md',
    'DECK_BUILDER_TODO.md',
    'DECK_BUILDER_TODO_QUICK_FIXES.md'
  ],
  'docs/reports': [
    'APP_EVALUATION_REPORT.md',
    'DECK_VIEW_FIX_COMPLETE.md',
    'IMMEDIATE_DECK_VIEW_FIX.md',
    'DECK_GENERATION_FINAL_REPORT.md',
    'DECK_GENERATION_SUCCESS.md',
    'SYSTEM_VALIDATION_CHECKLIST.md',
    'TEYSA_DECK_TEST_SUMMARY.md'
  ]
};

// Test files to remove
const TEST_FILE_PATTERNS = [
  /^test-.*\.(js|ts|sh)$/,
  /^run-.*\.sh$/,
  /^update-.*\.js$/,
  /validation-report\.md$/
];

// Documentation files to remove (old versions)
const DOCS_TO_REMOVE_PATTERNS = [
  /^DECK_GENERATION_V[0-9]_.*\.md$/,
  /^DECK_GENERATION_.*_FIX.*\.md$/,
  /^DECK_GENERATION_ISSUES_.*\.md$/,
  /^DECK_GENERATION_TIMEOUT_.*\.md$/,
  /^DECK_GENERATION_TEST_.*\.md$/,
  /^DECK_GENERATION_UPDATE_.*\.md$/,
  /^IMMEDIATE_TIMEOUT_.*\.md$/,
  /^TESTING_.*_PROGRESS.*\.md$/,
  /^TESTING_STATUS_.*\.md$/,
  /^TEST_.*_PLAN\.md$/,
  /^TEST_.*_PROGRESS.*\.md$/,
  /^CURRENT_TEST_STATUS\.md$/,
  /^COMPREHENSIVE_TEST_.*\.md$/,
  /^TRPC_BATCH_SIZE_FIX\.md$/,
  /^REAL_CARD_DATA_IMPLEMENTATION\.md$/,
  /^DOCUMENTATION_INDEX\.md$/
];

// Create directories if they don't exist
function ensureDirectoryExists(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
}

// Move file to new location
function moveFile(filename, targetDir) {
  const sourcePath = path.join(process.cwd(), filename);
  const targetPath = path.join(process.cwd(), targetDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    ensureDirectoryExists(targetDir);
    fs.renameSync(sourcePath, targetPath);
    console.log(`📁 Moved ${filename} → ${targetDir}/`);
    return true;
  }
  return false;
}

// Delete file
function deleteFile(filename) {
  const filePath = path.join(process.cwd(), filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted ${filename}`);
    return true;
  }
  return false;
}

// Main cleanup function
function cleanup() {
  const rootFiles = fs.readdirSync(process.cwd());
  let movedCount = 0;
  let deletedCount = 0;
  let keptCount = 0;
  
  console.log('📊 Analyzing root directory files...\n');
  
  rootFiles.forEach(filename => {
    // Skip directories
    const filePath = path.join(process.cwd(), filename);
    if (fs.statSync(filePath).isDirectory()) {
      return;
    }
    
    // Check if file should be kept in root
    if (KEEP_IN_ROOT.includes(filename)) {
      keptCount++;
      return;
    }
    
    // Check if file should be moved
    let moved = false;
    for (const [targetDir, files] of Object.entries(FILES_TO_MOVE)) {
      if (files.includes(filename)) {
        if (moveFile(filename, targetDir)) {
          movedCount++;
          moved = true;
          break;
        }
      }
    }
    
    if (moved) return;
    
    // Check if file should be deleted
    let shouldDelete = false;
    
    // Check test file patterns
    for (const pattern of TEST_FILE_PATTERNS) {
      if (pattern.test(filename)) {
        shouldDelete = true;
        break;
      }
    }
    
    // Check documentation patterns to remove
    if (!shouldDelete) {
      for (const pattern of DOCS_TO_REMOVE_PATTERNS) {
        if (pattern.test(filename)) {
          shouldDelete = true;
          break;
        }
      }
    }
    
    if (shouldDelete) {
      if (deleteFile(filename)) {
        deletedCount++;
      }
    }
  });
  
  console.log('\n📈 Cleanup Summary:');
  console.log(`   ✅ Kept in root: ${keptCount} files`);
  console.log(`   📁 Moved to subdirectories: ${movedCount} files`);
  console.log(`   🗑️  Deleted: ${deletedCount} files`);
  console.log('\n✨ Cleanup complete!\n');
  
  // Create a summary file
  const summary = `# MoxMuse Cleanup Summary

Date: ${new Date().toISOString()}

## Actions Taken
- Kept ${keptCount} essential files in root
- Moved ${movedCount} documentation files to organized subdirectories
- Deleted ${deletedCount} test files and outdated documentation

## New Directory Structure
- \`/docs/architecture\` - System architecture documentation
- \`/docs/implementation\` - Implementation details and decisions
- \`/docs/guides\` - Development and testing guides
- \`/docs/setup\` - Setup and configuration guides
- \`/docs/planning\` - Project planning and roadmaps
- \`/docs/reports\` - Status reports and summaries

## Next Steps
1. Set up Supabase for database and auth
2. Configure Vercel deployment
3. Implement rate limiting and user accounts
4. Prepare for beta launch
`;
  
  fs.writeFileSync(path.join(process.cwd(), 'CLEANUP_SUMMARY.md'), summary);
  console.log('📝 Created CLEANUP_SUMMARY.md with details\n');
}

// Run cleanup
cleanup();
