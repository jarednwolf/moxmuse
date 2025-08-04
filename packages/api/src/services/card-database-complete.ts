import { PrismaClient, type EnhancedCardData } from '@moxmuse/db';

export interface CardSearchParams {
  colors?: string[];
  cmc?: { min?: number; max?: number };
  types?: string[];
  keywords?: string[];
  priceRange?: { min?: number; max?: number };
  text?: string;
  strategy?: string;
  limit?: number;
}

export interface Card {
  id: string;
  name: string;
  manaCost: string;
  cmc: number;
  typeLine: string;
  oracleText: string;
  power?: string | null;
  toughness?: string | null;
  colors: string[];
  colorIdentity: string[];
  keywords: string[];
  price: number;
  imageUrl: string;
  rarity?: string;
  set?: string;
}

/**
 * Complete Card Database Service
 * Queries from our database with 99,267 commander-legal cards
 * No API calls needed - instant access to entire card pool
 */
export class CompleteCardDatabase {
  private prisma: PrismaClient;
  private cardsCache: Map<string, Card> = new Map();
  private commandersCache: Card[] = [];
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize the database connection and warm up caches
   */
  async initialize(): Promise<void> {
    console.log('Initializing complete card database...');
    
    // Get stats
    const count = await this.prisma.enhancedCardData.count();
    console.log(`Database connected with ${count} cards`);
    
    // Warm up commander cache
    await this.getAllCommanders();
  }

  /**
   * Convert database card to our Card interface
   */
  private dbCardToCard(dbCard: EnhancedCardData): Card {
    return {
      id: dbCard.cardId,
      name: dbCard.name,
      manaCost: dbCard.manaCost || '',
      cmc: dbCard.cmc,
      typeLine: dbCard.typeLine,
      oracleText: dbCard.oracleText || '',
      power: dbCard.power,
      toughness: dbCard.toughness,
      colors: dbCard.colors,
      colorIdentity: dbCard.colorIdentity,
      keywords: dbCard.synergyTags, // Using synergy tags as keywords
      price: dbCard.currentPrice?.toNumber() || 0,
      imageUrl: (dbCard.imageUrls as any)?.normal || '',
      rarity: (dbCard.printings as any[])?.[0]?.rarity || 'common',
      set: (dbCard.printings as any[])?.[0]?.set || ''
    };
  }

