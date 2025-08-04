# MoxMuse 🎴

Advanced deck analysis engine for competitive Commander (EDH) players. Build winning decks in half the time with AI-powered recommendations, real-time price tracking, and collection management.

![MoxMuse Logo](https://via.placeholder.com/800x400/1a1a1a/8b5cf6?text=MoxMuse+-+Commander+Deck+Engine)

## 🚀 Features

### Core Features
- **AI-Powered Recommendations**: GPT-4 analyzes your deck strategy and suggests optimal cards
- **Guided Deck Building**: Interactive consultation wizard walks you through deck creation
- **Collection Sync**: Import from Moxfield, Archidekt, or CSV in seconds
- **Price Tracking**: Real-time prices from TCGPlayer, Card Kingdom, and more
- **Synergy Analysis**: Score card combinations based on 100K+ tournament games
- **Power Level Estimation**: Official Commander Brackets (1-5) from Exhibition to cEDH
- **Budget Alternatives**: Find cheaper cards with similar effects

### TolarianTutor AI Assistant
- **Dual-Mode Interface**: Choose between guided wizard or open chat
- **Smart Consultation Flow**: Adapts questions based on your answers
- **Multi-Select Preferences**: Support for complex deck requirements
- **Win Condition Analysis**: Combat, combo, or alternative strategies
- **Social Dynamics**: Table politics and threat assessment
- **Collection Integration**: Build with cards you own or explore new options

### Design Highlights
- Professional dark theme designed for competitive players
- Cycling fantasy backgrounds (Plains, Island, Swamp, Mountain, Forest)
- Mox-inspired branding with five colored circles (WUBRG)
- Mobile-responsive design
- No ads, no clutter - just data

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: tRPC, Prisma, PostgreSQL
- **AI**: OpenAI GPT-4 with function calling
- **Auth**: NextAuth.js with Moxfield OAuth
- **Cache**: Redis for API rate limiting
- **Deployment**: Vercel/Railway ready

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/moxmuse.git
   cd moxmuse
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example apps/web/.env.local
   ```
   
   Edit `.env.local` with your keys:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/moxmuse"
   
   # Redis
   REDIS_URL="redis://localhost:6379"
   
   # Auth
   NEXTAUTH_URL="http://localhost:3001"
   NEXTAUTH_SECRET="generate-a-secret-here"
   
   # OpenAI
   OPENAI_API_KEY="your-openai-key"
   
   # Moxfield OAuth
   MOXFIELD_CLIENT_ID="your-client-id"
   MOXFIELD_CLIENT_SECRET="your-client-secret"
   ```

4. **Set up the database**
   ```bash
   pnpm db:push
   ```

5. **Run the development server**
   ```bash
   pnpm dev
   ```

6. **Visit http://localhost:3001**

## 🗂️ Project Structure

```
moxmuse/
├── apps/
│   └── web/                 # Next.js frontend
├── packages/
│   ├── api/                 # tRPC API
│   ├── db/                  # Prisma database
│   └── shared/              # Shared types & utils
└── docs/                    # Documentation
```

## 🎨 Customization

### Adding Background Images

1. Find CC0/public domain fantasy landscapes
2. Save as:
   - `/public/images/plains-bg.jpg`
   - `/public/images/island-bg.jpg`
   - `/public/images/swamp-bg.jpg`
   - `/public/images/mountain-bg.jpg`
   - `/public/images/forest-bg.jpg`
3. Uncomment the image CSS in `apps/web/app/globals.css`

### Theming

The color scheme uses Tailwind's zinc palette with MTG color accents:
- White: `#ffffff`
- Blue: `#60a5fa`
- Black: `#000000`
- Red: `#ef4444`
- Green: `#22c55e`

## 🔐 Security

- Session-based auth with JWT tokens
- Rate limiting on all external APIs
- Input validation with Zod schemas
- SQL injection prevention via Prisma
- Minimal PII storage (email, name, avatar only)

## 📝 API Documentation

### tRPC Procedures

- `tutor.recommendAndLink` - Get AI card recommendations
- `collection.sync` - Sync from Moxfield
- `collection.importCSV` - Import from CSV
- `deck.create/update/delete` - Manage decks
- `tutor.trackClick` - Track affiliate clicks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- MTG and all card names are © Wizards of the Coast
- Built with data from Scryfall API
- Powered by OpenAI GPT-4
- Community contributions welcome!

## 🚧 Roadmap

- [ ] Add fantasy background images
- [ ] Implement CSV upload
- [ ] Add deck diff visualization
- [ ] Build mobile app
- [ ] Add trade matching
- [ ] Multi-language support

---

**Not affiliated with Wizards of the Coast** 