# Getting Started with MoxMuse

This guide will help you set up MoxMuse for development and understand the core concepts.

## Prerequisites

### Required Software
- **Node.js 20+** - JavaScript runtime
- **pnpm 8+** - Package manager (faster than npm)
- **PostgreSQL 14+** - Database
- **Git** - Version control

### Required Services
- **OpenAI API Key** - For AI deck generation
- **Database** - PostgreSQL instance (local or hosted)

### Optional Services
- **Redis** - For caching and rate limiting
- **Moxfield OAuth** - For collection import

## Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/moxmuse.git
cd moxmuse
```

### 2. Install Dependencies
```bash
# Install all packages in the monorepo
pnpm install

# Verify installation
pnpm --version
node --version
```

### 3. Environment Configuration

Copy the example environment file:
```bash
cp env.example apps/web/.env.local
```

Configure your environment variables:

#### Required Variables
```env
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/moxmuse"

# NextAuth configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI API
OPENAI_API_KEY="sk-your-openai-api-key"
```

#### Optional Variables
```env
# Redis for caching (optional)
REDIS_URL="redis://localhost:6379"

# Moxfield OAuth (for collection import)
MOXFIELD_CLIENT_ID="your-moxfield-client-id"
MOXFIELD_CLIENT_SECRET="your-moxfield-client-secret"

# Feature flags (all default to true)
NEXT_PUBLIC_ENABLE_DECK_BUILDING_TUTOR="true"
NEXT_PUBLIC_ENABLE_COMMANDER_SUGGESTIONS="true"
```

### 4. Database Setup

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb moxmuse

# Set DATABASE_URL in .env.local
DATABASE_URL="postgresql://$(whoami)@localhost:5432/moxmuse"
```

#### Option B: Hosted Database
Use services like:
- **Railway** - Easy PostgreSQL hosting
- **Supabase** - PostgreSQL with additional features
- **Neon** - Serverless PostgreSQL

### 5. Initialize Database
```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Optional: Seed with sample data
pnpm db:seed
```

### 6. Start Development Server
```bash
# Start all services
pnpm dev

# Or start specific services
pnpm dev --filter=web    # Just the web app
pnpm dev --filter=api    # Just the API
```

### 7. Verify Installation

Open http://localhost:3000 and verify:
- [ ] Homepage loads correctly
- [ ] Authentication works (sign up/in)
- [ ] Tutor page is accessible
- [ ] Database connections work

## Development Workflow

### Project Structure
```
moxmuse/
├── apps/web/                 # Next.js frontend
│   ├── app/                  # App router pages
│   ├── src/components/       # React components
│   ├── src/lib/             # Utilities
│   └── public/              # Static assets
├── packages/
│   ├── api/                 # tRPC API
│   ├── db/                  # Prisma database
│   └── shared/              # Shared code
└── docs/                    # Documentation
```

### Key Commands
```bash
# Development
pnpm dev                     # Start dev server
pnpm build                   # Build for production
pnpm start                   # Start production server

# Database
pnpm db:push                 # Push schema changes
pnpm db:migrate              # Create migration
pnpm db:studio               # Open Prisma Studio
pnpm db:reset                # Reset database

# Testing
pnpm test                    # Run unit tests
pnpm test:e2e               # Run E2E tests
pnpm test:watch             # Watch mode

# Code Quality
pnpm lint                    # Lint code
pnpm lint:fix               # Fix linting issues
pnpm type-check             # TypeScript check
```

### Testing Environment Notes

- API tests use a dedicated setup harness at `packages/api/src/test/setup.ts` to configure env vars and global mocks (Sentry, Prisma, Cron, etc.). No `.env.test` file is required.

### Scripts Directory

- Operational and one-off maintenance scripts have been grouped under `scripts/maintenance/` to reduce clutter. Core deployment scripts remain in `scripts/deployment/`.

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the [Style Guide](STYLE_GUIDE.md)
   - Add tests for new features
   - Update documentation

3. **Test your changes**
   ```bash
   pnpm test
   pnpm test:e2e
   pnpm type-check
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

## Core Concepts

### AI Deck Building Tutor
The main feature that guides users through creating complete Commander decks:

1. **Entry Point Selection** - Choose between full deck building or card recommendations
2. **Consultation Wizard** - Multi-step form collecting user preferences
3. **Commander Selection** - AI-powered commander recommendations
4. **Deck Generation** - Complete 100-card deck creation
5. **Deck Editor** - Professional editing with statistics and analysis

### Database Schema
Key models:
- **User** - Authentication and preferences
- **GeneratedDeck** - Complete AI-generated decks
- **ConsultationSession** - Wizard progress tracking
- **DeckAnalysis** - Cached statistics and insights

### API Structure
tRPC procedures organized by domain:
- **tutor** - AI recommendations and deck generation
- **deck** - Deck CRUD operations
- **user** - User management
- **collection** - Card collection sync

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Reset database if corrupted
pnpm db:reset
```

#### OpenAI API Issues
```bash
# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

#### Build Errors
```bash
# Clear caches
rm -rf node_modules .next
pnpm install
pnpm build
```

#### Port Conflicts
```bash
# Check what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 pnpm dev
```

### Getting Help

1. **Check the logs** - Look for error messages in the console
2. **Review documentation** - Check relevant docs in `/docs`
3. **Search issues** - Look for similar problems in GitHub issues
4. **Ask for help** - Create a new issue with details

## Next Steps

Once you have MoxMuse running:

1. **Explore the codebase** - Read through the main components
2. **Try the features** - Use the AI Deck Building Tutor
3. **Read the architecture docs** - Understand the system design
4. **Make a small change** - Start with a simple improvement
5. **Join the community** - Contribute to discussions and development

## Additional Resources

- [Architecture Guide](ARCHITECTURE.md) - System design patterns
- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Style Guide](STYLE_GUIDE.md) - Code and design standards
- [Contributing Guide](CONTRIBUTING.md) - Development workflow
- [Deployment Guide](DEPLOYMENT.md) - Production deployment