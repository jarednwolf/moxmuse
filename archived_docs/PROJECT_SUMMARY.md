# MoxMuse Project Summary

## Project Scaffold

```
moxmuse/
├── apps/
│   └── web/                    # Next.js 14 web application
│       ├── app/                # App Router
│       │   ├── api/            # API routes
│       │   │   └── trpc/       # tRPC endpoint
│       │   ├── solsync/        # Collection sync pillar
│       │   ├── lotuslist/      # Card explorer pillar
│       │   ├── tutor/          # AI chat pillar
│       │   ├── layout.tsx      # Root layout
│       │   ├── page.tsx        # Home page
│       │   └── globals.css     # Global styles
│       ├── src/
│       │   ├── components/     # React components
│       │   └── lib/            # Utilities
│       │       └── trpc/       # tRPC client setup
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   ├── api/                    # tRPC API package
│   │   └── src/
│   │       ├── routers/        # API routers
│   │       ├── services/       # Business logic
│   │       ├── root.ts         # Root router
│   │       └── trpc.ts         # tRPC setup
│   ├── db/                     # Prisma database package
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       └── index.ts        # Prisma client export
│   └── shared/                 # Shared types & utilities
│       └── src/
│           ├── types.ts        # TypeScript types
│           ├── constants.ts    # App constants
│           └── utils.ts        # Utility functions
├── pnpm-workspace.yaml         # pnpm workspace config
├── turbo.json                  # Turborepo config
├── package.json                # Root package.json
└── env.example                 # Environment variables template
```

## Key Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/moxmuse"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# OAuth Providers
MOXFIELD_CLIENT_ID=""
MOXFIELD_CLIENT_SECRET=""

# OpenAI
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4-1106-preview"

