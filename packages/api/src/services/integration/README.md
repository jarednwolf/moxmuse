# Integration and Export Systems

This module provides comprehensive integration capabilities for the MoxMuse AI Deck Building Tutor, including multi-format exports, shareable links, collection imports, API authentication, and webhook notifications.

## Features

### 1. Multi-Format Deck Export

Export generated decks to various formats for use in other platforms:

- **Moxfield**: JSON format compatible with Moxfield deck builder
- **Archidekt**: JSON format compatible with Archidekt deck builder  
- **Text**: Plain text format for easy sharing and copying
- **JSON**: Full deck data with metadata for programmatic use

#### Usage

```typescript
import { exportService } from './ExportService'

const exportResult = await exportService.exportDeck(deck, {
  format: 'moxfield',
  includeMetadata: true,
  includePrices: false,
  includeAnalysis: true,
})

console.log(exportResult.filename) // "my_deck_moxfield.json"
console.log(exportResult.data) // JSON string
```

### 2. Shareable Deck Links

Create shareable links with embedded metadata for social sharing:

- **Public/Private Links**: Control visibility and access
- **Password Protection**: Optional password protection for sensitive decks
- **Expiration Dates**: Set automatic expiration for temporary shares
- **Fork Capability**: Allow others to fork and modify shared decks
- **View Analytics**: Track views and engagement

#### Usage

```typescript
import { shareableLinksService } from './ShareableLinksService'

const shareableLink = await shareableLinksService.createShareableLink(
  deckId,
  userId,
  {
    includeAnalysis: true,
    allowForks: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }
)

console.log(`Share URL: /shared/${shareableLink.slug}`)
```

### 3. Collection Import

Import card collections from major deck building platforms:

- **Moxfield**: Import collections via API or JSON export
- **Archidekt**: Import decks via API or JSON export
- **CSV**: Import from custom CSV format
- **EDHREC/TappedOut**: Import via manual deck list export

#### Supported Formats

- **CSV Template**:
  ```csv
  Name,Quantity,Set,Foil,Condition,Price,Notes
  Lightning Bolt,4,M11,false,near_mint,0.50,Great card
  Sol Ring,1,C21,true,mint,2.00,Foil version
  ```

#### Usage

```typescript
import { collectionImportService } from './CollectionImportService'

const importResult = await collectionImportService.importCollection(userId, {
  platform: 'csv',
  data: csvData,
  validateCards: true,
  mergeWithExisting: false,
})

console.log(`Imported ${importResult.importedCount} cards`)
```

### 4. API Authentication

Secure API access with multiple authentication methods:

- **API Keys**: Long-lived keys with configurable permissions and rate limits
- **OAuth 2.0**: Standard OAuth flow for third-party applications
- **Rate Limiting**: Per-key rate limiting with configurable quotas
- **Permission System**: Granular permissions for different operations

#### Available Permissions

- `decks:read` - Read deck data
- `decks:write` - Create and modify decks
- `decks:delete` - Delete decks
- `collections:read` - Read collection data
- `collections:write` - Modify collections
- `ai:generate` - Use AI generation features
- `export:all` - Export data in all formats
- `import:all` - Import data from all platforms
- `webhooks:manage` - Manage webhook configurations

#### Usage

```typescript
import { apiAuthenticationService } from './APIAuthenticationService'

// Create API key
const { apiKey, plainKey } = await apiAuthenticationService.createAPIKey(userId, {
  name: 'My Integration',
  permissions: ['decks:read', 'decks:write'],
  rateLimit: 1000, // requests per minute
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
})

// Validate API key
const validation = await apiAuthenticationService.validateAPIKey(plainKey)
console.log(`User: ${validation.userId}, Permissions: ${validation.permissions}`)
```

### 5. Webhook System

Real-time notifications for deck and collection events:

- **Event Types**: Comprehensive event coverage
- **Reliable Delivery**: Automatic retries with exponential backoff
- **Signature Verification**: HMAC signatures for security
- **Delivery Analytics**: Track delivery success and failure rates
- **Testing Tools**: Built-in webhook testing capabilities

#### Available Events

- `deck.created` - New deck generated
- `deck.updated` - Deck modified
- `deck.deleted` - Deck removed
- `collection.updated` - Collection modified
- `generation.completed` - AI generation finished
- `generation.failed` - AI generation failed
- `export.completed` - Export operation finished
- `import.completed` - Import operation finished

#### Webhook Payload Format

```json
{
  "event": "deck.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "userId": "user-123",
  "data": {
    "deckId": "deck-456",
    "name": "My New Deck",
    "commander": "Sol Ring",
    "format": "commander",
    "cardCount": 100,
    "estimatedBudget": 500.00,
    "powerLevel": 7
  }
}
```

