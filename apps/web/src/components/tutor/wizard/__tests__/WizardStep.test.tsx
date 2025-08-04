import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WizardStep } from '../WizardStep'

describe('WizardStep', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and children correctly', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div data-testid="step-content">Step Content</div>
      </WizardStep>
    )

    expect(screen.getByText('Test Step')).toBeInTheDocument()
    expect(screen.getByTestId('step-content')).toBeInTheDocument()
  })

  it('shows next button when canProceed is true', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeInTheDocument()
    expect(nextButton).not.toBeDisabled()
  })

  it('disables next button when canProceed is false', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={false}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('shows back button when not first step', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('hides back button when first step', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={true}
      >
        <div>Content</div>
      </WizardStep>
    )

    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('calls onNext when next button is clicked', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    fireEvent.click(screen.getByText('Next'))
    expect(mockOnNext).toHaveBeenCalledTimes(1)
  })

  it('calls onBack when back button is clicked', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    fireEvent.click(screen.getByText('Back'))
    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('shows custom next button text', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
        nextText="Generate Deck"
      >
        <div>Content</div>
      </WizardStep>
    )

    expect(screen.getByText('Generate Deck')).toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('shows loading state on next button', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
        isLoading={true}
      >
        <div>Content</div>
      </WizardStep>
    )

    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeDisabled()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows description when provided', () => {
    render(
      <WizardStep
        title="Test Step"
        description="This is a test step description"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    expect(screen.getByText('This is a test step description')).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    const stepContainer = container.firstChild as HTMLElement
    expect(stepContainer).toHaveClass('space-y-6')
  })

  it('handles keyboard navigation', () => {
    render(
      <WizardStep
        title="Test Step"
        onNext={mockOnNext}
        onBack={mockOnBack}
        canProceed={true}
        isFirstStep={false}
      >
        <div>Content</div>
      </WizardStep>
    )

    const nextButton = screen.getByText('Next')
    fireEvent.keyDown(nextButton, { key: 'Enter' })
    expect(mockOnNext).toHaveBeenCalledTimes(1)
  })
})