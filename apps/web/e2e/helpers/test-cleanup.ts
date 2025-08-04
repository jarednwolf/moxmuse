/**
 * Test cleanup utilities to prevent database constraint violations
 * and ensure tests run in isolation
 */

import { test as base } from '@playwright/test'
import { installOpenAIMocks } from '../mocks/openai'

/**
 * Extended test fixture that includes cleanup and mocking
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Install OpenAI mocks before each test
    await installOpenAIMocks(page)
    
    // Clear localStorage before each test
    await page.addInitScript(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
    
    // Use the page with mocks installed
    await use(page)
    
    // Cleanup after each test
    await page.evaluate(() => {
      window.localStorage.clear()
      window.sessionStorage.clear()
    })
  }
})

// Re-export expect for convenience
export { expect } from '@playwright/test'

/**
 * Generate unique session IDs to avoid database conflicts
 */
export function generateUniqueSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `test-session-${timestamp}-${random}`
}

/**
 * Mock deck generation response with unique session ID
 */
export function createMockDeckResponse(overrides = {}) {
  return {
    deckName: "Test Generated Deck",
    commanderName: "Azusa, Lost but Seeking",
    commanderCard: {
      name: "Azusa, Lost but Seeking",
      mana_cost: "{2}{G}",
      type_line: "Legendary Creature — Human Monk",
      oracle_text: "You may play two additional lands on each of your turns.",
      power: "1",
      toughness: "2",
      colors: ["G"],
      color_identity: ["G"],
      keywords: [],
      set: "chk",
      rarity: "rare",
      image_uris: {
        normal: "https://cards.scryfall.io/normal/front/0/b/0b8aff2c-1f7b-4507-b914-53f8c4706b3d.jpg",
        small: "https://cards.scryfall.io/small/front/0/b/0b8aff2c-1f7b-4507-b914-53f8c4706b3d.jpg"
      }
    },
    format: "commander",
    cards: {
      lands: [
        { name: "Forest", quantity: 35, category: "Land" },
        { name: "Command Tower", quantity: 1, category: "Land" },
        { name: "Evolving Wilds", quantity: 1, category: "Land" }
      ],
      creatures: [
        { name: "Llanowar Elves", quantity: 1, category: "Creature" },
        { name: "Elvish Mystic", quantity: 1, category: "Creature" },
        { name: "Birds of Paradise", quantity: 1, category: "Creature" }
      ],
      nonCreatures: [
        { name: "Cultivate", quantity: 1, category: "Sorcery" },
        { name: "Kodama's Reach", quantity: 1, category: "Sorcery" },
        { name: "Rampant Growth", quantity: 1, category: "Sorcery" }
      ]
    },
    strategy: {
      primary: "Ramp and land-based strategies",
      themes: ["Land ramp", "Landfall triggers", "Big mana plays"],
      keyCards: ["Azusa, Lost but Seeking", "Cultivate", "Oracle of Mul Daya"],
      winConditions: ["Overwhelming board presence", "Combat damage with large creatures"]
    },
    reasoning: "This deck leverages Azusa's ability to play additional lands for explosive ramp",
    sessionId: generateUniqueSessionId(), // Use unique session ID
    ...overrides
  }
}
