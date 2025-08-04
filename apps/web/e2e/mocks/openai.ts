/**
 * Mock responses for OpenAI API calls in tests
 * This prevents rate limiting and ensures consistent test results
 */

/**
 * Generate unique session IDs to avoid database conflicts
 */
function generateUniqueSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `test-session-${timestamp}-${random}`
}

export const mockDeckGenerationResponse = () => ({
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
  sessionId: generateUniqueSessionId() // Use unique session ID for each test
});

export const mockCommanderSuggestions = [
  {
    name: "Atraxa, Praetors' Voice",
    mana_cost: "{G}{W}{U}{B}",
    type_line: "Legendary Creature — Angel Horror",
    oracle_text: "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
    power: "4",
    toughness: "4",
    colors: ["G", "W", "U", "B"],
    color_identity: ["G", "W", "U", "B"],
    keywords: ["Flying", "Vigilance", "Deathtouch", "Lifelink"],
    set: "c16",
    rarity: "mythic",
    image_uris: {
      normal: "https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg",
      small: "https://cards.scryfall.io/small/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg"
    }
  },
  {
    name: "The Ur-Dragon",
    mana_cost: "{4}{W}{U}{B}{R}{G}",
    type_line: "Legendary Creature — Dragon Avatar",
    oracle_text: "Eminence — As long as The Ur-Dragon is in the command zone or on the battlefield, other Dragon spells you cast cost {1} less to cast.\nFlying\nWhenever one or more Dragons you control attack, draw that many cards, then you may put a permanent card from your hand onto the battlefield.",
    power: "10",
    toughness: "10",
    colors: ["W", "U", "B", "R", "G"],
    color_identity: ["W", "U", "B", "R", "G"],
    keywords: ["Flying"],
    set: "c17",
    rarity: "mythic",
    image_uris: {
      normal: "https://cards.scryfall.io/normal/front/7/e/7e78b70b-0c67-4f14-8ad7-c9f8e3f59743.jpg",
      small: "https://cards.scryfall.io/small/front/7/e/7e78b70b-0c67-4f14-8ad7-c9f8e3f59743.jpg"
    }
  },
  {
    name: "Edgar Markov",
    mana_cost: "{3}{R}{W}{B}",
    type_line: "Legendary Creature — Vampire Knight",
    oracle_text: "Eminence — Whenever you cast another Vampire spell, if Edgar Markov is in the command zone or on the battlefield, create a 1/1 black Vampire creature token.\nFirst strike, haste\nWhenever Edgar Markov attacks, put a +1/+1 counter on each Vampire you control.",
    power: "4",
    toughness: "4",
    colors: ["R", "W", "B"],
    color_identity: ["R", "W", "B"],
    keywords: ["First strike", "Haste"],
    set: "c17",
    rarity: "mythic",
    image_uris: {
      normal: "https://cards.scryfall.io/normal/front/8/d/8d94b8ec-ecda-43c8-a60e-1ba33e6a54a4.jpg",
      small: "https://cards.scryfall.io/small/front/8/d/8d94b8ec-ecda-43c8-a60e-1ba33e6a54a4.jpg"
    }
  }
];

export const mockCardRecommendations = [
  { name: "Sol Ring", quantity: 1, category: "Artifact", reasoning: "Essential mana acceleration" },
  { name: "Lightning Bolt", quantity: 1, category: "Instant", reasoning: "Efficient removal spell" },
  { name: "Counterspell", quantity: 1, category: "Instant", reasoning: "Classic counter magic" },
  { name: "Swords to Plowshares", quantity: 1, category: "Instant", reasoning: "Premium creature removal" },
  { name: "Rhystic Study", quantity: 1, category: "Enchantment", reasoning: "Powerful card draw engine" }
];

/**
 * Install mock handlers for OpenAI API calls
 * Should be called in global-setup.ts before tests run
 */
export async function installOpenAIMocks(page: any) {
  // Intercept tutor API calls that would use OpenAI
  await page.route('**/api/trpc/tutor.generateFullDeck*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        result: {
          data: mockDeckGenerationResponse() // Call function to get unique response
        }
      }])
    });
  });

  await page.route('**/api/trpc/tutor.getCommanderSuggestions*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        result: {
          data: mockCommanderSuggestions
        }
      }])
    });
  });

  await page.route('**/api/trpc/tutor.getCardRecommendations*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        result: {
          data: mockCardRecommendations
        }
      }])
    });
  });

  // Mock deck save operations
  await page.route('**/api/trpc/deck.create*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        result: {
          data: {
            id: generateUniqueSessionId(),
            name: "Test Deck",
            createdAt: new Date().toISOString()
          }
        }
      }])
    });
  });

  // Mock consultation session creation
  await page.route('**/api/trpc/tutor.createConsultationSession*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        result: {
          data: {
            sessionId: generateUniqueSessionId(),
            createdAt: new Date().toISOString()
          }
        }
      }])
    });
  });
}
