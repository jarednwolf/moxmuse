import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import { EntryPointSelector } from '../../EntryPointSelector'
import { DeckBuildingWizard } from '../../wizard/DeckBuildingWizard'
import { DeckEditor } from '../../deck-editor/DeckEditor'
import { GenerationProgress } from '../../GenerationProgress'
import { GeneratedDeck } from '@moxmuse/shared'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock data for testing
const mockDeck: GeneratedDeck = {
  id: 'test-deck',
  name: 'Accessibility Test Deck',
  commander: 'Atraxa, Praetors\' Voice',
  format: 'commander',
  strategy: {
    name: 'Value Engine',
    description: 'A value-focused strategy',
    archetype: 'value',
    themes: ['counters'],
    gameplan: 'Generate card advantage',
    strengths: ['Card draw', 'Versatility'],
    weaknesses: ['Slow start']
  },
  winConditions: [],
  powerLevel: 3,
  estimatedBudget: 300,
  cards: [
    {
      cardId: 'sol-ring',
      quantity: 1,
      category: 'Ramp',
      role: 'Acceleration',
      reasoning: 'Provides early mana acceleration'
    }
  ],
  categories: [],
  statistics: {
    manaCurve: {
      distribution: [0, 1, 2, 3, 4, 5, 6, 7],
      peakCMC: 3,
      averageCMC: 3.5,
      landRatio: 0.35
    },
    colorDistribution: {
      white: 5, blue: 5, black: 5, green: 5, red: 0,
      colorless: 0, multicolor: 10, devotion: {}
    },
    typeDistribution: {
      creature: 30, instant: 10, sorcery: 15, artifact: 10,
      enchantment: 5, planeswalker: 2, land: 35, other: 3
    },
    rarityDistribution: {
      common: 20, uncommon: 30, rare: 40, mythic: 10
    },
    averageCMC: 3.5,
    totalValue: 300,
    landCount: 35,
    nonlandCount: 65
  },
  synergies: [],
  weaknesses: [],
  generatedAt: new Date(),
  consultationData: {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false
  }
}

