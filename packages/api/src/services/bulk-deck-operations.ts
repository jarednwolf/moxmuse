import { PrismaClient } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

// =====================================================
// BULK OPERATION TYPES
// =====================================================

export const BulkOperationTypeSchema = z.enum([
  'import',
  'export', 
  'delete',
  'move',
  'clone',
  'tag',
  'analyze',
  'optimize',
  'share',
  'privacy'
])

export type BulkOperationType = z.infer<typeof BulkOperationTypeSchema>

export const BulkOperationStatusSchema = z.enum([
  'pending',
  'processing', 
  'completed',
  'failed',
  'cancelled'
])

export type BulkOperationStatus = z.infer<typeof BulkOperationStatusSchema>

export const BulkOperationSchema = z.object({
  id: z.string().optional(),
  type: BulkOperationTypeSchema,
  deckIds: z.array(z.string()),
  parameters: z.record(z.any()),
  userId: z.string().optional(),
  status: BulkOperationStatusSchema.optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type BulkOperation = z.infer<typeof BulkOperationSchema>

export const BulkOperationResultSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  processedCount: z.number(),
  errorCount: z.number(),
  skippedCount: z.number().optional(),
  totalCount: z.number(),
  errors: z.array(z.object({
    deckId: z.string(),
    error: z.string(),
    code: z.string().optional(),
    canRetry: z.boolean().optional()
  })),
  warnings: z.array(z.object({
    deckId: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high'])
  })).optional(),
  results: z.record(z.any()),
  progressPercentage: z.number().optional(),
  estimatedTimeRemaining: z.number().optional(),
  canUndo: z.boolean().optional(),
  undoData: z.record(z.any()).optional()
})

export type BulkOperationResult = z.infer<typeof BulkOperationResultSchema>

// Undo/Redo operation types
export const UndoOperationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  originalOperationId: z.string(),
  operationType: BulkOperationTypeSchema,
  undoData: z.record(z.any()),
  canRedo: z.boolean(),
  createdAt: z.date()
})

export type UndoOperation = z.infer<typeof UndoOperationSchema>

// Progress tracking
export interface BulkOperationProgress {
  operationId: string
  currentStep: string
  currentDeck?: string
  processedCount: number
  totalCount: number
  percentage: number
  estimatedTimeRemaining?: number
  errors: Array<{ deckId: string; error: string }>
  warnings: Array<{ deckId: string; message: string }>
}

// =====================================================
// BULK DECK OPERATIONS SERVICE
// =====================================================

export class BulkDeckOperationsService {
  private progressCallbacks: Map<string, (progress: BulkOperationProgress) => void> = new Map()
  private activeOperations: Map<string, AbortController> = new Map()

  constructor(private prisma: PrismaClient) {}

  // =====================================================
  // MAIN BULK OPERATION HANDLER
  // =====================================================

