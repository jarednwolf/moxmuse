# Data Persistence and Recovery System

This comprehensive data persistence and recovery system provides automatic saving, session management, incremental backups, data migrations, and disaster recovery capabilities for the AI Deck Building Tutor application.

## Overview

The persistence system consists of five main components:

1. **AutoSaveService** - Automatic saving with conflict resolution
2. **SessionPersistenceService** - Consultation session persistence and resumption
3. **IncrementalBackupService** - Automated backup system with testing
4. **DataMigrationService** - Schema migration tools with rollback support
5. **DisasterRecoveryService** - Disaster recovery procedures and documentation

## Features

### ✅ Automatic Deck Saving with Conflict Resolution
- Automatic saving of deck changes every 30 seconds
- Version-based conflict detection and resolution
- Multiple conflict resolution strategies (client-wins, server-wins, merge)
- Retry logic with exponential backoff
- Checksum validation for data integrity

### ✅ Consultation Session Persistence and Resumption
- Automatic session state saving
- Step-by-step progress tracking with snapshots
- Session resumption after interruption
- Session history and rollback to previous steps
- Cleanup of old abandoned sessions

### ✅ Incremental Backup System with Automated Testing
- Full and incremental backups
- Compression and encryption support
- Automated backup integrity testing
- Backup restoration testing
- Configurable retention policies
- Multiple restore points with dependency tracking

### ✅ Data Migration Tools for Schema Updates
- Migration creation with up/down scripts
- Dependency management between migrations
- Dry-run capability for testing
- Rollback support for failed migrations
- Migration plan creation and execution
- Risk assessment and validation

### ✅ Disaster Recovery Procedures and Documentation
- Pre-defined disaster recovery scenarios
- Automated recovery execution with validation
- System health monitoring
- Recovery testing and documentation generation
- Emergency procedures with alerting
- Recovery time/point objective tracking

## Quick Start

### Basic Setup

```typescript
import { createPersistenceService } from './services/persistence/PersistenceService'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const persistenceService = createPersistenceService(prisma, {
  backup: {
    backupDirectory: './backups',
    retentionDays: 30,
    compressionEnabled: true,
  },
  disasterRecovery: {
    alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  }
})

// Initialize the system
await persistenceService.initialize()
```

### Auto-Save Usage

```typescript
const autoSaveService = persistenceService.getAutoSaveService()

// Schedule automatic deck saving
await autoSaveService.scheduleDeckSave('user-123', 'deck-456', {
  id: 'deck-456',
  name: 'My Commander Deck',
  commander: 'Atraxa, Praetors\' Voice',
  cards: [
    { cardId: 'card-1', quantity: 1, category: 'commander' },
    { cardId: 'card-2', quantity: 4, category: 'main' },
  ],
  strategy: {
    primary: 'control',
    themes: ['proliferate', 'planeswalkers'],
  },
  metadata: {
    powerLevel: 7,
    budget: 500,
    colors: ['W', 'U', 'B', 'G'],
  },
  version: 1,
  lastModified: new Date(),
})

// Force immediate save
await autoSaveService.forceSave('deck', 'deck-456')
```

### Session Persistence Usage

```typescript
const sessionService = persistenceService.getSessionPersistenceService()

// Create new consultation session
const session = await sessionService.createSession('user-123', 10, {
  commander: 'Atraxa, Praetors\' Voice',
  budget: 500,
})

// Update session with step data
await sessionService.updateSession(
  session.id,
  1,
  { strategy: 'control' },
  { powerLevel: 7 }
)

// Get resumable sessions
const resumableSessions = await sessionService.getResumableSessions('user-123')

// Resume a session
const resumptionData = await sessionService.resumeSession(session.id)
```

### Backup Operations

```typescript
const backupService = persistenceService.getBackupService()

// Create full backup
const fullBackup = await backupService.createFullBackup()

// Create incremental backup
const incrementalBackup = await backupService.createIncrementalBackup()

// Test backup integrity
const testResult = await backupService.testBackupIntegrity(fullBackup.id)

// Get available restore points
const restorePoints = await backupService.getRestorePoints()
```

### Migration Management

```typescript
const migrationService = persistenceService.getMigrationService()

// Create a new migration
const migration = await migrationService.createMigration(
  'add-deck-tags',
  'Add tags column to generated_decks table',
  'ALTER TABLE generated_decks ADD COLUMN tags TEXT[];',
  'ALTER TABLE generated_decks DROP COLUMN tags;',
  {
    estimatedDuration: 60000, // 1 minute
    riskLevel: 'low',
    requiresDowntime: false,
  }
)

// Get pending migrations
const pendingMigrations = await migrationService.getPendingMigrations()

// Create migration plan
const plan = await migrationService.createMigrationPlan()

// Execute migrations (dry run first)
const dryRunResults = await migrationService.executeMigrationPlan(plan, {
  dryRun: true,
  createBackup: true,
})

// Execute for real
const results = await migrationService.executeMigrationPlan(plan, {
  dryRun: false,
  createBackup: true,
  stopOnError: true,
})
```

