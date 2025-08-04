# MoxMuse Style Guide

## Design Philosophy

MoxMuse is designed for **competitive Commander (EDH) players** who value data, efficiency, and winning. Every design decision reflects this focus.

### Core Principles
1. **Professional, Not Playful** - Dark theme, minimal colors, data-focused
2. **MTG Heritage** - Subtle references to iconic cards (Moxen, land types)
3. **Performance First** - Fast loading, smooth animations, no bloat
4. **Mobile Responsive** - Works perfectly on all devices

## Color Palette

### Base Colors
```css
/* Primary backgrounds */
--bg-primary: #18181b;      /* zinc-900 */
--bg-secondary: #27272a;    /* zinc-800 */
--bg-tertiary: #3f3f46;     /* zinc-700 */

/* Text colors */
--text-primary: #fafafa;    /* zinc-50 */
--text-secondary: #a1a1aa;  /* zinc-400 */
--text-muted: #71717a;      /* zinc-500 */

/* Borders */
--border-primary: #3f3f46;  /* zinc-700 */
--border-secondary: #52525b; /* zinc-600 */
```

### WUBRG Accent Colors (MTG Mana Colors)
```css
/* Used sparingly for Mox references */
--white-mana: #ffffff;
--blue-mana: #60a5fa;    /* blue-400 */
--black-mana: #000000;
--red-mana: #ef4444;     /* red-500 */
--green-mana: #22c55e;   /* green-500 */
```

### Semantic Colors
```css
/* Status colors */
--success: #22c55e;      /* green-500 */
--warning: #f59e0b;      /* amber-500 */
--error: #ef4444;        /* red-500 */
--info: #3b82f6;         /* blue-500 */
```

## Typography

### Font Stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

### Font Weights
- **Light (300)**: Headers, display text
- **Normal (400)**: Body text
- **Medium (500)**: Buttons, emphasis
- **Semibold (600)**: Small headers

### Text Sizes
```css
/* Headers */
--text-5xl: 3rem;        /* Hero headers */
--text-4xl: 2.25rem;     /* Page headers */
--text-3xl: 1.875rem;    /* Section headers */
--text-2xl: 1.5rem;      /* Subsection headers */
--text-xl: 1.25rem;      /* Card headers */

/* Body */
--text-lg: 1.125rem;     /* Large body text */
--text-base: 1rem;       /* Normal body text */
--text-sm: 0.875rem;     /* Small text */
--text-xs: 0.75rem;      /* Tiny text, labels */
```

### Letter Spacing
- **Headers**: `tracking-wider` or `tracking-widest`
- **Uppercase text**: `tracking-widest`
- **Body text**: Normal

## Layout Patterns

### Page Structure
```tsx
<div className="min-h-screen bg-zinc-900 text-zinc-100">
  {/* Header with Mox circles */}
  <header className="relative border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm z-50">
    {/* Header content */}
  </header>

  {/* Main content with cycling backgrounds */}
  <main className="relative">
    {/* Cycling backgrounds layer */}
    <div className="absolute inset-0 cycling-backgrounds">
      <div className="bg-layer bg-plains"></div>
      <div className="bg-layer bg-island"></div>
      <div className="bg-layer bg-swamp"></div>
      <div className="bg-layer bg-mountain"></div>
      <div className="bg-layer bg-forest"></div>
    </div>
    
    {/* Dark overlay for text readability */}
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80"></div>
    
    {/* Content */}
    <div className="relative">
      {/* Page content */}
    </div>
  </main>
</div>
```

### Container Widths
```css
--container-sm: 640px;    /* max-w-sm */
--container-md: 768px;    /* max-w-md */
--container-lg: 1024px;   /* max-w-lg */
--container-xl: 1280px;   /* max-w-xl */
--container-2xl: 1536px;  /* max-w-2xl */
```

## Components

### Header with Mox Circles
```tsx
<header className="relative border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm z-50">
  <div className="container mx-auto px-6 py-4">
    <Link href="/" className="flex items-center gap-4">
      <div className="flex -space-x-2">
        <Circle className="w-8 h-8 text-white fill-white/10 border border-zinc-600" />
        <Circle className="w-8 h-8 text-blue-400 fill-blue-900/30 border border-blue-800" />
        <Circle className="w-8 h-8 text-zinc-400 fill-black border border-zinc-400" />
        <Circle className="w-8 h-8 text-red-500 fill-red-900/30 border border-red-800" />
        <Circle className="w-8 h-8 text-green-500 fill-green-900/30 border border-green-800" />
      </div>
      <div>
        <h1 className="text-2xl font-light tracking-wider">MOXMUSE</h1>
        <p className="text-[11px] text-zinc-500 tracking-widest uppercase">Commander Deck Engine</p>
      </div>
    </Link>
  </div>
</header>
```

### Glassmorphic Cards
```tsx
<div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-6 rounded-lg shadow-lg">
  {/* Card content */}
</div>
```

