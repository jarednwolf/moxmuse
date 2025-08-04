import { z } from 'zod';
import { PrismaClient } from '@moxmuse/db';
import OpenAI from 'openai';
import { CompleteCardDatabase, getCardDatabase, type Card } from './card-database-complete';

// Request schema for AI-first generation
export const AIFirstRequestSchema = z.object({
  commanderName: z.string().optional(),
  userRequest: z.string(),
  constraints: z.object({
    budget: z.number().optional(),
    powerLevel: z.number().min(1).max(10).optional(),
    mustInclude: z.array(z.string()).optional(),
    mustExclude: z.array(z.string()).optional(),
  }).optional(),
});

export type AIFirstRequest = z.infer<typeof AIFirstRequestSchema>;

// Enhanced Commander rules with card counting emphasis
const COMMANDER_RULES_V2 = `
Commander/EDH Rules:
1. Deck Construction:
   - EXACTLY 100 cards total (1 commander + 99 other cards)
   - This is CRITICAL: You MUST have exactly 99 cards in the mainboard
   - Singleton format: Only one copy of each card (except basic lands)
   - Color Identity: All cards must only contain mana symbols in the commander's color identity

2. Card Counting Guidelines:
   - Count every card as you add it
   - Use basic lands to reach exactly 99 cards
   - Standard land count: 35-40 total lands (including basics)
   - If you have 25 non-basic lands, add 12-15 basic lands
   - Double-check your count before responding

3. Color Identity Rules:
   - Determined by all mana symbols in the commander's mana cost AND rules text
   - Lands with basic land types have color identity
   - Hybrid mana symbols count as BOTH colors
   - Cards with no mana symbols are colorless

4. Basic Land Distribution:
   - Plains (White), Island (Blue), Swamp (Black), Mountain (Red), Forest (Green)
   - Distribute evenly among commander's colors
   - Round up if needed to reach exactly 99 cards
`;

// Deck categories for structured generation
const DECK_CATEGORIES = {
  lands: { min: 35, max: 40, description: "Lands including basics" },
  ramp: { min: 8, max: 12, description: "Mana acceleration" },
  removal: { min: 8, max: 12, description: "Removal and interaction" },
  draw: { min: 8, max: 12, description: "Card draw and advantage" },
  core: { min: 15, max: 25, description: "Core strategy cards" },
  support: { min: 10, max: 20, description: "Support and utility" }
};

