# MoxMuse 🎴

**AI-Powered Commander Deck Building Platform**

MoxMuse is the most intelligent deck building tool for Magic: The Gathering Commander players. Get complete 100-card decks generated through AI consultation, then refine them with professional editing tools.

![MoxMuse Logo](https://via.placeholder.com/800x400/1a1a1a/8b5cf6?text=MoxMuse+-+AI+Commander+Deck+Builder)

## ✨ Core Features

### 🤖 AI Deck Building Tutor
- **Complete Deck Generation**: Get full 100-card Commander decks tailored to your preferences
- **Guided Consultation**: Multi-step wizard that learns your playstyle and constraints
- **Commander Recommendations**: AI suggests commanders based on your preferred strategy
- **Professional Deck Editor**: Moxfield-quality editing with interactive statistics
- **Strategy Analysis**: Understand your deck's win conditions and play patterns

### 🎯 Key Capabilities
- **Smart Consultation Flow**: Adapts questions based on your answers
- **Budget Optimization**: Build within your price range with upgrade suggestions  
- **Power Level Targeting**: Official Commander Brackets (1-4) from casual to cEDH
- **Interactive Statistics**: Mana curve, color distribution, and type breakdown
- **Export Options**: Share to Moxfield, Archidekt, or download as text

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key
- pnpm package manager

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/moxmuse.git
   cd moxmuse
   pnpm install
   ```

2. **Environment setup**
   ```bash
   cp env.example apps/web/.env.local
   ```
   
   Configure your `.env.local`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/moxmuse"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   OPENAI_API_KEY="your-openai-api-key"
   ```

3. **Database setup**
   ```bash
   pnpm db:push
   pnpm db:generate
   ```

4. **Start development**
   ```bash
   pnpm dev
   ```

5. **Open http://localhost:3000**

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: tRPC, Prisma ORM, PostgreSQL
- **AI**: OpenAI GPT-4 with structured outputs
- **Auth**: NextAuth.js with OAuth providers
- **Testing**: Playwright (E2E), Vitest (Unit)

### Project Structure
```
moxmuse/
├── apps/web/                    # Next.js application
│   ├── app/                     # App router pages
│   ├── src/                     # Source code
│   │   ├── components/          # React components
│   │   │   ├── ui/             # Base UI components
│   │   │   └── tutor/          # Tutor-specific components
│   │   ├── lib/                # Utilities and config
│   │   ├── hooks/              # Custom React hooks
│   │   └── types/              # TypeScript definitions
│   └── public/                 # Static assets
├── packages/
│   ├── api/                    # tRPC API layer
│   ├── db/                     # Database schema & migrations
│   └── shared/                 # Shared types & utilities
└── docs/                       # Documentation
```

## 📚 Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** - Detailed setup guide
- **[Architecture](docs/ARCHITECTURE.md)** - System design and patterns
- **[API Reference](docs/API_REFERENCE.md)** - tRPC procedures and schemas
- **[Style Guide](docs/STYLE_GUIDE.md)** - Code and design standards
- **[Contributing](docs/CONTRIBUTING.md)** - Development workflow
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide

## 🎨 Design System

### Visual Identity
- **Dark Theme**: Professional zinc palette optimized for long sessions
- **MTG Colors**: WUBRG accent colors for Magic-specific elements
- **Typography**: Inter font family for clean, readable text
- **Responsive**: Mobile-first design with desktop enhancements

### Component Library
- Consistent design tokens and spacing
- Accessible color contrasts (WCAG AA)
- Interactive elements with proper focus states
- Loading states and error boundaries

## 🔧 Development

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test         # Run test suite
pnpm test:e2e     # Run E2E tests
pnpm lint         # Lint code
pnpm type-check   # TypeScript validation
pnpm db:push      # Push schema changes
pnpm db:migrate   # Run migrations
```

### Code Standards
- **TypeScript**: Strict mode with comprehensive types
- **ESLint + Prettier**: Automated code formatting
- **Testing**: Unit tests for utilities, E2E for workflows
- **Git**: Conventional commits with automated hooks

## 🚀 Deployment

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] OpenAI API limits configured
- [ ] Error monitoring enabled
- [ ] Performance monitoring active

### Supported Platforms
- **Vercel**: Recommended for Next.js apps
- **Railway**: Database and backend services
- **Docker**: Containerized deployment option

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

### Code of Conduct
- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **Wizards of the Coast** - Magic: The Gathering
- **Scryfall** - Comprehensive card database API
- **OpenAI** - GPT-4 language model
- **Community** - Feedback and contributions

---

**Not affiliated with Wizards of the Coast**

*MoxMuse is an independent tool for Magic: The Gathering players* 

## Editor Setup
- Developing in Cursor? See `docs/guides/CURSOR_SETUP.md` for optimized local workflow. 