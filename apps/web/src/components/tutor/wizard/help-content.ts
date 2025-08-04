export const WIZARD_HELP_CONTENT = {
  commander: {
    title: "Commander Selection",
    description: "Your commander defines your deck's color identity and often its strategy. If you're unsure, our AI can suggest commanders based on your preferences.",
    knownCommander: "Choose this if you already have a specific commander in mind that you want to build around.",
    needSuggestions: "Choose this if you want AI recommendations for commanders that match your preferred playstyle and strategy."
  },
  
  strategy: {
    title: "Deck Strategy",
    description: "Your deck's overall game plan and approach to winning games.",
    strategies: {
      aggro: "Fast, aggressive strategy focused on dealing damage quickly with efficient creatures and spells.",
      control: "Reactive strategy that uses removal and counterspells to control the game until you can win with powerful late-game threats.",
      combo: "Strategy focused on assembling specific card combinations that can win the game instantly or create overwhelming advantage.",
      midrange: "Balanced approach that plays efficient threats while maintaining interaction and card advantage.",
      tribal: "Strategy built around a specific creature type, leveraging tribal synergies and support cards.",
      value: "Strategy focused on card advantage and incremental benefits, often through engines and repeatable effects.",
      stax: "Control strategy that uses resource denial and taxing effects to slow down opponents while advancing your own game plan."
    }
  },
  
  budget: {
    title: "Budget Constraints",
    description: "Set your spending limits to get appropriate card recommendations.",
    ranges: {
      budget: "Under $100 - Focus on budget-friendly alternatives and reprints",
      moderate: "$100-300 - Mix of budget options with some higher-value staples",
      high: "$300-500 - Include expensive staples and optimal mana base",
      premium: "$500+ - No budget restrictions, optimal card choices"
    },
    collection: "Enable this if you want recommendations to prioritize cards you already own from your linked collection."
  },
  
  powerLevel: {
    title: "Power Level",
    description: "The competitive strength of your deck, following the 1-4 bracket system.",
    levels: {
      1: "Casual/Precon Level - Modified preconstructed decks, basic strategies, minimal tutors or fast mana",
      2: "Focused Casual - Clear strategy with some optimization, limited tutors, budget mana base",
      3: "Optimized/High Power - Highly tuned with efficient cards, good mana base, some fast mana and tutors",
      4: "Competitive/cEDH - Maximum optimization, fastest possible wins, extensive tutors and fast mana"
    }
  },
  
  winConditions: {
    title: "Win Conditions",
    description: "How your deck plans to actually win games.",
    primary: {
      combat: "Win through creature combat damage, either through aggression or large threats",
      combo: "Win through specific card combinations that create infinite loops or massive effects",
      alternative: "Win through non-combat, non-combo methods like mill, burn, or alternate win conditions",
      control: "Win by controlling the game until you can deploy and protect a single powerful threat"
    },
    combatStyles: {
      aggro: "Fast, efficient creatures that deal damage quickly",
      voltron: "Single large creature with equipment/auras for commander damage",
      tokens: "Many small creatures created by spells and abilities",
      bigCreatures: "Large, impactful creatures that dominate the battlefield"
    }
  },
  
  interaction: {
    title: "Interaction Level",
    description: "How much removal, counterspells, and disruption your deck includes.",
    levels: {
      low: "Minimal interaction, focus on your own game plan (5-8 interactive spells)",
      medium: "Balanced interaction to handle threats (8-12 interactive spells)",
      high: "Heavy interaction to control the game (12+ interactive spells)"
    },
    timing: {
      proactive: "Prefer to act on your own turn with sorcery-speed removal",
      reactive: "Prefer instant-speed responses and counterspells",
      balanced: "Mix of proactive and reactive interaction"
    }
  },
  
  restrictions: {
    title: "Restrictions and Preferences",
    description: "Specify strategies or cards you want to avoid, or pet cards you want to include.",
    avoidStrategies: "Strategies you don't enjoy playing against or find unfun (e.g., 'stax', 'land destruction', 'extra turns')",
    avoidCards: "Specific cards you don't want in your deck for any reason",
    petCards: "Favorite cards you'd like to include if they fit the strategy"
  },
  
  complexity: {
    title: "Complexity Level",
    description: "How complex you want your deck's decision-making and interactions to be.",
    levels: {
      simple: "Straightforward cards with clear effects, minimal complex interactions",
      moderate: "Some synergies and decision points, but not overwhelming",
      complex: "Intricate interactions, multiple decision points, and advanced synergies"
    }
  },
  
  summary: {
    title: "Summary",
    description: "Review all your preferences before generating your deck. You can go back to modify any choices.",
    generation: "The AI will use all these preferences to create a personalized 100-card Commander deck that matches your specifications."
  }
} as const;

export const POWER_LEVEL_EXAMPLES = {
  1: [
    "Preconstructed Commander decks",
    "Decks with mostly commons and uncommons",
    "Basic mana base with mostly tap lands",
    "Win around turn 15-20"
  ],
  2: [
    "Upgraded precons with clear themes",
    "Some rares and mythics, budget alternatives",
    "Improved mana base with some dual lands",
    "Win around turn 10-15"
  ],
  3: [
    "Highly optimized with expensive staples",
    "Efficient mana base with fetch lands",
    "Fast mana and tutors present",
    "Win around turn 6-10"
  ],
  4: [
    "Competitive EDH (cEDH) level",
    "Maximum optimization regardless of cost",
    "Extensive fast mana and tutors",
    "Win around turn 3-6"
  ]
} as const;

export const STRATEGY_EXAMPLES = {
  aggro: [
    "Krenko, Mob Boss goblin tribal",
    "Alesha, Who Smiles at Death reanimator aggro",
    "Zurgo Helmsmasher voltron"
  ],
  control: [
    "Teferi, Temporal Archmage control",
    "Grand Arbiter Augustin IV stax-control",
    "Tasigur, the Golden Fang control"
  ],
  combo: [
    "Thrasios + Tymna consultation combo",
    "Kiki-Jiki, Mirror Breaker combo",
    "Gitrog Monster combo"
  ],
  midrange: [
    "Muldrotha, the Gravetide value",
    "Korvold, Fae-Cursed King sacrifice",
    "Chulane, Teller of Tales value engine"
  ]
} as const;