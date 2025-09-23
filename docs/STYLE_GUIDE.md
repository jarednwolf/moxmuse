# MoxMuse Style Guide

This guide establishes coding standards, design patterns, and best practices for MoxMuse development.

## Code Style

### TypeScript Standards

#### Type Definitions
```typescript
// Use interfaces for object shapes
interface User {
  id: string
  email: string
  name?: string
}

// Use types for unions and computed types
type DeckStrategy = 'aggro' | 'control' | 'combo' | 'midrange'
type UserWithDecks = User & { decks: Deck[] }

// Use enums sparingly, prefer string literals
const POWER_LEVELS = ['casual', 'focused', 'optimized', 'competitive'] as const
type PowerLevel = typeof POWER_LEVELS[number]
```

#### Function Signatures
```typescript
// Prefer explicit return types for public APIs
export function calculateManaCurve(cards: Card[]): ManaCurveData {
  // Implementation
}

// Use async/await over Promises
async function generateDeck(consultation: ConsultationData): Promise<GeneratedDeck> {
  const recommendations = await openaiService.generateCards(consultation)
  return assembleDeck(recommendations)
}

// Use proper error handling
async function safeDeckGeneration(consultation: ConsultationData): Promise<Result<GeneratedDeck, Error>> {
  try {
    const deck = await generateDeck(consultation)
    return { success: true, data: deck }
  } catch (error) {
    return { success: false, error: error as Error }
  }
}
```

#### Naming Conventions
```typescript
// PascalCase for components and types
interface DeckAnalysis {}
const DeckEditor: React.FC = () => {}

// camelCase for variables and functions
const deckCards = []
const calculateStatistics = () => {}

// SCREAMING_SNAKE_CASE for constants
const MAX_DECK_SIZE = 100
const DEFAULT_TIMEOUT = 30000

// kebab-case for file names
deck-editor.tsx
consultation-wizard.tsx
```

### React Component Standards

#### Component Structure
```typescript
// Functional components with TypeScript
interface DeckEditorProps {
  deck: GeneratedDeck
  onDeckUpdate: (deck: GeneratedDeck) => void
  className?: string
}

export const DeckEditor: React.FC<DeckEditorProps> = ({
  deck,
  onDeckUpdate,
  className
}) => {
  // Hooks at the top
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('category')
  
  // Derived state
  const filteredCards = useMemo(() => 
    filterCardsByViewMode(deck.cards, viewMode), 
    [deck.cards, viewMode]
  )
  
  // Event handlers
  const handleCardSelect = useCallback((cardId: string) => {
    setSelectedCard(cardId)
  }, [])
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [])
  
  // Early returns
  if (!deck) {
    return <DeckEditorSkeleton />
  }
  
  // Main render
  return (
    <div className={cn('deck-editor', className)}>
      {/* Component content */}
    </div>
  )
}
```

#### Custom Hooks
```typescript
// Prefix with 'use' and return object with named properties
export const useDeckGeneration = (consultation: ConsultationData) => {
  const [state, setState] = useState<GenerationState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  
  const generateDeck = useCallback(async () => {
    setState('generating')
    setError(null)
    
    try {
      // Generation logic
      setState('complete')
    } catch (err) {
      setError(err as Error)
      setState('error')
    }
  }, [consultation])
  
  return {
    state,
    progress,
    error,
    generateDeck,
    isGenerating: state === 'generating',
    isComplete: state === 'complete',
    hasError: state === 'error'
  }
}
```

### CSS and Styling

#### Tailwind CSS Patterns
```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils'

const Button: React.FC<ButtonProps> = ({ variant, size, className, ...props }) => {
  return (
    <button
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        
        // Variants
        {
          'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
          'border border-input bg-background hover:bg-accent': variant === 'outline',
        },
        
        // Sizes
        {
          'h-10 px-4 py-2': size === 'default',
          'h-9 rounded-md px-3': size === 'sm',
          'h-11 rounded-md px-8': size === 'lg',
        },
        
        className
      )}
      {...props}
    />
  )
}
```

#### Design Tokens
```css
/* Use CSS custom properties for consistent theming */
:root {
  /* Colors */
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 262 83% 58%;
  --primary-foreground: 210 20% 98%;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Typography */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
}
```

#### Component Styling
```typescript
// Co-locate styles with components when needed
const DeckCard = styled.div<{ isSelected: boolean }>`
  padding: var(--spacing-md);
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: var(--card);
  transition: all 0.2s ease;
  
  ${props => props.isSelected && `
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-foreground);
  `}
  
  &:hover {
    background: var(--accent);
  }
