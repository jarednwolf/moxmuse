import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { FolderManagementService } from '../folder-management'
import { TRPCError } from '@trpc/server'

// Mock Prisma
const prismaMock = {
  deckFolder: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  deck: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  deckFolderItem: {
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  }
} as any

const folderService = new FolderManagementService(prismaMock)

describe('FolderManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createFolder', () => {
    it('should create a folder successfully', async () => {
      const userId = 'user-1'
      const folderData = {
        name: 'Test Folder',
        description: 'Test Description',
        color: '#6366f1'
      }

      const mockFolder = {
        id: 'folder-1',
        userId,
        name: folderData.name,
        description: folderData.description,
        color: folderData.color,
        parentId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: [],
        items: []
      }

      // Mock validation queries
      prismaMock.deckFolder.findFirst.mockResolvedValue(null) // No existing folder with same name
      prismaMock.deckFolder.findFirst.mockResolvedValue(null) // No last folder for sort order

      // Mock creation
      prismaMock.deckFolder.create.mockResolvedValue(mockFolder as any)

      const result = await folderService.createFolder(userId, folderData)

      expect(result).toEqual({
        id: 'folder-1',
        userId,
        name: folderData.name,
        description: folderData.description,
        color: folderData.color,
        parentId: null,
        children: [],
        deckIds: [],
        sortOrder: 1,
        createdAt: mockFolder.createdAt,
        updatedAt: mockFolder.updatedAt
      })

      expect(prismaMock.deckFolder.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: folderData.name,
          description: folderData.description,
          color: folderData.color,
          parentId: undefined,
          sortOrder: 1
        },
        include: expect.any(Object)
      })
    })

    it('should throw error for duplicate folder name', async () => {
      const userId = 'user-1'
      const folderData = {
        name: 'Existing Folder'
      }

      // Mock existing folder
      prismaMock.deckFolder.findFirst.mockResolvedValue({
        id: 'existing-folder',
        name: 'Existing Folder'
      } as any)

      await expect(folderService.createFolder(userId, folderData))
        .rejects.toThrow('A folder with this name already exists in the same location')
    })

    it('should validate parent folder ownership', async () => {
      const userId = 'user-1'
      const folderData = {
        name: 'Child Folder',
        parentId: 'parent-folder-1'
      }

      // Mock no existing folder with same name
      prismaMock.deckFolder.findFirst.mockResolvedValueOnce(null)
      // Mock parent folder not found (ownership validation)
      prismaMock.deckFolder.findFirst.mockResolvedValueOnce(null)

      await expect(folderService.createFolder(userId, folderData))
        .rejects.toThrow('Folder not found or access denied')
    })
  })

  describe('updateFolder', () => {
    it('should update folder successfully', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'
      const updateData = {
        name: 'Updated Folder',
        description: 'Updated Description'
      }

      const mockFolder = {
        id: folderId,
        userId,
        name: updateData.name,
        description: updateData.description,
        color: '#6366f1',
        parentId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: [],
        items: []
      }

      // Mock ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValueOnce({ id: folderId } as any)
      // Mock current folder for name validation
      prismaMock.deckFolder.findUnique.mockResolvedValue({
        name: 'Old Name',
        parentId: null
      } as any)
      // Mock no existing folder with new name
      prismaMock.deckFolder.findFirst.mockResolvedValueOnce(null)
      // Mock update
      prismaMock.deckFolder.update.mockResolvedValue(mockFolder as any)

      const result = await folderService.updateFolder(userId, folderId, updateData)

      expect(result.name).toBe(updateData.name)
      expect(result.description).toBe(updateData.description)
      expect(prismaMock.deckFolder.update).toHaveBeenCalledWith({
        where: { id: folderId },
        data: updateData,
        include: expect.any(Object)
      })
    })

    it('should prevent circular references when changing parent', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'
      const updateData = {
        parentId: 'folder-2'
      }

      // Mock ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      
      // Mock circular reference detection
      prismaMock.deckFolder.findUnique
        .mockResolvedValueOnce({ parentId: 'folder-1' } as any) // folder-2 has folder-1 as parent

      await expect(folderService.updateFolder(userId, folderId, updateData))
        .rejects.toThrow('Cannot move folder into its own descendant')
    })
  })

  describe('deleteFolder', () => {
    it('should delete empty folder successfully', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'

      // Mock ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      // Mock folder with no children or items
      prismaMock.deckFolder.findUnique.mockResolvedValue({
        id: folderId,
        children: [],
        items: []
      } as any)
      // Mock deletion
      prismaMock.deckFolder.delete.mockResolvedValue({} as any)

      await folderService.deleteFolder(userId, folderId)

      expect(prismaMock.deckFolder.delete).toHaveBeenCalledWith({
        where: { id: folderId }
      })
    })

    it('should prevent deletion of folder with children', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'

      // Mock ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      // Mock folder with children
      prismaMock.deckFolder.findUnique.mockResolvedValue({
        id: folderId,
        children: [{ id: 'child-1' }],
        items: []
      } as any)

      await expect(folderService.deleteFolder(userId, folderId))
        .rejects.toThrow('Cannot delete folder with subfolders')
    })

    it('should prevent deletion of folder with decks', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'

      // Mock ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      // Mock folder with items
      prismaMock.deckFolder.findUnique.mockResolvedValue({
        id: folderId,
        children: [],
        items: [{ id: 'item-1' }]
      } as any)

      await expect(folderService.deleteFolder(userId, folderId))
        .rejects.toThrow('Cannot delete folder with decks')
    })
  })

  describe('addDeckToFolder', () => {
    it('should add deck to folder successfully', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'
      const deckId = 'deck-1'

      const mockFolderItem = {
        id: 'item-1',
        folderId,
        deckId,
        sortOrder: 1,
        createdAt: new Date()
      }

      // Mock folder ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      // Mock deck ownership validation
      prismaMock.deck.findFirst.mockResolvedValue({ id: deckId } as any)
      // Mock no existing folder item
      prismaMock.deckFolderItem.findUnique.mockResolvedValue(null)
      // Mock sort order calculation
      prismaMock.deckFolderItem.findFirst.mockResolvedValue(null)
      // Mock creation
      prismaMock.deckFolderItem.create.mockResolvedValue(mockFolderItem as any)

      const result = await folderService.addDeckToFolder(userId, folderId, deckId)

      expect(result).toEqual(mockFolderItem)
      expect(prismaMock.deckFolderItem.create).toHaveBeenCalledWith({
        data: {
          folderId,
          deckId,
          sortOrder: 1
        }
      })
    })

    it('should prevent adding deck already in folder', async () => {
      const userId = 'user-1'
      const folderId = 'folder-1'
      const deckId = 'deck-1'

      // Mock folder ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: folderId } as any)
      // Mock deck ownership validation
      prismaMock.deck.findFirst.mockResolvedValue({ id: deckId } as any)
      // Mock existing folder item
      prismaMock.deckFolderItem.findUnique.mockResolvedValue({
        id: 'existing-item'
      } as any)

      await expect(folderService.addDeckToFolder(userId, folderId, deckId))
        .rejects.toThrow('Deck is already in this folder')
    })
  })

  describe('moveDecksToFolder', () => {
    it('should move decks to folder successfully', async () => {
      const userId = 'user-1'
      const deckIds = ['deck-1', 'deck-2']
      const targetFolderId = 'folder-1'

      // Mock target folder ownership validation
      prismaMock.deckFolder.findFirst.mockResolvedValue({ id: targetFolderId } as any)
      // Mock deck ownership validation
      prismaMock.deck.findMany.mockResolvedValue([
        { id: 'deck-1' },
        { id: 'deck-2' }
      ] as any)
      // Mock removal from existing folders
      prismaMock.deckFolderItem.deleteMany.mockResolvedValue({ count: 2 } as any)
      // Mock sort order calculation
      prismaMock.deckFolderItem.findFirst.mockResolvedValue(null)
      // Mock creation
      prismaMock.deckFolderItem.createMany.mockResolvedValue({ count: 2 } as any)

      await folderService.moveDecksToFolder(userId, deckIds, targetFolderId)

      expect(prismaMock.deckFolderItem.deleteMany).toHaveBeenCalledWith({
        where: { deckId: { in: deckIds } }
      })
      expect(prismaMock.deckFolderItem.createMany).toHaveBeenCalledWith({
        data: [
          { folderId: targetFolderId, deckId: 'deck-1', sortOrder: 1 },
          { folderId: targetFolderId, deckId: 'deck-2', sortOrder: 2 }
        ]
      })
    })

    it('should remove decks from all folders when target is null', async () => {
      const userId = 'user-1'
      const deckIds = ['deck-1', 'deck-2']
      const targetFolderId = null

      // Mock deck ownership validation
      prismaMock.deck.findMany.mockResolvedValue([
        { id: 'deck-1' },
        { id: 'deck-2' }
      ] as any)
      // Mock removal from existing folders
      prismaMock.deckFolderItem.deleteMany.mockResolvedValue({ count: 2 } as any)

      await folderService.moveDecksToFolder(userId, deckIds, targetFolderId)

      expect(prismaMock.deckFolderItem.deleteMany).toHaveBeenCalledWith({
        where: { deckId: { in: deckIds } }
      })
      expect(prismaMock.deckFolderItem.createMany).not.toHaveBeenCalled()
    })
  })

  describe('reorderFolders', () => {
    it('should reorder folders successfully', async () => {
      const userId = 'user-1'
      const parentId = null
      const folderIds = ['folder-1', 'folder-2', 'folder-3']

      // Mock folder validation
      prismaMock.deckFolder.findMany.mockResolvedValue([
        { id: 'folder-1' },
        { id: 'folder-2' },
        { id: 'folder-3' }
      ] as any)

      // Mock updates
      prismaMock.deckFolder.update
        .mockResolvedValueOnce({ id: 'folder-1' } as any)
        .mockResolvedValueOnce({ id: 'folder-2' } as any)
        .mockResolvedValueOnce({ id: 'folder-3' } as any)

      await folderService.reorderFolders(userId, parentId, folderIds)

      expect(prismaMock.deckFolder.update).toHaveBeenCalledTimes(3)
      expect(prismaMock.deckFolder.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'folder-1' },
        data: { sortOrder: 0 }
      })
      expect(prismaMock.deckFolder.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'folder-2' },
        data: { sortOrder: 1 }
      })
      expect(prismaMock.deckFolder.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'folder-3' },
        data: { sortOrder: 2 }
      })
    })
  })

  describe('bulkFolderOperation', () => {
    it('should handle bulk delete operation', async () => {
      const userId = 'user-1'
      const operation = {
        type: 'delete' as const,
        deckIds: [],
        parameters: {
          folderIds: ['folder-1', 'folder-2']
        }
      }

      // Mock successful deletions
      prismaMock.deckFolder.findFirst
        .mockResolvedValueOnce({ id: 'folder-1' } as any) // ownership validation
        .mockResolvedValueOnce({ id: 'folder-2' } as any) // ownership validation

      prismaMock.deckFolder.findUnique
        .mockResolvedValueOnce({ children: [], items: [] } as any) // empty folder
        .mockResolvedValueOnce({ children: [], items: [] } as any) // empty folder

      prismaMock.deckFolder.delete
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any)

      const result = await folderService.bulkFolderOperation(userId, operation)

      expect(result.success).toBe(true)
      expect(result.processedCount).toBe(2)
      expect(result.errorCount).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle partial failures in bulk operations', async () => {
      const userId = 'user-1'
      const operation = {
        type: 'delete' as const,
        deckIds: [],
        parameters: {
          folderIds: ['folder-1', 'folder-2']
        }
      }

      // Mock first folder success, second folder failure
      prismaMock.deckFolder.findFirst
        .mockResolvedValueOnce({ id: 'folder-1' } as any) // ownership validation
        .mockResolvedValueOnce(null) // ownership validation fails

      prismaMock.deckFolder.findUnique
        .mockResolvedValueOnce({ children: [], items: [] } as any) // empty folder

      prismaMock.deckFolder.delete
        .mockResolvedValueOnce({} as any)

      const result = await folderService.bulkFolderOperation(userId, operation)

      expect(result.success).toBe(false)
      expect(result.processedCount).toBe(1)
      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].deckId).toBe('folder-2')
    })
  })

  describe('getFolderTree', () => {
    it('should return hierarchical folder structure', async () => {
      const userId = 'user-1'
      const mockFolders = [
        {
          id: 'folder-1',
          userId,
          name: 'Root Folder 1',
          color: '#6366f1',
          parentId: null,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          children: [
            {
              id: 'folder-2',
              userId,
              name: 'Child Folder',
              color: '#8b5cf6',
              parentId: 'folder-1',
              sortOrder: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              children: [],
              items: []
            }
          ],
          items: [
            {
              id: 'item-1',
              folderId: 'folder-1',
              deckId: 'deck-1',
              sortOrder: 0,
              createdAt: new Date(),
              deck: {
                id: 'deck-1',
                name: 'Test Deck',
                commander: 'Test Commander',
                format: 'commander',
                updatedAt: new Date()
              }
            }
          ]
        }
      ]

      prismaMock.deckFolder.findMany.mockResolvedValue(mockFolders as any)

      const result = await folderService.getFolderTree(userId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Root Folder 1')
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children[0].name).toBe('Child Folder')
      expect(result[0].deckIds).toEqual(['deck-1'])
    })
  })
})