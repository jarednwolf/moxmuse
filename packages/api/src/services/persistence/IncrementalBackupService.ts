import { PrismaClient } from '@prisma/client'
import { promises as fs , createReadStream, createWriteStream } from 'fs'
import { join } from 'path'
import { createGzip, createGunzip } from 'zlib'
import { pipeline } from 'stream/promises'

export interface BackupConfig {
  backupDirectory: string
  retentionDays: number
  compressionEnabled: boolean
  encryptionEnabled: boolean
  encryptionKey?: string
  maxBackupSizeMB: number
  incrementalIntervalHours: number
  fullBackupIntervalDays: number
}

export interface BackupMetadata {
  id: string
  type: 'full' | 'incremental'
  timestamp: Date
  size: number
  checksum: string
  tables: string[]
  recordCount: number
  compressionRatio?: number
  encryptionEnabled: boolean
  parentBackupId?: string // For incremental backups
  status: 'in_progress' | 'completed' | 'failed' | 'corrupted'
  errorMessage?: string
}

export interface BackupRestorePoint {
  backupId: string
  timestamp: Date
  type: 'full' | 'incremental'
  canRestore: boolean
  dependencies: string[] // Required backup IDs for restoration
  description: string
}

export interface BackupTestResult {
  backupId: string
  testType: 'integrity' | 'restoration' | 'performance'
  success: boolean
  duration: number
  details: any
  timestamp: Date
}

export class IncrementalBackupService {
  private prisma: PrismaClient
  private config: BackupConfig
  private lastFullBackup?: Date
  private lastIncrementalBackup?: Date

  constructor(prisma: PrismaClient, config: BackupConfig) {
    this.prisma = prisma
    this.config = config
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    // Ensure backup directory exists
    await fs.mkdir(this.config.backupDirectory, { recursive: true })
    
    // Create metadata directory
    await fs.mkdir(join(this.config.backupDirectory, 'metadata'), { recursive: true })
    
    // Create test results directory
    await fs.mkdir(join(this.config.backupDirectory, 'test-results'), { recursive: true })
    
    // Load last backup timestamps
    await this.loadBackupHistory()
  }