  async executeBulkOperation(
    userId: string,
    operation: BulkOperation,
    onProgress?: (progress: BulkOperationProgress) => void
  ): Promise<BulkOperationResult> {
    // Generate operation ID
    const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Set up progress tracking
    if (onProgress) {
      this.progressCallbacks.set(operationId, onProgress)
    }

    // Set up cancellation
    const abortController = new AbortController()
    this.activeOperations.set(operationId, abortController)

    try {
      // Validate operation
      await this.validateBulkOperation(userId, operation)

      // Create operation record
      const operationRecord = await this.createOperationRecord(userId, operation, operationId)

      // Execute based on type
      let result: BulkOperationResult
      
      switch (operation.type) {
        case 'import':
          result = await this.executeBulkImport(userId, operation, operationId)
          break
        case 'export':
          result = await this.executeBulkExport(userId, operation, operationId)
          break
        case 'delete':
          result = await this.executeBulkDelete(userId, operation, operationId)
          break
        case 'move':
          result = await this.executeBulkMove(userId, operation, operationId)
          break
        case 'clone':
          result = await this.executeBulkClone(userId, operation, operationId)
          break
        case 'tag':
          result = await this.executeBulkTag(userId, operation, operationId)
          break
        case 'analyze':
          result = await this.executeBulkAnalyze(userId, operation, operationId)
          break
        case 'optimize':
          result = await this.executeBulkOptimize(userId, operation, operationId)
          break
        case 'share':
          result = await this.executeBulkShare(userId, operation, operationId)
          break
        case 'privacy':
          result = await this.executeBulkPrivacy(userId, operation, operationId)
          break
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unsupported bulk operation type: ${operation.type}`
          })
      }

      // Update operation record
      await this.updateOperationRecord(operationId, result)

      return result

    } catch (error) {
      // Handle operation failure
      const errorResult: BulkOperationResult = {
        id: operationId,
        success: false,
        processedCount: 0,
        errorCount: operation.deckIds.length,
        totalCount: operation.deckIds.length,
        errors: operation.deckIds.map(deckId => ({
          deckId,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })),
        results: {}
      }

      await this.updateOperationRecord(operationId, errorResult)
      return errorResult

    } finally {
      // Cleanup
      this.progressCallbacks.delete(operationId)
      this.activeOperations.delete(operationId)
    }
  }

  // =====================================================
  // BULK IMPORT OPERATIONS
  // =====================================================

  private async executeBulkImport(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { importData, format, folderId } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    this.updateProgress(operationId, {
      operationId,
      currentStep: 'Parsing import data',
      processedCount: 0,
      totalCount: operation.deckIds.length,
      percentage: 0,
      errors: [],
      warnings: []
    })

    // Parse import data based on format
    let parsedDecks: any[] = []
    try {
      parsedDecks = await this.parseImportData(importData, format)
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Failed to parse import data: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }

    // Process each deck
    for (let i = 0; i < parsedDecks.length; i++) {
      const deckData = parsedDecks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Importing deck',
          currentDeck: deckData.name,
          processedCount: i,
          totalCount: parsedDecks.length,
          percentage: (i / parsedDecks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        // Import individual deck
        const importedDeck = await this.importSingleDeck(userId, deckData, folderId)
        result.results[`deck_${i}`] = importedDeck
        result.processedCount++

        // Store undo data
        result.undoData![`deck_${i}`] = {
          action: 'delete',
          deckId: importedDeck.id
        }

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: `deck_${i}`,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK EXPORT OPERATIONS
  // =====================================================

  private async executeBulkExport(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { format, includeAnalysis, compression } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)
    
    this.updateProgress(operationId, {
      operationId,
      currentStep: 'Preparing export',
      processedCount: 0,
      totalCount: operation.deckIds.length,
      percentage: 0,
      errors: [],
      warnings: []
    })

    const exportedDecks: any[] = []

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Exporting deck',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        // Export individual deck
        const exportedDeck = await this.exportSingleDeck(deck, format, includeAnalysis)
        exportedDecks.push(exportedDeck)
        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    // Create export file
    if (exportedDecks.length > 0) {
      const exportFile = await this.createExportFile(exportedDecks, format, compression)
      result.results.exportFile = exportFile
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK DELETE OPERATIONS
  // =====================================================

  private async executeBulkDelete(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { permanent = false } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: !permanent,
      undoData: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: permanent ? 'Permanently deleting deck' : 'Moving deck to trash',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        if (permanent) {
          // Permanently delete deck
          await this.prisma.deck.delete({
            where: { id: deck.id }
          })
        } else {
          // Soft delete (move to trash)
          await this.prisma.deck.update({
            where: { id: deck.id },
            data: { 
              isDeleted: true,
              deletedAt: new Date()
            }
          })

          // Store undo data
          result.undoData![deck.id] = {
            action: 'restore',
            deckId: deck.id
          }
        }

        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK MOVE OPERATIONS
  // =====================================================

  private async executeBulkMove(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { targetFolderId } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    // Validate target folder if specified
    if (targetFolderId) {
      const folder = await this.prisma.deckFolder.findFirst({
        where: { id: targetFolderId, userId }
      })
      if (!folder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target folder not found'
        })
      }
    }

    // Get current folder assignments for undo
    const currentAssignments = await this.prisma.deckFolderItem.findMany({
      where: { deckId: { in: operation.deckIds } }
    })

    // Store undo data
    result.undoData!.previousAssignments = currentAssignments

    // Remove from current folders
    await this.prisma.deckFolderItem.deleteMany({
      where: { deckId: { in: operation.deckIds } }
    })

    // Add to target folder if specified
    if (targetFolderId) {
      const sortOrder = await this.getNextDeckSortOrder(targetFolderId)
      
      await this.prisma.deckFolderItem.createMany({
        data: operation.deckIds.map((deckId, index) => ({
          folderId: targetFolderId,
          deckId,
          sortOrder: sortOrder + index
        }))
      })
    }

    result.processedCount = operation.deckIds.length
    result.success = true
    return result
  }

  // =====================================================
  // BULK CLONE OPERATIONS
  // =====================================================

  private async executeBulkClone(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { namePrefix = 'Copy of', targetFolderId } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Cloning deck',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        // Clone deck
        const clonedDeck = await this.cloneSingleDeck(userId, deck, namePrefix, targetFolderId)
        result.results[deck.id] = clonedDeck
        result.processedCount++

        // Store undo data
        result.undoData![deck.id] = {
          action: 'delete',
          deckId: clonedDeck.id
        }

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK TAGGING OPERATIONS
  // =====================================================

  private async executeBulkTag(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { tags, action = 'add' } = operation.parameters // 'add', 'remove', 'replace'
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Store original tags for undo
    const originalTags = await this.prisma.deck.findMany({
      where: { id: { in: operation.deckIds } },
      select: { id: true, tags: true }
    })
    result.undoData!.originalTags = originalTags

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: `${action === 'add' ? 'Adding' : action === 'remove' ? 'Removing' : 'Replacing'} tags`,
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        let newTags: string[]
        const currentTags = deck.tags || []

        switch (action) {
          case 'add':
            newTags = [...new Set([...currentTags, ...tags])]
            break
          case 'remove':
            newTags = currentTags.filter(tag => !tags.includes(tag))
            break
          case 'replace':
            newTags = tags
            break
          default:
            throw new Error(`Invalid tag action: ${action}`)
        }

        await this.prisma.deck.update({
          where: { id: deck.id },
          data: { tags: newTags }
        })

        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK ANALYSIS OPERATIONS
  // =====================================================

  private async executeBulkAnalyze(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { analysisTypes = ['all'] } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Analyzing deck',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        // Perform analysis (this would integrate with existing AI analysis services)
        const analysis = await this.analyzeSingleDeck(deck, analysisTypes)
        result.results[deck.id] = analysis
        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK OPTIMIZATION OPERATIONS
  // =====================================================

  private async executeBulkOptimize(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { optimizationTypes = ['all'], autoApply = false } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: autoApply,
      undoData: autoApply ? {} : undefined
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: autoApply ? 'Optimizing deck' : 'Generating optimization suggestions',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        // Generate optimization suggestions
        const optimizations = await this.optimizeSingleDeck(deck, optimizationTypes, autoApply)
        result.results[deck.id] = optimizations
        result.processedCount++

        // Store undo data if auto-applying
        if (autoApply && result.undoData) {
          result.undoData[deck.id] = {
            action: 'revert_optimization',
            originalDeck: deck
          }
        }

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK SHARING OPERATIONS
  // =====================================================

  private async executeBulkShare(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { shareSettings } = operation.parameters
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Store original sharing settings for undo
    const originalSettings = await this.prisma.deck.findMany({
      where: { id: { in: operation.deckIds } },
      select: { id: true, isPublic: true, shareSettings: true }
    })
    result.undoData!.originalSettings = originalSettings

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Updating sharing settings',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        await this.prisma.deck.update({
          where: { id: deck.id },
          data: {
            isPublic: shareSettings.isPublic,
            shareSettings: shareSettings
          }
        })

        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // BULK PRIVACY OPERATIONS
  // =====================================================

  private async executeBulkPrivacy(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<BulkOperationResult> {
    const { privacyLevel } = operation.parameters // 'private', 'unlisted', 'public'
    const result: BulkOperationResult = {
      id: operationId,
      success: true,
      processedCount: 0,
      errorCount: 0,
      totalCount: operation.deckIds.length,
      errors: [],
      results: {},
      canUndo: true,
      undoData: {}
    }

    // Validate deck ownership
    const decks = await this.validateDeckOwnership(userId, operation.deckIds)

    // Store original privacy settings for undo
    const originalSettings = await this.prisma.deck.findMany({
      where: { id: { in: operation.deckIds } },
      select: { id: true, isPublic: true, privacyLevel: true }
    })
    result.undoData!.originalSettings = originalSettings

    // Process each deck
    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i]
      
      try {
        this.updateProgress(operationId, {
          operationId,
          currentStep: 'Updating privacy settings',
          currentDeck: deck.name,
          processedCount: i,
          totalCount: decks.length,
          percentage: (i / decks.length) * 100,
          errors: result.errors,
          warnings: []
        })

        await this.prisma.deck.update({
          where: { id: deck.id },
          data: {
            isPublic: privacyLevel === 'public',
            privacyLevel: privacyLevel
          }
        })

        result.processedCount++

      } catch (error) {
        result.errorCount++
        result.errors.push({
          deckId: deck.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          canRetry: true
        })
      }
    }

    result.success = result.errorCount === 0
    return result
  }

  // =====================================================
  // UNDO/REDO OPERATIONS
  // =====================================================

  async undoBulkOperation(
    userId: string,
    operationId: string
  ): Promise<BulkOperationResult> {
    // Get original operation
    const operation = await this.prisma.bulkOperation.findFirst({
      where: { id: operationId, userId }
    })

    if (!operation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Operation not found'
      })
    }

    if (!operation.canUndo || !operation.undoData) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Operation cannot be undone'
      })
    }

    // Execute undo based on operation type
    const undoResult = await this.executeUndoOperation(userId, operation)

    // Create undo record
    await this.prisma.undoOperation.create({
      data: {
        id: `undo_${operationId}`,
        userId,
        originalOperationId: operationId,
        operationType: operation.type,
        undoData: operation.undoData,
        canRedo: true
      }
    })

    return undoResult
  }

  async redoBulkOperation(
    userId: string,
    undoOperationId: string
  ): Promise<BulkOperationResult> {
    // Get undo operation
    const undoOp = await this.prisma.undoOperation.findFirst({
      where: { id: undoOperationId, userId }
    })

    if (!undoOp || !undoOp.canRedo) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Undo operation not found or cannot be redone'
      })
    }

    // Get original operation
    const originalOp = await this.prisma.bulkOperation.findFirst({
      where: { id: undoOp.originalOperationId }
    })

    if (!originalOp) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Original operation not found'
      })
    }

    // Re-execute original operation
    return await this.executeBulkOperation(userId, originalOp as BulkOperation)
  }

  // =====================================================
  // OPERATION MANAGEMENT
  // =====================================================

  async cancelBulkOperation(
    userId: string,
    operationId: string
  ): Promise<void> {
    const abortController = this.activeOperations.get(operationId)
    if (abortController) {
      abortController.abort()
      
      // Update operation status
      await this.prisma.bulkOperation.updateMany({
        where: { id: operationId, userId },
        data: { status: 'cancelled' }
      })
    }
  }

  async getBulkOperationStatus(
    userId: string,
    operationId: string
  ): Promise<BulkOperationResult | null> {
    const operation = await this.prisma.bulkOperation.findFirst({
      where: { id: operationId, userId }
    })

    return operation?.result as BulkOperationResult | null
  }

  async listBulkOperations(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<BulkOperationResult[]> {
    const operations = await this.prisma.bulkOperation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return operations.map(op => op.result as BulkOperationResult)
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async validateBulkOperation(
    userId: string,
    operation: BulkOperation
  ): Promise<void> {
    // Validate deck IDs
    if (!operation.deckIds || operation.deckIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No deck IDs provided'
      })
    }

    // Validate deck ownership for operations that require it
    const ownershipRequiredOps = ['delete', 'move', 'clone', 'tag', 'analyze', 'optimize', 'share', 'privacy']
    if (ownershipRequiredOps.includes(operation.type)) {
      await this.validateDeckOwnership(userId, operation.deckIds)
    }

    // Validate operation-specific parameters
    switch (operation.type) {
      case 'move':
        if (operation.parameters.targetFolderId) {
          const folder = await this.prisma.deckFolder.findFirst({
            where: { id: operation.parameters.targetFolderId, userId }
          })
          if (!folder) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Target folder not found'
            })
          }
        }
        break
      
      case 'tag':
        if (!operation.parameters.tags || !Array.isArray(operation.parameters.tags)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Tags parameter is required and must be an array'
          })
        }
        break
    }
  }

  private async validateDeckOwnership(
    userId: string,
    deckIds: string[]
  ): Promise<any[]> {
    const decks = await this.prisma.deck.findMany({
      where: {
        id: { in: deckIds },
        userId
      }
    })

    if (decks.length !== deckIds.length) {
      const foundIds = decks.map(d => d.id)
      const missingIds = deckIds.filter(id => !foundIds.includes(id))
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Decks not found or access denied: ${missingIds.join(', ')}`
      })
    }

