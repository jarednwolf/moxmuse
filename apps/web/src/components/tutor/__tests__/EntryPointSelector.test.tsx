import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EntryPointSelector } from '../EntryPointSelector'

describe('EntryPointSelector', () => {
  const mockOnDeckBuilding = vi.fn()
  const mockOnCardRecommendations = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders both entry point options', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('Build Full Deck')).toBeInTheDocument()
    expect(screen.getByText('Get Card Recommendations')).toBeInTheDocument()
  })

  it('renders the main title', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('How can I help you today?')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('Choose your preferred way to get deck building assistance')).toBeInTheDocument()
  })

  it('calls onDeckBuilding when deck building option is clicked', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const deckBuildingOption = screen.getByText('Build Full Deck').closest('div')
    fireEvent.click(deckBuildingOption!)
    expect(mockOnDeckBuilding).toHaveBeenCalledTimes(1)
  })

  it('calls onCardRecommendations when card recommendations option is clicked', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const cardRecommendationsOption = screen.getByText('Get Card Recommendations').closest('div')
    fireEvent.click(cardRecommendationsOption!)
    expect(mockOnCardRecommendations).toHaveBeenCalledTimes(1)
  })

  it('has proper grid layout classes', () => {
    const { container } = render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'gap-6')
  })

  it('has proper container styling', () => {
    const { container } = render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const mainContainer = container.firstChild as HTMLElement
    expect(mainContainer).toHaveClass('max-w-4xl', 'mx-auto', 'space-y-8')
  })

  it('renders comparison information', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('Quick Comparison')).toBeInTheDocument()
    expect(screen.getByText('Full Deck: Complete 100-card deck with strategy')).toBeInTheDocument()
    expect(screen.getByText('Card Recommendations: Individual card suggestions and advice')).toBeInTheDocument()
  })

  it('shows time estimates', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('5-10 minutes')).toBeInTheDocument()
    expect(screen.getByText('Instant responses')).toBeInTheDocument()
  })

  it('handles keyboard navigation', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const deckBuildingOption = screen.getByText('Build Full Deck').closest('div')
    fireEvent.keyDown(deckBuildingOption!, { key: 'Enter' })
    expect(mockOnDeckBuilding).toHaveBeenCalledTimes(1)

    const cardRecommendationsOption = screen.getByText('Get Card Recommendations').closest('div')
    fireEvent.keyDown(cardRecommendationsOption!, { key: 'Enter' })
    expect(mockOnCardRecommendations).toHaveBeenCalledTimes(1)
  })

  it('shows help text', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    expect(screen.getByText('Perfect for new decks or major rebuilds')).toBeInTheDocument()
    expect(screen.getByText('Ask me anything about Magic cards and deck building')).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    const { container } = render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const options = container.querySelectorAll('[role="button"]')
    expect(options).toHaveLength(2)
    
    options.forEach(option => {
      expect(option).toHaveAttribute('tabIndex', '0')
    })
  })

  it('shows feature highlights', () => {
    render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    // Deck building features
    expect(screen.getByText('Guided Wizard')).toBeInTheDocument()
    expect(screen.getByText('Complete Deck')).toBeInTheDocument()
    expect(screen.getByText('Advanced Editor')).toBeInTheDocument()

    // Card recommendation features
    expect(screen.getByText('Targeted Card Search')).toBeInTheDocument()
    expect(screen.getByText('Deck Improvement Ideas')).toBeInTheDocument()
    expect(screen.getByText('Interactive Chat')).toBeInTheDocument()
  })

  it('renders with proper responsive design', () => {
    const { container } = render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    const gridContainer = container.querySelector('.grid')
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2')
  })

  it('shows visual indicators for each option', () => {
    const { container } = render(
      <EntryPointSelector
        onDeckBuilding={mockOnDeckBuilding}
        onCardRecommendations={mockOnCardRecommendations}
      />
    )

    // Should have visual indicators (icons) for each option
    const icons = container.querySelectorAll('.w-12.h-12')
    expect(icons.length).toBeGreaterThanOrEqual(2)
  })
})