import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { FolderManagementService } from '../services/folder-management'

// Validation schemas
const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  parentId: z.string().optional()
})

const updateFolderSchema = z.object({
  folderId: z.string(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  parentId: z.string().optional()
})

const bulkOperationSchema = z.object({
  type: z.enum(['export', 'delete', 'move', 'clone', 'tag']),
  folderIds: z.array(z.string()).optional(),
  deckIds: z.array(z.string()).optional(),
  parameters: z.record(z.any())
})

const collaborationPermissionsSchema = z.object({
  canEdit: z.boolean(),
  canComment: z.boolean(),
  canShare: z.boolean(),
  canDelete: z.boolean()
})

export const folderManagementRouter = createTRPCRouter({
  // =====================================================
  // FOLDER CRUD OPERATIONS
  // =====================================================

  createFolder: protectedProcedure
    .input(createFolderSchema)
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.createFolder(ctx.session.user.id, input)
    }),

  updateFolder: protectedProcedure
    .input(updateFolderSchema)
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      const { folderId, ...data } = input
      return await folderService.updateFolder(ctx.session.user.id, folderId, data)
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.deleteFolder(ctx.session.user.id, input.folderId)
      return { success: true }
    }),

  getFolderTree: protectedProcedure
    .query(async ({ ctx }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.getFolderTree(ctx.session.user.id)
    }),

  getFolder: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      const folders = await folderService.getFolderTree(ctx.session.user.id)
      
      // Find the specific folder in the tree
      const findFolder = (folders: any[], targetId: string): any => {
        for (const folder of folders) {
          if (folder.id === targetId) return folder
          if (folder.children) {
            const found = findFolder(folder.children, targetId)
            if (found) return found
          }
        }
        return null
      }

      const folder = findFolder(folders, input.folderId)
      if (!folder) {
        throw new Error('Folder not found')
      }

      return folder
    }),

  // =====================================================
  // DECK MANAGEMENT WITHIN FOLDERS
  // =====================================================

  addDeckToFolder: protectedProcedure
    .input(z.object({
      folderId: z.string(),
      deckId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.addDeckToFolder(
        ctx.session.user.id,
        input.folderId,
        input.deckId
      )
    }),

  removeDeckFromFolder: protectedProcedure
    .input(z.object({
      folderId: z.string(),
      deckId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.removeDeckFromFolder(
        ctx.session.user.id,
        input.folderId,
        input.deckId
      )
      return { success: true }
    }),

  moveDecksToFolder: protectedProcedure
    .input(z.object({
      deckIds: z.array(z.string()),
      targetFolderId: z.string().nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.moveDecksToFolder(
        ctx.session.user.id,
        input.deckIds,
        input.targetFolderId
      )
      return { success: true }
    }),

  // =====================================================
  // DRAG AND DROP OPERATIONS
  // =====================================================

  reorderFolders: protectedProcedure
    .input(z.object({
      parentId: z.string().nullable(),
      folderIds: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.reorderFolders(
        ctx.session.user.id,
        input.parentId,
        input.folderIds
      )
      return { success: true }
    }),

  reorderDecksInFolder: protectedProcedure
    .input(z.object({
      folderId: z.string(),
      deckIds: z.array(z.string())
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.reorderDecksInFolder(
        ctx.session.user.id,
        input.folderId,
        input.deckIds
      )
      return { success: true }
    }),

  moveFolderToParent: protectedProcedure
    .input(z.object({
      folderId: z.string(),
      newParentId: z.string().nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.moveFolderToParent(
        ctx.session.user.id,
        input.folderId,
        input.newParentId
      )
    }),

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  bulkOperation: protectedProcedure
    .input(bulkOperationSchema)
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.bulkFolderOperation(ctx.session.user.id, input)
    }),

  // =====================================================
  // FOLDER SHARING AND COLLABORATION
  // =====================================================

  shareFolder: protectedProcedure
    .input(z.object({
      folderId: z.string(),
      targetUserId: z.string(),
      permissions: collaborationPermissionsSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      await folderService.shareFolderWithUser(
        ctx.session.user.id,
        input.folderId,
        input.targetUserId,
        input.permissions
      )
      return { success: true }
    }),

  getFolderPermissions: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      return await folderService.getFolderPermissions(
        ctx.session.user.id,
        input.folderId
      )
    }),

  // =====================================================
  // FOLDER SEARCH AND FILTERING
  // =====================================================

  searchFolders: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      includeDecks: z.boolean().default(false),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const folderService = new FolderManagementService(ctx.prisma)
      const folders = await folderService.getFolderTree(ctx.session.user.id)
      
      // Simple search implementation - in production you'd want more sophisticated search
      const searchInFolders = (folders: any[], query: string): any[] => {
        const results: any[] = []
        
        for (const folder of folders) {
          if (folder.name.toLowerCase().includes(query.toLowerCase()) ||
              folder.description?.toLowerCase().includes(query.toLowerCase())) {
            results.push(folder)
          }
          
          if (folder.children) {
            results.push(...searchInFolders(folder.children, query))
          }
        }
        
        return results
      }

      let results = folders
      if (input.query) {
        results = searchInFolders(folders, input.query)
      }

      // Apply pagination
      const paginatedResults = results.slice(input.offset, input.offset + input.limit)

      return {
        folders: paginatedResults,
        totalCount: results.length,
        hasMore: input.offset + input.limit < results.length
      }
    }),

  // =====================================================
  // FOLDER STATISTICS
  // =====================================================

  getFolderStats: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const folder = await ctx.prisma.deckFolder.findFirst({
        where: {
          id: input.folderId,
          userId: ctx.session.user.id
        },
        include: {
          items: {
            include: {
              deck: {
                select: {
                  format: true,
                  powerLevel: true,
                  budget: true,
                  updatedAt: true
                }
              }
            }
          },
          children: {
            include: {
              items: {
                include: {
                  deck: {
                    select: {
                      format: true,
                      powerLevel: true,
                      budget: true,
                      updatedAt: true
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (!folder) {
        throw new Error('Folder not found')
      }

      // Calculate statistics
      const allDecks = [
        ...folder.items.map(item => item.deck),
        ...folder.children.flatMap(child => child.items.map(item => item.deck))
      ]

      const stats = {
        totalDecks: allDecks.length,
        totalSubfolders: folder.children.length,
        formatBreakdown: {} as Record<string, number>,
        averagePowerLevel: 0,
        totalBudget: 0,
        lastUpdated: new Date(0)
      }

      allDecks.forEach(deck => {
        // Format breakdown
        stats.formatBreakdown[deck.format] = (stats.formatBreakdown[deck.format] || 0) + 1
        
        // Average power level
        if (deck.powerLevel) {
          stats.averagePowerLevel += deck.powerLevel
        }
        
        // Total budget
        if (deck.budget) {
          stats.totalBudget += Number(deck.budget)
        }
        
        // Last updated
        if (deck.updatedAt > stats.lastUpdated) {
          stats.lastUpdated = deck.updatedAt
        }
      })

      if (allDecks.length > 0) {
        stats.averagePowerLevel = stats.averagePowerLevel / allDecks.length
      }

      return stats
    })
})
