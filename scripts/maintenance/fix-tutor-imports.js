#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix the tutor router imports
const tutorPath = path.join(__dirname, '../packages/api/src/routers/tutor.ts');
let content = fs.readFileSync(tutorPath, 'utf8');

// Remove the broken import
content = content.replace(
  "import { getDeckGenerator, type DeckGenerationRequest } from '../services/deck-generator-v3'",
  "// V3 deck generator removed - not implemented"
);

// Remove the generateFullDeckV3 endpoint that uses it
const v3EndpointStart = content.indexOf('generateFullDeckV3: protectedProcedure');
if (v3EndpointStart !== -1) {
  // Find the end of this endpoint (next endpoint or end of router)
  const nextEndpoint = content.indexOf('getCommanderSuggestions: protectedProcedure', v3EndpointStart);
  if (nextEndpoint !== -1) {
    content = content.substring(0, v3EndpointStart) + content.substring(nextEndpoint);
  }
}

fs.writeFileSync(tutorPath, content);
console.log('✅ Fixed tutor router imports');

// Also ensure the feedback widget is properly configured
const feedbackWidgetPath = path.join(__dirname, '../apps/web/src/components/beta/FeedbackWidget.tsx');
if (fs.existsSync(feedbackWidgetPath)) {
  let feedbackContent = fs.readFileSync(feedbackWidgetPath, 'utf8');
  
  // Ensure it's exported properly
  if (!feedbackContent.includes('export function FeedbackWidget') && 
      !feedbackContent.includes('export const FeedbackWidget')) {
    feedbackContent = feedbackContent.replace(
      'function FeedbackWidget',
      'export function FeedbackWidget'
    );
    fs.writeFileSync(feedbackWidgetPath, feedbackContent);
    console.log('✅ Fixed FeedbackWidget export');
  }
}

console.log('✨ All fixes applied successfully!');
