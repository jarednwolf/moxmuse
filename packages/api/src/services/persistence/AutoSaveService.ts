import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

// Types for auto-save functionality
export interface AutoSaveConfig {
  saveIntervalMs: number
  maxRetries: number
  conflictResolutionStrategy: 'client-wins' | 'server-wins' | 'merge' | 'prompt-user'
}

export interface SaveOperation {
  id: string
  userId: string
  entityType: 'deck' | 'consultation-session'
  entityId: string
  data: any
  version: number
  timestamp: Date
  checksum: string
}

export interface ConflictResolution {
  conflictId: string
  clientVersion: number
  serverVersion: number
  resolution: 'client' | 'server' | 'merged'
  mergedData?: any
}

// Validation schemas
const DeckSaveSchema = z.object({
  id: z.string(),
  name: z.string(),
  commander: z.string(),
  cards: z.array(z.object({
    cardId: z.string(),
    quantity: z.number(),
    category: z.string().optional(),
  })),
  strategy: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    themes: z.array(z.string()),
  }),
  metadata: z.object({
    powerLevel: z.number().min(1).max(10),
    budget: z.number().optional(),
    colors: z.array(z.string()),
  }),
  version: z.number(),
  lastModified: z.date(),
})

const ConsultationSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  currentStep: z.number(),
  totalSteps: z.number(),
  responses: z.record(z.any()),
  preferences: z.object({
    commander: z.string().optional(),
    strategy: z.string().optional(),
    budget: z.number().optional(),
    powerLevel: z.number().optional(),
  }),
  version: z.number(),
  lastModified: z.date(),
})

export class AutoSaveService {
  private prisma: PrismaClient
  private config: AutoSaveConfig
  private saveQueue: Map<string, SaveOperation> = new Map()
  private saveTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(prisma: PrismaClient, config: AutoSaveConfig) {
    this.prisma = prisma
    this.config = config
  }