### Primary Button
```tsx
<button className="bg-zinc-100 text-zinc-900 px-6 py-2.5 font-medium hover:bg-zinc-200 transition-all">
  Button Text
</button>
```

### Secondary Button
```tsx
<button className="border border-zinc-700 text-zinc-100 px-6 py-2.5 hover:bg-zinc-800 transition-all">
  Button Text
</button>
```

### Input Fields
```tsx
<input
  type="text"
  className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent transition-all"
  placeholder="Placeholder text"
/>
```

### Success/Error States
```tsx
{/* Success */}
<div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
  <p className="text-green-400">Success message</p>
</div>

{/* Error */}
<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
  <p className="text-red-400">Error message</p>
</div>
```

## Background System

### Cycling Backgrounds
The site uses a 25-second animation cycle through 5 fantasy landscape backgrounds representing MTG's basic land types:

1. **Plains** (White) - 0-5 seconds
2. **Island** (Blue) - 5-10 seconds  
3. **Swamp** (Black) - 10-15 seconds
4. **Mountain** (Red) - 15-20 seconds
5. **Forest** (Green) - 20-25 seconds

### Implementation
```css
/* In globals.css */
.bg-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  animation: cycle 25s infinite;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.bg-plains {
  background-image: url('/images/plains1.png');
  animation-delay: 0s;
}

.bg-island {
  background-image: url('/images/island1.png');
  animation-delay: 5s;
}

/* ... etc */
```

### Overlay for Readability
Always use a dark gradient overlay when text appears over backgrounds:
```tsx
<div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/50 to-zinc-900/80"></div>
```

## Icons

### Lucide Icons
Use Lucide React for all icons. Common ones:
- **Navigation**: ChevronRight, ArrowLeft, Menu
- **Actions**: Plus, Trash2, Edit, Save
- **Status**: Check, X, AlertCircle, Info
- **Features**: Zap, TrendingUp, MessageSquare, Database

### Icon Sizes
- **Small**: w-4 h-4 (16px)
- **Medium**: w-5 h-5 (20px) 
- **Large**: w-6 h-6 (24px)
- **XL**: w-8 h-8 (32px)

## Animation

### Transition Classes
```css
transition-all       /* For general transitions */
transition-colors    /* For color changes only */
transition-opacity   /* For fade effects */
duration-300        /* Standard duration */
```

### Hover Effects
- **Scale**: `hover:scale-[1.02]` for subtle growth
- **Brightness**: `hover:brightness-110` for images
- **Opacity**: `hover:opacity-80` for fade effect

## Spacing

### Padding/Margin Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Copy Guidelines

### Tone
- **Professional**: Use data and metrics, not emotions
- **Direct**: Get to the point quickly
- **Competitive**: Focus on winning, optimization, efficiency

### Avoid
- Fun, casual, friendly
- Exclamation points (except sparingly)
- Childish language or emojis (except established MTG symbols)

### Emphasize
- Speed, efficiency, data
- Competitive advantage
- Professional tools
- Community size/activity

## Mobile Responsiveness

### Breakpoints
```css
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Desktops */
xl: 1280px  /* Large desktops */
2xl: 1536px /* Extra large */
```

### Mobile Patterns
- Stack columns on small screens
- Reduce padding/margins
- Ensure touch targets are 44px minimum
- Hide non-essential elements

## Performance

### Image Optimization
- Use WebP format when possible
- Lazy load off-screen images
- Provide width/height to prevent layout shift

### CSS Best Practices
- Use Tailwind utilities over custom CSS
- Purge unused styles in production
- Minimize custom animations

### Font Loading
- Use system fonts (no web font downloads)
- Preload critical assets
- Enable font-display: swap

## Accessibility

### Color Contrast
- Ensure WCAG AA compliance (4.5:1 for normal text)
- Test with color blindness simulators
- Don't rely on color alone for information

### Keyboard Navigation
- All interactive elements keyboard accessible
- Visible focus indicators
- Logical tab order

### Screen Readers
- Semantic HTML structure
- Proper ARIA labels where needed
- Alt text for images

## File Organization

### Component Structure
```
components/
  ui/               # Reusable UI components
    Button.tsx
    Card.tsx
    Input.tsx
  layout/           # Layout components
    Header.tsx
    Footer.tsx
  features/         # Feature-specific components
    DeckBuilder/
    CollectionGrid/
```

### Style Organization
- Use Tailwind classes inline
- Global styles in `globals.css`
- Component-specific styles co-located

## Testing Checklist

- [ ] Looks good on mobile (320px+)
- [ ] Backgrounds cycle smoothly
- [ ] Text is readable over backgrounds
- [ ] Forms are accessible
- [ ] Hover states work
- [ ] Loading states present
- [ ] Error states handled
- [ ] Page loads quickly
- [ ] No layout shift
- [ ] Keyboard navigable 