### Disaster Recovery

```typescript
const disasterRecoveryService = persistenceService.getDisasterRecoveryService()

// Check system health
const healthChecks = await disasterRecoveryService.getSystemHealth()

// Test disaster recovery scenario
const testExecution = await disasterRecoveryService.testRecoveryScenario('database-corruption')

// Execute emergency recovery (if needed)
const recovery = await persistenceService.handleEmergency('database-corruption')
```

## Configuration

### Auto-Save Configuration

```typescript
interface AutoSaveConfig {
  saveIntervalMs: number              // Save interval (default: 30000)
  maxRetries: number                  // Max retry attempts (default: 3)
  conflictResolutionStrategy:         // Conflict resolution strategy
    | 'client-wins'                   // Client data takes precedence
    | 'server-wins'                   // Server data takes precedence  
    | 'merge'                         // Attempt to merge changes
    | 'prompt-user'                   // Prompt user for resolution
}
```

### Backup Configuration

```typescript
interface BackupConfig {
  backupDirectory: string             // Backup storage directory
  retentionDays: number              // Days to keep backups (default: 30)
  compressionEnabled: boolean        // Enable gzip compression
  encryptionEnabled: boolean         // Enable backup encryption
  encryptionKey?: string             // Encryption key (if enabled)
  maxBackupSizeMB: number           // Max backup file size
  incrementalIntervalHours: number   // Incremental backup interval
  fullBackupIntervalDays: number     // Full backup interval
}
```

### Migration Configuration

```typescript
interface MigrationConfig {
  migrationsDirectory: string        // Migration files directory
  backupBeforeMigration: boolean     // Create backup before migration
  rollbackEnabled: boolean           // Enable rollback support
  dryRunEnabled: boolean             // Enable dry-run by default
  maxRollbackSteps: number          // Max rollback steps allowed
}
```

### Disaster Recovery Configuration

```typescript
interface DisasterRecoveryConfig {
  recoveryProceduresPath: string     // Recovery procedures directory
  maxRecoveryTimeObjective: number   // Max RTO in minutes
  maxRecoveryPointObjective: number  // Max RPO in minutes
  alertingEnabled: boolean           // Enable alerting
  alertWebhookUrl?: string          // Webhook for alerts
  emergencyContactsPath: string      // Emergency contacts file
  runbookPath: string               // Generated runbook path
}
```

## API Endpoints

The persistence system exposes tRPC endpoints for all operations:

### Auto-Save Endpoints
- `persistence.scheduleDeckSave` - Schedule deck auto-save
- `persistence.scheduleSessionSave` - Schedule session auto-save
- `persistence.forceSave` - Force immediate save

### Session Endpoints
- `persistence.createSession` - Create consultation session
- `persistence.updateSession` - Update session step
- `persistence.getSession` - Get session by ID
- `persistence.getUserSessions` - Get user's sessions
- `persistence.getResumableSessions` - Get resumable sessions
- `persistence.resumeSession` - Resume session
- `persistence.pauseSession` - Pause session
- `persistence.completeSession` - Complete session
- `persistence.getSessionHistory` - Get session history
- `persistence.restoreToStep` - Restore to previous step

### Backup Endpoints
- `persistence.createFullBackup` - Create full backup
- `persistence.createIncrementalBackup` - Create incremental backup
- `persistence.getRestorePoints` - Get restore points
- `persistence.testBackupIntegrity` - Test backup integrity
- `persistence.runAutomatedTests` - Run backup tests

### Migration Endpoints
- `persistence.getPendingMigrations` - Get pending migrations
- `persistence.createMigrationPlan` - Create migration plan
- `persistence.executeMigrationPlan` - Execute migrations
- `persistence.getMigrationHistory` - Get migration history

### System Endpoints
- `persistence.getSystemHealth` - Get system health
- `persistence.getStatus` - Get persistence status
- `persistence.performHealthCheck` - Perform health check
- `persistence.runMaintenance` - Run maintenance tasks
- `persistence.handleEmergency` - Handle emergency scenarios

## Database Schema

The persistence system adds several tables to track operations:

### Consultation Sessions
```sql
CREATE TABLE consultation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 10,
  responses JSONB NOT NULL DEFAULT '{}',
  preferences JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  version INTEGER NOT NULL DEFAULT 1,
  checksum TEXT,
  auto_save_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Session Snapshots
```sql
CREATE TABLE session_snapshots (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES consultation_sessions(id),
  step INTEGER NOT NULL,
  step_data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  is_checkpoint BOOLEAN DEFAULT false
);
```

### Save Operations Tracking
```sql
CREATE TABLE save_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  data_snapshot JSONB,
  version_before INTEGER,
  version_after INTEGER,
  conflict_detected BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Migration Tracking
