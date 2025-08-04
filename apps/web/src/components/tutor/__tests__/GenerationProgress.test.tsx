import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerationProgress } from '../GenerationProgress'

describe('GenerationProgress', () => {
  const mockOnGenerate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders generation title', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Generating Your Deck')).toBeInTheDocument()
  })

  it('shows progress bar with correct percentage', () => {
    render(
      <GenerationProgress
        progress={45}
        phase="Analyzing commander..."
        onGenerate={mockOnGenerate}
      />
    )

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '45')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('displays current phase', () => {
    render(
      <GenerationProgress
        progress={30}
        phase="Selecting cards based on strategy..."
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Selecting cards based on strategy...')).toBeInTheDocument()
  })

  it('shows progress percentage', () => {
    render(
      <GenerationProgress
        progress={67}
        phase="Building mana base..."
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('shows generate button when progress is 0', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Generate Deck')).toBeInTheDocument()
  })

  it('calls onGenerate when generate button is clicked', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
      />
    )

    fireEvent.click(screen.getByText('Generate Deck'))
    expect(mockOnGenerate).toHaveBeenCalledTimes(1)
  })

  it('hides generate button during generation', () => {
    render(
      <GenerationProgress
        progress={50}
        phase="Generating cards..."
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.queryByText('Generate Deck')).not.toBeInTheDocument()
  })

  it('shows completion message when progress is 100', () => {
    render(
      <GenerationProgress
        progress={100}
        phase="Complete!"
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Deck generation complete!')).toBeInTheDocument()
  })

  it('shows estimated time remaining', () => {
    render(
      <GenerationProgress
        progress={25}
        phase="Analyzing strategy..."
        onGenerate={mockOnGenerate}
        estimatedTimeRemaining={45}
      />
    )

    expect(screen.getByText('Estimated time remaining: 45 seconds')).toBeInTheDocument()
  })

  it('shows generation phases list', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Generation Process:')).toBeInTheDocument()
    expect(screen.getByText('1. Analyze commander and strategy')).toBeInTheDocument()
    expect(screen.getByText('2. Select core cards and synergies')).toBeInTheDocument()
    expect(screen.getByText('3. Build mana base and utility')).toBeInTheDocument()
    expect(screen.getByText('4. Calculate statistics and analysis')).toBeInTheDocument()
  })

  it('highlights current phase in the list', () => {
    render(
      <GenerationProgress
        progress={60}
        phase="Building mana base and utility..."
        onGenerate={mockOnGenerate}
      />
    )

    const currentPhaseItem = screen.getByText('3. Build mana base and utility')
    expect(currentPhaseItem).toHaveClass('text-purple-400')
  })

  it('shows completed phases with checkmarks', () => {
    render(
      <GenerationProgress
        progress={75}
        phase="Calculating statistics..."
        onGenerate={mockOnGenerate}
      />
    )

    const completedPhases = screen.getAllByTestId('completed-phase')
    expect(completedPhases.length).toBeGreaterThan(0)
  })

  it('shows cancel button during generation', () => {
    render(
      <GenerationProgress
        progress={40}
        phase="Selecting cards..."
        onGenerate={mockOnGenerate}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const mockOnCancel = vi.fn()
    
    render(
      <GenerationProgress
        progress={40}
        phase="Selecting cards..."
        onGenerate={mockOnGenerate}
        onCancel={mockOnCancel}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('shows loading animation during generation', () => {
    const { container } = render(
      <GenerationProgress
        progress={30}
        phase="Generating..."
        onGenerate={mockOnGenerate}
      />
    )

    const loadingSpinner = container.querySelector('.animate-spin')
    expect(loadingSpinner).toBeInTheDocument()
  })

  it('shows error state when provided', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
        error="Failed to generate deck. Please try again."
      />
    )

    expect(screen.getByText('Failed to generate deck. Please try again.')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('handles retry after error', () => {
    render(
      <GenerationProgress
        progress={0}
        phase=""
        onGenerate={mockOnGenerate}
        error="Generation failed"
      />
    )

    fireEvent.click(screen.getByText('Retry'))
    expect(mockOnGenerate).toHaveBeenCalledTimes(1)
  })

  it('shows generation tips during process', () => {
    render(
      <GenerationProgress
        progress={20}
        phase="Analyzing..."
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText('Generation Tips:')).toBeInTheDocument()
    expect(screen.getByText('• The AI considers your budget and power level preferences')).toBeInTheDocument()
    expect(screen.getByText('• Cards are categorized by function for easy understanding')).toBeInTheDocument()
    expect(screen.getByText('• You can modify any suggestions in the deck editor')).toBeInTheDocument()
  })

  it('shows progress bar animation', () => {
    const { container } = render(
      <GenerationProgress
        progress={45}
        phase="Generating..."
        onGenerate={mockOnGenerate}
      />
    )

    const progressBar = container.querySelector('.transition-all')
    expect(progressBar).toBeInTheDocument()
  })

  it('handles very long phase descriptions', () => {
    const longPhase = 'This is a very long phase description that might wrap to multiple lines and should be handled gracefully by the component'
    
    render(
      <GenerationProgress
        progress={50}
        phase={longPhase}
        onGenerate={mockOnGenerate}
      />
    )

    expect(screen.getByText(longPhase)).toBeInTheDocument()
  })

  it('shows accessibility attributes', () => {
    render(
      <GenerationProgress
        progress={60}
        phase="Generating cards..."
        onGenerate={mockOnGenerate}
      />
    )

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label', 'Deck generation progress')
  })
})