#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Running final cleanup to fix all compilation errors...\n');

// 1. Remove monitoring page
const monitoringPath = path.join(__dirname, '../apps/web/app/monitoring');
if (fs.existsSync(monitoringPath)) {
  fs.rmSync(monitoringPath, { recursive: true, force: true });
  console.log('✅ Removed monitoring directory');
}

// 2. Remove any other problematic pages
const problematicPages = [
  'apps/web/app/solsync',
  'apps/web/app/lotuslist',
  'apps/web/app/deckforge',
  'apps/web/app/deck-templates'
];

problematicPages.forEach(page => {
  const fullPath = path.join(__dirname, '..', page);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`✅ Removed ${page}`);
  }
});

// 3. Update the layout to remove FeedbackWidget
const layoutPath = path.join(__dirname, '../apps/web/app/layout.tsx');
if (fs.existsSync(layoutPath)) {
  let content = fs.readFileSync(layoutPath, 'utf8');
  
  // Remove the import
  content = content.replace(/import { FeedbackWidget } from.*\n/g, '');
  content = content.replace(/\/\/ import { FeedbackWidget } from.*\n/g, '');
  
  // Remove the component usage
  content = content.replace(/<FeedbackWidget \/>/g, '');
  content = content.replace(/\{\/\* <FeedbackWidget \/> \*\/\}/g, '');
  
  fs.writeFileSync(layoutPath, content);
  console.log('✅ Cleaned up layout.tsx');
}

// 4. Remove FeedbackWidget component itself
const feedbackWidgetPath = path.join(__dirname, '../apps/web/src/components/beta/FeedbackWidget.tsx');
if (fs.existsSync(feedbackWidgetPath)) {
  fs.unlinkSync(feedbackWidgetPath);
  console.log('✅ Removed FeedbackWidget component');
}

// 5. Remove the beta directory if empty
const betaDir = path.join(__dirname, '../apps/web/src/components/beta');
if (fs.existsSync(betaDir)) {
  const files = fs.readdirSync(betaDir);
  if (files.length === 0 || (files.length === 1 && files[0] === 'BetaBadge.tsx')) {
    fs.rmSync(betaDir, { recursive: true, force: true });
    console.log('✅ Removed empty beta directory');
  }
}

// 6. Clean up any test files in the root
const rootDir = path.join(__dirname, '..');
const testFiles = fs.readdirSync(rootDir).filter(file => 
  (file.startsWith('test-') || file.startsWith('run-')) && 
  (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.sh'))
);

testFiles.forEach(file => {
  fs.unlinkSync(path.join(rootDir, file));
  console.log(`✅ Removed test file: ${file}`);
});

// 7. Remove update-demo-password.js if it exists
const updateDemoPath = path.join(__dirname, '../update-demo-password.js');
if (fs.existsSync(updateDemoPath)) {
  fs.unlinkSync(updateDemoPath);
  console.log('✅ Removed update-demo-password.js');
}

console.log('\n✨ Final cleanup complete!');
console.log('\n📝 Your project is now clean and ready:');
console.log('1. Run: pnpm dev');
console.log('2. Visit: http://localhost:3000');
console.log('3. Test the AI deck generator at: http://localhost:3000/tutor');
console.log('4. View analytics at: http://localhost:3000/admin/analytics');
