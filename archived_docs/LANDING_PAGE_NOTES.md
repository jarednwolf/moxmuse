# Landing Page Design Notes

## Design Philosophy

The MoxMuse landing page was redesigned with a specific audience in mind: **competitive Commander (EDH) players** who care about data, efficiency, and winning. Every design decision reflects this focus.

### Key Design Principles

1. **Professional, Not Playful**: Dark theme, minimal colors, data-focused content
2. **MTG Heritage**: Subtle references to iconic cards (Moxen, Black Lotus, Tolarian Academy)
3. **Performance Metrics**: Real numbers that matter to competitive players
4. **No Fluff**: Every element serves a purpose - no decorative nonsense

## Visual Design

### Color Scheme
- **Base**: Zinc-900 (near black) for professional aesthetic
- **Text**: Zinc-100 (near white) for high contrast
- **Accents**: MTG's five colors (WUBRG) used sparingly
  - White: #ffffff
  - Blue: #60a5fa
  - Black: #000000 (with zinc-400 border)
  - Red: #ef4444
  - Green: #22c55e

### Mox Integration
The five colored circles represent the legendary Mox artifacts:
- Mox Pearl (White)
- Mox Sapphire (Blue)
- Mox Jet (Black)
- Mox Ruby (Red)
- Mox Emerald (Green)

These appear in the header logo and as small dots in the hero section.

### Typography
- Font: System fonts (clean, fast loading)
- Weights: Light (300) for headers, normal (400) for body
- Tracking: Wide for headers (tracking-wider, tracking-widest)

## Background Cycling System

### Implementation
- 5 backgrounds cycle every 5 seconds (25 seconds total)
- Each represents an MTG basic land type
- Currently using gradient placeholders
- CSS animation with opacity transitions

### How to Add Real Images
1. Find high-quality fantasy landscapes (CC0/public domain)
2. Save to `/public/images/`:
   - `plains-bg.jpg` - Light, open plains
   - `island-bg.jpg` - Ocean/coastal scene
   - `swamp-bg.jpg` - Dark bog/swamp
   - `mountain-bg.jpg` - Red rock mountains
   - `forest-bg.jpg` - Dense green forest
3. Uncomment the `background-image` lines in `globals.css`

### Animation Details
```css
@keyframes cycle {
  0% { opacity: 0; }     // Start invisible
  4% { opacity: 1; }     // Fade in (1 second)
  20% { opacity: 1; }    // Stay visible (4 seconds)
  24% { opacity: 0; }    // Fade out (1 second)
  100% { opacity: 0; }   // Stay invisible until next cycle
}
```

## Content Strategy

### Hero Section
- **Headline**: "Build winning decks in half the time"
  - Focus on speed and results
  - No mention of "fun" or "casual"
- **Subtext**: Data-driven value proposition
  - Mentions "millions of deck lists"
  - References "synergies" and "optimization"

### Three Pillars
1. **SolSync** (Collection Import)
   - Name references Sol Ring / Sun / Mox Pearl
   - Focus: Speed and duplicate prevention
   
2. **LotusList** (Collection Browser)
   - Name references Black Lotus
   - Focus: Win rates and competitive stats
   
3. **TolarianTutor** (AI Chat)
   - Name references Tolarian Academy
   - Focus: Optimization for different power levels

### Stats Section
Real metrics competitive players care about:
- **65% Faster**: Deck building time
- **Save 20%**: Price tracking alerts
- **Win More**: Data from 100K+ games
- **50K+ Decks**: Community database

### Features Lists
Two columns focusing on:
1. **Smart deck analysis**: Synergy, meta, power level
2. **Price tracking**: Real-time, alerts, bulk optimization

## Technical Implementation

### Next.js 14 App Router
- Server components for fast initial load
- Client-side navigation between features
- Responsive design with Tailwind CSS

### Performance Optimizations
- System fonts (no web font loading)
- CSS animations (no JavaScript)
- Lazy loading for off-screen content
- Minimal external dependencies

### Mobile Responsiveness
- Single column layout on mobile
- Touch-friendly tap targets
- Readable font sizes
- No horizontal scrolling

## Future Enhancements

1. **Real Background Images**
   - Find/commission fantasy art
   - Optimize for web (WebP format)
   - Add loading states

2. **Interactive Elements**
   - Hover effects on feature cards
   - Parallax scrolling on backgrounds
   - Animated statistics counters

3. **Social Proof**
   - Tournament winner testimonials
   - Discord member count
   - Live deck building counter

## Copy Guidelines

When writing copy for MoxMuse:
- Use data and metrics, not emotions
- Reference speed, efficiency, winning
- Avoid: "fun", "casual", "friendly"
- Include: "competitive", "optimize", "data-driven"

## Competitor Analysis

Unlike other MTG tools:
- **No cartoon mascots** (looking at you, other apps)
- **No bright colors** (professional > playful)
- **No social features** (focus on winning)
- **All data, no fluff** (every stat matters)

## Maintenance Notes

- Background images should be at least 1920x1080
- Test cycling animation on slow devices
- Keep copy concise - competitive players scan, don't read
- Monitor page load time - target < 1 second
- A/B test CTA button text and placement 