```sql
CREATE TABLE migration_executions (
  id TEXT PRIMARY KEY,
  migration_id TEXT NOT NULL,
  status TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INTEGER,
  error TEXT,
  dry_run BOOLEAN DEFAULT FALSE,
  affected_tables TEXT[],
  affected_records INTEGER DEFAULT 0,
  rollback_available BOOLEAN DEFAULT FALSE
);
```

## Monitoring and Alerting

### Health Checks
The system performs regular health checks on:
- Database connectivity and performance
- Backup system status
- Application health metrics
- External dependency status

### Metrics Tracked
- Auto-save success/failure rates
- Session completion rates
- Backup creation and test results
- Migration execution times
- System recovery times (RTO/RPO)

### Alerting
Alerts are sent for:
- Failed backups or integrity tests
- Migration failures
- System health degradation
- Disaster recovery activation
- RTO/RPO threshold breaches

## Testing

### Unit Tests
```bash
npm test packages/api/src/services/persistence/__tests__/
```

### Integration Tests
```bash
npm run test:integration persistence
```

### Disaster Recovery Tests
```bash
# Test database corruption scenario
npm run test:disaster-recovery database-corruption

# Test complete system failure scenario  
npm run test:disaster-recovery complete-system-failure
```

## Maintenance

### Daily Tasks
- Incremental backups (automated)
- Health checks (automated)
- Session cleanup (automated)

### Weekly Tasks
- Full backup integrity tests
- Migration review
- System health assessment

### Monthly Tasks
- Disaster recovery scenario testing
- Backup retention cleanup
- Performance optimization review

### Quarterly Tasks
- Full disaster recovery drill
- Documentation updates
- Configuration review

## Troubleshooting

### Common Issues

#### Auto-Save Conflicts
```typescript
// Check conflict resolution logs
const conflicts = await prisma.conflictResolutions.findMany({
  where: { entityId: 'problematic-entity-id' },
  orderBy: { createdAt: 'desc' }
})
```

#### Session Recovery Issues
```typescript
// Check session snapshots
const snapshots = await sessionService.getSessionHistory('session-id')
console.log('Available snapshots:', snapshots.length)
```

#### Backup Failures
```typescript
// Test backup integrity
const testResult = await backupService.testBackupIntegrity('backup-id')
if (!testResult.success) {
  console.error('Backup integrity test failed:', testResult.details)
}
```

#### Migration Problems
```typescript
// Check migration history
const history = await migrationService.getMigrationHistory()
const failed = history.filter(h => h.status === 'failed')
console.log('Failed migrations:', failed)
```

### Recovery Procedures

#### Data Loss Recovery
1. Identify the scope of data loss
2. Find the latest valid backup before the incident
3. Execute disaster recovery scenario
4. Validate data integrity after recovery
5. Document the incident and lessons learned

#### System Corruption Recovery
1. Activate disaster recovery procedures
2. Provision new infrastructure if needed
3. Restore from latest backup
4. Validate system functionality
5. Update DNS and routing
6. Monitor system performance

## Security Considerations

### Data Protection
- All backups can be encrypted at rest
- Session data includes checksums for integrity
- Migration scripts are validated before execution
- Access controls on all persistence operations

### Audit Trail
- All save operations are logged
- Migration executions are tracked
- Disaster recovery actions are recorded
- System health changes are monitored

### Compliance
- Data retention policies are configurable
- Backup encryption meets security standards
- Migration rollback capabilities for compliance
- Disaster recovery documentation for audits

## Performance Optimization

### Auto-Save Performance
- Batched save operations
- Intelligent conflict detection
- Optimistic locking for concurrency
- Configurable save intervals

### Backup Performance
- Incremental backups reduce overhead
- Compression reduces storage requirements
- Parallel backup operations where possible
- Background integrity testing

### Migration Performance
- Dry-run validation before execution
- Dependency-based execution order
- Progress tracking and estimation
- Rollback optimization

## Future Enhancements

### Planned Features
- Cross-region backup replication
- Advanced conflict resolution UI
- Machine learning for migration risk assessment
- Automated disaster recovery triggers
- Real-time session collaboration
- Advanced backup deduplication

### Integration Opportunities
- Cloud storage backends (S3, GCS, Azure)
- External monitoring systems (DataDog, New Relic)
- Notification systems (Slack, PagerDuty)
- Configuration management (Terraform, Ansible)

## Support

For issues or questions about the persistence system:

1. Check the troubleshooting section above
2. Review the test files for usage examples
3. Check system health and logs
4. Contact the development team with specific error details

## Contributing

When contributing to the persistence system:

1. Add comprehensive tests for new features
2. Update documentation for API changes
3. Consider backward compatibility
4. Test disaster recovery scenarios
5. Update configuration examples