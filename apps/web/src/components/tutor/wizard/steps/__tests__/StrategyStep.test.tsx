import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrategyStep } from '../StrategyStep'
import { ConsultationData } from '@moxmuse/shared'

describe('StrategyStep', () => {
  const mockOnChange = vi.fn()
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  const defaultData: ConsultationData = {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders strategy options', () => {
    render(
      <StrategyStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Deck Strategy')).toBeInTheDocument()
    expect(screen.getByText('Aggro')).toBeInTheDocument()
    expect(screen.getByText('Control')).toBeInTheDocument()
    expect(screen.getByText('Combo')).toBeInTheDocument()
    expect(screen.getByText('Midrange')).toBeInTheDocument()
    expect(screen.getByText('Tribal')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
    expect(screen.getByText('Stax')).toBeInTheDocument()
  })

  it('shows strategy descriptions', () => {
    render(
      <StrategyStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText(/Fast, aggressive gameplay/)).toBeInTheDocument()
    expect(screen.getByText(/Control the game through interaction/)).toBeInTheDocument()
    expect(screen.getByText(/Win through powerful card combinations/)).toBeInTheDocument()
  })

  it('calls onChange when strategy is selected', () => {
    render(
      <StrategyStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Aggro'))
    expect(mockOnChange).toHaveBeenCalledWith({
      strategy: 'aggro'
    })
  })

  it('highlights selected strategy', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'combo' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const comboOption = screen.getByText('Combo').closest('div')
    expect(comboOption).toHaveClass('border-purple-500')
  })

  it('shows themes section when strategy is selected', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'tribal' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Themes (Optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., Dragons, Artifacts, +1/+1 counters')).toBeInTheDocument()
  })

  it('handles theme input', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'tribal' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const themeInput = screen.getByPlaceholderText('e.g., Dragons, Artifacts, +1/+1 counters')
    fireEvent.change(themeInput, { target: { value: 'Dragons, Flying creatures' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      themes: ['Dragons', 'Flying creatures']
    })
  })

  it('shows custom theme input', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'value' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Custom Theme (Optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Describe your unique deck theme...')).toBeInTheDocument()
  })

  it('handles custom theme input', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'value' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const customThemeInput = screen.getByPlaceholderText('Describe your unique deck theme...')
    fireEvent.change(customThemeInput, { target: { value: 'Graveyard value engine' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      customTheme: 'Graveyard value engine'
    })
  })

  it('validates strategy selection', () => {
    render(
      <StrategyStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be disabled when no strategy is selected
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when strategy is selected', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'midrange' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows strategy examples', () => {
    render(
      <StrategyStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Should show example commanders or cards for each strategy
    expect(screen.getByText('Examples:')).toBeInTheDocument()
  })

  it('handles color preferences when strategy is selected', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'aggro' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Preferred Colors (Optional)')).toBeInTheDocument()
    
    // Should show color selection buttons
    expect(screen.getByText('White')).toBeInTheDocument()
    expect(screen.getByText('Blue')).toBeInTheDocument()
    expect(screen.getByText('Black')).toBeInTheDocument()
    expect(screen.getByText('Red')).toBeInTheDocument()
    expect(screen.getByText('Green')).toBeInTheDocument()
  })

  it('handles color selection', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'control' as const
    }

    render(
      <StrategyStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Blue'))
    expect(mockOnChange).toHaveBeenCalledWith({
      colorPreferences: ['U']
    })
  })
})