import type { ConsultationData, GeneratedDeck } from '@moxmuse/shared'

/**
 * Prompt Management Service
 * 
 * Centralizes all AI prompt templates and prompt engineering logic.
 * This service ensures consistent, optimized prompts across all AI operations
 * and makes it easy to update prompt strategies in one place.
 */
export class PromptManagementService {
  
  /**
   * Get system prompt for vision parsing (natural language to consultation data)
   */
  getVisionParsingPrompt(): string {
    return `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering deck building assistant.

Your task is to parse a user's natural language description of their deck vision into structured consultation data.

Parse the user's vision text and extract:
- Commander (if mentioned specifically)
- Theme/Strategy
- Budget (if mentioned)  
- Power level/bracket (if mentioned)
- Colors or color preferences
- Win conditions
- Interaction preferences
- Specific cards mentioned
- Strategies to avoid

RESPONSE FORMAT: You MUST respond with ONLY a valid JSON object:
{
  "commander": "Commander Name" or null,
  "theme": "strategy name",
  "budget": "budget range or amount",
  "powerLevel": 1-5,
  "colors": ["W", "U", "B", "R", "G"],
  "winCondition": "combat|combo|alternative|mixed",
  "interactionLevel": "low|moderate|heavy",
  "petCards": ["Card Name 1", "Card Name 2"],
  "avoidStrategies": ["strategy1", "strategy2"],
  "complexity": "low|moderate|high"
}

If information is not mentioned, use null or reasonable defaults.`
  }

  /**
   * Get system prompt for commander suggestions
   */
  getCommanderSuggestionsPrompt(): string {
    return `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering commander specialist.

Based on the user's preferences, recommend exactly 5 legendary creatures that can be used as commanders.

CRITICAL REQUIREMENTS:
- ONLY recommend legendary creatures that can legally be commanders
- Each recommendation must be a real Magic: The Gathering legendary creature
- Consider the user's specified preferences for colors, strategy, power level, and budget
- Provide diverse options with different strategies and color combinations

RESPONSE FORMAT: You MUST respond with ONLY a valid JSON array, no other text. Example:
[
  {
    "name": "Atraxa, Praetors' Voice",
    "reason": "Perfect for +1/+1 counters strategy in 4-color identity",
    "price": "25.00"
  },
  {
    "name": "Edgar Markov",
    "reason": "Aggressive vampire tribal commander with immediate impact",
    "price": "15.00"
  }
]

Do not include any explanation text, just the JSON array.`
  }

  /**
   * Get system prompt for card recommendations
   */
  getCardRecommendationsPrompt(constraints?: {
    budget?: number
    powerLevel?: number
  }): string {
    return `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering deck-building assistant.

Given the user's request, recommend specific Magic cards that would work well.

If the user is asking for a complete deck or many cards, recommend 8-15 cards.
If the user is asking for specific suggestions, recommend 3-5 cards.

For each card, provide:
1. The exact card name (must be a real Magic card)
2. Why it's a good fit for their request
3. Estimated price in USD

Consider:
- Commander color identity restrictions
- Budget: ${constraints?.budget ? `$${constraints.budget} total` : 'Not specified'}
- Power Level: ${constraints?.powerLevel ? `Bracket ${constraints.powerLevel}` : 'Bracket 2-3'}
- The specific strategy or request mentioned

IMPORTANT: Only recommend real Magic: The Gathering cards that exist. Double-check card names for accuracy.

Format your response as a JSON array like this:
[
  {
    "name": "Sol Ring",
    "reason": "Essential mana acceleration for any Commander deck",
    "price": "1.50"
  }
]`
  }

