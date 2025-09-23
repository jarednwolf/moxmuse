import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface MigrationConfig {
  migrationsDirectory: string
  backupBeforeMigration: boolean
  rollbackEnabled: boolean
  dryRunEnabled: boolean
  maxRollbackSteps: number
}

export interface Migration {
  id: string
  name: string
  description: string
  version: string
  upScript: string
  downScript?: string
  dependencies: string[]
  estimatedDuration: number
  riskLevel: 'low' | 'medium' | 'high'
  requiresDowntime: boolean
  createdAt: Date
}

export interface MigrationExecution {
  id: string
  migrationId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'
  startTime: Date
  endTime?: Date
  duration?: number
  error?: string
  backupId?: string
  dryRun: boolean
  affectedTables: string[]
  affectedRecords: number
  rollbackAvailable: boolean
}

export interface MigrationPlan {
  migrations: Migration[]
  totalEstimatedDuration: number
  highestRiskLevel: 'low' | 'medium' | 'high'
  requiresDowntime: boolean
  backupRequired: boolean
  warnings: string[]
}

export interface RollbackPlan {
  executionId: string
  rollbackSteps: Migration[]
  estimatedDuration: number
  dataLossRisk: boolean
  warnings: string[]
}

export class DataMigrationService {
  private prisma: PrismaClient
  private config: MigrationConfig
  private availableMigrations: Map<string, Migration> = new Map()

  constructor(prisma: PrismaClient, config: MigrationConfig) {
    this.prisma = prisma
    this.config = config
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    // Ensure migrations directory exists
    await fs.mkdir(this.config.migrationsDirectory, { recursive: true })
    
    // Create migration tracking table if it doesn't exist
    await this.createMigrationTables()
    
    // Load available migrations
    await this.loadAvailableMigrations()
  }

