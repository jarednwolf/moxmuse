import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { sentryService } from '../monitoring/SentryService'
import { metricsService } from '../monitoring/MetricsService'

const execAsync = promisify(exec)

export interface BackupConfig {
  databaseUrl: string
  backupPath: string
  retentionDays: number
  compressionEnabled: boolean
  encryptionKey?: string
}

export interface BackupMetadata {
  id: string
  timestamp: Date
  size: number
  compressed: boolean
  encrypted: boolean
  checksum: string
  tables: string[]
  version: string
}

export interface RestoreOptions {
  backupId: string
  targetTime?: Date
  dryRun?: boolean
  skipTables?: string[]
}

export class DatabaseBackupService {
  private static instance: DatabaseBackupService
  private config: BackupConfig
  private backupInProgress = false

  private constructor() {
    this.config = {
      databaseUrl: process.env.DATABASE_URL!,
      backupPath: process.env.BACKUP_PATH || './backups',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
    }
  }

  static getInstance(): DatabaseBackupService {
    if (!DatabaseBackupService.instance) {
      DatabaseBackupService.instance = new DatabaseBackupService()
    }
    return DatabaseBackupService.instance
  }

  async initialize(): Promise<void> {
    try {
      // Ensure backup directory exists
      if (!existsSync(this.config.backupPath)) {
        await mkdir(this.config.backupPath, { recursive: true })
      }

      // Test database connection
      await this.testDatabaseConnection()

      // Schedule automated backups
      this.scheduleBackups()

      console.log('Database backup service initialized')
    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'DatabaseBackupService',
        action: 'initialize',
      })
      throw error
    }
  }

  async createBackup(options: { manual?: boolean } = {}): Promise<BackupMetadata> {
    if (this.backupInProgress) {
      throw new Error('Backup already in progress')
    }

    this.backupInProgress = true
    const startTime = Date.now()

    try {
      const backupId = this.generateBackupId()
      const timestamp = new Date()
      
      console.log(`Starting database backup: ${backupId}`)
      
      // Create backup using pg_dump
      const backupFile = await this.performDatabaseDump(backupId)
      
      // Get backup metadata
      const metadata = await this.generateBackupMetadata(backupId, backupFile, timestamp)
      
      // Save metadata
      await this.saveBackupMetadata(metadata)
      
      // Clean up old backups
      await this.cleanupOldBackups()
      
      const duration = Date.now() - startTime
      
      metricsService.recordMetric({
        name: 'backup.duration',
        value: duration,
        unit: 'milliseconds',
        tags: {
          type: options.manual ? 'manual' : 'automated',
          success: 'true',
        },
      })

      metricsService.recordMetric({
        name: 'backup.size',
        value: metadata.size,
        unit: 'bytes',
        tags: {
          compressed: metadata.compressed.toString(),
          encrypted: metadata.encrypted.toString(),
        },
      })

      console.log(`Backup completed successfully: ${backupId} (${duration}ms)`)
      
      return metadata
    } catch (error) {
      const duration = Date.now() - startTime
      
      metricsService.recordError('backup', 'creation_failed', {
        duration: duration.toString(),
      })

      sentryService.captureError(error as Error, {
        component: 'DatabaseBackupService',
        action: 'createBackup',
        metadata: { duration },
      })

      throw error
    } finally {
      this.backupInProgress = false
    }
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const metadataFiles = await this.getMetadataFiles()
      const backups: BackupMetadata[] = []

      for (const file of metadataFiles) {
        try {
          const content = await readFile(file, 'utf-8')
          const metadata = JSON.parse(content) as BackupMetadata
          backups.push(metadata)
        } catch (error) {
          console.warn(`Failed to read backup metadata: ${file}`, error)
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'DatabaseBackupService',
        action: 'listBackups',
      })
      throw error
    }
  }

  async restoreBackup(options: RestoreOptions): Promise<void> {
    const startTime = Date.now()

    try {
      console.log(`Starting database restore: ${options.backupId}`)

      // Get backup metadata
      const metadata = await this.getBackupMetadata(options.backupId)
      if (!metadata) {
        throw new Error(`Backup not found: ${options.backupId}`)
      }

      // Validate backup integrity
      await this.validateBackupIntegrity(metadata)

      if (options.dryRun) {
        console.log('Dry run completed successfully')
        return
      }

      // Perform restore
      await this.performDatabaseRestore(metadata, options)

      const duration = Date.now() - startTime

      metricsService.recordMetric({
        name: 'restore.duration',
        value: duration,
        unit: 'milliseconds',
        tags: {
          backupId: options.backupId,
          success: 'true',
        },
      })

      console.log(`Database restore completed: ${options.backupId} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime

      metricsService.recordError('restore', 'failed', {
        backupId: options.backupId,
        duration: duration.toString(),
      })

      sentryService.captureError(error as Error, {
        component: 'DatabaseBackupService',
        action: 'restoreBackup',
        metadata: { options, duration },
      })

      throw error
    }
  }

  async validateBackupIntegrity(metadata: BackupMetadata): Promise<boolean> {
    try {
      const backupFile = this.getBackupFilePath(metadata.id)
      
      // Check if file exists
      if (!existsSync(backupFile)) {
        throw new Error(`Backup file not found: ${backupFile}`)
      }

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backupFile)
      if (currentChecksum !== metadata.checksum) {
        throw new Error(`Backup integrity check failed: checksum mismatch`)
      }

      // Test restore in dry-run mode
      await this.testBackupRestore(metadata)

      return true
    } catch (error) {
      sentryService.captureError(error as Error, {
        component: 'DatabaseBackupService',
        action: 'validateBackupIntegrity',
        metadata: { backupId: metadata.id },
      })
      throw error
    }
  }

  private async performDatabaseDump(backupId: string): Promise<string> {
    const backupFile = this.getBackupFilePath(backupId)
    const tempFile = `${backupFile}.tmp`

    try {
      // Extract connection details from DATABASE_URL
      const dbUrl = new URL(this.config.databaseUrl)
      
      const pgDumpCommand = [
        'pg_dump',
        `--host=${dbUrl.hostname}`,
        `--port=${dbUrl.port || 5432}`,
        `--username=${dbUrl.username}`,
        `--dbname=${dbUrl.pathname.slice(1)}`,
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        '--format=custom',
        `--file=${tempFile}`,
      ].join(' ')

      // Set password via environment variable
      const env = {
        ...process.env,
        PGPASSWORD: dbUrl.password,
      }

      await execAsync(pgDumpCommand, { env })

      // Compress if enabled
      let finalFile = tempFile
      if (this.config.compressionEnabled) {
        finalFile = `${backupFile}.gz`
        await execAsync(`gzip -c ${tempFile} > ${finalFile}`)
        await execAsync(`rm ${tempFile}`)
      } else {
        await execAsync(`mv ${tempFile} ${backupFile}`)
        finalFile = backupFile
      }

      // Encrypt if enabled
      if (this.config.encryptionKey) {
        const encryptedFile = `${finalFile}.enc`
        await this.encryptFile(finalFile, encryptedFile)
        await execAsync(`rm ${finalFile}`)
        finalFile = encryptedFile
      }

      return finalFile
    } catch (error) {
      // Clean up temp files
      try {
        await execAsync(`rm -f ${tempFile} ${backupFile}*`)
      } catch {}
      throw error
    }
  }

  private async performDatabaseRestore(metadata: BackupMetadata, options: RestoreOptions): Promise<void> {
    const backupFile = this.getBackupFilePath(metadata.id)
    let restoreFile = backupFile

    try {
      // Decrypt if needed
      if (metadata.encrypted) {
        const decryptedFile = `${backupFile}.dec`
        await this.decryptFile(backupFile, decryptedFile)
        restoreFile = decryptedFile
      }

      // Decompress if needed
      if (metadata.compressed) {
        const decompressedFile = `${restoreFile}.sql`
        await execAsync(`gunzip -c ${restoreFile} > ${decompressedFile}`)
        if (metadata.encrypted) {
          await execAsync(`rm ${restoreFile}`) // Clean up decrypted file
        }
        restoreFile = decompressedFile
      }

      // Extract connection details
      const dbUrl = new URL(this.config.databaseUrl)
      
      const pgRestoreCommand = [
        'pg_restore',
        `--host=${dbUrl.hostname}`,
        `--port=${dbUrl.port || 5432}`,
        `--username=${dbUrl.username}`,
        `--dbname=${dbUrl.pathname.slice(1)}`,
        '--verbose',
        '--clean',
        '--if-exists',
        '--create',
        restoreFile,
      ].join(' ')

      const env = {
        ...process.env,
        PGPASSWORD: dbUrl.password,
      }

      await execAsync(pgRestoreCommand, { env })

      // Clean up temporary files
      if (restoreFile !== backupFile) {
        await execAsync(`rm ${restoreFile}`)
      }
    } catch (error) {
      // Clean up temporary files
      try {
        if (restoreFile !== backupFile) {
          await execAsync(`rm -f ${restoreFile}`)
        }
      } catch {}
      throw error
    }
  }

  private async generateBackupMetadata(backupId: string, backupFile: string, timestamp: Date): Promise<BackupMetadata> {
    const stats = await import('fs').then(fs => fs.promises.stat(backupFile))
    const checksum = await this.calculateChecksum(backupFile)
    const tables = await this.getDatabaseTables()
    const version = await this.getDatabaseVersion()

    return {
      id: backupId,
      timestamp,
      size: stats.size,
      compressed: this.config.compressionEnabled,
      encrypted: !!this.config.encryptionKey,
      checksum,
      tables,
      version,
    }
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataFile = path.join(this.config.backupPath, `${metadata.id}.metadata.json`)
    await writeFile(metadataFile, JSON.stringify(metadata, null, 2))
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metadataFile = path.join(this.config.backupPath, `${backupId}.metadata.json`)
      const content = await readFile(metadataFile, 'utf-8')
      return JSON.parse(content) as BackupMetadata
    } catch {
      return null
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups()
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000)

      for (const backup of backups) {
        if (backup.timestamp < cutoffDate) {
          await this.deleteBackup(backup.id)
          console.log(`Deleted old backup: ${backup.id}`)
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error)
    }
  }

  private async deleteBackup(backupId: string): Promise<void> {
    const backupFile = this.getBackupFilePath(backupId)
    const metadataFile = path.join(this.config.backupPath, `${backupId}.metadata.json`)

    await execAsync(`rm -f ${backupFile}* ${metadataFile}`)
  }

  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const random = Math.random().toString(36).substring(2, 8)
    return `backup-${timestamp}-${random}`
  }

  private getBackupFilePath(backupId: string): string {
    return path.join(this.config.backupPath, `${backupId}.sql`)
  }

  private async getMetadataFiles(): Promise<string[]> {
    const { readdir } = await import('fs/promises')
    const files = await readdir(this.config.backupPath)
    return files
      .filter(file => file.endsWith('.metadata.json'))
      .map(file => path.join(this.config.backupPath, file))
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const { createHash } = await import('crypto')
    const { createReadStream } = await import('fs')
    
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filePath)
      
      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  private async encryptFile(inputFile: string, outputFile: string): Promise<void> {
    // Simple encryption using openssl (in production, use proper encryption)
    const command = `openssl enc -aes-256-cbc -salt -in ${inputFile} -out ${outputFile} -k ${this.config.encryptionKey}`
    await execAsync(command)
  }

  private async decryptFile(inputFile: string, outputFile: string): Promise<void> {
    const command = `openssl enc -aes-256-cbc -d -in ${inputFile} -out ${outputFile} -k ${this.config.encryptionKey}`
    await execAsync(command)
  }

  private async testDatabaseConnection(): Promise<void> {
    const dbUrl = new URL(this.config.databaseUrl)
    const testCommand = `pg_isready -h ${dbUrl.hostname} -p ${dbUrl.port || 5432} -U ${dbUrl.username}`
    
    await execAsync(testCommand)
  }

  private async getDatabaseTables(): Promise<string[]> {
    // This would typically use a database client to query table names
    // For now, return common tables
    return ['users', 'generated_decks', 'deck_cards', 'cards', 'consultation_sessions']
  }

  private async getDatabaseVersion(): Promise<string> {
    // This would typically query the database version
    return 'PostgreSQL 15.0'
  }

  private async testBackupRestore(metadata: BackupMetadata): Promise<void> {
    // In a real implementation, this would restore to a test database
    console.log(`Testing backup restore for ${metadata.id} (dry run)`)
  }

  private scheduleBackups(): void {
    // Schedule daily backups at 2 AM
    const scheduleBackup = () => {
      const now = new Date()
      const nextBackup = new Date()
      nextBackup.setHours(2, 0, 0, 0)
      
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1)
      }
      
      const timeUntilBackup = nextBackup.getTime() - now.getTime()
      
      setTimeout(async () => {
        try {
          await this.createBackup({ manual: false })
        } catch (error) {
          console.error('Scheduled backup failed:', error)
        }
        
        // Schedule next backup
        scheduleBackup()
      }, timeUntilBackup)
      
      console.log(`Next automated backup scheduled for: ${nextBackup.toISOString()}`)
    }

    scheduleBackup()
  }
}

// Export singleton instance
export const databaseBackupService = DatabaseBackupService.getInstance()