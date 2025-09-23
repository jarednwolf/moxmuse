import { z } from 'zod'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { createPersistenceService } from '../services/persistence/PersistenceService'

// Initialize persistence service
const persistenceService = createPersistenceService(
  // This would be injected in a real implementation
  {} as any, // prisma instance
  {
    backup: {
      backupDirectory: process.env.BACKUP_DIRECTORY || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
    },
    disasterRecovery: {
      alertWebhookUrl: process.env.DISASTER_RECOVERY_WEBHOOK_URL,
    }
  }
)

export const persistenceRouter = createTRPCRouter({
  // Auto-save operations
  scheduleDeckSave: protectedProcedure
    .input(z.object({
      deckId: z.string(),
      deckData: z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await persistenceService.getAutoSaveService().scheduleDeckSave(
          ctx.user.id,
          input.deckId,
          input.deckData
        )
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule deck save',
          cause: error,
        })
      }
    }),

  scheduleSessionSave: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      sessionData: z.object({
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
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await persistenceService.getAutoSaveService().scheduleSessionSave(
          ctx.user.id,
          input.sessionId,
          input.sessionData
        )
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to schedule session save',
          cause: error,
        })
      }
    }),

  forceSave: protectedProcedure
    .input(z.object({
      entityType: z.enum(['deck', 'consultation-session']),
      entityId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await persistenceService.getAutoSaveService().forceSave(
          input.entityType,
          input.entityId
        )
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to force save',
          cause: error,
        })
      }
    }),

  // Session persistence operations
  createSession: protectedProcedure
    .input(z.object({
      totalSteps: z.number().default(10),
      initialPreferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const session = await persistenceService.getSessionPersistenceService().createSession(
          ctx.user.id,
          input.totalSteps,
          input.initialPreferences
        )
        return session
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create session',
          cause: error,
        })
      }
    }),

  updateSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      stepNumber: z.number(),
      stepData: z.any(),
      preferences: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const session = await persistenceService.getSessionPersistenceService().updateSession(
          input.sessionId,
          input.stepNumber,
          input.stepData,
          input.preferences
        )
        return session
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update session',
          cause: error,
        })
      }
    }),

  getSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const session = await persistenceService.getSessionPersistenceService().getSession(
          input.sessionId
        )
        return session
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get session',
          cause: error,
        })
      }
    }),

  getUserSessions: protectedProcedure
    .input(z.object({
      status: z.enum(['in_progress', 'completed', 'abandoned', 'paused']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const sessions = await persistenceService.getSessionPersistenceService().getUserSessions(
          ctx.user.id,
          input.status
        )
        return sessions
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user sessions',
          cause: error,
        })
      }
    }),

  getResumableSessions: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const sessions = await persistenceService.getSessionPersistenceService().getResumableSessions(
          ctx.user.id
        )
        return sessions
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get resumable sessions',
          cause: error,
        })
      }
    }),

  resumeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const resumptionData = await persistenceService.getSessionPersistenceService().resumeSession(
          input.sessionId
        )
        return resumptionData
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resume session',
          cause: error,
        })
      }
    }),

  pauseSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        await persistenceService.getSessionPersistenceService().pauseSession(
          input.sessionId
        )
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to pause session',
          cause: error,
        })
      }
    }),

  completeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      finalData: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        await persistenceService.getSessionPersistenceService().completeSession(
          input.sessionId,
          input.finalData
        )
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete session',
          cause: error,
        })
      }
    }),

  getSessionHistory: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .query(async ({ input }) => {
      try {
        const history = await persistenceService.getSessionPersistenceService().getSessionHistory(
          input.sessionId
        )
        return history
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get session history',
          cause: error,
        })
      }
    }),

  restoreToStep: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      stepNumber: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const session = await persistenceService.getSessionPersistenceService().restoreToStep(
          input.sessionId,
          input.stepNumber
        )
        return session
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore session to step',
          cause: error,
        })
      }
    }),

  // Backup operations
  createFullBackup: protectedProcedure
    .mutation(async () => {
      try {
        const backup = await persistenceService.getBackupService().createFullBackup()
        return backup
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create full backup',
          cause: error,
        })
      }
    }),

  createIncrementalBackup: protectedProcedure
    .mutation(async () => {
      try {
        const backup = await persistenceService.getBackupService().createIncrementalBackup()
        return backup
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create incremental backup',
          cause: error,
        })
      }
    }),

  getRestorePoints: protectedProcedure
    .query(async () => {
      try {
        const restorePoints = await persistenceService.getBackupService().getRestorePoints()
        return restorePoints
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get restore points',
          cause: error,
        })
      }
    }),

  testBackupIntegrity: protectedProcedure
    .input(z.object({
      backupId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const testResult = await persistenceService.getBackupService().testBackupIntegrity(
          input.backupId
        )
        return testResult
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to test backup integrity',
          cause: error,
        })
      }
    }),

  runAutomatedTests: protectedProcedure
    .mutation(async () => {
      try {
        const testResults = await persistenceService.getBackupService().runAutomatedTests()
        return testResults
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to run automated tests',
          cause: error,
        })
      }
    }),

  // Migration operations
  getPendingMigrations: protectedProcedure
    .query(async () => {
      try {
        const migrations = await persistenceService.getMigrationService().getPendingMigrations()
        return migrations
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get pending migrations',
          cause: error,
        })
      }
    }),

  createMigrationPlan: protectedProcedure
    .input(z.object({
      migrationIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const plan = await persistenceService.getMigrationService().createMigrationPlan(
          input.migrationIds
        )
        return plan
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create migration plan',
          cause: error,
        })
      }
    }),

  executeMigrationPlan: protectedProcedure
    .input(z.object({
      plan: z.any(), // Migration plan object
      options: z.object({
        dryRun: z.boolean().optional(),
        createBackup: z.boolean().optional(),
        stopOnError: z.boolean().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const executions = await persistenceService.getMigrationService().executeMigrationPlan(
          input.plan,
          input.options
        )
        return executions
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute migration plan',
          cause: error,
        })
      }
    }),

  getMigrationHistory: protectedProcedure
    .query(async () => {
      try {
        const history = await persistenceService.getMigrationService().getMigrationHistory()
        return history
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get migration history',
          cause: error,
        })
      }
    }),

  // Disaster recovery operations
  getSystemHealth: publicProcedure
    .query(async () => {
      try {
        const health = await persistenceService.getDisasterRecoveryService().getSystemHealth()
        return health
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get system health',
          cause: error,
        })
      }
    }),

  testRecoveryScenario: protectedProcedure
    .input(z.object({
      scenarioId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const execution = await persistenceService.getDisasterRecoveryService().testRecoveryScenario(
          input.scenarioId
        )
        return execution
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to test recovery scenario',
          cause: error,
        })
      }
    }),

  // System status and maintenance
  getStatus: protectedProcedure
    .query(async () => {
      try {
        const status = await persistenceService.getStatus()
        return status
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get persistence status',
          cause: error,
        })
      }
    }),

  performHealthCheck: protectedProcedure
    .query(async () => {
      try {
        const healthCheck = await persistenceService.performHealthCheck()
        return healthCheck
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to perform health check',
          cause: error,
        })
      }
    }),

  runMaintenance: protectedProcedure
    .mutation(async () => {
      try {
        const results = await persistenceService.runMaintenance()
        return results
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to run maintenance',
          cause: error,
        })
      }
    }),

  handleEmergency: protectedProcedure
    .input(z.object({
      scenario: z.enum(['database-corruption', 'complete-system-failure']),
    }))
    .mutation(async ({ input }) => {
      try {
        const recovery = await persistenceService.handleEmergency(input.scenario)
        return recovery
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to handle emergency',
          cause: error,
        })
      }
    }),
})