  /**
   * Create a new migration
   */
  async createMigration(
    name: string,
    description: string,
    upScript: string,
    downScript?: string,
    options: {
      dependencies?: string[]
      estimatedDuration?: number
      riskLevel?: 'low' | 'medium' | 'high'
      requiresDowntime?: boolean
    } = {}
  ): Promise<Migration> {
    const migrationId = `${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`
    const version = new Date().toISOString().split('T')[0].replace(/-/g, '')
    
    const migration: Migration = {
      id: migrationId,
      name,
      description,
      version,
      upScript,
      downScript,
      dependencies: options.dependencies || [],
      estimatedDuration: options.estimatedDuration || 60000, // 1 minute default
      riskLevel: options.riskLevel || 'medium',
      requiresDowntime: options.requiresDowntime || false,
      createdAt: new Date(),
    }

    // Save migration to file
    const migrationPath = join(this.config.migrationsDirectory, `${migrationId}.json`)
    await fs.writeFile(migrationPath, JSON.stringify(migration, null, 2))

    // Add to available migrations
    this.availableMigrations.set(migrationId, migration)

    return migration
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const executedMigrations = await this.getExecutedMigrations()
    const executedIds = new Set(executedMigrations.map(m => m.migrationId))
    
    const pending: Migration[] = []
    for (const migration of this.availableMigrations.values()) {
      if (!executedIds.has(migration.id)) {
        pending.push(migration)
      }
    }
    
    // Sort by dependencies and creation date
    return this.sortMigrationsByDependencies(pending)
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(migrationIds?: string[]): Promise<MigrationPlan> {
    let migrationsToRun: Migration[]
    
    if (migrationIds) {
      migrationsToRun = migrationIds
        .map(id => this.availableMigrations.get(id))
        .filter((m): m is Migration => m !== undefined)
    } else {
      migrationsToRun = await this.getPendingMigrations()
    }

    // Sort by dependencies
    const sortedMigrations = this.sortMigrationsByDependencies(migrationsToRun)
    
    // Calculate plan metrics
    const totalEstimatedDuration = sortedMigrations.reduce(
      (total, m) => total + m.estimatedDuration, 
      0
    )
    
    const riskLevels = sortedMigrations.map(m => m.riskLevel)
    const highestRiskLevel = riskLevels.includes('high') ? 'high' 
      : riskLevels.includes('medium') ? 'medium' 
      : 'low'
    
    const requiresDowntime = sortedMigrations.some(m => m.requiresDowntime)
    const backupRequired = this.config.backupBeforeMigration || 
      sortedMigrations.some(m => m.riskLevel === 'high')

    // Generate warnings
    const warnings: string[] = []
    if (requiresDowntime) {
      warnings.push('Some migrations require system downtime')
    }
    if (highestRiskLevel === 'high') {
      warnings.push('High-risk migrations detected - extra caution required')
    }
    if (totalEstimatedDuration > 300000) { // 5 minutes
      warnings.push('Migration plan will take more than 5 minutes to complete')
    }

    return {
      migrations: sortedMigrations,
      totalEstimatedDuration,
      highestRiskLevel,
      requiresDowntime,
      backupRequired,
      warnings,
    }
  }

  /**
   * Execute migration plan
   */
  async executeMigrationPlan(
    plan: MigrationPlan,
    options: {
      dryRun?: boolean
      createBackup?: boolean
      stopOnError?: boolean
    } = {}
  ): Promise<MigrationExecution[]> {
    const executions: MigrationExecution[] = []
    const dryRun = options.dryRun || this.config.dryRunEnabled
    
    console.log(`${dryRun ? 'DRY RUN: ' : ''}Executing migration plan with ${plan.migrations.length} migrations`)

    // Create backup if required
    let backupId: string | undefined
    if ((options.createBackup || plan.backupRequired) && !dryRun) {
      console.log('Creating backup before migration...')
      // This would integrate with the backup service
      backupId = `pre-migration-${Date.now()}`
    }

    // Execute migrations in order
    for (const migration of plan.migrations) {
      const execution = await this.executeMigration(migration, {
        dryRun,
        backupId,
      })
      
      executions.push(execution)
      
      // Stop on error if configured
      if (execution.status === 'failed' && options.stopOnError !== false) {
        console.error(`Migration failed: ${migration.id}. Stopping execution.`)
        break
      }
    }

    return executions
  }

  /**
   * Execute a single migration
   */
  async executeMigration(
    migration: Migration,
    options: {
      dryRun?: boolean
      backupId?: string
    } = {}
  ): Promise<MigrationExecution> {
    const executionId = `exec-${migration.id}-${Date.now()}`
    const dryRun = options.dryRun || false
    
    const execution: MigrationExecution = {
      id: executionId,
      migrationId: migration.id,
      status: 'pending',
      startTime: new Date(),
      dryRun,
      backupId: options.backupId,
      affectedTables: [],
      affectedRecords: 0,
      rollbackAvailable: !!migration.downScript,
    }

    try {
      console.log(`${dryRun ? 'DRY RUN: ' : ''}Executing migration: ${migration.name}`)
      
      execution.status = 'running'
      await this.saveMigrationExecution(execution)

      // Parse and analyze the migration script
      const statements = this.parseSQLStatements(migration.upScript)
      execution.affectedTables = this.extractAffectedTables(statements)

      if (dryRun) {
        // Validate SQL syntax and simulate execution
        await this.validateMigrationScript(migration.upScript)
        execution.affectedRecords = await this.estimateAffectedRecords(statements)
        console.log(`DRY RUN: Migration would affect ${execution.affectedRecords} records in tables: ${execution.affectedTables.join(', ')}`)
      } else {
        // Execute the actual migration
        const result = await this.executeMigrationScript(migration.upScript)
        execution.affectedRecords = result.affectedRecords
      }

      execution.status = 'completed'
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()

      console.log(`${dryRun ? 'DRY RUN: ' : ''}Migration completed: ${migration.name} (${execution.duration}ms)`)

    } catch (error) {
      execution.status = 'failed'
      execution.error = error instanceof Error ? error.message : 'Unknown error'
      execution.endTime = new Date()
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime()

      console.error(`Migration failed: ${migration.name}`, error)
    }

    await this.saveMigrationExecution(execution)
    return execution
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(executionId: string): Promise<MigrationExecution> {
    const originalExecution = await this.getMigrationExecution(executionId)
    if (!originalExecution) {
      throw new Error(`Migration execution not found: ${executionId}`)
    }

    if (!originalExecution.rollbackAvailable) {
      throw new Error(`Migration ${originalExecution.migrationId} does not support rollback`)
    }

    const migration = this.availableMigrations.get(originalExecution.migrationId)
    if (!migration || !migration.downScript) {
      throw new Error(`Migration or rollback script not found: ${originalExecution.migrationId}`)
    }

    const rollbackExecutionId = `rollback-${executionId}-${Date.now()}`
    
    const rollbackExecution: MigrationExecution = {
      id: rollbackExecutionId,
      migrationId: migration.id,
      status: 'running',
      startTime: new Date(),
      dryRun: false,
      affectedTables: originalExecution.affectedTables,
      affectedRecords: 0,
      rollbackAvailable: false,
    }

    try {
      console.log(`Rolling back migration: ${migration.name}`)
      
      await this.saveMigrationExecution(rollbackExecution)

      // Execute rollback script
      const result = await this.executeMigrationScript(migration.downScript)
      rollbackExecution.affectedRecords = result.affectedRecords

      rollbackExecution.status = 'completed'
      rollbackExecution.endTime = new Date()
      rollbackExecution.duration = rollbackExecution.endTime.getTime() - rollbackExecution.startTime.getTime()

      // Update original execution status
      originalExecution.status = 'rolled_back'
      await this.saveMigrationExecution(originalExecution)

      console.log(`Migration rolled back successfully: ${migration.name}`)

    } catch (error) {
      rollbackExecution.status = 'failed'
      rollbackExecution.error = error instanceof Error ? error.message : 'Unknown error'
      rollbackExecution.endTime = new Date()
      rollbackExecution.duration = rollbackExecution.endTime.getTime() - rollbackExecution.startTime.getTime()

      console.error(`Rollback failed: ${migration.name}`, error)
    }

    await this.saveMigrationExecution(rollbackExecution)
    return rollbackExecution
  }

  /**
   * Create rollback plan
   */
  async createRollbackPlan(executionIds: string[]): Promise<RollbackPlan> {
    const executions = await Promise.all(
      executionIds.map(id => this.getMigrationExecution(id))
    )

    const validExecutions = executions.filter((e): e is MigrationExecution => 
      e !== null && e.status === 'completed' && e.rollbackAvailable
    )

    if (validExecutions.length === 0) {
      throw new Error('No rollbackable migrations found')
    }

    // Get migrations for rollback (in reverse order)
    const rollbackSteps: Migration[] = []
    let totalDuration = 0
    
    for (const execution of validExecutions.reverse()) {
      const migration = this.availableMigrations.get(execution.migrationId)
      if (migration && migration.downScript) {
        rollbackSteps.push(migration)
        totalDuration += migration.estimatedDuration
      }
    }

    // Analyze risks
    const dataLossRisk = rollbackSteps.some(m => 
      m.downScript?.toLowerCase().includes('drop') || 
      m.downScript?.toLowerCase().includes('delete')
    )

    const warnings: string[] = []
    if (dataLossRisk) {
      warnings.push('Rollback may result in data loss')
    }
    if (rollbackSteps.length > this.config.maxRollbackSteps) {
      warnings.push(`Rolling back ${rollbackSteps.length} migrations exceeds recommended limit`)
    }

    return {
      executionId: executionIds[0],
      rollbackSteps,
      estimatedDuration: totalDuration,
      dataLossRisk,
      warnings,
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<MigrationExecution[]> {
    return this.getExecutedMigrations()
  }

  /**
   * Private helper methods
   */
  private async createMigrationTables(): Promise<void> {
    // Create migration tracking tables
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS migration_executions (
        id TEXT PRIMARY KEY,
        migration_id TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        error TEXT,
        backup_id TEXT,
        dry_run BOOLEAN DEFAULT FALSE,
        affected_tables TEXT[],
        affected_records INTEGER DEFAULT 0,
        rollback_available BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_migration_executions_migration_id 
      ON migration_executions(migration_id)
    `

    await this.prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_migration_executions_status 
      ON migration_executions(status)
    `
  }

  private async loadAvailableMigrations(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.migrationsDirectory)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.config.migrationsDirectory, file)
          const content = await fs.readFile(filePath, 'utf8')
          const migration: Migration = JSON.parse(content)
          this.availableMigrations.set(migration.id, migration)
        }
      }
      
      console.log(`Loaded ${this.availableMigrations.size} available migrations`)
    } catch (error) {
      console.error('Failed to load migrations:', error)
    }
  }

