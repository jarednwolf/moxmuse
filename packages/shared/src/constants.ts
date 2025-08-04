// Feature flags for MoxMuse platform
export const FEATURE_FLAGS = {
  // Core Vision Features (Phase 1)
  NATURAL_LANGUAGE_VISION: true,     // Natural language deck descriptions
  ENHANCED_EXPLANATIONS: false,       // Deep card choice explanations
  SYNERGY_VISUALIZATION: false,       // Visual synergy mapping
  EDUCATIONAL_CONTENT: false,         // Interactive learning features
  
  // Optimization Tools (Phase 2)
  BUDGET_OPTIMIZATION: false,         // Budget-aware deck building
  ALTERNATIVE_PATHS: false,           // Show alternative build options
  TRADE_OFF_ANALYSIS: false,          // Card trade-off comparisons
  
  // Platform Features
  PERFORMANCE_MONITORING: false,      // Track API performance
  ADVANCED_CACHING: false,           // Enhanced caching strategies
  BETA_FEATURES: false,              // Enable beta testing features
  
  // Existing Features (Currently Active)
  DECK_BUILDING_TUTOR: true,         // AI deck building assistant
  COMMANDER_SUGGESTIONS: true,        // Commander recommendations
  DECK_ANALYSIS: true,               // Deck composition analysis
  MOXFIELD_INTEGRATION: true,        // Moxfield OAuth & import
  EXPORT_FEATURES: true,             // Deck export functionality
} as const;

// Type for feature flag keys
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

// Helper function to check if a feature is enabled
export function isFeatureEnabled(feature: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[feature] ?? false;
}

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  DECK_GENERATION_TIME_MS: 30000,    // 30 seconds max
  VISION_PARSE_SUCCESS_RATE: 0.95,   // 95% success rate
  CACHE_HIT_RATE: 0.80,              // 80% cache hit rate
  API_RESPONSE_TIME_MS: 2000,        // 2 second max API response
} as const;

// Business metrics targets
export const BUSINESS_TARGETS = {
  FREE_TO_PAID_CONVERSION: 0.10,     // 10% conversion rate
  MONTHLY_ACTIVE_BUILDERS: 10000,    // 10K MAU
  DECKS_PER_USER_MONTH: 5,          // 5+ decks/user/month
  NPS_SCORE: 50,                     // Net Promoter Score > 50
} as const;

// API rate limits
export const API_RATE_LIMITS = {
  OPENAI_REQUESTS_PER_MIN: 60,       // OpenAI API rate limit
  DECK_GENERATIONS_PER_HOUR: 20,     // Per user deck generation limit
  VISION_PARSES_PER_DAY: 100,       // Natural language parsing limit
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  CARD_DATA: 86400,                  // 24 hours
  DECK_ANALYSIS: 3600,               // 1 hour
  COMMANDER_SUGGESTIONS: 7200,       // 2 hours
  USER_SESSION: 1800,                // 30 minutes
} as const;

// Affiliate configuration
export const AFFILIATE_CONFIG = {
  tcgplayer: {
    baseUrl: 'https://www.tcgplayer.com/product/',
    affiliateParam: 'affiliate_id',
  },
  cardkingdom: {
    baseUrl: 'https://www.cardkingdom.com/mtg/',
    affiliateParam: 'partner',
  },
  channelfireball: {
    baseUrl: 'https://store.channelfireball.com/products/',
    affiliateParam: 'aff',
  },
} as const;