    return decks
  }

  private updateProgress(
    operationId: string,
    progress: BulkOperationProgress
  ): void {
    const callback = this.progressCallbacks.get(operationId)
    if (callback) {
      callback(progress)
    }
  }

  private async createOperationRecord(
    userId: string,
    operation: BulkOperation,
    operationId: string
  ): Promise<any> {
    return await this.prisma.bulkOperation.create({
      data: {
        id: operationId,
        userId,
        type: operation.type,
        deckIds: operation.deckIds,
        parameters: operation.parameters,
        status: 'processing',
        createdAt: new Date()
      }
    })
  }

  private async updateOperationRecord(
    operationId: string,
    result: BulkOperationResult
  ): Promise<void> {
    await this.prisma.bulkOperation.update({
      where: { id: operationId },
      data: {
        status: result.success ? 'completed' : 'failed',
        result: result,
        updatedAt: new Date()
      }
    })
  }

  // Placeholder methods for specific operations
  private async parseImportData(data: any, format: string): Promise<any[]> {
    // Implementation would depend on format
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Import parsing not implemented' })
  }

  private async importSingleDeck(userId: string, deckData: any, folderId?: string): Promise<any> {
    // Implementation would create deck from parsed data
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Single deck import not implemented' })
  }

  private async exportSingleDeck(deck: any, format: string, includeAnalysis: boolean): Promise<any> {
    // Implementation would export deck to specified format
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Single deck export not implemented' })
  }

  private async createExportFile(decks: any[], format: string, compression?: boolean): Promise<any> {
    // Implementation would create downloadable file
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Export file creation not implemented' })
  }

  private async cloneSingleDeck(userId: string, deck: any, namePrefix: string, folderId?: string): Promise<any> {
    // Implementation would clone deck
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Deck cloning not implemented' })
  }

  private async analyzeSingleDeck(deck: any, analysisTypes: string[]): Promise<any> {
    // Implementation would analyze deck
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Deck analysis not implemented' })
  }

  private async optimizeSingleDeck(deck: any, optimizationTypes: string[], autoApply: boolean): Promise<any> {
    // Implementation would optimize deck
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Deck optimization not implemented' })
  }

  private async executeUndoOperation(userId: string, operation: any): Promise<BulkOperationResult> {
    // Implementation would undo the operation
    throw new TRPCError({ code: 'NOT_IMPLEMENTED', message: 'Undo operation not implemented' })
  }

  private async getNextDeckSortOrder(folderId: string): Promise<number> {
    const lastItem = await this.prisma.deckFolderItem.findFirst({
      where: { folderId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    return (lastItem?.sortOrder || 0) + 1
  }
}