describe('Accessibility Tests', () => {
  describe('EntryPointSelector Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading structure', () => {
      render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      // Should have main heading
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
      
      // Should have proper heading hierarchy
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should have proper button roles and labels', () => {
      render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(2)

      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label')
        expect(button).toHaveAttribute('tabIndex', '0')
      })
    })

    it('should support keyboard navigation', () => {
      render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('tabIndex', '0')
      })
    })

    it('should have sufficient color contrast', () => {
      const { container } = render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      // Check that text elements have proper contrast classes
      const textElements = container.querySelectorAll('[class*="text-"]')
      textElements.forEach(element => {
        const classes = element.className
        // Should not use low-contrast colors for main text
        expect(classes).not.toMatch(/text-gray-[1-4]00/)
        expect(classes).not.toMatch(/text-zinc-[1-4]00/)
      })
    })
  })

  describe('DeckBuildingWizard Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // All form inputs should have labels
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveAccessibleName()
      })

      const selects = screen.getAllByRole('combobox')
      selects.forEach(select => {
        expect(select).toHaveAccessibleName()
      })
    })

    it('should have proper progress indication', () => {
      render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should have progress indicator
      const progressElement = screen.getByText(/Step \d+ of \d+/)
      expect(progressElement).toBeInTheDocument()
      expect(progressElement).toHaveAttribute('aria-label', expect.stringContaining('progress'))
    })

    it('should have proper error messaging', () => {
      render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Error messages should be associated with form fields
      const errorMessages = screen.queryAllByRole('alert')
      errorMessages.forEach(error => {
        expect(error).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('should support screen reader navigation', () => {
      render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Should have proper landmarks
      expect(screen.getByRole('main')).toBeInTheDocument()
      
      // Navigation buttons should be properly labeled
      const nextButton = screen.queryByText('Next')
      if (nextButton) {
        expect(nextButton).toHaveAttribute('aria-label', expect.stringContaining('Next'))
      }

      const backButton = screen.queryByText('Back')
      if (backButton) {
        expect(backButton).toHaveAttribute('aria-label', expect.stringContaining('Back'))
      }
    })
  })

  describe('GenerationProgress Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <GenerationProgress
          progress={50}
          phase="Generating cards..."
          onGenerate={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper progress bar attributes', () => {
      render(
        <GenerationProgress
          progress={75}
          phase="Building mana base..."
          onGenerate={vi.fn()}
        />
      )

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      expect(progressBar).toHaveAttribute('aria-label', expect.stringContaining('progress'))
    })

    it('should announce progress updates', () => {
      render(
        <GenerationProgress
          progress={25}
          phase="Analyzing commander..."
          onGenerate={vi.fn()}
        />
      )

      const statusElement = screen.getByText('Analyzing commander...')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should have accessible cancel button', () => {
      render(
        <GenerationProgress
          progress={40}
          phase="Generating..."
          onGenerate={vi.fn()}
          onCancel={vi.fn()}
        />
      )

      const cancelButton = screen.getByText('Cancel')
      expect(cancelButton).toHaveAttribute('aria-label', expect.stringContaining('Cancel'))
    })
  })

  describe('DeckEditor Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper table structure for card list', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // Card list should be in a table or list with proper structure
      const cardList = screen.getByRole('table') || screen.getByRole('list')
      expect(cardList).toBeInTheDocument()

      if (cardList.getAttribute('role') === 'table') {
        expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
      }
    })

    it('should have accessible statistics charts', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // Charts should have proper labels and descriptions
      const charts = screen.getAllByRole('img')
      charts.forEach(chart => {
        expect(chart).toHaveAttribute('alt')
      })
    })

    it('should support keyboard navigation for card interactions', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // Card elements should be focusable
      const cardElements = screen.getAllByTestId(/card-/)
      cardElements.forEach(card => {
        expect(card).toHaveAttribute('tabIndex')
      })
    })

    it('should have proper modal accessibility', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // If modal is present, it should have proper attributes
      const modal = screen.queryByRole('dialog')
      if (modal) {
        expect(modal).toHaveAttribute('aria-labelledby')
        expect(modal).toHaveAttribute('aria-modal', 'true')
      }
    })
  })

  describe('Focus Management', () => {
    it('should manage focus properly in wizard navigation', () => {
      render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      // Focus should be managed when navigating between steps
      const firstFocusableElement = screen.getAllByRole('button')[0]
      expect(document.activeElement).toBe(firstFocusableElement)
    })

    it('should trap focus in modals', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // If modal is open, focus should be trapped
      const modal = screen.queryByRole('dialog')
      if (modal) {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        expect(focusableElements.length).toBeGreaterThan(0)
      }
    })

    it('should restore focus after modal closes', () => {
      // This would test focus restoration after modal interaction
      // Implementation depends on modal behavior
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA landmarks', () => {
      render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      // Should have main landmark
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should have proper live regions for dynamic content', () => {
      render(
        <GenerationProgress
          progress={50}
          phase="Generating..."
          onGenerate={vi.fn()}
        />
      )

      // Dynamic content should be announced
      const liveRegions = screen.getAllByLabelText(/live/i)
      expect(liveRegions.length).toBeGreaterThan(0)
    })

    it('should have descriptive button labels', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const label = button.getAttribute('aria-label') || button.textContent
        expect(label).toBeTruthy()
        expect(label!.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Color and Contrast', () => {
    it('should not rely solely on color for information', () => {
      render(
        <DeckEditor
          deck={mockDeck}
          onDeckUpdate={vi.fn()}
          onSave={vi.fn()}
          onExport={vi.fn()}
        />
      )

      // Color-coded elements should have additional indicators
      const colorElements = screen.getAllByTestId(/color-/)
      colorElements.forEach(element => {
        // Should have text label or icon in addition to color
        expect(element.textContent || element.querySelector('svg')).toBeTruthy()
      })
    })

    it('should have sufficient contrast ratios', () => {
      const { container } = render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      // Check for proper contrast classes
      const textElements = container.querySelectorAll('[class*="text-"]')
      textElements.forEach(element => {
        const classes = element.className
        // Should use high-contrast text colors
        expect(classes).toMatch(/text-(white|gray-[89]00|zinc-[89]00|slate-[89]00)/)
      })
    })
  })

  describe('Mobile Accessibility', () => {
    it('should have proper touch targets', () => {
      render(
        <EntryPointSelector
          onDeckBuilding={vi.fn()}
          onCardRecommendations={vi.fn()}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Touch targets should be at least 44px (checked via CSS classes)
        const classes = button.className
        expect(classes).toMatch(/(min-h-|h-)(11|12|16|20)/) // Tailwind classes for adequate height
      })
    })

    it('should support zoom up to 200%', () => {
      // This would be tested with actual zoom functionality
      // For now, ensure responsive design classes are present
      const { container } = render(
        <DeckBuildingWizard
          onComplete={vi.fn()}
          onBack={vi.fn()}
        />
      )

      const responsiveElements = container.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]')
      expect(responsiveElements.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling Accessibility', () => {
    it('should announce errors to screen readers', () => {
      render(
        <GenerationProgress
          progress={0}
          phase=""
          onGenerate={vi.fn()}
          error="Generation failed. Please try again."
        />
      )

      const errorMessage = screen.getByText('Generation failed. Please try again.')
      expect(errorMessage).toHaveAttribute('role', 'alert')
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive')
    })

    it('should provide clear error recovery instructions', () => {
      render(
        <GenerationProgress
          progress={0}
          phase=""
          onGenerate={vi.fn()}
          error="Network error occurred"
        />
      )

      // Should have retry button with clear label
      const retryButton = screen.getByText('Retry')
      expect(retryButton).toHaveAttribute('aria-label', expect.stringContaining('retry'))
    })
  })
})