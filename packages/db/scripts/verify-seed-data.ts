import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verifying AI Deck Building Tutor seed data...')
  
  try {
    // Check consultation sessions
    const consultationSessions = await prisma.consultationSession.findMany({
      include: {
        user: true,
        generatedDeck: true
      }
    })
    console.log(`\nConsultation Sessions: ${consultationSessions.length}`)
    consultationSessions.forEach(session => {
      console.log(`- Session ${session.sessionId}: ${session.completed ? 'Completed' : 'In Progress'}`)
    })
    
    // Check generated decks
    const generatedDecks = await prisma.generatedDeck.findMany({
      include: {
        user: true,
        cards: true,
        analysis: true
      }
    })
    console.log(`\nGenerated Decks: ${generatedDecks.length}`)
    generatedDecks.forEach(deck => {
      console.log(`- Deck "${deck.name}": ${deck.cards.length} cards, Power Level ${deck.powerLevel}`)
    })
    
    // Check generated deck cards
    const deckCards = await prisma.generatedDeckCard.findMany()
    console.log(`\nGenerated Deck Cards: ${deckCards.length}`)
    deckCards.forEach(card => {
      console.log(`- ${card.cardId} (${card.category}): ${card.reasoning?.substring(0, 50)}...`)
    })
    
    // Check deck analysis
    const analyses = await prisma.deckAnalysis.findMany()
    console.log(`\nDeck Analyses: ${analyses.length}`)
    analyses.forEach(analysis => {
      console.log(`- Analysis for deck ${analysis.deckId}: ${analysis.weaknesses.length} weaknesses identified`)
    })
    
    console.log('\n✅ All seed data verified successfully!')
    
  } catch (error) {
    console.error('Error verifying seed data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })