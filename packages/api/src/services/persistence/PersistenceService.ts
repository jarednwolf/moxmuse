import { PrismaClient } from '@prisma/client'
import { AutoSaveService, AutoSaveConfig } from './AutoSaveService'
import { SessionPersistenceService } from './SessionPersistenceService'
import { IncrementalBackupService, BackupConfig } from './IncrementalBackupService'
import { DataMigrationService, MigrationConfig } from './DataMigrationService'
import { DisasterRecoveryService, DisasterRecoveryConfig } from './DisasterRecoveryService'

export interface PersistenceConfig {
  autoSave: AutoSaveConfig
  backup: BackupConfig
  migration: MigrationConfig
  disasterRecovery: DisasterRecoveryConfig
}

export interface PersistenceStatus {
  autoSave: {
    enabled: boolean
    pendingSaves: number
    lastSave?: Date
  }
  backup: {
    lastFullBackup?: Date
    lastIncrementalBackup?: Date
    nextScheduledBackup?: Date
    availableRestorePoints: number
  }
  migration: {
    pendingMigrations: number
    lastMigration?: Date
    migrationInProgress: boolean
  }
  disasterRecovery: {
    scenariosAvailable: number
    lastTest?: Date
    systemHealth: 'healthy' | 'degraded' | 'unhealthy'
  }
}

/**
 * Main persistence service that coordinates all data persistence and recovery functionality
 */
export class PersistenceService {
  private prisma: PrismaClient
  private config: PersistenceConfig
  
  // Sub-services
  private autoSaveService: AutoSaveService
  private sessionPersistenceService: SessionPersistenceService
  private backupService: IncrementalBackupService
  private migrationService: DataMigrationService
  private disasterRecoveryService: DisasterRecoveryService
  
  // Scheduling
  private backupScheduler?: NodeJS.Timeout
  private healthCheckScheduler?: NodeJS.Timeout

  constructor(prisma: PrismaClient, config: PersistenceConfig) {
    this.prisma = prisma
    this.config = config
    
    // Initialize sub-services
    this.autoSaveService = new AutoSaveService(prisma, config.autoSave)
    this.sessionPersistenceService = new SessionPersistenceService(prisma, this.autoSaveService)
    this.backupService = new IncrementalBackupService(prisma, config.backup)
    this.migrationService = new DataMigrationService(prisma, config.migration)
    this.disasterRecoveryService = new DisasterRecoveryService(
      prisma,
      config.disasterRecovery,
      this.backupService,
      this.migrationService
    )
  }

  /**
   * Initialize the persistence system
   */
  async initialize(): Promise<void> {
    console.log('Initializing persistence system...')
    
    try {
      // Initialize all sub-services
      await this.backupService.initialize()
      await this.migrationService.initialize()
      await this.disasterRecoveryService.initialize()
      
      // Create built-in disaster recovery scenarios
      await this.disasterRecoveryService.createBuiltInScenarios()
      
      // Start scheduled tasks
      await this.startScheduledTasks()
      
      console.log('Persistence system initialized successfully')
    } catch (error) {
      console.error('Failed to initialize persistence system:', error)
      throw error
    }
  }

  /**
   * Get auto-save service
   */
  getAutoSaveService(): AutoSaveService {
    return this.autoSaveService
  }

  /**
   * Get session persistence service
   */
  getSessionPersistenceService(): SessionPersistenceService {
    return this.sessionPersistenceService
  }

  /**
   * Get backup service
   */
  getBackupService(): IncrementalBackupService {
    return this.backupService
  }

  /**
   * Get migration service
   */
  getMigrationService(): DataMigrationService {
    return this.migrationService
  }

  /**
   * Get disaster recovery service
   */
  getDisasterRecoveryService(): DisasterRecoveryService {
    return this.disasterRecoveryService
  }

  /**
   * Get overall persistence system status
   */
  async getStatus(): Promise<PersistenceStatus> {
    const [
      restorePoints,
      pendingMigrations,
      migrationHistory,
      systemHealth
    ] = await Promise.all([
      this.backupService.getRestorePoints(),
      this.migrationService.getPendingMigrations(),
      this.migrationService.getMigrationHistory(),
      this.disasterRecoveryService.getSystemHealth()
    ])

    const lastMigration = migrationHistory[0]
    const overallHealth = systemHealth.every(h => h.status === 'healthy') ? 'healthy' :
                         systemHealth.some(h => h.status === 'unhealthy') ? 'unhealthy' : 'degraded'

    return {
      autoSave: {
        enabled: true,
        pendingSaves: 0, // Would track actual pending saves
        lastSave: new Date() // Would track actual last save
      },
      backup: {
        lastFullBackup: restorePoints.find(p => p.type === 'full')?.timestamp,
        lastIncrementalBackup: restorePoints.find(p => p.type === 'incremental')?.timestamp,
        nextScheduledBackup: this.calculateNextBackupTime(),
        availableRestorePoints: restorePoints.length
      },
      migration: {
        pendingMigrations: pendingMigrations.length,
        lastMigration: lastMigration?.startTime,
        migrationInProgress: false // Would track actual migration status
      },
      disasterRecovery: {
        scenariosAvailable: 2, // Built-in scenarios
        lastTest: undefined, // Would track last test execution
        systemHealth: overallHealth
      }
    }
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy'
    components: any[]
    recommendations: string[]
  }> {
    const healthChecks = await this.disasterRecoveryService.getSystemHealth()
    const recommendations: string[] = []

    // Check backup health
    const restorePoints = await this.backupService.getRestorePoints()
    if (restorePoints.length === 0) {
      recommendations.push('No backup restore points available - create initial backup')
    } else {
      const latestBackup = restorePoints[0]
      const hoursSinceBackup = (Date.now() - latestBackup.timestamp.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceBackup > 24) {
        recommendations.push('Latest backup is over 24 hours old - consider more frequent backups')
      }
    }

    // Check pending migrations
    const pendingMigrations = await this.migrationService.getPendingMigrations()
    if (pendingMigrations.length > 0) {
      recommendations.push(`${pendingMigrations.length} pending migrations - review and apply if needed`)
    }

    // Determine overall health
    const unhealthyComponents = healthChecks.filter(h => h.status === 'unhealthy')
    const degradedComponents = healthChecks.filter(h => h.status === 'degraded')
    
    const overall = unhealthyComponents.length > 0 ? 'unhealthy' :
                   degradedComponents.length > 0 ? 'degraded' : 'healthy'

    return {
      overall,
      components: healthChecks,
      recommendations
    }
  }

  /**
   * Run automated maintenance tasks
   */
  async runMaintenance(): Promise<{
    backupResults: any[]
    cleanupResults: any
    testResults: any[]
  }> {
    console.log('Running automated maintenance tasks...')

    const results = {
      backupResults: [] as any[],
      cleanupResults: null as any,
      testResults: [] as any[]
    }

    try {
      // Run incremental backup
      const incrementalBackup = await this.backupService.createIncrementalBackup()
      results.backupResults.push(incrementalBackup)

      // Clean up old backups
      const cleanupResult = await this.backupService.cleanupOldBackups()
      results.cleanupResults = cleanupResult

      // Clean up old sessions
      const sessionCleanup = await this.sessionPersistenceService.cleanupOldSessions()
      results.cleanupResults.sessionsDeleted = sessionCleanup

      // Run automated backup tests
      const testResults = await this.backupService.runAutomatedTests()
      results.testResults = testResults

      console.log('Automated maintenance completed successfully')
    } catch (error) {
      console.error('Automated maintenance failed:', error)
      throw error
    }

    return results
  }

  /**
   * Emergency procedures for critical failures
   */
  async handleEmergency(scenario: 'database-corruption' | 'complete-system-failure'): Promise<any> {
    console.log(`Handling emergency scenario: ${scenario}`)
    
    try {
      // Execute disaster recovery
      const recovery = await this.disasterRecoveryService.executeRecovery(scenario, {
        dryRun: false,
        skipValidation: false,
        continueOnError: false
      })

      return recovery
    } catch (error) {
      console.error(`Emergency recovery failed for scenario ${scenario}:`, error)
      throw error
    }
  }

  /**
   * Shutdown the persistence system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down persistence system...')

    try {
      // Clear scheduled tasks
      if (this.backupScheduler) {
        clearInterval(this.backupScheduler)
      }
      if (this.healthCheckScheduler) {
        clearInterval(this.healthCheckScheduler)
      }

      // Shutdown auto-save service (force save pending operations)
      await this.autoSaveService.shutdown()

      console.log('Persistence system shutdown completed')
    } catch (error) {
      console.error('Error during persistence system shutdown:', error)
    }
  }

  /**
   * Private helper methods
   */
  private async startScheduledTasks(): Promise<void> {
    // Schedule incremental backups
    const backupInterval = this.config.backup.incrementalIntervalHours * 60 * 60 * 1000
    this.backupScheduler = setInterval(async () => {
      try {
        await this.backupService.createIncrementalBackup()
      } catch (error) {
        console.error('Scheduled backup failed:', error)
      }
    }, backupInterval)

    // Schedule health checks
    this.healthCheckScheduler = setInterval(async () => {
      try {
        const health = await this.performHealthCheck()
        if (health.overall !== 'healthy') {
          console.warn(`System health check: ${health.overall}`, health.recommendations)
        }
      } catch (error) {
        console.error('Health check failed:', error)
      }
    }, 5 * 60 * 1000) // Every 5 minutes

    // Schedule full backups
    const fullBackupInterval = this.config.backup.fullBackupIntervalDays * 24 * 60 * 60 * 1000
    setTimeout(async () => {
      setInterval(async () => {
        try {
          await this.backupService.createFullBackup()
        } catch (error) {
          console.error('Scheduled full backup failed:', error)
        }
      }, fullBackupInterval)
    }, this.calculateTimeUntilNextFullBackup())

    console.log('Scheduled tasks started')
  }

  private calculateNextBackupTime(): Date {
    const now = new Date()
    const intervalMs = this.config.backup.incrementalIntervalHours * 60 * 60 * 1000
    return new Date(now.getTime() + intervalMs)
  }

  private calculateTimeUntilNextFullBackup(): number {
    // Calculate time until next full backup (e.g., daily at 2 AM)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(2, 0, 0, 0) // 2 AM
    
    return tomorrow.getTime() - now.getTime()
  }
}

/**
 * Factory function to create persistence service with default configuration
 */
export function createPersistenceService(
  prisma: PrismaClient,
  overrides: Partial<PersistenceConfig> = {}
): PersistenceService {
  const defaultConfig: PersistenceConfig = {
    autoSave: {
      saveIntervalMs: 30000, // 30 seconds
      maxRetries: 3,
      conflictResolutionStrategy: 'client-wins'
    },
    backup: {
      backupDirectory: './backups',
      retentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: false,
      maxBackupSizeMB: 1000,
      incrementalIntervalHours: 6,
      fullBackupIntervalDays: 1
    },
    migration: {
      migrationsDirectory: './migrations',
      backupBeforeMigration: true,
      rollbackEnabled: true,
      dryRunEnabled: false,
      maxRollbackSteps: 5
    },
    disasterRecovery: {
      recoveryProceduresPath: './disaster-recovery',
      maxRecoveryTimeObjective: 60, // 1 hour
      maxRecoveryPointObjective: 15, // 15 minutes
      alertingEnabled: true,
      emergencyContactsPath: './emergency-contacts.json',
      runbookPath: './disaster-recovery-runbook.md'
    }
  }

  const config = {
    ...defaultConfig,
    ...overrides,
    autoSave: { ...defaultConfig.autoSave, ...overrides.autoSave },
    backup: { ...defaultConfig.backup, ...overrides.backup },
    migration: { ...defaultConfig.migration, ...overrides.migration },
    disasterRecovery: { ...defaultConfig.disasterRecovery, ...overrides.disasterRecovery }
  }

  return new PersistenceService(prisma, config)
}