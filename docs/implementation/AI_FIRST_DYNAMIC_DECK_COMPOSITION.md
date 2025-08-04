# AI-First Dynamic Deck Composition Strategy

## Overview: 3-Phase Iterative Approach

Instead of fixed categories for all decks, we use AI to:
1. **Phase 1**: Analyze strategy & create custom composition
2. **Phase 2**: Generate cards based on dynamic categories
3. **Phase 3**: Validate and adjust to reach exactly 99 cards

## Phase 1: Strategy Analysis & Composition Planning

### Step 1: Commander & Strategy Analysis
```javascript
const analyzeStrategy = async (commander, userRequest) => {
  const prompt = `Analyze this commander and request:
  Commander: ${commander}
  Request: ${userRequest}
  
  Determine:
  1. Primary strategy (e.g., lands-matter, aristocrats, spellslinger)
  2. Secondary themes
  3. Key mechanics/synergies
  4. Optimal deck composition for this strategy
  
  Output JSON:
  {
    "strategy": "primary strategy name",
    "themes": ["theme1", "theme2"],
    "mechanics": ["mechanic1", "mechanic2"],
    "composition": {
      "lands": {"total": 45, "basics": 20, "nonbasics": 25},
      "creatures": {"total": 20, "utility": 10, "threats": 10},
      "artifacts": {"total": 5, "ramp": 3, "value": 2},
      "enchantments": {"total": 8},
      "instants": {"total": 10},
      "sorceries": {"total": 11},
      "planeswalkers": {"total": 0}
    },
    "rationale": "Why this composition fits the strategy"
  }`;
  
  // AI determines optimal composition
  return aiResponse;
};
```

### Step 2: Dynamic Category Generation
Based on strategy, create custom categories:

```javascript
const generateDynamicCategories = (strategyAnalysis) => {
  const { strategy, composition } = strategyAnalysis;
  
  // Example: Lands Matter Deck
  if (strategy === "lands-matter") {
    return [
      { name: "land-ramp", count: 15, description: "land-based ramp (Cultivate, Kodama's Reach)" },
      { name: "landfall-payoffs", count: 12, description: "landfall triggers (Avenger of Zendikar)" },
      { name: "land-recursion", count: 8, description: "get lands from graveyard" },
      { name: "utility-lands", count: 20, description: "lands with abilities" },
      { name: "basic-lands", count: 25, description: "basic lands for triggers" },
      { name: "protection", count: 8, description: "protect key pieces" },
      { name: "card-draw", count: 10, description: "draw engines" },
      { name: "removal", count: 6, description: "minimal removal package" }
    ];
  }
  
  // Example: Aristocrats Deck
  if (strategy === "aristocrats") {
    return [
      { name: "sacrifice-outlets", count: 8, description: "free sac outlets" },
      { name: "death-triggers", count: 12, description: "Blood Artist effects" },
      { name: "token-generators", count: 10, description: "fodder creation" },
      { name: "recursion", count: 8, description: "bring back creatures" },
      { name: "creatures", count: 20, description: "value creatures" },
      { name: "removal", count: 10, description: "removal package" },
      { name: "lands", count: 35, description: "lean mana base" }
    ];
  }
  
  // Example: Artifact Deck
  if (strategy === "artifact") {
    return [
      { name: "artifact-creatures", count: 15, description: "artifact creatures" },
      { name: "artifact-ramp", count: 12, description: "Sol Ring, signets, etc" },
      { name: "artifact-synergy", count: 15, description: "cards that care about artifacts" },
      { name: "utility-artifacts", count: 10, description: "value artifacts" },
      { name: "protection", count: 6, description: "protect artifacts" },
      { name: "removal", count: 8, description: "removal package" },
      { name: "lands", count: 33, description: "artifact lands included" }
    ];
  }
  
  // Add more strategies...
  return defaultCategories;
};
```

## Phase 2: Intelligent Card Selection

### Step 1: Context-Aware Generation
Each category gets generated with full context:

```javascript
const generateCategoryWithContext = async (category, strategyContext, existingCards) => {
  const prompt = `
Strategy Context:
${JSON.stringify(strategyContext, null, 2)}

Current deck has ${existingCards.length} cards.
Category: ${category.name}
Description: ${category.description}

Generate EXACTLY ${category.count} cards that:
1. Fit the ${strategyContext.strategy} strategy
2. Synergize with ${strategyContext.commander}
3. Work with these themes: ${strategyContext.themes.join(', ')}
4. Avoid duplicates with existing cards

Focus on cards that specifically enhance the ${strategyContext.strategy} game plan.

Output JSON: {"cards": [...], "count": ${category.count}}`;

  return aiGeneratedCards;
};
```

### Step 2: Overlap Management
Handle cards that fit multiple categories:

```javascript
const manageOverlaps = (categories, strategyContext) => {
  // Some cards count for multiple categories
  const overlaps = {
    "Cultivate": ["ramp", "lands"],
    "Sakura-Tribe Elder": ["ramp", "creatures", "sacrifice"],
    "Solemn Simulacrum": ["ramp", "creatures", "draw", "artifact"],
    // etc...
  };
  
  // Adjust category counts based on expected overlaps
  return adjustedCategories;
};
```

