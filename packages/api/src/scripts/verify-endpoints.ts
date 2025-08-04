#!/usr/bin/env tsx

/**
 * Simple verification script to check that the new tRPC endpoints are properly defined
 */

import { appRouter } from '../root'

async function verifyEndpoints() {
  console.log('🔍 Verifying enhanced tRPC API endpoints...')
  
  // Check that the tutor router exists
  const tutorRouter = appRouter.tutor
  if (!tutorRouter) {
    console.error('❌ Tutor router not found')
    process.exit(1)
  }
  
  console.log('✅ Tutor router found')
  
  // Check that the new endpoints exist by examining the router definition
  const routerDef = tutorRouter._def
  const procedures = routerDef.procedures
  
  const expectedEndpoints = [
    'generateFullDeck',
    'analyzeDeck', 
    'suggestDeckImprovements',
    'exportDeck',
    'saveConsultationSession'
  ]
  
  const existingEndpoints = [
    'getCommanderSuggestions',
    'recommendAndLink',
    'getChatHistory',
    'trackClick'
  ]
  
  const allExpectedEndpoints = [...existingEndpoints, ...expectedEndpoints]
  
  for (const endpoint of allExpectedEndpoints) {
    if ((procedures as any)[endpoint]) {
      console.log(`✅ ${endpoint} endpoint found`)
    } else {
      console.error(`❌ ${endpoint} endpoint missing`)
      process.exit(1)
    }
  }
  
  console.log('\n🎉 All enhanced tRPC API endpoints are properly defined!')
  console.log('\nNew endpoints added:')
  expectedEndpoints.forEach(endpoint => {
    console.log(`  - ${endpoint}`)
  })
  
  console.log('\nEndpoint descriptions:')
  console.log('  - generateFullDeck: Creates a complete 100-card deck with analysis')
  console.log('  - analyzeDeck: Calculates deck statistics and synergies')
  console.log('  - suggestDeckImprovements: Provides AI-powered improvement suggestions')
  console.log('  - exportDeck: Exports deck in multiple formats (text, JSON, Moxfield, Archidekt)')
  console.log('  - saveConsultationSession: Preserves wizard progress across sessions')
}

verifyEndpoints().catch(error => {
  console.error('❌ Verification failed:', error)
  process.exit(1)
})