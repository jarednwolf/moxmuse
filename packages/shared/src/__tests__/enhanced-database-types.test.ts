// Test for Enhanced Database Types
import { describe, it, expect } from 'vitest'
import {
  EnhancedDeckFolder,
  EnhancedDeckTemplate,
  EnhancedCardDataWithMetrics,
  EnhancedImportJob,
  EnhancedExportJob,
  EnhancedDeckAnalytics,
  EnhancedPublicDeck,
  EnhancedUserProfile,
  EnhancedDeckWithAnalytics,
  EnhancedDeckCardWithMetrics
} from '../enhanced-database-types'

describe('Enhanced Database Types', () => {
  describe('Enhanced Deck Organization', () => {
    it('should extend deck folder with computed properties', () => {
      const enhancedFolder: EnhancedDeckFolder = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Folder',
        color: '#6366f1',
        parentId: undefined,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Enhanced properties
        children: [],
        deckCount: 5,
        totalDecks: 12,
        depth: 0,
        path: ['Test Folder'],
        isRoot: true,
        canDelete: true,
        canMove: true
      }
      
      expect(enhancedFolder.deckCount).toBe(5)
      expect(enhancedFolder.totalDecks).toBe(12)
      expect(enhancedFolder.isRoot).toBe(true)
      expect(enhancedFolder.path).toEqual(['Test Folder'])
    })

    it('should extend deck template with usage statistics', () => {
      const enhancedTemplate: EnhancedDeckTemplate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Aggro Template',
        description: 'Fast aggressive deck template',
        format: 'commander',
        archetype: 'aggro',
        isPublic: true,
        powerLevel: 7,
        estimatedBudget: 500,
        tags: ['fast', 'competitive'],
        usageCount: 25,
        categories: [],
        coreCards: [],
        flexSlots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        // Enhanced properties
        categoryCount: 8,
        coreCardCount: 35,
        flexSlotCount: 15,
        completionPercentage: 85,
        averageUsageRating: 4.2,
        lastUsed: new Date(),
        successRate: 0.78,
        isValid: true,
        validationErrors: [],
        canUse: () => true,
        canEdit: () => true,
        canDelete: () => false
      }
      
      expect(enhancedTemplate.categoryCount).toBe(8)
      expect(enhancedTemplate.successRate).toBe(0.78)
      expect(enhancedTemplate.isValid).toBe(true)
      expect(enhancedTemplate.canUse('user-id')).toBe(true)
    })
  })

  describe('Enhanced Card Database', () => {
    it('should extend card data with market intelligence', () => {
      const enhancedCard: EnhancedCardDataWithMetrics = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        cardId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Lightning Bolt',
        cmc: 1,
        typeLine: 'Instant',
        colors: ['R'],
        colorIdentity: ['R'],
        legalities: { commander: 'legal' },
        rulings: [],
        printings: [],
        relatedCards: [],
        popularityScore: 85.5,
        synergyTags: ['burn', 'removal'],
        priceHistory: [],
        availability: {
          inStock: true,
          sources: ['tcgplayer'],
          lowestPrice: 0.25,
          averagePrice: 0.35
        },
        lastUpdated: new Date(),
        imageUrls: {},
        // Enhanced properties
        priceVolatility: 0.15,
        priceDirection: 'up',
        popularityDirection: 'rising',
        isRecommendedBuy: true,
        priceTarget: 0.40,
        reprints: [],
        deckUsageCount: 1250,
        winRateContribution: 0.68,
        synergyStrength: 0.82,
        isAvailable: true,
        alternativeCards: [],
        getPriceHistory: (days: number) => [],
        getPopularityTrend: (days: number) => [],
        getSynergyCards: (limit?: number) => []
      }
      
      expect(enhancedCard.priceDirection).toBe('up')
      expect(enhancedCard.isRecommendedBuy).toBe(true)
      expect(enhancedCard.deckUsageCount).toBe(1250)
      expect(enhancedCard.winRateContribution).toBe(0.68)
    })
  })

  describe('Enhanced Import/Export', () => {
    it('should extend import job with progress tracking', () => {
      const enhancedImportJob: EnhancedImportJob = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        source: 'moxfield',
        status: 'processing',
        decksFound: 10,
        decksImported: 7,
        errors: [],
        warnings: [],
        createdAt: new Date(),
        // Enhanced properties
        progressPercentage: 70,
        currentStep: 'Processing deck 8 of 10',
        estimatedTimeRemaining: 45,
        successRate: 0.7,
        mostCommonErrors: ['card_not_found'],
        suggestedFixes: ['Update card database'],
        canRetry: true,
        retryCount: 0,
        maxRetries: 3,
        canCancel: () => true,
        getDetailedErrors: () => [],
        getProcessingStats: () => ({
          totalLines: 1000,
          processedLines: 700,
          skippedLines: 50,
          errorLines: 25,
          warningLines: 15,
          processingRate: 50
        })
      }
      
      expect(enhancedImportJob.progressPercentage).toBe(70)
      expect(enhancedImportJob.canRetry).toBe(true)
      expect(enhancedImportJob.canCancel()).toBe(true)
      expect(enhancedImportJob.getProcessingStats().processingRate).toBe(50)
    })

    it('should extend export job with file information', () => {
      const enhancedExportJob: EnhancedExportJob = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        deckIds: ['deck1', 'deck2'],
        format: {
          id: 'moxfield',
          name: 'Moxfield Format',
          description: 'Export to Moxfield format',
          fileExtension: 'txt',
          mimeType: 'text/plain',
          supportsMultipleDecks: true,
          customizable: false
        },
        options: {
          includeCommander: true,
          includeSideboard: false,
          includeTokens: false,
          includeBasicLands: true,
          groupByCategory: true,
          includeQuantities: true,
          includePrices: false,
          customFields: []
        },
        status: 'completed',
        downloadUrl: 'https://example.com/download/file.txt',
        fileSize: 2048,
        createdAt: new Date(),
        completedAt: new Date(),
        // Enhanced properties
        progressPercentage: 100,
        currentDeck: 'deck2',
        previewUrl: 'https://example.com/preview/file.txt',
        fileFormat: 'text/plain',
        compressionRatio: 0.75,
        downloadCount: 5,
        lastDownloaded: new Date(),
        canCancel: () => false,
        getPreview: () => 'Deck preview content...',
        getDownloadStats: () => ({
          totalDownloads: 5,
          uniqueDownloaders: 3,
          averageDownloadTime: 2.5,
          popularityScore: 0.8
        })
      }
      
      expect(enhancedExportJob.progressPercentage).toBe(100)
      expect(enhancedExportJob.downloadCount).toBe(5)
      expect(enhancedExportJob.canCancel()).toBe(false)
      expect(enhancedExportJob.getDownloadStats().uniqueDownloaders).toBe(3)
    })
  })

  describe('Enhanced Analytics', () => {
    it('should extend deck analytics with confidence scores', () => {
      const enhancedAnalytics: EnhancedDeckAnalytics = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        deckId: '123e4567-e89b-12d3-a456-426614174001',
        manaAnalysis: {
          colorRequirements: { W: 5, U: 8, B: 3 },
          pipAnalysis: {
            totalPips: { W: 12, U: 20, B: 8 },
            pipsByTurn: {},
            criticalTurns: [3, 4, 5],
            bottlenecks: ['early game mana']
          },
          fixingRecommendations: [],
          manaEfficiency: 0.85,
          colorConsistency: { W: 0.9, U: 0.95, B: 0.8 }
        },
        consistencyMetrics: {
          keepableHands: 0.78,
          averageTurnToPlay: { commander: 4.2 },
          mulliganRate: 0.22,
          gameplayConsistency: 0.82,
          simulationRuns: 1000,
          openingHandStats: {
            averageCMC: 3.2,
            landCount: { 2: 15, 3: 45, 4: 30 },
            keepablePercentage: 0.78,
            reasonsToMulligan: { 'no lands': 12, 'all lands': 8 }
          },
          earlyGameStats: {
            averageTurnToFirstSpell: 2.1,
            averageTurnToCommander: 4.2,
            earlyGameThreats: 3,
            earlyGameAnswers: 2
          }
        },
        metaAnalysis: {
          archetype: 'Control',
          metaShare: 0.15,
          winRate: 0.62,
          popularityTrend: 'stable',
          matchups: [],
          positioning: {
            tier: 2,
            competitiveViability: 0.75,
            metaShare: 0.15,
            trendDirection: 'stable'
          },
          adaptationSuggestions: []
        },
        performanceData: {
          gamesPlayed: 50,
          winRate: 0.62,
          averageGameLength: 45,
          matchupData: {},
          performanceTrends: [],
          keyMetrics: {}
        },
        optimizationSuggestions: [],
        analysisVersion: '1.0',
        lastAnalyzed: new Date(),
        // Enhanced properties
        isUpToDate: true,
        needsRefresh: false,
        analysisAge: 2,
        manaAnalysisConfidence: 0.92,
        metaAnalysisConfidence: 0.85,
        performanceConfidence: 0.78,
        similarDecks: [],
        metaComparison: {
          tierPosition: 2,
          metaShare: 0.15,
          winRateVsMeta: 0.05,
          popularityRank: 25,
          competitiveViability: 0.75
        },
        improvementPotential: 0.25,
        performanceTrend: 'stable',
        metaPositionTrend: 'stable',
        getOptimizationPriority: () => [],
        getWeakestAreas: () => [],
        getStrengthAreas: () => []
      }
      
      expect(enhancedAnalytics.isUpToDate).toBe(true)
      expect(enhancedAnalytics.manaAnalysisConfidence).toBe(0.92)
      expect(enhancedAnalytics.improvementPotential).toBe(0.25)
      expect(enhancedAnalytics.performanceTrend).toBe('stable')
    })
  })

  describe('Enhanced Social Features', () => {
    it('should extend public deck with engagement metrics', () => {
      const enhancedPublicDeck: EnhancedPublicDeck = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        deckId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Competitive Control',
        commander: 'Teferi, Hero of Dominaria',
        format: 'commander',
        userId: '123e4567-e89b-12d3-a456-426614174002',
        authorName: 'ProPlayer',
        cardCount: 100,
        estimatedBudget: 1500,
        powerLevel: 9,
        archetype: 'Control',
        tags: ['competitive', 'tournament'],
        views: 2500,
        likes: 180,
        comments: 45,
        copies: 25,
        rating: 4.7,
        isActive: true,
        publishedAt: new Date(),
        lastUpdated: new Date(),
        // Enhanced properties
        engagementRate: 0.072,
        shareRate: 0.01,
        copyRate: 0.01,
        qualityScore: 0.94,
        completenessScore: 0.98,
        originalityScore: 0.85,
        averageRating: 4.7,
        ratingCount: 38,
        featuredScore: 0.92,
        viewsTrend: 'rising',
        popularityTrend: 'rising',
        tournamentResults: [],
        metaRelevance: 0.88,
        canEdit: () => false,
        canDelete: () => false,
        canFeature: () => true,
        getEngagementStats: () => ({
          dailyViews: [100, 120, 95],
          weeklyViews: [800, 750, 900],
          monthlyViews: [2500],
          commentEngagement: 0.018,
          likeEngagement: 0.072,
          shareEngagement: 0.01
        })
      }
      
      expect(enhancedPublicDeck.engagementRate).toBe(0.072)
      expect(enhancedPublicDeck.qualityScore).toBe(0.94)
      expect(enhancedPublicDeck.viewsTrend).toBe('rising')
      expect(enhancedPublicDeck.canFeature('admin-id')).toBe(true)
    })

    it('should extend user profile with reputation system', () => {
      const enhancedProfile: EnhancedUserProfile = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        username: 'deckmaster',
        displayName: 'Deck Master',
        bio: 'Competitive EDH player and deck builder',
        avatar: 'https://example.com/avatar.jpg',
        totalDecks: 25,
        publicDecks: 15,
        totalLikes: 450,
        totalViews: 12000,
        favoriteFormats: ['commander'],
        favoriteArchetypes: ['control', 'combo'],
        brewingStyle: ['competitive', 'innovative'],
        followers: 120,
        following: 80,
        achievements: [],
        isPublic: true,
        createdAt: new Date(),
        lastActive: new Date(),
        // Enhanced properties
        activityScore: 0.85,
        contributionScore: 0.92,
        helpfulnessScore: 0.78,
        reputationLevel: 7,
        trustScore: 0.88,
        expertiseAreas: ['control', 'mana bases'],
        engagementRate: 0.15,
        followerGrowthRate: 0.08,
        contentQuality: 0.91,
        nextAchievements: [],
        achievementProgress: {},
        privacySettings: {
          showEmail: false,
          showActivity: true,
          showDecks: true,
          showFollowers: true,
          allowMessages: true,
          allowFollows: true
        },
        notificationPreferences: {
          emailNotifications: true,
          pushNotifications: false,
          deckComments: true,
          deckLikes: true,
          newFollowers: true,
          achievements: true,
          systemUpdates: false
        },
        canFollow: () => true,
        canMessage: () => true,
        getActivitySummary: () => ({
          decksCreated: 25,
          decksShared: 15,
          commentsPosted: 150,
          likesGiven: 300,
          helpfulComments: 45,
          featuredDecks: 3
        })
      }
      
      expect(enhancedProfile.reputationLevel).toBe(7)
      expect(enhancedProfile.trustScore).toBe(0.88)
      expect(enhancedProfile.expertiseAreas).toContain('control')
      expect(enhancedProfile.canFollow('other-user')).toBe(true)
      expect(enhancedProfile.getActivitySummary().featuredDecks).toBe(3)
    })
  })

  describe('Enhanced Deck Types', () => {
    it('should extend deck with analytics integration', () => {
      const enhancedDeck: EnhancedDeckWithAnalytics = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Optimized Control',
        commander: 'Teferi, Hero of Dominaria',
        format: 'commander',
        // Enhanced properties
        cardCount: 100,
        averageCMC: 3.2,
        colorDistribution: { W: 25, U: 35, B: 0, R: 0, G: 0 },
        typeDistribution: { creature: 15, instant: 20, sorcery: 12, artifact: 8, enchantment: 6, planeswalker: 3, land: 36, other: 0 },
        winRate: 0.68,
        playRate: 0.15,
        metaShare: 0.08,
        strengthScore: 0.85,
        consistencyScore: 0.82,
        innovationScore: 0.75,
        needsUpdate: false,
        lastOptimized: new Date(),
        optimizationScore: 0.92,
        ownedPercentage: 0.85,
        missingCards: [],
        totalValue: 1250.50,
        canOptimize: () => true,
        getOptimizationSuggestions: () => [],
        calculateUpgradeCost: () => 150.75,
        getAlternativeCards: () => []
      }
      
      expect(enhancedDeck.cardCount).toBe(100)
      expect(enhancedDeck.winRate).toBe(0.68)
      expect(enhancedDeck.strengthScore).toBe(0.85)
      expect(enhancedDeck.canOptimize()).toBe(true)
      expect(enhancedDeck.calculateUpgradeCost()).toBe(150.75)
    })

    it('should extend deck card with performance metrics', () => {
      const enhancedCard: EnhancedDeckCardWithMetrics = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        deckId: '123e4567-e89b-12d3-a456-426614174001',
        cardId: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 1,
        category: 'removal',
        role: 'core',
        // Enhanced properties
        synergyRating: 0.85,
        replacementPriority: 0.25,
        metaRelevance: 0.78,
        currentMarketPrice: 2.50,
        priceHistory: [],
        availability: 'in-stock',
        upgrades: [],
        budgetOptions: [],
        sidegrades: [],
        playRate: 0.68,
        winRateWhenDrawn: 0.72,
        averageTurnPlayed: 3.5,
        canReplace: () => true,
        getReplacementOptions: () => [],
        calculateSynergyWith: () => 0.65
      }
      
      expect(enhancedCard.synergyRating).toBe(0.85)
      expect(enhancedCard.metaRelevance).toBe(0.78)
      expect(enhancedCard.winRateWhenDrawn).toBe(0.72)
      expect(enhancedCard.canReplace()).toBe(true)
      expect(enhancedCard.calculateSynergyWith('other-card')).toBe(0.65)
    })
  })
})