  /**
   * Get system prompt for complete deck generation
   */
  getDeckGenerationPrompt(): string {
    return `You are MoxMuse's TolarianTutor, an expert Magic: The Gathering deck builder specializing exclusively in Commander format.

Your task is to generate a complete, competitive, and cohesive 100-card Commander deck optimized for multiplayer games based on the user's preferences and constraints.

CRITICAL COMMANDER REQUIREMENTS:
- Generate exactly 99 cards (excluding the commander) for a total of 100 cards
- All cards must be real Magic: The Gathering cards legal in Commander
- Respect Commander format rules and color identity restrictions
- Design for multiplayer Commander games (typically 4 players)
- Ensure proper mana curve and deck balance for Commander gameplay
- Include 35-38 lands, 8-12 ramp sources, 8-10 card draw, 5-8 removal spells
- Cards must work synergistically with the chosen commander and strategy
- Consider the political and multiplayer aspects of Commander

RESPONSE FORMAT: Provide a JSON response with the following structure:
{
  "strategy": {
    "name": "Strategy Name",
    "description": "Detailed strategy description",
    "archetype": "aggro|control|combo|midrange|tribal|value|stax",
    "themes": ["theme1", "theme2"],
    "gameplan": "How the deck wins",
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "winConditions": [
    {
      "type": "combat|combo|alternative|control",
      "description": "How this win condition works",
      "keyCards": ["Card Name 1", "Card Name 2"],
      "probability": 0.6
    }
  ],
  "cards": [
    {
      "name": "Exact Card Name",
      "category": "ramp|draw|removal|win-con|utility|protection|land",
      "role": "primary|secondary|support",
      "reasoning": "Why this card is included",
      "alternatives": ["Alternative Card 1", "Alternative Card 2"],
      "upgradeOptions": ["Upgrade Card 1", "Upgrade Card 2"],
      "budgetOptions": ["Budget Card 1", "Budget Card 2"]
    }
  ]
}

Ensure all card names are spelled exactly as they appear on official Magic cards.`
  }

  /**
   * Get system prompt for synergy analysis
   */
  getSynergyAnalysisPrompt(): string {
    return `You are an expert Magic: The Gathering deck analyst specializing in identifying card synergies and interactions.

Analyze the provided cards and identify meaningful synergies. Respond with a JSON array of synergy objects:

[
  {
    "cardId": "primary-card-id",
    "relatedCardIds": ["related-card-1", "related-card-2"],
    "synergyType": "combo|support|engine|protection|enabler",
    "strength": 8,
    "description": "Detailed explanation of the synergy"
  }
]

Focus on:
- Combo pieces that work together
- Support cards that enable strategies
- Engine cards that generate value
- Protection for key pieces
- Enablers that make strategies possible

Rate strength from 1-10 where 10 is game-winning synergy.
Focus on actual mechanical interactions, not just thematic connections.`
  }

  /**
   * Get system prompt for strategy analysis
   */
  getStrategyAnalysisPrompt(): string {
    return `You are an expert Magic: The Gathering strategist analyzing Commander decks.

Provide a comprehensive strategy analysis in JSON format:

{
  "strategy": {
    "name": "Strategy Name",
    "description": "Detailed strategy description",
    "archetype": "aggro|control|combo|midrange|tribal|value|stax",
    "themes": ["theme1", "theme2"],
    "gameplan": "How the deck wins",
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "winConditions": [
    {
      "type": "combat|combo|alternative|control",
      "description": "How this win condition works",
      "keyCards": ["Card Name 1", "Card Name 2"],
      "probability": 0.6
    }
  ],
  "keyInteractions": ["interaction1", "interaction2"],
  "playPattern": "Typical game flow description",
  "mulliganGuide": "What to look for in opening hands",
  "sideboarding": ["sideboard tip1", "sideboard tip2"]
}`
  }

  /**
   * Get system prompt for deck improvements
   */
  getDeckImprovementsPrompt(): string {
    return `You are an expert Magic: The Gathering deck optimizer.

Suggest specific card improvements for the provided deck. Respond with a JSON array:

[
  {
    "name": "Card Name",
    "reason": "Why this card improves the deck",
    "replaces": "Card it should replace (if any)",
    "category": "improvement category"
  }
]

Focus on cards that meaningfully improve the deck's strategy, consistency, or power level.`
  }

