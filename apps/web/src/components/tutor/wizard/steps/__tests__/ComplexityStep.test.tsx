import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ComplexityStep } from '../ComplexityStep'
import { ConsultationData } from '@moxmuse/shared'

describe('ComplexityStep', () => {
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

  it('renders complexity level options', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Deck Complexity')).toBeInTheDocument()
    expect(screen.getByText('Simple')).toBeInTheDocument()
    expect(screen.getByText('Moderate')).toBeInTheDocument()
    expect(screen.getByText('Complex')).toBeInTheDocument()
  })

  it('shows complexity descriptions', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText(/Straightforward gameplay/)).toBeInTheDocument()
    expect(screen.getByText(/Some decision-making/)).toBeInTheDocument()
    expect(screen.getByText(/Many interactions and decisions/)).toBeInTheDocument()
  })

  it('calls onChange when complexity is selected', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Moderate'))
    expect(mockOnChange).toHaveBeenCalledWith({
      complexityLevel: 'moderate'
    })
  })

  it('highlights selected complexity', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'complex' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const complexOption = screen.getByText('Complex').closest('div')
    expect(complexOption).toHaveClass('border-purple-500')
  })

  it('shows complexity examples', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Simple:')).toBeInTheDocument()
    expect(screen.getByText('Turn creatures sideways')).toBeInTheDocument()
    expect(screen.getByText('Complex:')).toBeInTheDocument()
    expect(screen.getByText('Stack interactions, priority')).toBeInTheDocument()
  })

  it('validates complexity selection', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be disabled when no complexity is selected
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when complexity is selected', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'simple' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows decision-making indicators', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Decisions per turn:')).toBeInTheDocument()
    expect(screen.getByText('1-2')).toBeInTheDocument()
    expect(screen.getByText('3-5')).toBeInTheDocument()
    expect(screen.getByText('5+')).toBeInTheDocument()
  })

  it('shows learning curve information', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'complex' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Learning curve: Steep')).toBeInTheDocument()
    expect(screen.getByText('Requires deep format knowledge')).toBeInTheDocument()
  })

  it('shows time investment information', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'simple' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Time to learn: Quick')).toBeInTheDocument()
    expect(screen.getByText('Pick up and play')).toBeInTheDocument()
  })

  it('shows complexity icons', () => {
    render(
      <ComplexityStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Should show visual indicators for complexity levels
    const complexityIcons = screen.getAllByTestId('complexity-icon')
    expect(complexityIcons).toHaveLength(3)
  })

  it('shows example card types for each complexity', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'moderate' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Typical cards:')).toBeInTheDocument()
    expect(screen.getByText('Modal spells, activated abilities')).toBeInTheDocument()
  })

  it('handles complexity warnings', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'complex' as const,
      powerLevel: 1
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Note: Complex decks work best at higher power levels')).toBeInTheDocument()
  })

  it('shows gameplay style implications', () => {
    const dataWithComplexity = {
      ...defaultData,
      complexityLevel: 'simple' as const
    }

    render(
      <ComplexityStep
        data={dataWithComplexity}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Gameplay style:')).toBeInTheDocument()
    expect(screen.getByText('Linear, predictable')).toBeInTheDocument()
  })

  it('shows complexity recommendations based on other choices', () => {
    const dataWithStrategy = {
      ...defaultData,
      strategy: 'aggro' as const
    }

    render(
      <ComplexityStep
        data={dataWithStrategy}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Recommended for Aggro: Simple to Moderate')).toBeInTheDocument()
  })
})