# Bulk Deck Operations System

This system provides comprehensive bulk operations for deck management, allowing users to perform actions on multiple decks simultaneously with progress tracking, error handling, and undo/redo functionality.

## Features

### Core Operations
- **Import**: Bulk import decks from various formats (Moxfield, Archidekt, TappedOut, EDHREC, CSV, text)
- **Export**: Bulk export decks to multiple formats with customizable options
- **Delete**: Soft or permanent deletion of multiple decks with undo capability
- **Move**: Move decks between folders with drag-and-drop support
- **Clone**: Create copies of decks with customizable naming and placement
- **Tag**: Add, remove, or replace tags across multiple decks
- **Analyze**: Run AI analysis on multiple decks simultaneously
- **Optimize**: Generate optimization suggestions for multiple decks
- **Share**: Update sharing settings for multiple decks
- **Privacy**: Change privacy levels for multiple decks

### Advanced Features
- **Progress Tracking**: Real-time progress updates with current step and estimated time remaining
- **Error Handling**: Detailed error reporting with retry capabilities
- **Undo/Redo**: Full undo/redo support for reversible operations
- **Batch Validation**: Pre-execution validation with warnings and cost estimates
- **Operation History**: Track and manage recent bulk operations
- **Cancellation**: Cancel long-running operations
- **Operation Presets**: Predefined operation templates for common tasks

## Architecture

### Service Layer (`BulkDeckOperationsService`)
The main service class handles:
- Operation validation and execution
- Progress tracking and callbacks
- Error handling and recovery
- Undo/redo functionality
- Database operations

### tRPC Router (`bulkDeckOperationsRouter`)
Provides type-safe API endpoints for:
- Executing bulk operations
- Managing operation status
- Undo/redo operations
- Batch validation
- Operation history

### React Components
- `BulkOperationsPanel`: Main UI for selecting and executing operations
- `BulkOperationModal`: Configuration modal for operation parameters
- Progress indicators and status displays

### Database Models
- `BulkOperation`: Stores operation details and results
- `UndoOperation`: Tracks undo operations for reversibility

## Usage Examples

### Basic Export Operation
```typescript
const operation: BulkOperation = {
  type: 'export',
  deckIds: ['deck1', 'deck2', 'deck3'],
  parameters: {
    format: 'text',
    includeAnalysis: true,
    compression: true
  }
}

const result = await trpc.bulkDeckOperations.execute.mutate({ operation })
```

### Bulk Tagging
```typescript
const result = await trpc.bulkDeckOperations.tag.mutate({
  deckIds: ['deck1', 'deck2'],
  tags: ['competitive', 'tournament'],
  action: 'add'
})
```

### Progress Tracking
```typescript
const service = new BulkDeckOperationsService(prisma)

await service.executeBulkOperation(userId, operation, (progress) => {
  console.log(`${progress.percentage}% complete`)
  console.log(`Processing: ${progress.currentDeck}`)
  console.log(`${progress.processedCount}/${progress.totalCount} processed`)
})
```

### Undo Operation
```typescript
const undoResult = await trpc.bulkDeckOperations.undo.mutate({
  operationId: 'bulk_123456789'
})
```

## Operation Types

### Import Operations
- **Supported Formats**: Moxfield, Archidekt, TappedOut, EDHREC, CSV, plain text
- **Features**: Duplicate detection, auto-tagging, category preservation
- **Parameters**: `importData`, `format`, `folderId`, `skipDuplicates`, `autoTag`

### Export Operations
- **Supported Formats**: JSON, CSV, Moxfield, Archidekt, text, PDF
- **Features**: Analysis inclusion, image embedding, compression
- **Parameters**: `format`, `includeAnalysis`, `includeImages`, `compression`

### Delete Operations
- **Types**: Soft delete (recoverable) or permanent deletion
- **Features**: Undo support for soft deletes, batch confirmation
- **Parameters**: `permanent`, `reason`

### Move Operations
- **Features**: Folder validation, order preservation, drag-and-drop
- **Parameters**: `targetFolderId`, `preserveOrder`

### Clone Operations
- **Features**: Customizable naming, target folder, metadata handling
- **Parameters**: `namePrefix`, `targetFolderId`, `cloneAnalysis`, `resetStats`

### Tag Operations
- **Actions**: Add, remove, or replace tags
- **Features**: Bulk tag management, tag suggestions
- **Parameters**: `tags`, `action` ('add', 'remove', 'replace')