  /**
   * Build deck generation user prompt
   */
  buildDeckGenerationUserPrompt(
    consultationData: ConsultationData, 
    commander: string, 
    constraints?: { budget?: number; powerLevel?: number; useCollection?: boolean }
  ): string {
    const budget = constraints?.budget || consultationData.budget
    const powerLevel = constraints?.powerLevel || consultationData.powerLevel || 3
    const useCollection = constraints?.useCollection || consultationData.useCollection

    let prompt = `Build a complete 100-card Commander deck with ${commander} as the commander.

DECK REQUIREMENTS:
- Exactly 99 cards + 1 commander (100 total)
- Follow Commander format rules and color identity restrictions
- Power Level: Bracket ${powerLevel} (1=Precon, 2=Focused, 3=Optimized, 4=High Power)
${budget ? `- Budget: $${budget} total` : '- No specific budget constraint'}
${useCollection ? '- Prioritize commonly owned cards when possible' : ''}

STRATEGY PREFERENCES:`

    if (consultationData.strategy) {
      prompt += `\n- Primary Strategy: ${consultationData.strategy}`
    }
    
    if (consultationData.themes?.length) {
      prompt += `\n- Themes: ${consultationData.themes.join(', ')}`
    }

    if (consultationData.winConditions) {
      prompt += `\n- Primary Win Condition: ${consultationData.winConditions.primary}`
      if (consultationData.winConditions.combatStyle) {
        prompt += ` (${consultationData.winConditions.combatStyle})`
      }
      if (consultationData.winConditions.comboType) {
        prompt += ` (${consultationData.winConditions.comboType})`
      }
    }

    if (consultationData.interaction) {
      prompt += `\n- Interaction Level: ${consultationData.interaction.level}`
      prompt += `\n- Interaction Types: ${consultationData.interaction.types.join(', ')}`
      prompt += `\n- Interaction Timing: ${consultationData.interaction.timing}`
    }

    if (consultationData.complexityLevel) {
      prompt += `\n- Complexity Level: ${consultationData.complexityLevel}`
    }

    if (consultationData.avoidStrategies?.length) {
      prompt += `\n- Avoid Strategies: ${consultationData.avoidStrategies.join(', ')}`
    }

    if (consultationData.avoidCards?.length) {
      prompt += `\n- Avoid Cards: ${consultationData.avoidCards.join(', ')}`
    }

    if (consultationData.petCards?.length) {
      prompt += `\n- Include Pet Cards: ${consultationData.petCards.join(', ')}`
    }

    prompt += `

COMMANDER DECK COMPOSITION GUIDELINES:
- 35-38 lands (including utility lands and color fixing)
- 8-12 mana ramp sources (artifacts, land ramp, mana dorks)
- 8-10 card draw engines (for multiplayer card advantage)
- 5-8 targeted removal spells
- 2-4 board wipes (essential for multiplayer)
- 25-35 strategy-specific cards that synergize with your commander
- 5-10 utility/protection cards (including counterspells if in blue)
- Consider political cards and multiplayer interactions

Please provide the complete 99-card deck list with categorization and reasoning for each card choice.`

    return prompt
  }

  /**
   * Build synergy analysis user prompt
   */
  buildSynergyAnalysisUserPrompt(cardDetails: any[]): string {
    let prompt = `Analyze the synergies between these Magic: The Gathering cards in a Commander deck:\n\n`
    
    for (const card of cardDetails) {
      if (card.cardData) {
        prompt += `- ${card.cardData.name} (${card.cardData.type_line}): ${card.cardData.oracle_text?.substring(0, 200) || 'No text'}\n`
      }
    }

    prompt += `\nIdentify the key synergies, combos, and interactions between these cards. Focus on:\n`
    prompt += `- Direct card interactions and combos\n`
    prompt += `- Thematic synergies and engines\n`
    prompt += `- Support relationships between cards\n`
    prompt += `- Protection and enabler relationships\n`

    return prompt
  }

  /**
   * Build strategy analysis user prompt
   */
  buildStrategyAnalysisUserPrompt(deck: GeneratedDeck): string {
    return `Analyze this Commander deck and provide a comprehensive strategy analysis:

Commander: ${deck.commander}
Strategy: ${deck.strategy.name}
Power Level: ${deck.powerLevel}
Card Count: ${deck.cards.length}

Key Cards:
${deck.cards.slice(0, 10).map(card => `- ${card.cardId} (${card.category}): ${card.reasoning}`).join('\n')}

Provide analysis of:
1. Overall strategy and gameplan
2. Win conditions and how to achieve them
3. Key interactions and synergies
4. Typical play patterns
5. Mulligan considerations
6. Strengths and weaknesses`
  }

  /**
   * Build deck improvements user prompt
   */
  buildDeckImprovementsUserPrompt(deck: GeneratedDeck, focusArea?: string): string {
    let prompt = `Suggest improvements for this Commander deck:

Commander: ${deck.commander}
Strategy: ${deck.strategy.name}
Power Level: ${deck.powerLevel}
Current Budget: $${deck.estimatedBudget || 'N/A'}

Current Deck Composition:
${deck.cards.slice(0, 15).map(card => `- ${card.cardId} (${card.category})`).join('\n')}

${focusArea ? `Focus specifically on improving: ${focusArea}` : 'Provide general improvements'}

Suggest 5-8 specific card recommendations that would improve the deck.`

    return prompt
  }
}