  /**
   * Create a full backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = `full-${Date.now()}`
    const timestamp = new Date()
    
    console.log(`Starting full backup: ${backupId}`)
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'full',
      timestamp,
      size: 0,
      checksum: '',
      tables: [],
      recordCount: 0,
      encryptionEnabled: this.config.encryptionEnabled,
      status: 'in_progress'
    }

    try {
      // Get all tables to backup
      const tables = await this.getBackupTables()
      metadata.tables = tables

      const backupPath = join(this.config.backupDirectory, `${backupId}.sql`)
      let totalRecords = 0

      // Create backup file
      const backupData: string[] = []
      
      // Add backup header
      backupData.push(`-- Full Backup: ${backupId}`)
      backupData.push(`-- Timestamp: ${timestamp.toISOString()}`)
      backupData.push(`-- Tables: ${tables.join(', ')}`)
      backupData.push('')

      // Backup each table
      for (const table of tables) {
        console.log(`Backing up table: ${table}`)
        const tableData = await this.backupTable(table)
        backupData.push(`-- Table: ${table}`)
        backupData.push(tableData.sql)
        backupData.push('')
        totalRecords += tableData.recordCount
      }

      metadata.recordCount = totalRecords

      // Write backup file
      const backupContent = backupData.join('\n')
      
      if (this.config.compressionEnabled) {
        await this.writeCompressedFile(backupPath + '.gz', backupContent)
        metadata.size = (await fs.stat(backupPath + '.gz')).size
        metadata.compressionRatio = backupContent.length / metadata.size
      } else {
        await fs.writeFile(backupPath, backupContent, 'utf8')
        metadata.size = (await fs.stat(backupPath)).size
      }

      // Calculate checksum
      metadata.checksum = await this.calculateFileChecksum(
        this.config.compressionEnabled ? backupPath + '.gz' : backupPath
      )

      // Encrypt if enabled
      if (this.config.encryptionEnabled && this.config.encryptionKey) {
        await this.encryptFile(
          this.config.compressionEnabled ? backupPath + '.gz' : backupPath,
          this.config.encryptionKey
        )
      }

      metadata.status = 'completed'
      this.lastFullBackup = timestamp

      // Save metadata
      await this.saveBackupMetadata(metadata)

      console.log(`Full backup completed: ${backupId} (${metadata.size} bytes, ${totalRecords} records)`)
      
      return metadata

    } catch (error) {
      metadata.status = 'failed'
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.saveBackupMetadata(metadata)
      throw error
    }
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const lastFullBackup = await this.getLastFullBackup()
    if (!lastFullBackup) {
      throw new Error('No full backup found. Create a full backup first.')
    }

    const backupId = `incremental-${Date.now()}`
    const timestamp = new Date()
    const sinceTimestamp = this.lastIncrementalBackup || this.lastFullBackup || new Date(0)
    
    console.log(`Starting incremental backup: ${backupId} (since ${sinceTimestamp.toISOString()})`)
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'incremental',
      timestamp,
      size: 0,
      checksum: '',
      tables: [],
      recordCount: 0,
      encryptionEnabled: this.config.encryptionEnabled,
      parentBackupId: lastFullBackup.id,
      status: 'in_progress'
    }

    try {
      // Get tables with changes since last backup
      const changedTables = await this.getChangedTables(sinceTimestamp)
      metadata.tables = changedTables

      if (changedTables.length === 0) {
        console.log('No changes detected since last backup')
        metadata.status = 'completed'
        await this.saveBackupMetadata(metadata)
        return metadata
      }

      const backupPath = join(this.config.backupDirectory, `${backupId}.sql`)
      let totalRecords = 0

      // Create incremental backup file
      const backupData: string[] = []
      
      // Add backup header
      backupData.push(`-- Incremental Backup: ${backupId}`)
      backupData.push(`-- Timestamp: ${timestamp.toISOString()}`)
      backupData.push(`-- Since: ${sinceTimestamp.toISOString()}`)
      backupData.push(`-- Parent Backup: ${lastFullBackup.id}`)
      backupData.push(`-- Changed Tables: ${changedTables.join(', ')}`)
      backupData.push('')

      // Backup changed data from each table
      for (const table of changedTables) {
        console.log(`Backing up changes in table: ${table}`)
        const tableData = await this.backupTableChanges(table, sinceTimestamp)
        if (tableData.recordCount > 0) {
          backupData.push(`-- Table Changes: ${table}`)
          backupData.push(tableData.sql)
          backupData.push('')
          totalRecords += tableData.recordCount
        }
      }

      metadata.recordCount = totalRecords

      // Write backup file
      const backupContent = backupData.join('\n')
      
      if (this.config.compressionEnabled) {
        await this.writeCompressedFile(backupPath + '.gz', backupContent)
        metadata.size = (await fs.stat(backupPath + '.gz')).size
        metadata.compressionRatio = backupContent.length / metadata.size
      } else {
        await fs.writeFile(backupPath, backupContent, 'utf8')
        metadata.size = (await fs.stat(backupPath)).size
      }

      // Calculate checksum
      metadata.checksum = await this.calculateFileChecksum(
        this.config.compressionEnabled ? backupPath + '.gz' : backupPath
      )

      // Encrypt if enabled
      if (this.config.encryptionEnabled && this.config.encryptionKey) {
        await this.encryptFile(
          this.config.compressionEnabled ? backupPath + '.gz' : backupPath,
          this.config.encryptionKey
        )
      }

      metadata.status = 'completed'
      this.lastIncrementalBackup = timestamp

      // Save metadata
      await this.saveBackupMetadata(metadata)

      console.log(`Incremental backup completed: ${backupId} (${metadata.size} bytes, ${totalRecords} records)`)
      
      return metadata

    } catch (error) {
      metadata.status = 'failed'
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.saveBackupMetadata(metadata)
      throw error
    }
  }

  /**
   * Test backup integrity
   */
  async testBackupIntegrity(backupId: string): Promise<BackupTestResult> {
    const startTime = Date.now()
    const testResult: BackupTestResult = {
      backupId,
      testType: 'integrity',
      success: false,
      duration: 0,
      details: {},
      timestamp: new Date()
    }

    try {
      const metadata = await this.getBackupMetadata(backupId)
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${backupId}`)
      }

      // Check if backup file exists
      const backupPath = this.getBackupFilePath(backupId, metadata)
      const fileExists = await fs.access(backupPath).then(() => true).catch(() => false)
      
      if (!fileExists) {
        throw new Error(`Backup file not found: ${backupPath}`)
      }

      // Verify file size
      const fileStats = await fs.stat(backupPath)
      if (fileStats.size !== metadata.size) {
        throw new Error(`File size mismatch. Expected: ${metadata.size}, Actual: ${fileStats.size}`)
      }

      // Verify checksum
      const actualChecksum = await this.calculateFileChecksum(backupPath)
      if (actualChecksum !== metadata.checksum) {
        throw new Error(`Checksum mismatch. Expected: ${metadata.checksum}, Actual: ${actualChecksum}`)
      }

      // Test file readability
      const content = await this.readBackupFile(backupPath, metadata)
      if (!content || content.length === 0) {
        throw new Error('Backup file is empty or unreadable')
      }

      // Validate SQL syntax (basic check)
      if (!content.includes('-- Full Backup:') && !content.includes('-- Incremental Backup:')) {
        throw new Error('Invalid backup file format')
      }

      testResult.success = true
      testResult.details = {
        fileSize: fileStats.size,
        checksum: actualChecksum,
        contentLength: content.length,
        tables: metadata.tables,
        recordCount: metadata.recordCount
      }

    } catch (error) {
      testResult.success = false
      testResult.details = {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    testResult.duration = Date.now() - startTime
    await this.saveTestResult(testResult)
    
    return testResult
  }

  /**
   * Test backup restoration
   */
  async testBackupRestoration(backupId: string, testDatabaseUrl?: string): Promise<BackupTestResult> {
    const startTime = Date.now()
    const testResult: BackupTestResult = {
      backupId,
      testType: 'restoration',
      success: false,
      duration: 0,
      details: {},
      timestamp: new Date()
    }

    try {
      // This would require a test database to avoid affecting production
      // For now, we'll do a dry-run validation
      const metadata = await this.getBackupMetadata(backupId)
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${backupId}`)
      }