  /**
   * Find cards matching color identity
   */
  async findCardsInColors(colors: string[]): Promise<Card[]> {
    // Cards are legal if their color identity is a subset of the commander's
    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: colors.map(color => ({
          NOT: {
            colorIdentity: {
              has: color
            }
          }
        })).length > 0 ? {
          NOT: {
            AND: colors.map(color => ({
              NOT: {
                colorIdentity: {
                  has: color
                }
              }
            }))
          }
        } : undefined
      }
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Find cards by strategy/theme
   */
  async findCardsByStrategy(strategy: string, colors: string[]): Promise<Card[]> {
    // Map strategies to synergy tags
    const strategyTags: Record<string, string[]> = {
      aristocrats: ['death triggers', 'sacrifice', 'aristocrats'],
      tokens: ['tokens', 'token-synergy'],
      voltron: ['equipment', 'aura', 'combat'],
      control: ['counterspell', 'removal', 'draw'],
      ramp: ['ramp', 'mana-acceleration'],
      tribal: [], // Handled by type line search
      combo: ['combo', 'draw', 'tutor'],
      aggro: ['combat', 'haste', 'aggro'],
      midrange: ['value', 'draw', 'removal'],
      stax: ['tax', 'restriction', 'sacrifice'],
      lifegain: ['lifegain', 'lifelink'],
      graveyard: ['graveyard', 'reanimator', 'death triggers']
    };

    const tags = strategyTags[strategy.toLowerCase()] || [];
    
    if (tags.length === 0) {
      return this.findCardsInColors(colors);
    }

    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          // Color identity check
          ...colors.length > 0 ? [{
            colorIdentity: {
              isEmpty: colors.length === 0,
            }
          }] : [],
          // Strategy tags check
          {
            OR: tags.map(tag => ({
              synergyTags: {
                has: tag
              }
            }))
          }
        ]
      },
      take: 1000 // Limit for performance
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Find cards by type
   */
  async findCardsByType(type: string, colors: string[]): Promise<Card[]> {
    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          // Color identity check
          ...colors.length > 0 ? [{
            colorIdentity: {
              isEmpty: colors.length === 0,
            }
          }] : [],
          // Type check
          {
            typeLine: {
              contains: type,
              mode: 'insensitive'
            }
          }
        ]
      },
      take: 500
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Find cards by CMC
   */
  async findCardsByCMC(cmc: number, colors: string[]): Promise<Card[]> {
    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          // Color identity check
          ...colors.length > 0 ? [{
            colorIdentity: {
              isEmpty: colors.length === 0,
            }
          }] : [],
          // CMC check
          {
            cmc: cmc
          }
        ]
      },
      take: 200
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Find cards by price range
   */
  async findCardsByPriceRange(minPrice: number, maxPrice: number, colors: string[]): Promise<Card[]> {
    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          // Color identity check
          ...colors.length > 0 ? [{
            colorIdentity: {
              isEmpty: colors.length === 0,
            }
          }] : [],
          // Price check
          {
            currentPrice: {
              gte: minPrice,
              lte: maxPrice
            }
          }
        ]
      },
      orderBy: {
        currentPrice: 'desc'
      },
      take: 500
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Search cards by text
   */
  async searchCardsByText(query: string, colors: string[]): Promise<Card[]> {
    const cards = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          // Color identity check
          ...colors.length > 0 ? [{
            colorIdentity: {
              isEmpty: colors.length === 0,
            }
          }] : [],
          // Text search
          {
            OR: [
              {
                name: {
                  contains: query,
                  mode: 'insensitive'
                }
              },
              {
                oracleText: {
                  contains: query,
                  mode: 'insensitive'
                }
              },
              {
                typeLine: {
                  contains: query,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      },
      take: 200
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Get a specific card by name
   */
  async getCard(name: string): Promise<Card | undefined> {
    // Check cache first
    if (this.cardsCache.has(name)) {
      return this.cardsCache.get(name);
    }

    const card = await this.prisma.enhancedCardData.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    if (card) {
      const converted = this.dbCardToCard(card);
      this.cardsCache.set(name, converted);
      return converted;
    }

    return undefined;
  }

  /**
   * Get all legendary creatures that can be commanders
   */
  async getAllCommanders(): Promise<Card[]> {
    // Check cache
    if (this.commandersCache.length > 0 && 
        Date.now() - this.lastCacheUpdate < this.CACHE_DURATION) {
      return this.commandersCache;
    }

    const commanders = await this.prisma.enhancedCardData.findMany({
      where: {
        AND: [
          {
            typeLine: {
              contains: 'Legendary',
              mode: 'insensitive'
            }
          },
          {
            typeLine: {
              contains: 'Creature',
              mode: 'insensitive'
            }
          }
        ]
      },
      orderBy: {
        name: 'asc'
      }
    });

    this.commandersCache = commanders.map(card => this.dbCardToCard(card));
    this.lastCacheUpdate = Date.now();
    
    return this.commandersCache;
  }

  /**
   * Advanced search with multiple parameters
   */
  async searchCards(params: CardSearchParams): Promise<Card[]> {
    const where: any = {
      AND: []
    };

    // Color identity filter
    if (params.colors && params.colors.length > 0) {
      // Cards must not contain colors outside the identity
      params.colors.forEach(color => {
        where.AND.push({
          NOT: {
            colorIdentity: {
              hasSome: params.colors!.filter(c => c !== color)
            }
          }
        });
      });
    }

    // CMC filter
    if (params.cmc) {
      if (params.cmc.min !== undefined) {
        where.AND.push({ cmc: { gte: params.cmc.min } });
      }
      if (params.cmc.max !== undefined) {
        where.AND.push({ cmc: { lte: params.cmc.max } });
      }
    }

    // Type filter
    if (params.types && params.types.length > 0) {
      where.AND.push({
        OR: params.types.map(type => ({
          typeLine: {
            contains: type,
            mode: 'insensitive'
          }
        }))
      });
    }

    // Keywords/synergy tags filter
    if (params.keywords && params.keywords.length > 0) {
      where.AND.push({
        OR: params.keywords.map(keyword => ({
          synergyTags: {
            has: keyword
          }
        }))
      });
    }

    // Price filter
    if (params.priceRange) {
      if (params.priceRange.min !== undefined) {
        where.AND.push({ currentPrice: { gte: params.priceRange.min } });
      }
      if (params.priceRange.max !== undefined) {
        where.AND.push({ currentPrice: { lte: params.priceRange.max } });
      }
    }

    // Text search
    if (params.text) {
      where.AND.push({
        OR: [
          {
            name: {
              contains: params.text,
              mode: 'insensitive'
            }
          },
          {
            oracleText: {
              contains: params.text,
              mode: 'insensitive'
            }
          }
        ]
      });
    }

    const cards = await this.prisma.enhancedCardData.findMany({
      where: where.AND.length > 0 ? where : undefined,
      take: params.limit || 100,
      orderBy: [
        { popularityScore: 'desc' },
        { name: 'asc' }
      ]
    });

    return cards.map(card => this.dbCardToCard(card));
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalCards: number;
    commanders: number;
    byColor: Record<string, number>;
    avgPrice: number;
  }> {
    const [total, commanders, avgPriceResult] = await Promise.all([
      this.prisma.enhancedCardData.count(),
      this.prisma.enhancedCardData.count({
        where: {
          AND: [
            { typeLine: { contains: 'Legendary' } },
            { typeLine: { contains: 'Creature' } }
          ]
        }
      }),
      this.prisma.enhancedCardData.aggregate({
        _avg: {
          currentPrice: true
        }
      })
    ]);

    // Group by color identity
    const colorGroups = await this.prisma.$queryRaw<Array<{ colorIdentity: string[], _count: number }>>`
      SELECT "colorIdentity", COUNT(*)::int as "_count"
      FROM "EnhancedCardData"
      GROUP BY "colorIdentity"
    `;

    const byColor: Record<string, number> = {};
    colorGroups.forEach(group => {
      const key = group.colorIdentity.join('') || 'Colorless';
      byColor[key] = group._count;
    });

    return {
      totalCards: total,
      commanders: commanders,
      byColor: byColor,
      avgPrice: avgPriceResult._avg.currentPrice?.toNumber() || 0
    };
  }
}

// Singleton instance management
let instance: CompleteCardDatabase | null = null;

export async function getCardDatabase(prisma: PrismaClient): Promise<CompleteCardDatabase> {
  if (!instance) {
    instance = new CompleteCardDatabase(prisma);
    await instance.initialize();
  }
  return instance;
}
