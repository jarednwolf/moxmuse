import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InteractionStep } from '../InteractionStep'
import { ConsultationData } from '@moxmuse/shared'

describe('InteractionStep', () => {
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

  it('renders interaction level options', () => {
    render(
      <InteractionStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Interaction Level')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('shows interaction descriptions', () => {
    render(
      <InteractionStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText(/Focus on your own game plan/)).toBeInTheDocument()
    expect(screen.getByText(/Balanced approach/)).toBeInTheDocument()
    expect(screen.getByText(/Heavy interaction and control/)).toBeInTheDocument()
  })

  it('calls onChange when interaction level is selected', () => {
    render(
      <InteractionStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Medium'))
    expect(mockOnChange).toHaveBeenCalledWith({
      interaction: { level: 'medium', types: [], timing: 'balanced' }
    })
  })

  it('shows interaction types when level is selected', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'medium' as const, types: [], timing: 'balanced' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Interaction Types')).toBeInTheDocument()
    expect(screen.getByText('Removal')).toBeInTheDocument()
    expect(screen.getByText('Counterspells')).toBeInTheDocument()
    expect(screen.getByText('Board Wipes')).toBeInTheDocument()
    expect(screen.getByText('Discard')).toBeInTheDocument()
  })

  it('handles interaction type selection', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'high' as const, types: [], timing: 'reactive' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Removal'))
    expect(mockOnChange).toHaveBeenCalledWith({
      interaction: { level: 'high', types: ['removal'], timing: 'reactive' }
    })
  })

  it('shows timing options', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'medium' as const, types: [], timing: 'balanced' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Interaction Timing')).toBeInTheDocument()
    expect(screen.getByText('Proactive')).toBeInTheDocument()
    expect(screen.getByText('Reactive')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
  })

  it('handles timing selection', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'high' as const, types: ['removal'], timing: 'balanced' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Reactive'))
    expect(mockOnChange).toHaveBeenCalledWith({
      interaction: { level: 'high', types: ['removal'], timing: 'reactive' }
    })
  })

  it('highlights selected options', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { 
        level: 'high' as const, 
        types: ['removal', 'counterspells'], 
        timing: 'reactive' as const 
      }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const highOption = screen.getByText('High').closest('div')
    expect(highOption).toHaveClass('border-purple-500')

    const removalOption = screen.getByText('Removal').closest('div')
    expect(removalOption).toHaveClass('bg-purple-500/20')

    const reactiveOption = screen.getByText('Reactive').closest('div')
    expect(reactiveOption).toHaveClass('border-purple-500')
  })

  it('validates interaction selection', () => {
    render(
      <InteractionStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be disabled when no interaction level is selected
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when interaction is configured', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'medium' as const, types: ['removal'], timing: 'balanced' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows interaction examples', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'high' as const, types: ['removal'], timing: 'reactive' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Example cards:')).toBeInTheDocument()
    expect(screen.getByText('Swords to Plowshares, Path to Exile')).toBeInTheDocument()
  })

  it('handles multiple interaction type selection', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'high' as const, types: ['removal'], timing: 'reactive' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Counterspells'))
    expect(mockOnChange).toHaveBeenCalledWith({
      interaction: { level: 'high', types: ['removal', 'counterspells'], timing: 'reactive' }
    })
  })

  it('handles deselecting interaction types', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { 
        level: 'medium' as const, 
        types: ['removal', 'counterspells'], 
        timing: 'balanced' as const 
      }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Removal'))
    expect(mockOnChange).toHaveBeenCalledWith({
      interaction: { level: 'medium', types: ['counterspells'], timing: 'balanced' }
    })
  })

  it('shows interaction count recommendations', () => {
    const dataWithInteraction = {
      ...defaultData,
      interaction: { level: 'high' as const, types: ['removal'], timing: 'reactive' as const }
    }

    render(
      <InteractionStep
        data={dataWithInteraction}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Recommended: 15-20 interaction pieces')).toBeInTheDocument()
  })
})