## Phase 3: Validation & Fine-Tuning

### Step 1: Composition Validation
```javascript
const validateComposition = async (deck, targetComposition) => {
  const actualComposition = analyzeDeck(deck);
  
  const adjustments = {
    lands: targetComposition.lands.total - actualComposition.lands,
    creatures: targetComposition.creatures.total - actualComposition.creatures,
    // etc...
  };
  
  // Generate missing pieces
  for (const [type, needed] of Object.entries(adjustments)) {
    if (needed > 0) {
      const additionalCards = await generateSpecificType(type, needed, deck);
      deck.push(...additionalCards);
    }
  }
  
  return deck;
};
```

### Step 2: Final 99-Card Guarantee
```javascript
const ensureExactly99 = async (deck, commander, strategy) => {
  const current = deck.length;
  
  if (current < 99) {
    // Smart filling based on strategy
    const needed = 99 - current;
    
    if (strategy === "lands-matter") {
      // Add more lands (probably basics for landfall)
      const lands = generateBasicLands(commander.colors, needed);
      deck.push(...lands);
    } else if (strategy === "aristocrats") {
      // Add more creatures or sac outlets
      const fillCards = await generateFillCards(strategy, needed, deck);
      deck.push(...fillCards);
    } else {
      // Default to basic lands
      const basics = distributeBasicLands(commander.colors, needed);
      deck.push(...basics);
    }
  } else if (current > 99) {
    // Intelligent trimming
    deck = intelligentTrim(deck, strategy, 99);
  }
  
  return deck;
};
```

## Implementation Example

```javascript
async function generateDynamicDeck(request) {
  // Phase 1: Strategy Analysis
  console.log("🎯 Phase 1: Analyzing Strategy...");
  const strategyAnalysis = await analyzeStrategy(
    request.commander || "auto-select",
    request.userRequest
  );
  
  console.log(`Strategy: ${strategyAnalysis.strategy}`);
  console.log(`Composition: ${JSON.stringify(strategyAnalysis.composition)}`);
  
  // Phase 2: Dynamic Category Generation
  console.log("\n📊 Phase 2: Generating Dynamic Categories...");
  const categories = generateDynamicCategories(strategyAnalysis);
  
  const deck = [];
  for (const category of categories) {
    console.log(`Generating ${category.count} ${category.name} cards...`);
    const cards = await generateCategoryWithContext(
      category,
      strategyAnalysis,
      deck
    );
    deck.push(...cards);
  }
  
  // Phase 3: Validation & Adjustment
  console.log("\n✅ Phase 3: Validation & Fine-tuning...");
  const validatedDeck = await validateComposition(
    deck,
    strategyAnalysis.composition
  );
  
  const finalDeck = await ensureExactly99(
    validatedDeck,
    strategyAnalysis.commander,
    strategyAnalysis.strategy
  );
  
  return {
    commander: strategyAnalysis.commander,
    mainboard: finalDeck,
    strategy: strategyAnalysis.strategy,
    composition: analyzeFinalComposition(finalDeck),
    success: finalDeck.length === 99
  };
}
```

## Strategy Examples

### Lands Matter Composition
- **45+ lands** (vs 37 standard)
- Heavy focus on landfall triggers
- Land recursion engines
- Minimal non-land spells

### Aristocrats Composition  
- **35-36 lands** (lean mana base)
- **30+ creatures** for sacrifice fodder
- Multiple sacrifice outlets
- Death trigger payoffs

### Spellslinger Composition
- **32-34 lands** (low curve)
- **25+ instants/sorceries**
- Spell copy effects
- Card draw engines

### Artifact Composition
- **33-35 lands** (artifact lands included)
- **35+ artifacts**
- Artifact synergies
- Cost reducers

## Benefits of This Approach

1. **Strategy-Appropriate**: Each deck gets the right balance for its strategy
2. **Flexible**: Can handle any commander or strategy
3. **Accurate**: Still guarantees exactly 99 cards
4. **Intelligent**: AI understands why certain compositions work
5. **Iterative**: Can refine based on validation

## Example Test Implementation

```javascript
// Test different strategies
const strategies = [
  { 
    request: "Build a lands matter deck with Omnath, Locus of Rage",
    expectedLands: 45 
  },
  { 
    request: "Build an aristocrats deck with Teysa Karlov",
    expectedCreatures: 30 
  },
  { 
    request: "Build a spellslinger deck with Kess, Dissident Mage",
    expectedSpells: 25 
  }
];

for (const test of strategies) {
  const deck = await generateDynamicDeck(test.request);
  console.log(`Strategy: ${deck.strategy}`);
  console.log(`Composition: ${JSON.stringify(deck.composition)}`);
  console.log(`Success: ${deck.success}`);
}
```

## Conclusion

This dynamic, iterative approach ensures:
- Each deck type gets appropriate composition
- AI understands and applies strategy-specific rules
- We still achieve 100% accuracy on 99 cards
- The system is extensible to new strategies

The key insight: **Let AI determine the optimal composition, then validate mathematically.**

[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]
