import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeckBuildingWizard } from '../../components/tutor/wizard/DeckBuildingWizard'
import { DeckEditor } from '../../components/tutor/deck-editor/DeckEditor'
import { MobileDeckEditor } from '../../components/tutor/deck-editor/MobileDeckEditor'
import { CommanderSelection } from '../../components/tutor/commander/CommanderSelection'
import { InteractiveManaCurve } from '../../components/tutor/deck-editor/InteractiveManaCurve'
import { WizardProvider } from '../../contexts/WizardContext'
import { TutorDeckProvider } from '../../contexts/TutorDeckContext'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock tRPC
const mockTrpc = {
  tutor: {
    generateCompleteDeck: {
      useMutation: vi.fn(() => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        data: null,
      })),
    },
    analyzeDecksRealTime: {
      useQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
      })),
    },
    searchCommanders: {
      useQuery: vi.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
      })),
    },
  },
}

vi.mock('../../lib/trpc/client', () => ({
  trpc: mockTrpc,
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('Accessibility Tests', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
    vi.restoreAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WizardProvider>
          <TutorDeckProvider>
            {component}
          </TutorDeckProvider>
        </WizardProvider>
      </QueryClientProvider>
    )
  }

  const mockDeck = {
    id: 'accessibility-test-deck',
    name: 'Accessibility Test Deck',
    commander: 'Accessible Commander',
    cards: [
      {
        id: 'sol-ring',
        name: 'Sol Ring',
        quantity: 1,
        category: 'ramp',
        cmc: 1,
        types: ['Artifact'],
        colors: [],
      },
      {
        id: 'lightning-bolt',
        name: 'Lightning Bolt',
        quantity: 1,
        category: 'removal',
        cmc: 1,
        types: ['Instant'],
        colors: ['R'],
      },
    ],
    strategy: 'Aggro',
    powerLevel: 6,
    budget: 100,
  }

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in deck building wizard', async () => {
      const { container } = renderWithProviders(<DeckBuildingWizard />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in deck editor', async () => {
      mockTrpc.tutor.analyzeDecksRealTime.useQuery.mockReturnValue({
        data: {
          synergyAnalysis: { synergyScore: 7.5, cardSynergies: [] },
          strategyAnalysis: { primaryStrategy: 'Aggro', strengths: [] },
          recommendations: [],
        },
        isLoading: false,
        isError: false,
        error: null,
      })

      const { container } = renderWithProviders(<DeckEditor deck={mockDeck} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in mobile deck editor', async () => {
      const { container } = renderWithProviders(<MobileDeckEditor deck={mockDeck} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have no accessibility violations in commander selection', async () => {
      const mockCommanders = [
        { name: 'Atraxa, Praetors\' Voice', colors: ['W', 'U', 'B', 'G'] },
        { name: 'Edgar Markov', colors: ['W', 'B', 'R'] },
      ]

      mockTrpc.tutor.searchCommanders.useQuery.mockReturnValue({
        data: mockCommanders,
        isLoading: false,
        isError: false,
        error: null,
      })

      const { container } = renderWithProviders(
        <CommanderSelection onSelect={vi.fn()} />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels for all interactive elements', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Check form inputs have labels
      const commanderInput = screen.getByRole('combobox', { name: /commander/i })
      expect(commanderInput).toHaveAttribute('aria-label')
      expect(commanderInput).toHaveAttribute('aria-describedby')

      // Check buttons have accessible names
      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toHaveAccessibleName()

      // Check navigation has proper structure
      const navigation = screen.getByRole('navigation')
      expect(navigation).toHaveAttribute('aria-label')
    })

    it('should announce dynamic content changes', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Mock screen reader announcements
      const announcements: string[] = []
      const mockAnnounce = vi.fn((message: string) => {
        announcements.push(message)
      })

      // Add aria-live region
      const liveRegion = document.createElement('div')
      liveRegion.setAttribute('aria-live', 'polite')
      liveRegion.setAttribute('aria-atomic', 'true')
      document.body.appendChild(liveRegion)

      // Simulate step change
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      await waitFor(() => {
        const stepIndicator = screen.getByText(/step 2/i)
        expect(stepIndicator).toBeInTheDocument()
      })

      // Should announce step change
      expect(liveRegion.textContent).toContain('Step 2')
    })

    it('should provide descriptive text for complex UI elements', async () => {
      const mockManaCurve = [2, 5, 8, 6, 4, 2, 1, 0]
      
      renderWithProviders(
        <InteractiveManaCurve
          distribution={mockManaCurve}
          onCMCFilter={vi.fn()}
          isMobile={false}
        />
      )

      // Chart should have description
      const chart = screen.getByRole('img', { name: /mana curve/i })
      expect(chart).toHaveAttribute('aria-describedby')

      const description = screen.getByText(/distribution of cards by mana cost/i)
      expect(description).toBeInTheDocument()

      // Individual bars should be accessible
      const bars = screen.getAllByRole('button')
      bars.forEach((bar, index) => {
        expect(bar).toHaveAttribute('aria-label')
        expect(bar.getAttribute('aria-label')).toContain(`${index} mana`)
        expect(bar.getAttribute('aria-label')).toContain(`${mockManaCurve[index]} cards`)
      })
    })

    it('should support keyboard navigation for all interactive elements', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should be able to navigate through cards with keyboard
      const firstCard = screen.getAllByRole('button')[0]
      firstCard.focus()
      expect(firstCard).toHaveFocus()

      // Tab should move to next interactive element
      await user.tab()
      const nextElement = document.activeElement
      expect(nextElement).not.toBe(firstCard)
      expect(nextElement).toHaveAttribute('tabindex')

      // Arrow keys should navigate within card list
      fireEvent.keyDown(firstCard, { key: 'ArrowDown' })
      await waitFor(() => {
        const nextCard = screen.getAllByRole('button')[1]
        expect(nextCard).toHaveFocus()
      })
    })

    it('should provide proper heading structure', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should have logical heading hierarchy
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toBeInTheDocument()

      const h2Elements = screen.getAllByRole('heading', { level: 2 })
      expect(h2Elements.length).toBeGreaterThan(0)

      // No heading levels should be skipped
      const allHeadings = screen.getAllByRole('heading')
      const headingLevels = allHeadings.map(h => parseInt(h.tagName.charAt(1)))
      
      for (let i = 1; i < headingLevels.length; i++) {
        const currentLevel = headingLevels[i]
        const previousLevel = headingLevels[i - 1]
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation in wizard', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Should be able to navigate entire wizard with keyboard
      const commanderInput = screen.getByRole('combobox', { name: /commander/i })
      commanderInput.focus()

      // Type to search
      await user.type(commanderInput, 'Atraxa')

      // Should be able to select with keyboard
      fireEvent.keyDown(commanderInput, { key: 'ArrowDown' })
      fireEvent.keyDown(commanderInput, { key: 'Enter' })

      // Should move to next step
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.tab()
      expect(nextButton).toHaveFocus()

      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(screen.getByText(/strategy/i)).toBeInTheDocument()
      })
    })

    it('should provide visible focus indicators', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      const interactiveElements = screen.getAllByRole('button')
      
      for (const element of interactiveElements.slice(0, 5)) {
        element.focus()
        
        // Should have visible focus indicator
        const computedStyle = window.getComputedStyle(element)
        const hasFocusOutline = computedStyle.outline !== 'none' || 
                               computedStyle.boxShadow !== 'none' ||
                               element.classList.contains('focus-visible')
        
        expect(hasFocusOutline).toBe(true)
      }
    })

    it('should trap focus in modal dialogs', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Open card detail modal
      const cardButton = screen.getAllByRole('button')[0]
      await user.click(cardButton)

      await waitFor(() => {
        const modal = screen.getByRole('dialog')
        expect(modal).toBeInTheDocument()
      })

      // Focus should be trapped within modal
      const modal = screen.getByRole('dialog')
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      // Tab from last element should go to first
      lastElement.focus()
      await user.tab()
      expect(firstElement).toHaveFocus()

      // Shift+Tab from first element should go to last
      firstElement.focus()
      await user.tab({ shift: true })
      expect(lastElement).toHaveFocus()
    })

    it('should support escape key to close modals', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Open modal
      const cardButton = screen.getAllByRole('button')[0]
      await user.click(cardButton)

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Escape should close modal
      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet color contrast requirements', async () => {
      const { container } = renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Check text elements have sufficient contrast
      const textElements = container.querySelectorAll('p, span, div, button')
      
      for (const element of Array.from(textElements).slice(0, 10)) {
        const computedStyle = window.getComputedStyle(element)
        const color = computedStyle.color
        const backgroundColor = computedStyle.backgroundColor

        // This is a simplified check - in real implementation,
        // you'd use a proper contrast ratio calculation
        expect(color).not.toBe(backgroundColor)
      }
    })

    it('should not rely solely on color to convey information', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Color distribution should have text labels
      const colorElements = screen.getAllByTestId('color-indicator')
      colorElements.forEach(element => {
        expect(element).toHaveAttribute('aria-label')
        expect(element.textContent || element.getAttribute('aria-label')).toMatch(/white|blue|black|red|green/i)
      })

      // Status indicators should have text or icons
      const statusElements = screen.getAllByTestId('status-indicator')
      statusElements.forEach(element => {
        const hasText = element.textContent && element.textContent.trim().length > 0
        const hasAriaLabel = element.getAttribute('aria-label')
        const hasIcon = element.querySelector('svg, .icon')
        
        expect(hasText || hasAriaLabel || hasIcon).toBe(true)
      })
    })

    it('should support high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should apply high contrast styles
      const container = screen.getByTestId('deck-editor')
      expect(container).toHaveClass('high-contrast')
    })
  })

  describe('Motion and Animation Accessibility', () => {
    it('should respect reduced motion preferences', async () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      renderWithProviders(<DeckBuildingWizard />)

      // Should disable animations
      const animatedElements = screen.getAllByTestId('animated-element')
      animatedElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element)
        expect(computedStyle.animationDuration).toBe('0s')
        expect(computedStyle.transitionDuration).toBe('0s')
      })
    })

    it('should provide alternative ways to access animated content', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Progress animations should have text alternatives
      const progressIndicator = screen.getByRole('progressbar')
      expect(progressIndicator).toHaveAttribute('aria-valuenow')
      expect(progressIndicator).toHaveAttribute('aria-valuemin')
      expect(progressIndicator).toHaveAttribute('aria-valuemax')
      expect(progressIndicator).toHaveAttribute('aria-valuetext')
    })
  })

  describe('Form Accessibility', () => {
    it('should associate labels with form controls', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // All form inputs should have labels
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        const hasLabel = input.getAttribute('aria-labelledby') || 
                        input.getAttribute('aria-label') ||
                        screen.queryByLabelText(input.getAttribute('name') || '')
        expect(hasLabel).toBeTruthy()
      })

      // Select elements should have labels
      const selects = screen.getAllByRole('combobox')
      selects.forEach(select => {
        const hasLabel = select.getAttribute('aria-labelledby') || 
                        select.getAttribute('aria-label')
        expect(hasLabel).toBeTruthy()
      })
    })

    it('should provide helpful error messages', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Try to proceed without required field
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert')
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveAttribute('aria-live', 'polite')
      })

      // Error should be associated with field
      const commanderInput = screen.getByRole('combobox', { name: /commander/i })
      const errorId = errorMessage.getAttribute('id')
      expect(commanderInput.getAttribute('aria-describedby')).toContain(errorId)
    })

    it('should group related form controls', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Strategy options should be in a fieldset
      const strategyFieldset = screen.getByRole('group', { name: /strategy/i })
      expect(strategyFieldset).toBeInTheDocument()

      const strategyOptions = screen.getAllByRole('radio')
      strategyOptions.forEach(option => {
        expect(strategyFieldset).toContainElement(option)
      })
    })
  })

  describe('Mobile Accessibility', () => {
    it('should maintain accessibility on mobile devices', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      Object.defineProperty(window, 'innerHeight', { value: 667 })

      const { container } = renderWithProviders(<MobileDeckEditor deck={mockDeck} />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have appropriate touch target sizes', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const touchTargets = screen.getAllByRole('button')
      touchTargets.forEach(target => {
        const rect = target.getBoundingClientRect()
        const size = Math.min(rect.width, rect.height)
        
        // Touch targets should be at least 44px (iOS) or 48dp (Android)
        expect(size).toBeGreaterThanOrEqual(44)
      })
    })

    it('should support voice control', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // All interactive elements should have accessible names for voice control
      const interactiveElements = screen.getAllByRole('button')
      interactiveElements.forEach(element => {
        const accessibleName = element.getAttribute('aria-label') || 
                              element.textContent ||
                              element.getAttribute('title')
        expect(accessibleName).toBeTruthy()
        expect(accessibleName!.trim().length).toBeGreaterThan(0)
      })
    })
  })

  describe('Assistive Technology Compatibility', () => {
    it('should work with screen readers', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should have proper landmark regions
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('navigation')).toBeInTheDocument()

      // Should have proper list structure for cards
      const cardList = screen.getByRole('list')
      expect(cardList).toBeInTheDocument()

      const cardItems = screen.getAllByRole('listitem')
      expect(cardItems.length).toBeGreaterThan(0)
    })

    it('should support voice recognition software', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Commands should be recognizable by voice
      const commands = [
        'next',
        'previous', 
        'generate deck',
        'cancel',
        'save',
      ]

      commands.forEach(command => {
        const element = screen.queryByRole('button', { name: new RegExp(command, 'i') })
        if (element) {
          expect(element).toHaveAccessibleName()
        }
      })
    })

    it('should support switch navigation', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // All interactive elements should be reachable via tab navigation
      const interactiveElements = screen.getAllByRole('button')
      
      let currentElement = interactiveElements[0]
      currentElement.focus()
      expect(currentElement).toHaveFocus()

      // Should be able to navigate through all elements
      for (let i = 1; i < Math.min(5, interactiveElements.length); i++) {
        await user.tab()
        const nextElement = document.activeElement
        expect(nextElement).toBeInstanceOf(HTMLElement)
        expect(nextElement).toHaveAttribute('tabindex')
      }
    })
  })
})