#### Usage

```typescript
import { webhookService } from './WebhookService'

// Create webhook
const webhook = await webhookService.createWebhook(userId, {
  name: 'My Webhook',
  url: 'https://myapp.com/webhooks/moxmuse',
  events: ['deck.created', 'deck.updated'],
  secret: 'my-webhook-secret', // Optional, auto-generated if not provided
})

// Trigger webhook (usually called internally)
await webhookService.triggerWebhook('deck.created', userId, {
  deckId: 'deck-123',
  name: 'New Deck',
  commander: 'Sol Ring',
})
```

## API Endpoints

### Export Endpoints

- `POST /api/trpc/integration.exportDeck` - Export a deck
- `GET /api/trpc/integration.getSupportedExportFormats` - Get available formats

### Sharing Endpoints

- `POST /api/trpc/integration.createShareableLink` - Create shareable link
- `GET /api/trpc/integration.getSharedDeck` - Get shared deck by slug
- `GET /api/trpc/integration.getUserShareableLinks` - Get user's links
- `PUT /api/trpc/integration.updateShareableLink` - Update link settings
- `DELETE /api/trpc/integration.deleteShareableLink` - Delete link
- `POST /api/trpc/integration.forkSharedDeck` - Fork a shared deck

### Import Endpoints

- `POST /api/trpc/integration.importCollection` - Import collection
- `GET /api/trpc/integration.getSupportedImportPlatforms` - Get platforms
- `GET /api/trpc/integration.getCSVTemplate` - Get CSV template

### API Authentication Endpoints

- `POST /api/trpc/integration.createAPIKey` - Create API key
- `GET /api/trpc/integration.getUserAPIKeys` - Get user's API keys
- `DELETE /api/trpc/integration.revokeAPIKey` - Revoke API key
- `GET /api/trpc/integration.getAvailablePermissions` - Get permissions

### Webhook Endpoints

- `POST /api/trpc/integration.createWebhook` - Create webhook
- `GET /api/trpc/integration.getUserWebhooks` - Get user's webhooks
- `PUT /api/trpc/integration.updateWebhook` - Update webhook
- `DELETE /api/trpc/integration.deleteWebhook` - Delete webhook
- `POST /api/trpc/integration.testWebhook` - Test webhook endpoint

## Database Schema

The integration system uses several database tables:

### Shareable Links
```sql
CREATE TABLE shareable_links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  deck_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT false,
  allow_forks BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  password TEXT,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Keys
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Webhooks
```sql
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

### API Key Security
- Keys are hashed using SHA-256 before storage
- Rate limiting prevents abuse
- Permissions are granular and configurable
- Expiration dates are enforced

### Webhook Security
- HMAC-SHA256 signatures for payload verification
- HTTPS-only endpoints recommended
- Automatic retry with exponential backoff
- Delivery attempt limits to prevent infinite loops

### Shareable Link Security
- Optional password protection
- Configurable expiration dates
- View tracking for analytics
- Access control for forking

## Error Handling

All services implement comprehensive error handling:

- **Validation Errors**: Input validation with detailed error messages
- **Authentication Errors**: Clear authentication failure responses
- **Rate Limiting**: Proper rate limit exceeded responses
- **External Service Errors**: Graceful handling of third-party API failures
- **Database Errors**: Transaction rollback and error recovery

## Testing

Comprehensive test coverage includes:

- **Unit Tests**: Individual service method testing
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Load testing for high-volume scenarios
- **Security Tests**: Authentication and authorization testing

Run tests with:
```bash
npm test packages/api/src/services/integration
```

## Monitoring and Analytics

The integration system provides:

- **Usage Analytics**: Track export, import, and sharing activity
- **Performance Metrics**: Monitor response times and success rates
- **Error Tracking**: Comprehensive error logging and alerting
- **Health Checks**: System health monitoring endpoints

## Configuration

Environment variables:

```env
# API Authentication
JWT_SECRET=your-jwt-secret-key

# Webhook Configuration
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_MAX_RETRIES=3

# Rate Limiting
DEFAULT_RATE_LIMIT=1000
MAX_RATE_LIMIT=10000

# External APIs
MOXFIELD_API_URL=https://api.moxfield.com
ARCHIDEKT_API_URL=https://archidekt.com/api
```

## Future Enhancements

Planned improvements:

1. **Additional Export Formats**: Support for more deck building platforms
2. **Advanced Analytics**: Detailed usage analytics and reporting
3. **Bulk Operations**: Batch export/import capabilities
4. **API Versioning**: Versioned API endpoints for backward compatibility
5. **Enhanced Security**: OAuth scopes, IP whitelisting, and audit logs