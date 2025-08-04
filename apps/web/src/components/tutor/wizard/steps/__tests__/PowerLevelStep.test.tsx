import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PowerLevelStep } from '../PowerLevelStep'
import { ConsultationData } from '@moxmuse/shared'

describe('PowerLevelStep', () => {
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

  it('renders power level options', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Power Level')).toBeInTheDocument()
    expect(screen.getByText('Bracket 1 - Casual')).toBeInTheDocument()
    expect(screen.getByText('Bracket 2 - Focused')).toBeInTheDocument()
    expect(screen.getByText('Bracket 3 - Optimized')).toBeInTheDocument()
    expect(screen.getByText('Bracket 4 - Competitive')).toBeInTheDocument()
  })

  it('shows power level descriptions', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText(/Preconstructed level/)).toBeInTheDocument()
    expect(screen.getByText(/Upgraded precons/)).toBeInTheDocument()
    expect(screen.getByText(/Tuned decks/)).toBeInTheDocument()
    expect(screen.getByText(/Competitive EDH/)).toBeInTheDocument()
  })

  it('calls onChange when power level is selected', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Bracket 2 - Focused'))
    expect(mockOnChange).toHaveBeenCalledWith({
      powerLevel: 2
    })
  })

  it('highlights selected power level', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 3
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const optimizedOption = screen.getByText('Bracket 3 - Optimized').closest('div')
    expect(optimizedOption).toHaveClass('border-purple-500')
  })

  it('shows detailed explanations for each bracket', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Should show example cards or strategies for each bracket
    expect(screen.getByText('Example cards:')).toBeInTheDocument()
    expect(screen.getByText('Turn 4+ wins')).toBeInTheDocument()
  })

  it('shows power level indicators', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Should show visual indicators for each power level
    const powerIndicators = screen.getAllByTestId('power-indicator')
    expect(powerIndicators).toHaveLength(4)
  })

  it('validates power level selection', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be disabled when no power level is selected
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when power level is selected', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 2
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows budget correlation information', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 4
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Typical budget: $500+')).toBeInTheDocument()
  })

  it('shows turn speed information', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 1
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Games typically end: Turn 8+')).toBeInTheDocument()
  })

  it('shows interaction level expectations', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 3
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Expected interaction: High')).toBeInTheDocument()
  })

  it('handles power level tooltips', () => {
    render(
      <PowerLevelStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const helpIcon = screen.getByTestId('power-level-help')
    fireEvent.mouseEnter(helpIcon)

    expect(screen.getByText('Power levels help match decks of similar strength')).toBeInTheDocument()
  })

  it('shows example commanders for each bracket', () => {
    const dataWithPowerLevel = {
      ...defaultData,
      powerLevel: 2
    }

    render(
      <PowerLevelStep
        data={dataWithPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Popular commanders:')).toBeInTheDocument()
    expect(screen.getByText('Edgar Markov, Atraxa')).toBeInTheDocument()
  })

  it('handles power level warnings', () => {
    const dataWithHighPowerLevel = {
      ...defaultData,
      powerLevel: 4,
      budget: 100
    }

    render(
      <PowerLevelStep
        data={dataWithHighPowerLevel}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Warning: Budget may be too low for this power level')).toBeInTheDocument()
  })
})