// Enhanced tool definitions
const DECK_BUILDING_TOOLS_V2 = [
  {
    type: 'function' as const,
    function: {
      name: 'generate_card_batch',
      description: 'Generate a specific number of cards for a category',
      parameters: {
        type: 'object',
        properties: {
          commander: { type: 'string', description: 'Commander name' },
          category: { 
            type: 'string',
            enum: ['lands', 'ramp', 'removal', 'draw', 'core', 'support', 'basics'],
            description: 'Card category to generate'
          },
          count: { type: 'number', description: 'Exact number of cards to generate' },
          existingCards: {
            type: 'array',
            items: { type: 'string' },
            description: 'Cards already in the deck to avoid duplicates'
          },
          constraints: {
            type: 'object',
            properties: {
              budget: { type: 'number' },
              mustInclude: { type: 'array', items: { type: 'string' } },
              mustExclude: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        required: ['commander', 'category', 'count']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'validate_and_fix_deck_count',
      description: 'Validate deck has exactly 99 cards and fix if needed',
      parameters: {
        type: 'object',
        properties: {
          commander: { type: 'string' },
          currentDeck: {
            type: 'array',
            items: { type: 'string' },
            description: 'Current deck list'
          }
        },
        required: ['commander', 'currentDeck']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_basic_lands_needed',
      description: 'Calculate how many basic lands are needed',
      parameters: {
        type: 'object',
        properties: {
          commander: { type: 'string' },
          currentNonBasicCount: { type: 'number' },
          targetTotalLands: { type: 'number' }
        },
        required: ['commander', 'currentNonBasicCount']
      }
    }
  }
];

export class AIFirstDeckGeneratorV2 {
  private openai: OpenAI;
  private prisma: PrismaClient;
  private cardDb: CompleteCardDatabase | null = null;
  
  constructor(prisma: PrismaClient, openaiKey: string) {
    this.prisma = prisma;
    this.openai = new OpenAI({ apiKey: openaiKey });
  }
  
  private async ensureCardDb(): Promise<CompleteCardDatabase> {
    if (!this.cardDb) {
      this.cardDb = await getCardDatabase(this.prisma);
    }
    return this.cardDb;
  }
  
  async generateDeck(request: AIFirstRequest): Promise<any> {
    console.log('🤖 AI-First V2 Deck Generation Started');
    console.log('Request:', request);
    
    try {
      // Stage 1: Commander selection and strategy
      const { commander, strategy } = await this.selectCommanderAndStrategy(request);
      console.log(`📌 Commander: ${commander}`);
      console.log(`📋 Strategy: ${strategy}`);
      
      // Stage 2: Generate deck in categories
      const deck = await this.generateDeckByCategories(commander, strategy, request);
      
      // Stage 3: Validate and ensure exactly 99 cards
      const validatedDeck = await this.ensureExactly99Cards(commander, deck);
      
      // Stage 4: Final validation
      const validation = await this.validateDeckLegality(commander, validatedDeck);
      
      if (!validation.valid) {
        console.error('❌ Deck validation failed:', validation.errors);
        // Attempt to fix
        const fixedDeck = await this.fixDeckIssues(commander, validatedDeck, validation);
        return {
          commander,
          mainboard: fixedDeck,
          strategy,
          description: `A ${strategy} deck led by ${commander}. Fixed validation issues.`,
          validation: await this.validateDeckLegality(commander, fixedDeck)
        };
      }
      
      return {
        commander,
        mainboard: validatedDeck,
        strategy,
        description: `A ${strategy} deck led by ${commander}.`,
        validation
      };
      
    } catch (error) {
      console.error('❌ Error in deck generation:', error);
      throw error;
    }
  }
  
  private async selectCommanderAndStrategy(request: AIFirstRequest): Promise<{ commander: string; strategy: string }> {
    const systemPrompt = `You are an expert Magic: The Gathering Commander deck builder.
    
Your task: Select an appropriate commander and define the strategy based on the user's request.

Output in JSON format:
{
  "commander": "Exact commander card name",
  "strategy": "Brief strategy description (e.g., 'Token Generation and Go-Wide Aggro')",
  "colorIdentity": ["W", "U", "B", "R", "G"], // Only include actual colors
  "reasoning": "Why this commander fits the request"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.userRequest }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const response = JSON.parse(completion.choices[0].message.content || '{}');
    return {
      commander: response.commander || request.commanderName || 'Trostani, Selesnya\'s Voice',
      strategy: response.strategy || 'Value-based midrange strategy'
    };
  }
  
  private async generateDeckByCategories(
    commander: string,
    strategy: string,
    request: AIFirstRequest
  ): Promise<string[]> {
    const deck: string[] = [];
    const categories = this.planDeckComposition(commander, strategy);
    
    console.log('📊 Planned composition:', categories);
    
    // Generate each category
    for (const [category, count] of Object.entries(categories)) {
      if (count > 0) {
        console.log(`🎴 Generating ${count} ${category} cards...`);
        const cards = await this.generateCategoryCards(
          commander,
          category,
          count,
          deck,
          request
        );
        deck.push(...cards);
        console.log(`   Added ${cards.length} cards. Total: ${deck.length}`);
      }
    }
    
    return deck;
  }
  
  private planDeckComposition(commander: string, strategy: string): Record<string, number> {
    // Plan a balanced deck composition
    return {
      core: 20,      // Core strategy cards
      support: 15,   // Support cards
      ramp: 10,      // Mana ramp
      removal: 10,   // Removal/interaction
      draw: 10,      // Card draw
      lands: 24,     // Non-basic lands
      basics: 10     // Will be adjusted to reach exactly 99
    };
  }
  
  private async generateCategoryCards(
    commander: string,
    category: string,
    count: number,
    existingCards: string[],
    request: AIFirstRequest
  ): Promise<string[]> {
    const categoryPrompts: Record<string, string> = {
      core: "Generate core strategy cards that directly synergize with the commander's abilities",
      support: "Generate support cards that enhance the deck's strategy",
      ramp: "Generate mana ramp and acceleration cards",
      removal: "Generate removal, counterspells, and interaction",
      draw: "Generate card draw and card advantage engines",
      lands: "Generate non-basic lands that support the deck's colors and strategy",
      basics: "Generate basic lands matching the commander's color identity"
    };
    
    const prompt = `Commander: ${commander}
Current deck has ${existingCards.length} cards.
Category: ${category}
Task: ${categoryPrompts[category] || 'Generate cards for this category'}

Generate EXACTLY ${count} cards for this category.
${request.constraints?.budget ? `Budget constraint: $${request.constraints.budget}` : ''}
${request.constraints?.mustInclude ? `Must include these if in category: ${request.constraints.mustInclude.join(', ')}` : ''}
Avoid duplicates with existing cards.

Output JSON format:
{
  "cards": ["Card Name 1", "Card Name 2", ...],
  "count": ${count},
  "verification": "I have provided exactly ${count} cards"
}`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: COMMANDER_RULES_V2 },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const response = JSON.parse(completion.choices[0].message.content || '{}');
    const cards = response.cards || [];
    
    // Filter out duplicates
    const uniqueCards = cards.filter((card: string) => !existingCards.includes(card));
    
    // If we don't have enough unique cards, try to generate more
    if (uniqueCards.length < count && category !== 'basics') {
      const additionalNeeded = count - uniqueCards.length;
      console.log(`   Need ${additionalNeeded} more cards...`);
      const additional = await this.generateCategoryCards(
        commander,
        category,
        additionalNeeded,
        [...existingCards, ...uniqueCards],
        request
      );
      uniqueCards.push(...additional);
    }
    
    return uniqueCards.slice(0, count);
  }
  
  private async ensureExactly99Cards(commander: string, deck: string[]): Promise<string[]> {
    console.log(`🔢 Ensuring exactly 99 cards (currently ${deck.length})...`);
    
    if (deck.length === 99) {
      return deck;
    }
    
    // Get commander details for color identity
    const commanderCard = await this.getCommanderCard(commander);
    const colors = commanderCard?.colorIdentity || ['W'];
    
    if (deck.length < 99) {
      // Add basic lands to reach 99
      const needed = 99 - deck.length;
      const basics = this.distributeBasicLands(colors, needed);
      console.log(`   Adding ${needed} basic lands:`, basics);
      deck.push(...basics);
    } else if (deck.length > 99) {
      // Remove excess cards (prefer to remove basics first)
      const excess = deck.length - 99;
      const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
      const sortedDeck = [...deck].sort((a, b) => {
        const aIsBasic = basics.includes(a);
        const bIsBasic = basics.includes(b);
        if (aIsBasic && !bIsBasic) return 1;
        if (!aIsBasic && bIsBasic) return -1;
        return 0;
      });
      deck = sortedDeck.slice(0, 99);
      console.log(`   Removed ${excess} cards to reach 99`);
    }
    
    return deck;
  }
  
  private distributeBasicLands(colors: string[], count: number): string[] {
    const colorToBasic: Record<string, string> = {
      'W': 'Plains',
      'U': 'Island',
      'B': 'Swamp',
      'R': 'Mountain',
      'G': 'Forest'
    };
    
    const basics: string[] = [];
    const basicsPerColor = Math.floor(count / colors.length);
    const remainder = count % colors.length;
    
    colors.forEach((color, index) => {
      const basic = colorToBasic[color];
      const thisColorCount = basicsPerColor + (index < remainder ? 1 : 0);
      for (let i = 0; i < thisColorCount; i++) {
        basics.push(basic);
      }
    });
    
    return basics;
  }
  
  private async getCommanderCard(commanderName: string): Promise<Card | null> {
    try {
      const db = await this.ensureCardDb();
      const card = await db.getCard(commanderName);
      return card ?? null; // Convert undefined to null
    } catch (error) {
      console.error('Error getting commander card:', error);
      return null;
    }
  }
  
  private async validateDeckLegality(commander: string, mainboard: string[]): Promise<any> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check deck size
    if (mainboard.length !== 99) {
      errors.push(`Deck must have exactly 99 cards, found ${mainboard.length}`);
    }
    
    // Check for duplicates
    const cardCounts = new Map<string, number>();
    for (const cardName of mainboard) {
      const count = (cardCounts.get(cardName) || 0) + 1;
      cardCounts.set(cardName, count);
    }
    
    const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
    for (const [cardName, count] of Array.from(cardCounts)) {
      if (count > 1 && !basics.includes(cardName)) {
        errors.push(`Illegal duplicate: ${cardName} (${count} copies)`);
      }
    }
    
    // Count card types
    let lands = 0;
    let creatures = 0;
    let other = 0;
    
    for (const cardName of mainboard) {
      if (basics.includes(cardName) || cardName.toLowerCase().includes('land')) {
        lands++;
      } else if (cardName.toLowerCase().includes('creature')) {
        creatures++;
      } else {
        other++;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        commander,
        cardCount: mainboard.length,
        uniqueCards: cardCounts.size,
        lands,
        creatures,
        other
      }
    };
  }
  
  private async fixDeckIssues(
    commander: string,
    deck: string[],
    validation: any
  ): Promise<string[]> {
    let fixedDeck = [...deck];
    
    // Fix duplicates
    if (validation.errors.some((e: string) => e.includes('duplicate'))) {
      const seen = new Set<string>();
      const basics = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
      fixedDeck = fixedDeck.filter(card => {
        if (basics.includes(card)) return true;
        if (seen.has(card)) return false;
        seen.add(card);
        return true;
      });
    }
    
    // Ensure exactly 99 cards
    fixedDeck = await this.ensureExactly99Cards(commander, fixedDeck);
    
    return fixedDeck;
  }
}

// Export factory function
export async function getAIFirstDeckGeneratorV2(
  prisma: PrismaClient,
  openaiKey: string
): Promise<AIFirstDeckGeneratorV2> {
  return new AIFirstDeckGeneratorV2(prisma, openaiKey);
}
