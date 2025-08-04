import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BudgetStep } from '../BudgetStep'
import { ConsultationData } from '@moxmuse/shared'

describe('BudgetStep', () => {
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

  it('renders budget options', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Budget Range')).toBeInTheDocument()
    expect(screen.getByText('Budget (excluding commander)')).toBeInTheDocument()
  })

  it('shows budget presets', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('$50 - Budget')).toBeInTheDocument()
    expect(screen.getByText('$150 - Casual')).toBeInTheDocument()
    expect(screen.getByText('$300 - Focused')).toBeInTheDocument()
    expect(screen.getByText('$500+ - Optimized')).toBeInTheDocument()
  })

  it('calls onChange when budget preset is selected', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('$150 - Casual'))
    expect(mockOnChange).toHaveBeenCalledWith({
      budget: 150
    })
  })

  it('shows custom budget input', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Custom Budget')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter custom budget...')).toBeInTheDocument()
  })

  it('handles custom budget input', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const customInput = screen.getByPlaceholderText('Enter custom budget...')
    fireEvent.change(customInput, { target: { value: '250' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      budget: 250
    })
  })

  it('shows budget slider', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
  })

  it('handles budget slider changes', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '200' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      budget: 200
    })
  })

  it('shows collection toggle', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Use My Collection')).toBeInTheDocument()
    expect(screen.getByText('Prioritize cards I already own')).toBeInTheDocument()
  })

  it('handles collection toggle', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const toggle = screen.getByRole('checkbox')
    fireEvent.click(toggle)

    expect(mockOnChange).toHaveBeenCalledWith({
      useCollection: true
    })
  })

  it('displays current budget value', () => {
    const dataWithBudget = {
      ...defaultData,
      budget: 300
    }

    render(
      <BudgetStep
        data={dataWithBudget}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('$300')).toBeInTheDocument()
  })

  it('highlights selected budget preset', () => {
    const dataWithBudget = {
      ...defaultData,
      budget: 150
    }

    render(
      <BudgetStep
        data={dataWithBudget}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const casualOption = screen.getByText('$150 - Casual').closest('div')
    expect(casualOption).toHaveClass('border-purple-500')
  })

  it('validates budget input', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be disabled when no budget is set
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when budget is set', () => {
    const dataWithBudget = {
      ...defaultData,
      budget: 200
    }

    render(
      <BudgetStep
        data={dataWithBudget}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows budget breakdown information', () => {
    const dataWithBudget = {
      ...defaultData,
      budget: 300
    }

    render(
      <BudgetStep
        data={dataWithBudget}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Budget Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Lands: ~40%')).toBeInTheDocument()
    expect(screen.getByText('Spells: ~60%')).toBeInTheDocument()
  })

  it('handles zero budget', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const customInput = screen.getByPlaceholderText('Enter custom budget...')
    fireEvent.change(customInput, { target: { value: '0' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      budget: 0
    })

    // Should show message about budget constraints
    expect(screen.getByText('Ultra-budget build with basic lands only')).toBeInTheDocument()
  })

  it('prevents negative budget values', () => {
    render(
      <BudgetStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const customInput = screen.getByPlaceholderText('Enter custom budget...')
    fireEvent.change(customInput, { target: { value: '-50' } })

    // Should not call onChange with negative value
    expect(mockOnChange).not.toHaveBeenCalledWith({
      budget: -50
    })
  })
})