      // Read and validate backup content
      const backupPath = this.getBackupFilePath(backupId, metadata)
      const content = await this.readBackupFile(backupPath, metadata)

      // Parse SQL statements
      const statements = this.parseSQLStatements(content)
      
      // Validate each statement
      let validStatements = 0
      let invalidStatements = 0
      
      for (const statement of statements) {
        if (this.validateSQLStatement(statement)) {
          validStatements++
        } else {
          invalidStatements++
        }
      }

      if (invalidStatements > 0) {
        throw new Error(`Found ${invalidStatements} invalid SQL statements`)
      }

      testResult.success = true
      testResult.details = {
        totalStatements: statements.length,
        validStatements,
        invalidStatements,
        tables: metadata.tables,
        recordCount: metadata.recordCount
      }

    } catch (error) {
      testResult.success = false
      testResult.details = {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    testResult.duration = Date.now() - startTime
    await this.saveTestResult(testResult)
    
    return testResult
  }

  /**
   * Get available restore points
   */
  async getRestorePoints(): Promise<BackupRestorePoint[]> {
    const backups = await this.getAllBackups()
    const restorePoints: BackupRestorePoint[] = []

    for (const backup of backups) {
      if (backup.status !== 'completed') continue

      const dependencies: string[] = []
      
      // For incremental backups, find all required backups
      if (backup.type === 'incremental') {
        const requiredBackups = await this.getRequiredBackups(backup.id)
        dependencies.push(...requiredBackups.map(b => b.id))
      }

      restorePoints.push({
        backupId: backup.id,
        timestamp: backup.timestamp,
        type: backup.type,
        canRestore: await this.canRestore(backup.id),
        dependencies,
        description: this.generateRestorePointDescription(backup)
      })
    }

    return restorePoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<{ deleted: number; errors: string[] }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

    const allBackups = await this.getAllBackups()
    const oldBackups = allBackups.filter(backup => backup.timestamp < cutoffDate)
    
    let deleted = 0
    const errors: string[] = []

    for (const backup of oldBackups) {
      try {
        await this.deleteBackup(backup.id)
        deleted++
      } catch (error) {
        errors.push(`Failed to delete backup ${backup.id}: ${error}`)
      }
    }

    return { deleted, errors }
  }

  /**
   * Run automated backup tests
   */
  async runAutomatedTests(): Promise<BackupTestResult[]> {
    const recentBackups = await this.getRecentBackups(5) // Test last 5 backups
    const testResults: BackupTestResult[] = []

    for (const backup of recentBackups) {
      // Test integrity
      const integrityTest = await this.testBackupIntegrity(backup.id)
      testResults.push(integrityTest)

      // Test restoration if integrity passed
      if (integrityTest.success) {
        const restorationTest = await this.testBackupRestoration(backup.id)
        testResults.push(restorationTest)
      }
    }

    return testResults
  }

  /**
   * Private helper methods
   */
  private async getBackupTables(): Promise<string[]> {
    // Get all tables that should be backed up
    return [
      'users',
      'generated_decks',
      'generated_deck_cards',
      'consultation_sessions',
      'session_snapshots',
      'save_operations',
      'conflict_resolutions',
      'cards', // If storing card data locally
    ]
  }

  private async backupTable(tableName: string): Promise<{ sql: string; recordCount: number }> {
    // This is a simplified version - in production, you'd use pg_dump or similar
    const records = await this.prisma.$queryRawUnsafe(`SELECT * FROM ${tableName}`)
    
    if (!Array.isArray(records) || records.length === 0) {
      return { sql: `-- No data in table ${tableName}`, recordCount: 0 }
    }

    const columns = Object.keys(records[0])
    const values = records.map(record => 
      `(${columns.map(col => this.formatSQLValue(record[col])).join(', ')})`
    ).join(',\n  ')

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n  ${values};`
    
    return { sql, recordCount: records.length }
  }

  private async backupTableChanges(tableName: string, since: Date): Promise<{ sql: string; recordCount: number }> {
    // Get records modified since the given timestamp
    const records = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM ${tableName} WHERE updated_at > $1 OR created_at > $1`,
      since
    )
    
    if (!Array.isArray(records) || records.length === 0) {
      return { sql: `-- No changes in table ${tableName} since ${since.toISOString()}`, recordCount: 0 }
    }

    const columns = Object.keys(records[0])
    const values = records.map(record => 
      `(${columns.map(col => this.formatSQLValue(record[col])).join(', ')})`
    ).join(',\n  ')

    const sql = `-- Changes since ${since.toISOString()}\n` +
               `DELETE FROM ${tableName} WHERE id IN (${records.map(r => this.formatSQLValue(r.id)).join(', ')});\n` +
               `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n  ${values};`
    
    return { sql, recordCount: records.length }
  }

  private async getChangedTables(since: Date): Promise<string[]> {
    const tables = await this.getBackupTables()
    const changedTables: string[] = []

    for (const table of tables) {
      const hasChanges = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM ${table} WHERE updated_at > $1 OR created_at > $1 LIMIT 1`,
        since
      )
      
      if (Array.isArray(hasChanges) && hasChanges.length > 0) {
        changedTables.push(table)
      }
    }

    return changedTables
  }

  private formatSQLValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL'
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE'
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`
    }
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`
    }
    return String(value)
  }

  private async writeCompressedFile(filePath: string, content: string): Promise<void> {
    const gzip = createGzip()
    const writeStream = createWriteStream(filePath)
    
    await pipeline(
      async function* () {
        yield Buffer.from(content, 'utf8')
      },
      gzip,
      writeStream
    )
  }

  private async readBackupFile(filePath: string, metadata: BackupMetadata): Promise<string> {
    if (this.config.compressionEnabled && filePath.endsWith('.gz')) {
      const gunzip = createGunzip()
      const readStream = createReadStream(filePath)
      
      const chunks: Buffer[] = []
      await pipeline(
        readStream,
        gunzip,
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk)
          }
        }
      )
      
      return Buffer.concat(chunks).toString('utf8')
    } else {
      return await fs.readFile(filePath, 'utf8')
    }
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)
    
    for await (const chunk of stream) {
      hash.update(chunk)
    }
    
    return hash.digest('hex')
  }

  private async encryptFile(filePath: string, key: string): Promise<void> {
    // Placeholder for encryption implementation
    // In production, use proper encryption libraries
    console.log(`Encrypting file: ${filePath}`)
  }

  private getBackupFilePath(backupId: string, metadata: BackupMetadata): string {
    const extension = this.config.compressionEnabled ? '.sql.gz' : '.sql'
    return join(this.config.backupDirectory, `${backupId}${extension}`)
  }

  private parseSQLStatements(content: string): string[] {
    return content
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  }

  private validateSQLStatement(statement: string): boolean {
    // Basic SQL validation
    const validKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP']
    const upperStatement = statement.toUpperCase()
    return validKeywords.some(keyword => upperStatement.includes(keyword))
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = join(this.config.backupDirectory, 'metadata', `${metadata.id}.json`)
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataPath = join(this.config.backupDirectory, 'metadata', `${backupId}.json`)
      const content = await fs.readFile(metadataPath, 'utf8')
      const metadata = JSON.parse(content)
      
      // Ensure timestamp is a Date object
      if (metadata.timestamp && typeof metadata.timestamp === 'string') {
        metadata.timestamp = new Date(metadata.timestamp)
      }
      
      return metadata
    } catch {
      return null
    }
  }

  private async saveTestResult(result: BackupTestResult): Promise<void> {
    const resultPath = join(
      this.config.backupDirectory, 
      'test-results', 
      `${result.backupId}-${result.testType}-${Date.now()}.json`
    )
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2))
  }

  private async getAllBackups(): Promise<BackupMetadata[]> {
    try {
      const metadataDir = join(this.config.backupDirectory, 'metadata')
      const files = await fs.readdir(metadataDir)
      
      const backups: BackupMetadata[] = []
      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadata = await this.getBackupMetadata(file.replace('.json', ''))
          if (metadata) {
            // Ensure timestamp is a Date object
            if (metadata.timestamp && typeof metadata.timestamp === 'string') {
              metadata.timestamp = new Date(metadata.timestamp)
            }
            backups.push(metadata)
          }
        }
      }
      
      return backups.sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime()
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime()
        return bTime - aTime
      })
    } catch (error) {
      console.error('Failed to load backups:', error)
      return []
    }
  }

  private async getRecentBackups(count: number): Promise<BackupMetadata[]> {
    const allBackups = await this.getAllBackups()
    return allBackups.slice(0, count)
  }

  private async getLastFullBackup(): Promise<BackupMetadata | null> {
    const backups = await this.getAllBackups()
    return backups.find(b => b.type === 'full' && b.status === 'completed') || null
  }

  private async getRequiredBackups(backupId: string): Promise<BackupMetadata[]> {
    const backup = await this.getBackupMetadata(backupId)
    if (!backup || backup.type === 'full') {
      return backup ? [backup] : []
    }

    const required: BackupMetadata[] = []
    let currentBackup = backup

    while (currentBackup && currentBackup.type === 'incremental') {
      required.unshift(currentBackup)
      if (currentBackup.parentBackupId) {
        currentBackup = await this.getBackupMetadata(currentBackup.parentBackupId)
      } else {
        break
      }
    }

    if (currentBackup && currentBackup.type === 'full') {
      required.unshift(currentBackup)
    }

    return required
  }

  private async canRestore(backupId: string): Promise<boolean> {
    const requiredBackups = await this.getRequiredBackups(backupId)
    
    for (const backup of requiredBackups) {
      const filePath = this.getBackupFilePath(backup.id, backup)
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      if (!exists || backup.status !== 'completed') {
        return false
      }
    }
    
    return true
  }

  private generateRestorePointDescription(backup: BackupMetadata): string {
    const date = backup.timestamp.toLocaleDateString()
    const time = backup.timestamp.toLocaleTimeString()
    const size = (backup.size / 1024 / 1024).toFixed(2)
    
    return `${backup.type === 'full' ? 'Full' : 'Incremental'} backup from ${date} ${time} (${size} MB, ${backup.recordCount} records)`
  }

  private async deleteBackup(backupId: string): Promise<void> {
    const metadata = await this.getBackupMetadata(backupId)
    if (!metadata) return

    // Delete backup file
    const backupPath = this.getBackupFilePath(backupId, metadata)
    await fs.unlink(backupPath).catch(() => {}) // Ignore if file doesn't exist

    // Delete metadata
    const metadataPath = join(this.config.backupDirectory, 'metadata', `${backupId}.json`)
    await fs.unlink(metadataPath).catch(() => {})
  }

  private async loadBackupHistory(): Promise<void> {
    try {
      const backups = await this.getAllBackups()
      
      const lastFull = backups.find(b => b.type === 'full' && b.status === 'completed')
      const lastIncremental = backups.find(b => b.type === 'incremental' && b.status === 'completed')
      
      this.lastFullBackup = lastFull?.timestamp instanceof Date ? lastFull.timestamp : 
                           lastFull?.timestamp ? new Date(lastFull.timestamp) : undefined
      this.lastIncrementalBackup = lastIncremental?.timestamp instanceof Date ? lastIncremental.timestamp :
                                  lastIncremental?.timestamp ? new Date(lastIncremental.timestamp) : undefined
    } catch (error) {
      console.error('Failed to load backup history:', error)
      this.lastFullBackup = undefined
      this.lastIncrementalBackup = undefined
    }
  }
}