# Affiliate IDs
TCGPLAYER_AFFILIATE_ID=""
CARDKINGDOM_AFFILIATE_ID=""
```

## Prisma Schema (Key Models)

- **User**: Core user model with auth integration
- **CollectionCard**: Tracks user's owned cards with quantity, condition, language
- **Deck**: User's deck configurations with power level and budget
- **DeckCard**: Cards in each deck with categories
- **Recommendation**: AI recommendations with affiliate links
- **ClickEvent**: Affiliate click tracking for revenue
- **SyncJob**: Background job tracking for collection imports

## Key API Procedures

### `tutor.recommendAndLink`
The core tRPC mutation that:
1. Accepts user prompt and constraints
2. Fetches user's collection
3. Calls OpenAI GPT-4 with function calling
4. Returns card recommendations with:
   - Scryfall card data
   - Ownership status
   - Affiliate links for missing cards
   - Confidence scores and reasoning

### Supporting Procedures
- `collection.importCSV`: Import collection from CSV
- `deck.create/update`: Deck management
- `tutor.trackClick`: Affiliate click tracking

## Next.js Page Skeleton

### Home Page (`/`)
- Three pillar cards with navigation
- Getting started guide
- Clean, modern UI with Tailwind

### TolarianTutor (`/tutor`)
- **Chat Interface**: Message input with streaming responses
- **Card Display**: Shows card images, prices, ownership status
- **Affiliate Links**: Dynamic generation for unowned cards
- **Session Summary**: Tracks recommendations, costs, owned vs unowned
- **Responsive Design**: Works on mobile and desktop

## Security & Compliance Notes

### Authentication
- NextAuth.js for OAuth (Moxfield, Google, etc.)
- Session-based auth with JWT tokens
- Protected API routes via tRPC middleware

### Data Privacy
- Store minimal PII (email, name, avatar)
- Collection data hashed for deduplication
- No card pricing stored locally (fetched on-demand)
- GDPR-compliant data deletion on request

### Affiliate Tracking
- Anonymous session IDs for tracking
- IP hashing for fraud detection
- Transparent affiliate disclosure in UI
- Click events stored for 90 days max

### API Security
- Rate limiting on all external API calls
- Redis caching to reduce API load
- Input validation with Zod schemas
- SQL injection prevention via Prisma

## Roadmap

### MVP (4-6 weeks)
- ✅ Core infrastructure setup
- ✅ Basic tRPC API with GPT-4 integration
- ✅ TolarianTutor chat interface
- ⏳ Moxfield OAuth and sync
- ⏳ Basic collection management
- ⏳ Affiliate link generation
- ⏳ Deploy to Vercel/Railway

### v1.5 (2-3 months)
- Archidekt sync support
- Power level calculator
- Deck diff visualization
- Advanced search filters
- Mobile PWA wrapper
- Email notifications for price drops

### v2.0 (6 months)
- Premium subscription tier
- LGS partnership tools
- Playtest hand simulator
- Trade matching system
- Content creator features
- Multi-language support

## Getting Started

1. Clone the repository
2. Copy `env.example` to `.env.local` and fill in values
3. Install dependencies: `pnpm install`
4. Push database schema: `pnpm db:push`
5. Start dev server: `pnpm dev`
6. Visit http://localhost:3000

## Tech Stack Summary

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Radix UI
- **Backend**: Node.js 20, tRPC, Prisma
- **Database**: PostgreSQL, Redis
- **AI**: OpenAI GPT-4 with function calling
- **Infrastructure**: Vercel/Railway, Turborepo
- **Monitoring**: PostHog analytics 

## Design System & Landing Page

### Visual Design
- **Color Scheme**: Dark theme with zinc-900 base, representing the five MTG colors (WUBRG)
- **Mox Integration**: Five colored circles in logo representing the legendary Mox artifacts
- **Typography**: Light font weights, wide tracking for modern tech aesthetic
- **Layout**: Professional SaaS-style with focus on player needs

### Landing Page Features
- **Cycling Backgrounds**: 5 fantasy landscapes (Plains, Island, Swamp, Mountain, Forest) cycle every 5 seconds
- **Player-Focused Content**: 
  - 65% faster deck building
  - Save 20% with price tracking
  - Win rate data from 100K+ games
  - 50K+ community decks
- **Feature Highlights**:
  - Synergy scoring for card combinations
  - Meta analysis from tournaments
  - Power level estimation (casual to cEDH)
  - Real-time price tracking across vendors
  - Budget alternatives for expensive cards

### Design Decisions
1. **No childish elements**: Professional aesthetic targeting competitive players
2. **Data-driven messaging**: Focus on metrics and real benefits
3. **Clear value proposition**: Time savings, cost savings, win rate improvements
4. **Community features**: Discord link, API access for developers 

## UI/UX Improvements (Latest Session)

### TolarianTutor Consultation Flow
1. **Dual-Mode Interface**:
   - **Guided Deck Building**: Step-by-step wizard for personalized consultation
   - **Open Chat**: Traditional free-form AI conversation

2. **Wizard Flow Optimization**:
   - Collection usage asked before budget (skip budget if using owned cards only)
   - Commander Brackets (1-5) replacing generic 1-10 power levels
   - Multi-select color preferences instead of single selection
   - Conditional questions based on previous answers

3. **New Features Added**:
   - **Super Friends** deck archetype in themes
   - **Custom theme input** with "Something else..." option
   - **Multi-select color preferences**: Can select mono, multi, and 5-color
   - **Contextual color questions**: Different prompts for mono vs multi-color
   - **Fixed budget display**: Shows formatted ranges like "$500 - $1000"
   - **Help modal**: Explains Commander Brackets system with visual reference

4. **Visual Polish**:
   - Cycling MTG land backgrounds (Plains, Island, Swamp, Mountain, Forest)
   - Gradient overlays for text readability
   - Purple accent for selected options with checkmarks
   - Smooth transitions and hover states
   - Emojis for visual interest without being childish

5. **Improved Data Collection**:
   - More granular win condition preferences
   - Interaction style preferences (counterspells, removal, etc.)
   - Table politics and social dynamics
   - Complexity preferences
   - Pet cards and house rules
   - Strategies to avoid 