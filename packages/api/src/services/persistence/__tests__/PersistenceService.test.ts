import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PersistenceService, createPersistenceService } from '../PersistenceService'
import { promises as fs } from 'fs'
import { join } from 'path'

// Mock Prisma
const mockPrisma = {
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
  generatedDeck: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  consultationSession: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  sessionSnapshot: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
} as any

describe('PersistenceService', () => {
  let persistenceService: PersistenceService
  let testDir: string

  beforeAll(async () => {
    // Create test directory
    testDir = join(process.cwd(), 'test-persistence')
    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(join(testDir, 'backups'), { recursive: true })
    await fs.mkdir(join(testDir, 'migrations'), { recursive: true })
    await fs.mkdir(join(testDir, 'disaster-recovery'), { recursive: true })
  })

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset all mock functions
    Object.values(mockPrisma).forEach(value => {
      if (typeof value === 'function') {
        value.mockReset()
      } else if (typeof value === 'object') {
        Object.values(value).forEach(fn => {
          if (typeof fn === 'function') {
            fn.mockReset()
          }
        })
      }
    })

    // Set up default mock implementations
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    mockPrisma.$queryRawUnsafe.mockResolvedValue([])
    mockPrisma.$executeRaw.mockResolvedValue(1)
    mockPrisma.$executeRawUnsafe.mockResolvedValue(1)
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      return await fn(mockPrisma)
    })
    
    persistenceService = createPersistenceService(mockPrisma, {
      backup: {
        backupDirectory: join(testDir, 'backups'),
        retentionDays: 7,
        compressionEnabled: false,
        encryptionEnabled: false,
        maxBackupSizeMB: 100,
        incrementalIntervalHours: 1,
        fullBackupIntervalDays: 1,
      },
      migration: {
        migrationsDirectory: join(testDir, 'migrations'),
        backupBeforeMigration: false,
        rollbackEnabled: true,
        dryRunEnabled: true,
        maxRollbackSteps: 3,
      },
      disasterRecovery: {
        recoveryProceduresPath: join(testDir, 'disaster-recovery'),
        maxRecoveryTimeObjective: 30,
        maxRecoveryPointObjective: 10,
        alertingEnabled: false,
        emergencyContactsPath: join(testDir, 'emergency-contacts.json'),
        runbookPath: join(testDir, 'runbook.md'),
      },
    })

    await persistenceService.initialize()
  })

  afterEach(async () => {
    await persistenceService.shutdown()
  })

  describe('Auto-save functionality', () => {
    it('should schedule deck save successfully', async () => {
      const autoSaveService = persistenceService.getAutoSaveService()
      
      const deckData = {
        id: 'test-deck-1',
        name: 'Test Deck',
        commander: 'Test Commander',
        cards: [
          { cardId: 'card-1', quantity: 1, category: 'main' },
          { cardId: 'card-2', quantity: 2, category: 'main' },
        ],
        strategy: {
          primary: 'aggro',
          themes: ['tribal'],
        },
        metadata: {
          powerLevel: 5,
          budget: 100,
          colors: ['R', 'G'],
        },
        version: 1,
        lastModified: new Date(),
      }

      // Mock successful upsert
      mockPrisma.generatedDeck.upsert.mockResolvedValue({
        id: 'test-deck-1',
        ...deckData,
      })

      await expect(
        autoSaveService.scheduleDeckSave('user-1', 'test-deck-1', deckData)
      ).resolves.not.toThrow()
    })

    it('should handle save conflicts with client-wins strategy', async () => {
      const autoSaveService = persistenceService.getAutoSaveService()
      
      // Mock existing deck with different version
      mockPrisma.generatedDeck.findUnique.mockResolvedValue({
        id: 'test-deck-1',
        version: 2,
        checksum: 'different-checksum',
        updatedAt: new Date(),
      })

      const deckData = {
        id: 'test-deck-1',
        name: 'Test Deck',
        commander: 'Test Commander',
        cards: [],
        strategy: { primary: 'control', themes: [] },
        metadata: { powerLevel: 5, colors: [] },
        version: 1, // Lower version - conflict
        lastModified: new Date(),
      }

      // Mock successful upsert (client wins)
      mockPrisma.generatedDeck.upsert.mockResolvedValue({
        id: 'test-deck-1',
        ...deckData,
        version: 3,
      })

      await expect(
        autoSaveService.scheduleDeckSave('user-1', 'test-deck-1', deckData)
      ).resolves.not.toThrow()
    })

    it('should force save immediately', async () => {
      const autoSaveService = persistenceService.getAutoSaveService()
      
      // Mock successful save
      mockPrisma.generatedDeck.upsert.mockResolvedValue({
        id: 'test-deck-1',
      })

      await expect(
        autoSaveService.forceSave('deck', 'test-deck-1')
      ).resolves.not.toThrow()
    })
  })

  describe('Session persistence', () => {
    it('should create new consultation session', async () => {
      const sessionService = persistenceService.getSessionPersistenceService()
      
      mockPrisma.consultationSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        currentStep: 0,
        totalSteps: 10,
        responses: {},
        preferences: {},
        status: 'in_progress',
        version: 1,
        checksum: 'test-checksum',
        autoSaveEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockPrisma.sessionSnapshot.create.mockResolvedValue({
        id: 1,
        sessionId: 'session-1',
        step: 0,
        stepData: {},
        timestamp: new Date(),
        isCheckpoint: true,
      })

      const session = await sessionService.createSession('user-1', 10, {
        commander: 'Test Commander'
      })

      expect(session).toBeDefined()
      expect(session.userId).toBe('user-1')
      expect(session.totalSteps).toBe(10)
      expect(session.status).toBe('in_progress')
      expect(mockPrisma.consultationSession.create).toHaveBeenCalled()
    })

    it('should update session with new step data', async () => {
      const sessionService = persistenceService.getSessionPersistenceService()
      
      // Mock existing session
      mockPrisma.consultationSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        currentStep: 0,
        totalSteps: 10,
        responses: {},
        preferences: { commander: 'Test Commander' },
        status: 'in_progress',
        version: 1,
        checksum: 'test-checksum',
        autoSaveEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockPrisma.sessionSnapshot.create.mockResolvedValue({
        id: 2,
        sessionId: 'session-1',
        step: 1,
        stepData: { strategy: 'aggro' },
        timestamp: new Date(),
        isCheckpoint: false,
      })

      // Mock the auto-save service call
      const autoSaveService = persistenceService.getAutoSaveService()
      vi.spyOn(autoSaveService, 'scheduleSessionSave').mockResolvedValue()

      const updatedSession = await sessionService.updateSession(
        'session-1',
        1,
        { strategy: 'aggro' },
        { powerLevel: 5 }
      )

      expect(updatedSession.currentStep).toBe(1)
      expect(updatedSession.responses[1]).toEqual({ strategy: 'aggro' })
      expect(updatedSession.preferences.powerLevel).toBe(5)
      expect(mockPrisma.sessionSnapshot.create).toHaveBeenCalled()
    })

    it('should get resumable sessions for user', async () => {
      const sessionService = persistenceService.getSessionPersistenceService()
      
      const mockSessions = [
        {
          id: 'session-1',
          userId: 'user-1',
          currentStep: 5,
          totalSteps: 10,
          responses: {},
          preferences: {},
          status: 'in_progress',
          version: 1,
          checksum: 'test-checksum',
          autoSaveEnabled: true,
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
          updatedAt: new Date(Date.now() - 60000),
        },
        {
          id: 'session-2',
          userId: 'user-1',
          currentStep: 10,
          totalSteps: 10,
          responses: {},
          preferences: {},
          status: 'completed',
          version: 1,
          checksum: 'test-checksum',
          autoSaveEnabled: true,
          createdAt: new Date(Date.now() - 120000), // 2 minutes ago
          updatedAt: new Date(Date.now() - 120000),
        },
      ]

      mockPrisma.consultationSession.findMany.mockResolvedValue(mockSessions)

      const resumableSessions = await sessionService.getResumableSessions('user-1')

      expect(resumableSessions).toHaveLength(1) // Only in_progress session should be resumable
      expect(resumableSessions[0].session.id).toBe('session-1')
      expect(resumableSessions[0].canResume).toBe(true)
      expect(resumableSessions[0].completionPercentage).toBe(50)
    })

    it('should restore session to previous step', async () => {
      const sessionService = persistenceService.getSessionPersistenceService()
      
      // Mock existing session
      mockPrisma.consultationSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        currentStep: 5,
        totalSteps: 10,
        responses: { 1: 'step1', 2: 'step2', 3: 'step3', 4: 'step4', 5: 'step5' },
        preferences: {},
        status: 'in_progress',
        version: 1,
        checksum: 'test-checksum',
        autoSaveEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Mock session snapshots
      mockPrisma.sessionSnapshot.findMany.mockResolvedValue([
        { sessionId: 'session-1', step: 1, stepData: 'step1', timestamp: new Date(), isCheckpoint: false },
        { sessionId: 'session-1', step: 2, stepData: 'step2', timestamp: new Date(), isCheckpoint: false },
        { sessionId: 'session-1', step: 3, stepData: 'step3', timestamp: new Date(), isCheckpoint: true },
      ])

      mockPrisma.consultationSession.update.mockResolvedValue({
        id: 'session-1',
        currentStep: 3,
        responses: { 1: 'step1', 2: 'step2', 3: 'step3' },
        version: 2,
      })

      const restoredSession = await sessionService.restoreToStep('session-1', 3)

      expect(restoredSession.currentStep).toBe(3)
      expect(Object.keys(restoredSession.responses)).toHaveLength(3)
      expect(mockPrisma.consultationSession.update).toHaveBeenCalled()
    })
  })

  describe('Backup system', () => {
    it('should create full backup', async () => {
      const backupService = persistenceService.getBackupService()
      
      // Mock database queries for backup
      mockPrisma.$queryRawUnsafe.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM')) {
          return Promise.resolve([
            { id: 1, name: 'test', created_at: new Date() },
            { id: 2, name: 'test2', created_at: new Date() },
          ])
        }
        return Promise.resolve([])
      })

      const backup = await backupService.createFullBackup()

      expect(backup).toBeDefined()
      expect(backup.type).toBe('full')
      expect(backup.status).toBe('completed')
      expect(backup.recordCount).toBeGreaterThan(0)
      expect(backup.size).toBeGreaterThan(0)
    })

    it('should create incremental backup', async () => {
      const backupService = persistenceService.getBackupService()
      
      // First create a full backup
      mockPrisma.$queryRawUnsafe.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM')) {
          return Promise.resolve([
            { id: 1, name: 'test', created_at: new Date() },
          ])
        }
        return Promise.resolve([])
      })

      await backupService.createFullBackup()

      // Now create incremental backup
      mockPrisma.$queryRawUnsafe.mockImplementation((query: string) => {
        if (query.includes('updated_at >') || query.includes('created_at >')) {
          return Promise.resolve([
            { id: 2, name: 'new-record', created_at: new Date() },
          ])
        }
        if (query.includes('SELECT 1 FROM')) {
          return Promise.resolve([{ '?column?': 1 }])
        }
        return Promise.resolve([])
      })

      const incrementalBackup = await backupService.createIncrementalBackup()

      expect(incrementalBackup).toBeDefined()
      expect(incrementalBackup.type).toBe('incremental')
      expect(incrementalBackup.status).toBe('completed')
    })

    it('should test backup integrity', async () => {
      const backupService = persistenceService.getBackupService()
      
      // Create a backup first
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, name: 'test', created_at: new Date() },
      ])

      const backup = await backupService.createFullBackup()
      
      // Test the backup integrity
      const testResult = await backupService.testBackupIntegrity(backup.id)

      expect(testResult).toBeDefined()
      expect(testResult.success).toBe(true)
      expect(testResult.testType).toBe('integrity')
      expect(testResult.details.fileSize).toBeGreaterThan(0)
    })

    it('should get available restore points', async () => {
      const backupService = persistenceService.getBackupService()
      
      // Create some backups
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, name: 'test', created_at: new Date() },
      ])

      await backupService.createFullBackup()
      
      // Mock incremental backup with changes
      mockPrisma.$queryRawUnsafe.mockImplementation((query: string) => {
        if (query.includes('updated_at >') || query.includes('created_at >')) {
          return Promise.resolve([
            { id: 2, name: 'new-record', created_at: new Date() },
          ])
        }
        if (query.includes('SELECT 1 FROM')) {
          return Promise.resolve([{ '?column?': 1 }])
        }
        return Promise.resolve([])
      })
      
      await backupService.createIncrementalBackup()

      const restorePoints = await backupService.getRestorePoints()

      expect(restorePoints).toBeDefined()
      expect(restorePoints.length).toBeGreaterThan(0)
      expect(restorePoints[0]).toHaveProperty('backupId')
      expect(restorePoints[0]).toHaveProperty('timestamp')
      expect(restorePoints[0]).toHaveProperty('canRestore')
    })
  })

  describe('Migration system', () => {
    it('should create migration', async () => {
      const migrationService = persistenceService.getMigrationService()
      
      const migration = await migrationService.createMigration(
        'test-migration',
        'Test migration for unit tests',
        'ALTER TABLE test ADD COLUMN new_field TEXT;',
        'ALTER TABLE test DROP COLUMN new_field;',
        {
          estimatedDuration: 30000,
          riskLevel: 'low',
          requiresDowntime: false,
        }
      )

      expect(migration).toBeDefined()
      expect(migration.name).toBe('test-migration')
      expect(migration.riskLevel).toBe('low')
      expect(migration.upScript).toContain('ALTER TABLE')
      expect(migration.downScript).toContain('DROP COLUMN')
    })

    it('should get pending migrations', async () => {
      const migrationService = persistenceService.getMigrationService()
      
      // Mock no executed migrations
      mockPrisma.$queryRaw.mockResolvedValue([])

      // Create a test migration
      await migrationService.createMigration(
        'pending-migration',
        'Pending test migration',
        'CREATE TABLE test_table (id SERIAL PRIMARY KEY);'
      )

      const pendingMigrations = await migrationService.getPendingMigrations()

      expect(pendingMigrations).toBeDefined()
      expect(pendingMigrations.length).toBeGreaterThan(0)
      // Check that we have at least one migration with the expected name
      const hasPendingMigration = pendingMigrations.some(m => m.name === 'pending-migration')
      expect(hasPendingMigration).toBe(true)
    })

    it('should create and execute migration plan', async () => {
      const migrationService = persistenceService.getMigrationService()
      
      // Mock no executed migrations
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.$executeRawUnsafe.mockResolvedValue(1)

      // Create test migration
      const migration = await migrationService.createMigration(
        'plan-test-migration',
        'Migration for plan testing',
        'CREATE TABLE plan_test (id SERIAL PRIMARY KEY);',
        'DROP TABLE plan_test;'
      )

      const plan = await migrationService.createMigrationPlan([migration.id])

      expect(plan).toBeDefined()
      expect(plan.migrations).toHaveLength(1)
      expect(plan.totalEstimatedDuration).toBeGreaterThan(0)

      // Execute the plan in dry run mode
      const executions = await migrationService.executeMigrationPlan(plan, {
        dryRun: true,
        stopOnError: true,
      })

      expect(executions).toBeDefined()
      expect(executions).toHaveLength(1)
      expect(executions[0].status).toBe('completed')
      expect(executions[0].dryRun).toBe(true)
    })
  })

  describe('Disaster recovery', () => {
    it('should get system health', async () => {
      const disasterRecoveryService = persistenceService.getDisasterRecoveryService()
      
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])

      const healthChecks = await disasterRecoveryService.getSystemHealth()

      expect(healthChecks).toBeDefined()
      expect(healthChecks.length).toBeGreaterThan(0)
      
      const dbHealth = healthChecks.find(h => h.component === 'Database')
      expect(dbHealth).toBeDefined()
      expect(dbHealth?.status).toBe('healthy')
    })

    it('should test disaster recovery scenario', async () => {
      const disasterRecoveryService = persistenceService.getDisasterRecoveryService()
      
      // Mock successful command execution
      vi.mock('child_process', () => ({
        exec: vi.fn((cmd, callback) => {
          callback(null, { stdout: 'success', stderr: '' })
        })
      }))

      const execution = await disasterRecoveryService.testRecoveryScenario('database-corruption')

      expect(execution).toBeDefined()
      expect(execution.scenarioId).toBe('database-corruption')
      expect(execution.status).toBe('completed')
      expect(execution.totalSteps).toBeGreaterThan(0)
    })
  })

  describe('System status and maintenance', () => {
    it('should get persistence status', async () => {
      // Mock restore points
      mockPrisma.$queryRawUnsafe.mockResolvedValue([])

      const status = await persistenceService.getStatus()

      expect(status).toBeDefined()
      expect(status.autoSave).toBeDefined()
      expect(status.backup).toBeDefined()
      expect(status.migration).toBeDefined()
      expect(status.disasterRecovery).toBeDefined()
    })

    it('should perform health check', async () => {
      // Mock successful database query
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
      mockPrisma.$queryRawUnsafe.mockResolvedValue([])

      const healthCheck = await persistenceService.performHealthCheck()

      expect(healthCheck).toBeDefined()
      expect(healthCheck.overall).toBeDefined()
      expect(healthCheck.components).toBeDefined()
      expect(healthCheck.recommendations).toBeDefined()
    })

    it('should run maintenance tasks', async () => {
      // Mock database operations
      mockPrisma.$queryRawUnsafe.mockImplementation((query: string) => {
        if (query.includes('updated_at >') || query.includes('created_at >')) {
          return Promise.resolve([])
        }
        if (query.includes('SELECT 1 FROM')) {
          return Promise.resolve([])
        }
        return Promise.resolve([])
      })

      mockPrisma.consultationSession.deleteMany.mockResolvedValue({ count: 0 })

      const results = await persistenceService.runMaintenance()

      expect(results).toBeDefined()
      expect(results.backupResults).toBeDefined()
      expect(results.cleanupResults).toBeDefined()
      expect(results.testResults).toBeDefined()
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create a new persistence service with failing database
      const failingPrisma = {
        ...mockPrisma,
        $queryRaw: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      }
      
      const failingService = createPersistenceService(failingPrisma as any, {
        backup: { backupDirectory: join(testDir, 'backups'), retentionDays: 7, compressionEnabled: false, encryptionEnabled: false, maxBackupSizeMB: 100, incrementalIntervalHours: 1, fullBackupIntervalDays: 1 },
        migration: { migrationsDirectory: join(testDir, 'migrations'), backupBeforeMigration: false, rollbackEnabled: true, dryRunEnabled: true, maxRollbackSteps: 3 },
        disasterRecovery: { recoveryProceduresPath: join(testDir, 'disaster-recovery'), maxRecoveryTimeObjective: 30, maxRecoveryPointObjective: 10, alertingEnabled: false, emergencyContactsPath: join(testDir, 'emergency-contacts.json'), runbookPath: join(testDir, 'runbook.md') },
      })
      
      await failingService.initialize()

      // The health check should handle the database error gracefully
      const healthCheck = await failingService.performHealthCheck()

      expect(healthCheck.overall).toBe('unhealthy')
      expect(healthCheck.components.some(c => c.status === 'unhealthy')).toBe(true)
      
      await failingService.shutdown()
    })

    it('should handle backup failures gracefully', async () => {
      const backupService = persistenceService.getBackupService()
      
      // Mock database error during backup
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Backup failed'))

      await expect(backupService.createFullBackup()).rejects.toThrow('Backup failed')
    })

    it('should handle migration failures gracefully', async () => {
      const migrationService = persistenceService.getMigrationService()
      
      // Mock migration execution error
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('Migration failed'))

      const migration = await migrationService.createMigration(
        'failing-migration',
        'Migration that will fail',
        'INVALID SQL STATEMENT;'
      )

      const execution = await migrationService.executeMigration(migration)

      expect(execution.status).toBe('failed')
      expect(execution.error).toContain('Migration failed')
    })
  })
})