`

// Prefer Tailwind classes for simple styling
<div className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
  {/* Content */}
</div>
```

## File Organization

### Directory Structure
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base components (Button, Input, etc.)
│   ├── tutor/           # Tutor-specific components
│   └── shared/          # Shared business components
├── lib/                 # Utilities and configurations
│   ├── utils.ts         # General utilities
│   ├── validations.ts   # Zod schemas
│   └── constants.ts     # App constants
├── hooks/               # Custom React hooks
├── contexts/            # React contexts
├── types/               # TypeScript type definitions
└── styles/              # Global styles and themes
```

### File Naming
```
// Components: PascalCase
DeckEditor.tsx
ConsultationWizard.tsx
CommanderSelection.tsx

// Hooks: camelCase with 'use' prefix
useDeckGeneration.ts
useCommanderSearch.ts

// Utilities: camelCase
formatPrice.ts
calculateStatistics.ts

// Types: camelCase
deckTypes.ts
apiTypes.ts

// Constants: camelCase
featureFlags.ts
apiEndpoints.ts
```

### Import/Export Patterns
```typescript
// Use barrel exports for clean imports
// components/ui/index.ts
export { Button } from './Button'
export { Input } from './Input'
export { Card } from './Card'

// Import from barrel
import { Button, Input, Card } from '@/components/ui'

// Use default exports for main component
// DeckEditor.tsx
export default DeckEditor
export type { DeckEditorProps }

// Use named exports for utilities
// utils.ts
export const formatPrice = (price: number) => {}
export const calculateWinRate = (games: Game[]) => {}
```

## API Design

### tRPC Procedures
```typescript
// Use descriptive procedure names
export const tutorRouter = createTRPCRouter({
  // Good: Describes what it does
  generateFullDeck: protectedProcedure
    .input(GenerateFullDeckSchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
  
  // Good: Clear action and resource
  getCommanderSuggestions: protectedProcedure
    .input(CommanderSuggestionsSchema)
    .query(async ({ ctx, input }) => {
      // Implementation
    }),
})

// Use Zod for input validation
const GenerateFullDeckSchema = z.object({
  sessionId: z.string().uuid(),
  consultationData: ConsultationDataSchema,
  constraints: z.object({
    budget: z.number().positive().optional(),
    powerLevel: z.number().int().min(1).max(4).optional(),
  }).optional(),
})
```

### Error Handling
```typescript
// Use specific error codes
import { TRPCError } from '@trpc/server'

if (!ctx.session?.user) {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'You must be logged in to generate decks'
  })
}

if (rateLimitExceeded) {
  throw new TRPCError({
    code: 'TOO_MANY_REQUESTS',
    message: 'Please wait before generating another deck'
  })
}

// Handle errors gracefully in components
const mutation = trpc.tutor.generateFullDeck.useMutation({
  onError: (error) => {
    switch (error.code) {
      case 'UNAUTHORIZED':
        router.push('/auth/signin')
        break
      case 'TOO_MANY_REQUESTS':
        toast.error('Please wait before generating another deck')
        break
      default:
        toast.error('An unexpected error occurred')
    }
  }
})
```

## Database Patterns

### Prisma Schema
```prisma
// Use descriptive model names
model GeneratedDeck {
  id        String   @id @default(cuid())
  userId    String
  name      String
  commander String
  
  // Use JSON for complex nested data
  strategy         Json  // DeckStrategy object
  consultationData Json  // ConsultationData object
  
  // Use proper relationships
  user  User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  cards GeneratedDeckCard[]
  
  // Add useful indexes
  @@index([userId])
  @@index([createdAt])
}

// Use descriptive field names
model GeneratedDeckCard {
  id       String @id @default(cuid())
  deckId   String
  cardId   String
  quantity Int    @default(1)
  
  // Categorization fields
  category String  // ramp, draw, removal, etc.
  role     String? // primary, secondary, utility
  
  // Relationships
  deck GeneratedDeck @relation(fields: [deckId], references: [id], onDelete: Cascade)
  
  @@unique([deckId, cardId])
  @@index([deckId])
}
```

### Query Patterns
```typescript
// Use select to limit data transfer
const deck = await prisma.generatedDeck.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    commander: true,
    cards: {
      select: {
        cardId: true,
        quantity: true,
        category: true,
      }
    }
  }
})

// Use include for related data
const deckWithAnalysis = await prisma.generatedDeck.findUnique({
  where: { id },
  include: {
    cards: true,
    analysis: true,
  }
})

