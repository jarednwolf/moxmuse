import { PrismaClient } from '@moxmuse/db'
import { TRPCError } from '@trpc/server'

// Define types locally until they are added to shared
interface DeckFolder {
  id: string
  userId: string
  name: string
  description?: string
  color: string
  parentId: string | null
  children: DeckFolder[]
  deckIds: string[]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

interface DeckFolderItem {
  folderId: string
  deckId: string
  sortOrder: number
}

interface BulkOperation {
  type: string
  parameters: any
}

interface BulkOperationResult {
  success: boolean
  processedCount: number
  errorCount: number
  errors: Array<{
    deckId: string
    error: string
  }>
  results: Record<string, any>
}

interface CollaborationPermissions {
  canEdit: boolean
  canComment: boolean
  canShare: boolean
  canDelete: boolean
}

export class FolderManagementService {
  constructor(private prisma: PrismaClient) {}

  // =====================================================
  // FOLDER CRUD OPERATIONS
  // =====================================================

  async createFolder(
    userId: string, 
    data: {
      name: string
      description?: string
      color?: string
      parentId?: string
    }
  ): Promise<DeckFolder> {
    // Validate folder name uniqueness within parent
    await this.validateFolderName(userId, data.name, data.parentId || null)
    
    // Validate parent exists and belongs to user
    if (data.parentId) {
      await this.validateFolderOwnership(userId, data.parentId)
    }

    // Get next sort order
    const sortOrder = await this.getNextSortOrder(userId, data.parentId || null)

    const folder = await this.prisma.deckFolder.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        color: data.color || '#6366f1',
        parentId: data.parentId,
        sortOrder
      },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            children: true,
            items: {
              include: {
                deck: {
                  select: {
                    id: true,
                    name: true,
                    commander: true,
                    format: true,
                    updatedAt: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        },
        items: {
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                commander: true,
                format: true,
                updatedAt: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    return this.transformFolderResponse(folder)
  }

  async updateFolder(
    userId: string,
    folderId: string,
    data: {
      name?: string
      description?: string
      color?: string
      parentId?: string
    }
  ): Promise<DeckFolder> {
    // Validate ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate name uniqueness if changing name
    if (data.name) {
      const currentFolder = await this.prisma.deckFolder.findUnique({
        where: { id: folderId },
        select: { name: true, parentId: true }
      })
      
      if (currentFolder && currentFolder.name !== data.name) {
        await this.validateFolderName(userId, data.name, data.parentId !== undefined ? data.parentId : currentFolder.parentId)
      }
    }

    // Validate parent change doesn't create cycles
    if (data.parentId !== undefined) {
      await this.validateNoCircularReference(folderId, data.parentId)
      if (data.parentId) {
        await this.validateFolderOwnership(userId, data.parentId)
      }
    }

    const folder = await this.prisma.deckFolder.update({
      where: { id: folderId },
      data,
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            children: true,
            items: {
              include: {
                deck: {
                  select: {
                    id: true,
                    name: true,
                    commander: true,
                    format: true,
                    updatedAt: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        },
        items: {
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                commander: true,
                format: true,
                updatedAt: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    return this.transformFolderResponse(folder)
  }

  async deleteFolder(userId: string, folderId: string): Promise<void> {
    // Validate ownership
    await this.validateFolderOwnership(userId, folderId)

    // Check if folder has children or decks
    const folder = await this.prisma.deckFolder.findUnique({
      where: { id: folderId },
      include: {
        children: true,
        items: true
      }
    })

    if (!folder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Folder not found'
      })
    }

    if (folder.children.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete folder with subfolders. Move or delete subfolders first.'
      })
    }

    if (folder.items.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot delete folder with decks. Move or remove decks first.'
      })
    }

    await this.prisma.deckFolder.delete({
      where: { id: folderId }
    })
  }

  async getFolderTree(userId: string): Promise<DeckFolder[]> {
    const folders = await this.prisma.deckFolder.findMany({
      where: { 
        userId,
        parentId: null
      },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              orderBy: { sortOrder: 'asc' },
              include: {
                children: true,
                items: {
                  include: {
                    deck: {
                      select: {
                        id: true,
                        name: true,
                        commander: true,
                        format: true,
                        updatedAt: true
                      }
                    }
                  },
                  orderBy: { sortOrder: 'asc' }
                }
              }
            },
            items: {
              include: {
                deck: {
                  select: {
                    id: true,
                    name: true,
                    commander: true,
                    format: true,
                    updatedAt: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        },
        items: {
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                commander: true,
                format: true,
                updatedAt: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })

    return folders.map(folder => this.transformFolderResponse(folder))
  }

  // =====================================================
  // DECK MANAGEMENT WITHIN FOLDERS
  // =====================================================

  async addDeckToFolder(
    userId: string,
    folderId: string,
    deckId: string
  ): Promise<DeckFolderItem> {
    // Validate folder ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate deck ownership
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId }
    })

    if (!deck) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deck not found or access denied'
      })
    }

    // Check if deck is already in folder
    const existing = await this.prisma.deckFolderItem.findUnique({
      where: {
        folderId_deckId: {
          folderId,
          deckId
        }
      }
    })

    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Deck is already in this folder'
      })
    }

    // Get next sort order for deck in folder
    const sortOrder = await this.getNextDeckSortOrder(folderId)

    return await this.prisma.deckFolderItem.create({
      data: {
        folderId,
        deckId,
        sortOrder
      }
    })
  }

  async removeDeckFromFolder(
    userId: string,
    folderId: string,
    deckId: string
  ): Promise<void> {
    // Validate folder ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate deck ownership
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, userId }
    })

    if (!deck) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deck not found or access denied'
      })
    }

    await this.prisma.deckFolderItem.deleteMany({
      where: {
        folderId,
        deckId
      }
    })
  }

  async moveDecksToFolder(
    userId: string,
    deckIds: string[],
    targetFolderId: string | null
  ): Promise<void> {
    // Validate target folder ownership if specified
    if (targetFolderId) {
      await this.validateFolderOwnership(userId, targetFolderId)
    }

    // Validate all deck ownership
    const decks = await this.prisma.deck.findMany({
      where: {
        id: { in: deckIds },
        userId
      }
    })

    if (decks.length !== deckIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'One or more decks not found or access denied'
      })
    }

    // Remove decks from all folders first
    await this.prisma.deckFolderItem.deleteMany({
      where: {
        deckId: { in: deckIds }
      }
    })

    // Add to target folder if specified
    if (targetFolderId) {
      const sortOrder = await this.getNextDeckSortOrder(targetFolderId)
      
      await this.prisma.deckFolderItem.createMany({
        data: deckIds.map((deckId, index) => ({
          folderId: targetFolderId,
          deckId,
          sortOrder: sortOrder + index
        }))
      })
    }
  }

  // =====================================================
  // DRAG AND DROP OPERATIONS
  // =====================================================

  async reorderFolders(
    userId: string,
    parentId: string | null,
    folderIds: string[]
  ): Promise<void> {
    // Validate all folders belong to user and have correct parent
    const folders = await this.prisma.deckFolder.findMany({
      where: {
        id: { in: folderIds },
        userId,
        parentId
      }
    })

    if (folders.length !== folderIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid folder IDs or parent mismatch'
      })
    }

    // Update sort orders
    await Promise.all(
      folderIds.map((folderId, index) =>
        this.prisma.deckFolder.update({
          where: { id: folderId },
          data: { sortOrder: index }
        })
      )
    )
  }

  async reorderDecksInFolder(
    userId: string,
    folderId: string,
    deckIds: string[]
  ): Promise<void> {
    // Validate folder ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate all decks are in the folder
    const items = await this.prisma.deckFolderItem.findMany({
      where: {
        folderId,
        deckId: { in: deckIds }
      }
    })

    if (items.length !== deckIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid deck IDs for this folder'
      })
    }

    // Update sort orders
    await Promise.all(
      deckIds.map((deckId, index) =>
        this.prisma.deckFolderItem.update({
          where: {
            folderId_deckId: {
              folderId,
              deckId
            }
          },
          data: { sortOrder: index }
        })
      )
    )
  }

  async moveFolderToParent(
    userId: string,
    folderId: string,
    newParentId: string | null
  ): Promise<DeckFolder> {
    // Validate folder ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate new parent ownership if specified
    if (newParentId) {
      await this.validateFolderOwnership(userId, newParentId)
    }

    // Validate no circular reference
    await this.validateNoCircularReference(folderId, newParentId)

    // Get next sort order in new parent
    const sortOrder = await this.getNextSortOrder(userId, newParentId)

    const folder = await this.prisma.deckFolder.update({
      where: { id: folderId },
      data: {
        parentId: newParentId,
        sortOrder
      },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            children: true,
            items: {
              include: {
                deck: {
                  select: {
                    id: true,
                    name: true,
                    commander: true,
                    format: true,
                    updatedAt: true
                  }
                }
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        },
        items: {
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                commander: true,
                format: true,
                updatedAt: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    })

    return this.transformFolderResponse(folder)
  }

  // =====================================================
  // BULK OPERATIONS
  // =====================================================

  async bulkFolderOperation(
    userId: string,
    operation: BulkOperation
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      success: true,
      processedCount: 0,
      errorCount: 0,
      errors: [],
      results: {}
    }

    switch (operation.type) {
      case 'delete':
        return await this.bulkDeleteFolders(userId, operation.parameters.folderIds)
      
      case 'move':
        return await this.bulkMoveFolders(
          userId, 
          operation.parameters.folderIds, 
          operation.parameters.targetParentId
        )
      
      case 'export':
        return await this.bulkExportFolders(userId, operation.parameters.folderIds)
      
      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Unsupported bulk operation type'
        })
    }
  }

  private async bulkDeleteFolders(
    userId: string,
    folderIds: string[]
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      success: true,
      processedCount: 0,
      errorCount: 0,
      errors: [],
      results: {}
    }

    for (const folderId of folderIds) {
      try {
        await this.deleteFolder(userId, folderId)
        results.processedCount++
      } catch (error) {
        results.errorCount++
        results.errors.push({
          deckId: folderId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    results.success = results.errorCount === 0
    return results
  }

  private async bulkMoveFolders(
    userId: string,
    folderIds: string[],
    targetParentId: string | null
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = {
      success: true,
      processedCount: 0,
      errorCount: 0,
      errors: [],
      results: {}
    }

    for (const folderId of folderIds) {
      try {
        await this.moveFolderToParent(userId, folderId, targetParentId)
        results.processedCount++
      } catch (error) {
        results.errorCount++
        results.errors.push({
          deckId: folderId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    results.success = results.errorCount === 0
    return results
  }

  private async bulkExportFolders(
    userId: string,
    folderIds: string[]
  ): Promise<BulkOperationResult> {
    // Implementation for bulk folder export would go here
    // This would integrate with the export system
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Bulk folder export not yet implemented'
    })
  }

  // =====================================================
  // FOLDER SHARING AND COLLABORATION
  // =====================================================

  async shareFolderWithUser(
    userId: string,
    folderId: string,
    targetUserId: string,
    permissions: CollaborationPermissions
  ): Promise<void> {
    // Validate folder ownership
    await this.validateFolderOwnership(userId, folderId)

    // Validate target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Target user not found'
      })
    }

    // For now, we'll store sharing info in a simple way
    // In a full implementation, you'd want a proper sharing/collaboration table
    await this.prisma.deckFolder.update({
      where: { id: folderId },
      data: {
        description: `Shared with ${targetUser.name || targetUser.email}`
      }
    })
  }

  async getFolderPermissions(
    userId: string,
    folderId: string
  ): Promise<CollaborationPermissions> {
    // Validate folder access
    const folder = await this.prisma.deckFolder.findFirst({
      where: {
        id: folderId,
        userId // For now, only owner has permissions
      }
    })

    if (!folder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Folder not found or access denied'
      })
    }

    // Return full permissions for owner
    return {
      canEdit: true,
      canComment: true,
      canShare: true,
      canDelete: true
    }
  }

  // =====================================================
  // VALIDATION HELPERS
  // =====================================================

  private async validateFolderName(
    userId: string,
    name: string,
    parentId: string | null
  ): Promise<void> {
    const existing = await this.prisma.deckFolder.findFirst({
      where: {
        userId,
        name,
        parentId
      }
    })

    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A folder with this name already exists in the same location'
      })
    }
  }

  private async validateFolderOwnership(
    userId: string,
    folderId: string
  ): Promise<void> {
    const folder = await this.prisma.deckFolder.findFirst({
      where: {
        id: folderId,
        userId
      }
    })

    if (!folder) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Folder not found or access denied'
      })
    }
  }

  private async validateNoCircularReference(
    folderId: string,
    newParentId: string | null
  ): Promise<void> {
    if (!newParentId) return

    // Check if newParentId is a descendant of folderId
    let currentParentId: string | null = newParentId
    const visited = new Set<string>()

    while (currentParentId !== null) {
      if (currentParentId === folderId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot move folder into its own descendant'
        })
      }

      if (visited.has(currentParentId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Circular reference detected in folder hierarchy'
        })
      }

      visited.add(currentParentId)

      const parentFolder: { parentId: string | null } | null = await this.prisma.deckFolder.findUnique({
        where: { id: currentParentId },
        select: { parentId: true }
      })

      currentParentId = parentFolder?.parentId ?? null
    }
  }

  private async getNextSortOrder(
    userId: string,
    parentId: string | null
  ): Promise<number> {
    const lastFolder = await this.prisma.deckFolder.findFirst({
      where: {
        userId,
        parentId
      },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    return (lastFolder?.sortOrder || 0) + 1
  }

  private async getNextDeckSortOrder(folderId: string): Promise<number> {
    const lastItem = await this.prisma.deckFolderItem.findFirst({
      where: { folderId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    return (lastItem?.sortOrder || 0) + 1
  }

  // =====================================================
  // RESPONSE TRANSFORMATION
  // =====================================================

  private transformFolderResponse(folder: any): DeckFolder {
    return {
      id: folder.id,
      userId: folder.userId,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      parentId: folder.parentId,
      children: folder.children?.map((child: any) => this.transformFolderResponse(child)) || [],
      deckIds: folder.items?.map((item: any) => item.deckId) || [],
      sortOrder: folder.sortOrder,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    }
  }
}