### Analysis Operations
- **Types**: Mana, synergy, meta, consistency, optimization analysis
- **Features**: Parallel processing, caching, recommendations
- **Parameters**: `analysisTypes`, `forceRefresh`, `includeRecommendations`

### Optimization Operations
- **Types**: Mana, curve, synergy, budget, meta optimization
- **Features**: Auto-apply suggestions, budget constraints, theme preservation
- **Parameters**: `optimizationTypes`, `autoApply`, `budgetLimit`, `aggressiveness`

## Error Handling

### Error Types
- **Validation Errors**: Invalid parameters, missing permissions
- **Processing Errors**: Card not found, format issues, API failures
- **System Errors**: Database errors, timeout, resource limits

### Error Recovery
- **Retry Logic**: Automatic retry for transient failures
- **Partial Success**: Continue processing remaining items after errors
- **Error Reporting**: Detailed error messages with suggested fixes

### Example Error Response
```typescript
{
  id: 'bulk_123456789',
  success: false,
  processedCount: 8,
  errorCount: 2,
  totalCount: 10,
  errors: [
    {
      deckId: 'deck5',
      error: 'Card "Lightning Bolt" not found',
      code: 'CARD_NOT_FOUND',
      canRetry: true
    },
    {
      deckId: 'deck7',
      error: 'Deck format validation failed',
      code: 'INVALID_FORMAT',
      canRetry: false
    }
  ],
  warnings: [
    {
      deckId: 'deck3',
      message: 'Deck contains cards not legal in Commander',
      severity: 'medium'
    }
  ]
}
```

## Performance Considerations

### Optimization Strategies
- **Batch Processing**: Process multiple items in parallel where possible
- **Progress Streaming**: Real-time progress updates without blocking
- **Resource Management**: Memory and CPU usage monitoring
- **Caching**: Cache frequently accessed data during operations

### Scalability
- **Queue System**: Background job processing for large operations
- **Rate Limiting**: Prevent system overload from concurrent operations
- **Pagination**: Handle large result sets efficiently
- **Cleanup**: Automatic cleanup of old operation records

## Security

### Access Control
- **User Validation**: Verify user ownership of all target decks
- **Permission Checks**: Validate operation permissions per deck
- **Rate Limiting**: Prevent abuse through operation throttling

### Data Protection
- **Input Validation**: Sanitize all operation parameters
- **SQL Injection Prevention**: Use parameterized queries
- **Data Encryption**: Encrypt sensitive operation data

## Testing

### Unit Tests
- Service method testing with mocked dependencies
- Error handling and edge case validation
- Undo/redo functionality verification

### Integration Tests
- End-to-end operation execution
- Database transaction integrity
- tRPC endpoint functionality

### Performance Tests
- Large batch operation handling
- Memory usage under load
- Concurrent operation processing

## Monitoring and Logging

### Metrics
- Operation success/failure rates
- Processing times and throughput
- Error frequency and types
- User adoption of different operations

### Logging
- Operation start/completion events
- Error details and stack traces
- Performance metrics and bottlenecks
- User activity patterns

## Future Enhancements

### Planned Features
- **Scheduled Operations**: Cron-like scheduling for recurring operations
- **Operation Templates**: Save and reuse complex operation configurations
- **Collaborative Operations**: Multi-user bulk operations with permissions
- **Advanced Analytics**: Operation performance analysis and optimization
- **API Webhooks**: External system integration for operation events

### Performance Improvements
- **Streaming Processing**: Handle very large datasets without memory issues
- **Distributed Processing**: Scale across multiple servers for large operations
- **Smart Batching**: Optimize batch sizes based on operation type and system load
- **Predictive Caching**: Pre-cache data likely to be needed for operations

## Configuration

### Environment Variables
```env
BULK_OPERATION_MAX_BATCH_SIZE=1000
BULK_OPERATION_TIMEOUT_MS=300000
BULK_OPERATION_RETRY_ATTEMPTS=3
BULK_OPERATION_CLEANUP_DAYS=30
```

### Database Configuration
- Ensure adequate connection pool size for concurrent operations
- Configure appropriate timeouts for long-running operations
- Set up proper indexing for operation queries

## Troubleshooting

### Common Issues
1. **Operation Timeout**: Increase timeout or reduce batch size
2. **Memory Issues**: Implement streaming for large datasets
3. **Database Locks**: Optimize transaction scope and duration
4. **Rate Limiting**: Implement proper throttling and queuing

### Debug Tools
- Operation status monitoring dashboard
- Detailed error logging and analysis
- Performance profiling tools
- Database query optimization tools