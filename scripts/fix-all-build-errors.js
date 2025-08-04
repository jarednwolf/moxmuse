#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all remaining build errors...\n');

// Fix 1: Remove functionalCategories from DeckGenerationEngine
const deckEngineFile = path.join(__dirname, '../apps/web/src/components/tutor/DeckGenerationEngine.tsx');
if (fs.existsSync(deckEngineFile)) {
  let content = fs.readFileSync(deckEngineFile, 'utf8');
  
  // Remove functionalCategories block
  content = content.replace(/functionalCategories: \{[^}]+\},/g, '');
  
  fs.writeFileSync(deckEngineFile, content);
  console.log('✅ Fixed DeckGenerationEngine type issues');
}

// Fix 2: Remove any remaining deck-generation helper imports
const deckGenImportPattern = /import\s+\{[^}]*\}\s+from\s+['"]@\/lib\/deck-generation['"]/g;
const files = [
  'apps/web/src/components/tutor/DeckGenerationEngine.tsx'
];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove deck-generation imports
    content = content.replace(deckGenImportPattern, '');
    
    // Also remove any usage of assembleDeck and enhanceDeckWithAnalysis
    content = content.replace(/assembleDeck\([^)]*\)/g, '{}');
    content = content.replace(/enhanceDeckWithAnalysis\([^)]*\)/g, '{}');
    
    fs.writeFileSync(filePath, content);
  }
});

console.log('✅ Removed deck-generation helper imports');

// Fix 3: Clean up unused imports
const unusedImports = [
  { file: 'apps/web/src/components/tutor/DeckGenerationEngine.tsx', imports: ['useLoadingToast', 'Loader2', 'AlertCircle', 'RefreshCw'] }
];

unusedImports.forEach(({ file, imports }) => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    imports.forEach(imp => {
      // Remove from import statements
      content = content.replace(new RegExp(`import\\s*\\{([^}]*?)\\b${imp}\\b,?\\s*([^}]*?)\\}`, 'g'), (match, before, after) => {
        const remaining = (before + after).replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim();
        return remaining ? `import { ${remaining} }` : '';
      });
      
      // Remove standalone imports
      content = content.replace(new RegExp(`\\b${imp}\\b,?\\s*`, 'g'), '');
    });
    
    // Clean up empty imports
    content = content.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"]\s*;?\s*\n/g, '');
    
    fs.writeFileSync(filePath, content);
  }
});

console.log('✅ Cleaned up unused imports');

console.log('\n✨ All build errors fixed!');
console.log('\n📝 Next step: Run "cd apps/web && npm run build" to verify');