// Use transactions for data consistency
await prisma.$transaction(async (tx) => {
  const deck = await tx.generatedDeck.create({ data: deckData })
  await tx.generatedDeckCard.createMany({
    data: cards.map(card => ({ ...card, deckId: deck.id }))
  })
})
```

## Testing Standards

### Unit Tests
```typescript
// Test utilities and pure functions
describe('calculateManaCurve', () => {
  it('should calculate correct mana curve distribution', () => {
    const cards = [
      { cmc: 1, quantity: 5 },
      { cmc: 2, quantity: 8 },
      { cmc: 3, quantity: 10 },
    ]
    
    const curve = calculateManaCurve(cards)
    
    expect(curve.distribution).toEqual([0, 5, 8, 10, 0, 0, 0, 0])
    expect(curve.averageCMC).toBeCloseTo(2.17)
  })
})

// Test React components
describe('DeckEditor', () => {
  it('should render deck cards correctly', () => {
    const mockDeck = createMockDeck()
    
    render(<DeckEditor deck={mockDeck} onDeckUpdate={jest.fn()} />)
    
    expect(screen.getByText(mockDeck.name)).toBeInTheDocument()
    expect(screen.getByText(mockDeck.commander)).toBeInTheDocument()
  })
})
```

### Integration Tests
```typescript
// Test API endpoints
describe('tutor router', () => {
  it('should generate full deck with valid consultation data', async () => {
    const caller = appRouter.createCaller({
      session: mockSession,
      prisma: mockPrisma,
    })
    
    const result = await caller.tutor.generateFullDeck({
      sessionId: 'test-session',
      consultationData: mockConsultationData,
    })
    
    expect(result.cards).toHaveLength(100)
    expect(result.commander).toBe(mockConsultationData.commander)
  })
})
```

### E2E Tests
```typescript
// Test complete user workflows
test('user can generate a complete deck through the wizard', async ({ page }) => {
  await page.goto('/tutor')
  
  // Select deck building option
  await page.click('[data-testid="build-full-deck"]')
  
  // Complete wizard steps
  await page.click('[data-testid="know-commander-yes"]')
  await page.fill('[data-testid="commander-input"]', 'Atraxa, Praetors\' Voice')
  await page.click('[data-testid="next-step"]')
  
  // Continue through wizard...
  
  // Verify deck generation
  await expect(page.locator('[data-testid="deck-editor"]')).toBeVisible()
  await expect(page.locator('[data-testid="card-count"]')).toHaveText('100')
})
```

## Performance Guidelines

### React Performance
```typescript
// Use React.memo for expensive components
export const DeckCard = React.memo<DeckCardProps>(({ card, onSelect }) => {
  return (
    <div onClick={() => onSelect(card.id)}>
      {card.name}
    </div>
  )
})

// Use useMemo for expensive calculations
const deckStatistics = useMemo(() => {
  return calculateDeckStatistics(deck.cards)
}, [deck.cards])

// Use useCallback for event handlers
const handleCardSelect = useCallback((cardId: string) => {
  setSelectedCard(cardId)
}, [])
```

### Bundle Optimization
```typescript
// Use dynamic imports for code splitting
const DeckEditor = dynamic(() => import('./DeckEditor'), {
  loading: () => <DeckEditorSkeleton />
})

// Lazy load heavy dependencies
const ChartComponent = lazy(() => import('recharts').then(module => ({
  default: module.PieChart
})))
```

## Accessibility Standards

### Semantic HTML
```typescript
// Use proper semantic elements
<main>
  <section aria-labelledby="deck-editor-heading">
    <h1 id="deck-editor-heading">Deck Editor</h1>
    <nav aria-label="Deck navigation">
      <ul>
        <li><a href="#cards">Cards</a></li>
        <li><a href="#statistics">Statistics</a></li>
      </ul>
    </nav>
  </section>
</main>
```

### ARIA Labels
```typescript
// Provide descriptive labels
<button
  aria-label={`Add ${card.name} to deck`}
  aria-describedby={`${card.id}-description`}
  onClick={() => addCard(card)}
>
  +
</button>

<div id={`${card.id}-description`} className="sr-only">
  {card.name} costs {card.manaCost} and is a {card.type}
</div>
```

### Keyboard Navigation
```typescript
// Support keyboard interactions
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      onSelect()
      break
    case 'Escape':
      onClose()
      break
  }
}

<div
  role="button"
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onClick={onSelect}
>
  {content}
</div>
```

This style guide ensures consistent, maintainable, and accessible code across the MoxMuse codebase.