  private sortMigrationsByDependencies(migrations: Migration[]): Migration[] {
    const sorted: Migration[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (migration: Migration) => {
      if (visiting.has(migration.id)) {
        throw new Error(`Circular dependency detected: ${migration.id}`)
      }
      if (visited.has(migration.id)) {
        return
      }

      visiting.add(migration.id)

      // Visit dependencies first
      for (const depId of migration.dependencies) {
        const dependency = migrations.find(m => m.id === depId)
        if (dependency) {
          visit(dependency)
        }
      }

      visiting.delete(migration.id)
      visited.add(migration.id)
      sorted.push(migration)
    }

    for (const migration of migrations) {
      visit(migration)
    }

    return sorted
  }

  private parseSQLStatements(script: string): string[] {
    return script
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  }

  private extractAffectedTables(statements: string[]): string[] {
    const tables = new Set<string>()
    
    for (const statement of statements) {
      const upperStmt = statement.toUpperCase()
      
      // Extract table names from various SQL operations
      const tableRegexes = [
        /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
        /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
      ]
      
      for (const regex of tableRegexes) {
        let match
        while ((match = regex.exec(upperStmt)) !== null) {
          tables.add(match[1].toLowerCase())
        }
      }
    }
    
    return Array.from(tables)
  }

  private async validateMigrationScript(script: string): Promise<void> {
    // Basic SQL validation
    const statements = this.parseSQLStatements(script)
    
    for (const statement of statements) {
      // Check for dangerous operations in production
      const upperStmt = statement.toUpperCase()
      if (upperStmt.includes('DROP DATABASE') || upperStmt.includes('TRUNCATE')) {
        throw new Error(`Dangerous operation detected: ${statement.substring(0, 50)}...`)
      }
    }
  }

  private async estimateAffectedRecords(statements: string[]): Promise<number> {
    let totalRecords = 0
    
    for (const statement of statements) {
      const upperStmt = statement.toUpperCase()
      
      if (upperStmt.includes('UPDATE') || upperStmt.includes('DELETE')) {
        // Try to estimate affected records
        const tableMatch = upperStmt.match(/(?:UPDATE|DELETE\s+FROM)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)
        if (tableMatch) {
          try {
            const result = await this.prisma.$queryRawUnsafe(
              `SELECT COUNT(*) as count FROM ${tableMatch[1]}`
            )
            if (Array.isArray(result) && result[0]) {
              totalRecords += Number(result[0].count) || 0
            }
          } catch {
            // Ignore errors in estimation
          }
        }
      }
    }
    
    return totalRecords
  }

  private async executeMigrationScript(script: string): Promise<{ affectedRecords: number }> {
    const statements = this.parseSQLStatements(script)
    let affectedRecords = 0
    
    // Execute in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        const result = await tx.$executeRawUnsafe(statement)
        if (typeof result === 'number') {
          affectedRecords += result
        }
      }
    })
    
    return { affectedRecords }
  }

  private async saveMigrationExecution(execution: MigrationExecution): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO migration_executions (
        id, migration_id, status, start_time, end_time, duration, error,
        backup_id, dry_run, affected_tables, affected_records, rollback_available
      ) VALUES (
        ${execution.id}, ${execution.migrationId}, ${execution.status}, 
        ${execution.startTime}, ${execution.endTime}, ${execution.duration}, 
        ${execution.error}, ${execution.backupId}, ${execution.dryRun},
        ${execution.affectedTables}, ${execution.affectedRecords}, 
        ${execution.rollbackAvailable}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        end_time = EXCLUDED.end_time,
        duration = EXCLUDED.duration,
        error = EXCLUDED.error,
        affected_records = EXCLUDED.affected_records
    `
  }

  private async getMigrationExecution(executionId: string): Promise<MigrationExecution | null> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM migration_executions WHERE id = ${executionId}
    `
    
    if (Array.isArray(result) && result[0]) {
      const row = result[0] as any
      return {
        id: row.id,
        migrationId: row.migration_id,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        error: row.error,
        backupId: row.backup_id,
        dryRun: row.dry_run,
        affectedTables: row.affected_tables || [],
        affectedRecords: row.affected_records || 0,
        rollbackAvailable: row.rollback_available || false,
      }
    }
    
    return null
  }

  private async getExecutedMigrations(): Promise<MigrationExecution[]> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM migration_executions 
      WHERE status IN ('completed', 'rolled_back')
      ORDER BY start_time DESC
    `
    
    if (Array.isArray(result)) {
      return result.map((row: any) => ({
        id: row.id,
        migrationId: row.migration_id,
        status: row.status,
        startTime: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        error: row.error,
        backupId: row.backup_id,
        dryRun: row.dry_run,
        affectedTables: row.affected_tables || [],
        affectedRecords: row.affected_records || 0,
        rollbackAvailable: row.rollback_available || false,
      }))
    }
    
    return []
  }
}