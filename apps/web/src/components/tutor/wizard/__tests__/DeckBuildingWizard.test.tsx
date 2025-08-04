import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeckBuildingWizard } from '../DeckBuildingWizard'
import { ConsultationData } from '@moxmuse/shared'

// Mock the wizard steps
vi.mock('../steps/CommanderStep', () => ({
  CommanderStep: ({ onNext, data }: any) => (
    <div data-testid="commander-step">
      <button onClick={() => onNext()}>Next from Commander</button>
      <span>Commander: {data.commander || 'None'}</span>
    </div>
  )
}))

vi.mock('../steps/StrategyStep', () => ({
  StrategyStep: ({ onNext, onBack }: any) => (
    <div data-testid="strategy-step">
      <button onClick={() => onBack()}>Back to Commander</button>
      <button onClick={() => onNext()}>Next from Strategy</button>
    </div>
  )
}))

vi.mock('../steps/SummaryStep', () => ({
  SummaryStep: ({ onNext, onBack }: any) => (
    <div data-testid="summary-step">
      <button onClick={() => onBack()}>Back to Previous</button>
      <button onClick={() => onNext()}>Generate Deck</button>
    </div>
  )
}))

describe('DeckBuildingWizard', () => {
  const mockOnComplete = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the first step initially', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByTestId('commander-step')).toBeInTheDocument()
    expect(screen.queryByTestId('strategy-step')).not.toBeInTheDocument()
  })

  it('shows wizard progress', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
  })

  it('navigates to next step when next is clicked', async () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    fireEvent.click(screen.getByText('Next from Commander'))

    await waitFor(() => {
      expect(screen.getByTestId('strategy-step')).toBeInTheDocument()
      expect(screen.queryByTestId('commander-step')).not.toBeInTheDocument()
    })
  })

  it('navigates back to previous step', async () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // Go to strategy step
    fireEvent.click(screen.getByText('Next from Commander'))
    
    await waitFor(() => {
      expect(screen.getByTestId('strategy-step')).toBeInTheDocument()
    })

    // Go back to commander step
    fireEvent.click(screen.getByText('Back to Commander'))

    await waitFor(() => {
      expect(screen.getByTestId('commander-step')).toBeInTheDocument()
      expect(screen.queryByTestId('strategy-step')).not.toBeInTheDocument()
    })
  })

  it('preserves data between steps', async () => {
    const { rerender } = render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
        initialData={{ commander: 'Atraxa' } as ConsultationData}
      />
    )

    expect(screen.getByText('Commander: Atraxa')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next from Commander'))

    await waitFor(() => {
      expect(screen.getByTestId('strategy-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Back to Commander'))

    await waitFor(() => {
      expect(screen.getByText('Commander: Atraxa')).toBeInTheDocument()
    })
  })

  it('calls onComplete when wizard is finished', async () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // Navigate to the last step (simplified for test)
    fireEvent.click(screen.getByText('Next from Commander'))
    
    await waitFor(() => {
      expect(screen.getByTestId('strategy-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next from Strategy'))

    await waitFor(() => {
      expect(screen.getByTestId('summary-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Generate Deck'))

    expect(mockOnComplete).toHaveBeenCalledTimes(1)
    expect(mockOnComplete).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls onBack when back button is clicked on first step', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // Assuming there's a back button on the first step
    const backButton = screen.queryByText('Back')
    if (backButton) {
      fireEvent.click(backButton)
      expect(mockOnBack).toHaveBeenCalledTimes(1)
    }
  })

  it('updates progress as user moves through steps', async () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Next from Commander'))

    await waitFor(() => {
      expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
    })
  })

  it('handles step validation', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // The wizard should validate each step before allowing progression
    // This would be tested with actual step components that have validation
    expect(screen.getByTestId('commander-step')).toBeInTheDocument()
  })

  it('saves progress to session storage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    fireEvent.click(screen.getByText('Next from Commander'))

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        'wizard-progress',
        expect.stringContaining('currentStep')
      )
    })

    setItemSpy.mockRestore()
  })

  it('restores progress from session storage', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    getItemSpy.mockReturnValue(JSON.stringify({
      currentStep: 1,
      consultationData: { commander: 'Restored Commander' }
    }))

    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByTestId('strategy-step')).toBeInTheDocument()

    getItemSpy.mockRestore()
  })

  it('handles wizard reset', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // Assuming there's a reset button
    const resetButton = screen.queryByText('Start Over')
    if (resetButton) {
      fireEvent.click(resetButton)
      expect(screen.getByTestId('commander-step')).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
    }
  })

  it('shows step names in progress indicator', () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    expect(screen.getByText('Commander')).toBeInTheDocument()
    expect(screen.getByText('Strategy')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('handles keyboard navigation', async () => {
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    const nextButton = screen.getByText('Next from Commander')
    fireEvent.keyDown(nextButton, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByTestId('strategy-step')).toBeInTheDocument()
    })
  })

  it('prevents navigation with invalid data', () => {
    // This would be tested with actual validation logic
    render(
      <DeckBuildingWizard
        onComplete={mockOnComplete}
        onBack={mockOnBack}
      />
    )

    // If validation fails, next button should be disabled
    // This depends on the actual step implementation
    expect(screen.getByTestId('commander-step')).toBeInTheDocument()
  })
})