  /**
   * Schedule automatic saving for a deck
   */
  async scheduleDeckSave(
    userId: string,
    deckId: string,
    deckData: z.infer<typeof DeckSaveSchema>
  ): Promise<void> {
    const saveKey = `deck:${deckId}`
    
    // Validate deck data
    const validatedData = DeckSaveSchema.parse(deckData)
    
    // Calculate checksum for conflict detection
    const checksum = this.calculateChecksum(validatedData)
    
    const saveOperation: SaveOperation = {
      id: `${saveKey}:${Date.now()}`,
      userId,
      entityType: 'deck',
      entityId: deckId,
      data: validatedData,
      version: validatedData.version,
      timestamp: new Date(),
      checksum,
    }

    // Clear existing timer if any
    const existingTimer = this.saveTimers.get(saveKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Queue the save operation
    this.saveQueue.set(saveKey, saveOperation)

    // Schedule the save
    const timer = setTimeout(async () => {
      await this.executeSave(saveKey)
    }, this.config.saveIntervalMs)

    this.saveTimers.set(saveKey, timer)
  }

  /**
   * Schedule automatic saving for a consultation session
   */
  async scheduleSessionSave(
    userId: string,
    sessionId: string,
    sessionData: z.infer<typeof ConsultationSessionSchema>
  ): Promise<void> {
    const saveKey = `session:${sessionId}`
    
    // Validate session data
    const validatedData = ConsultationSessionSchema.parse(sessionData)
    
    // Calculate checksum for conflict detection
    const checksum = this.calculateChecksum(validatedData)
    
    const saveOperation: SaveOperation = {
      id: `${saveKey}:${Date.now()}`,
      userId,
      entityType: 'consultation-session',
      entityId: sessionId,
      data: validatedData,
      version: validatedData.version,
      timestamp: new Date(),
      checksum,
    }

    // Clear existing timer if any
    const existingTimer = this.saveTimers.get(saveKey)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Queue the save operation
    this.saveQueue.set(saveKey, saveOperation)

    // Schedule the save
    const timer = setTimeout(async () => {
      await this.executeSave(saveKey)
    }, this.config.saveIntervalMs)

    this.saveTimers.set(saveKey, timer)
  }

  /**
   * Force immediate save (useful for critical operations)
   */
  async forceSave(entityType: 'deck' | 'consultation-session', entityId: string): Promise<void> {
    const saveKey = `${entityType}:${entityId}`
    await this.executeSave(saveKey)
  }

  /**
   * Execute the actual save operation with conflict resolution
   */
  private async executeSave(saveKey: string): Promise<void> {
    const saveOperation = this.saveQueue.get(saveKey)
    if (!saveOperation) {
      return
    }

    let retryCount = 0
    while (retryCount < this.config.maxRetries) {
      try {
        if (saveOperation.entityType === 'deck') {
          await this.saveDeckWithConflictResolution(saveOperation)
        } else if (saveOperation.entityType === 'consultation-session') {
          await this.saveSessionWithConflictResolution(saveOperation)
        }

        // Success - clean up
        this.saveQueue.delete(saveKey)
        this.saveTimers.delete(saveKey)
        return

      } catch (error) {
        retryCount++
        console.error(`Save attempt ${retryCount} failed for ${saveKey}:`, error)
        
        if (retryCount >= this.config.maxRetries) {
          // Log the failure and clean up
          console.error(`Failed to save ${saveKey} after ${this.config.maxRetries} attempts`)
          this.saveQueue.delete(saveKey)
          this.saveTimers.delete(saveKey)
          throw error
        }

        // Wait before retry with exponential backoff
        await this.sleep(Math.pow(2, retryCount) * 1000)
      }
    }
  }

  /**
   * Save deck with conflict resolution
   */
  private async saveDeckWithConflictResolution(saveOperation: SaveOperation): Promise<void> {
    const { entityId, data, version, checksum } = saveOperation

    // Check for existing deck and version conflicts
    const existingDeck = await this.prisma.generatedDeck.findUnique({
      where: { id: entityId },
      select: { 
        version: true, 
        checksum: true,
        updatedAt: true,
        cards: true,
        strategy: true,
        metadata: true,
      }
    })

    if (existingDeck && existingDeck.version !== version) {
      // Conflict detected - resolve based on strategy
      const resolution = await this.resolveConflict(
        saveOperation,
        existingDeck,
        this.config.conflictResolutionStrategy
      )

      if (resolution.resolution === 'server') {
        // Server wins - don't save, return existing data
        return
      } else if (resolution.resolution === 'merged') {
        // Use merged data
        data = resolution.mergedData
      }
      // For 'client' resolution, use original data
    }

    // Perform the save with optimistic locking
    await this.prisma.generatedDeck.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        userId: saveOperation.userId,
        sessionId: data.sessionId || `session-${entityId}`,
        name: data.name,
        commander: data.commander,
        format: 'commander',
        strategy: data.strategy,
        winConditions: data.strategy.winConditions || [],
        powerLevel: data.metadata.powerLevel,
        estimatedBudget: data.metadata.budget,
        consultationData: data.preferences || {},
        qualityScore: 0.8, // Default quality score
        manaCurveScore: 0.8,
        synergyScore: 0.8,
        budgetCompliance: 1.0,
        generationTime: 0,
        aiModelUsed: 'gpt-4',
        generationPromptHash: checksum,
        retryCount: 0,
        status: 'generated',
        version: version + 1,
        checksum,
        cards: {
          create: data.cards.map((card: any) => ({
            cardId: card.cardId,
            quantity: card.quantity,
            category: card.category || 'main',
          }))
        }
      },
      update: {
        name: data.name,
        commander: data.commander,
        strategy: data.strategy,
        powerLevel: data.metadata.powerLevel,
        estimatedBudget: data.metadata.budget,
        version: version + 1,
        checksum,
        updatedAt: new Date(),
        cards: {
          deleteMany: {},
          create: data.cards.map((card: any) => ({
            cardId: card.cardId,
            quantity: card.quantity,
            category: card.category || 'main',
          }))
        }
      }
    })
  }

  /**
   * Save consultation session with conflict resolution
   */
  private async saveSessionWithConflictResolution(saveOperation: SaveOperation): Promise<void> {
    const { entityId, data, version, checksum } = saveOperation

    // Check for existing session and version conflicts
    const existingSession = await this.prisma.consultationSession.findUnique({
      where: { id: entityId },
      select: { 
        version: true, 
        checksum: true,
        updatedAt: true,
        currentStep: true,
        responses: true,
        preferences: true,
      }
    })

    if (existingSession && existingSession.version !== version) {
      // Conflict detected - resolve based on strategy
      const resolution = await this.resolveConflict(
        saveOperation,
        existingSession,
        this.config.conflictResolutionStrategy
      )

      if (resolution.resolution === 'server') {
        // Server wins - don't save
        return
      } else if (resolution.resolution === 'merged') {
        // Use merged data
        data = resolution.mergedData
      }
    }

    // Perform the save
    await this.prisma.consultationSession.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        userId: saveOperation.userId,
        currentStep: data.currentStep,
        totalSteps: data.totalSteps,
        responses: data.responses,
        preferences: data.preferences,
        status: 'in_progress',
        version: version + 1,
        checksum,
      },
      update: {
        currentStep: data.currentStep,
        responses: data.responses,
        preferences: data.preferences,
        version: version + 1,
        checksum,
        updatedAt: new Date(),
      }
    })
  }

  /**
   * Resolve conflicts between client and server data
   */
  private async resolveConflict(
    saveOperation: SaveOperation,
    existingData: any,
    strategy: AutoSaveConfig['conflictResolutionStrategy']
  ): Promise<ConflictResolution> {
    const conflictId = `conflict-${saveOperation.entityId}-${Date.now()}`

    switch (strategy) {
      case 'client-wins':
        return {
          conflictId,
          clientVersion: saveOperation.version,
          serverVersion: existingData.version,
          resolution: 'client'
        }

      case 'server-wins':
        return {
          conflictId,
          clientVersion: saveOperation.version,
          serverVersion: existingData.version,
          resolution: 'server'
        }

      case 'merge':
        const mergedData = this.mergeData(saveOperation.data, existingData)
        return {
          conflictId,
          clientVersion: saveOperation.version,
          serverVersion: existingData.version,
          resolution: 'merged',
          mergedData
        }

      case 'prompt-user':
        // For now, default to client wins
        // In a real implementation, this would trigger a user prompt
        return {
          conflictId,
          clientVersion: saveOperation.version,
          serverVersion: existingData.version,
          resolution: 'client'
        }

      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`)
    }
  }

  /**
   * Merge client and server data intelligently
   */
  private mergeData(clientData: any, serverData: any): any {
    // Simple merge strategy - prefer client data for most fields
    // but preserve server timestamps and version info
    return {
      ...serverData,
      ...clientData,
      updatedAt: new Date(),
      version: Math.max(clientData.version || 0, serverData.version || 0) + 1,
    }
  }

  /**
   * Calculate checksum for conflict detection
   */
  private calculateChecksum(data: any): string {
    const crypto = require('crypto')
    const dataString = JSON.stringify(data, Object.keys(data).sort())
    return crypto.createHash('sha256').update(dataString).digest('hex')
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer)
    }
    this.saveTimers.clear()

    // Force save any pending operations
    const pendingSaves = Array.from(this.saveQueue.keys())
    await Promise.allSettled(
      pendingSaves.map(saveKey => this.executeSave(saveKey))
    )

    this.saveQueue.clear()
  }
}