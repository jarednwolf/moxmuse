import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeckBuildingOption } from '../DeckBuildingOption'

describe('DeckBuildingOption', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the main title and subtitle', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('Build Full Deck')).toBeInTheDocument()
    expect(screen.getByText('Complete 100-card deck creation')).toBeInTheDocument()
  })

  it('renders the main description', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(
      screen.getByText(/I'll guide you through creating a complete Commander deck/)
    ).toBeInTheDocument()
  })

  it('renders all feature sections', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('Guided Wizard')).toBeInTheDocument()
    expect(screen.getByText('Complete Deck')).toBeInTheDocument()
    expect(screen.getByText('Advanced Editor')).toBeInTheDocument()
  })

  it('renders feature descriptions', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(
      screen.getByText('Step-by-step questions to understand your preferences and constraints')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Receive a full 100-card deck with strategy explanation and categorization')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Review and modify your deck with interactive statistics and analysis')
    ).toBeInTheDocument()
  })

  it('displays the process steps', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('1. Answer questions about your preferences')).toBeInTheDocument()
    expect(screen.getByText('2. Get AI-generated deck recommendations')).toBeInTheDocument()
    expect(screen.getByText('3. Review and customize in the deck editor')).toBeInTheDocument()
  })

  it('displays the time estimate', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('5-10 minutes')).toBeInTheDocument()
  })

  it('displays the action text', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('Start Building')).toBeInTheDocument()
  })

  it('displays the help text', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(
      screen.getByText('Perfect for new decks or major rebuilds')
    ).toBeInTheDocument()
  })

  it('calls onClick when the component is clicked', async () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    const component = screen.getByText('Build Full Deck').closest('div')
    expect(component).toBeInTheDocument()
    
    fireEvent.click(component!)
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('has proper hover and transition classes', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('group', 'cursor-pointer', 'hover:scale-[1.02]', 'transition-all')
  })

  it('has proper gradient and styling classes', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-purple-900/20', 'to-blue-900/20')
  })

  it('renders the wand icon', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    // The Wand2 icon should be present in the header
    const iconContainer = container.querySelector('.w-12.h-12.bg-gradient-to-br')
    expect(iconContainer).toBeInTheDocument()
  })

  it('renders feature icons', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    // Should have 3 feature icons (Compass, Layers, BarChart3)
    const featureIcons = container.querySelectorAll('.w-6.h-6')
    expect(featureIcons.length).toBeGreaterThan(2)
  })

  it('renders process step boxes', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    // Should have 3 process step boxes
    const stepBoxes = container.querySelectorAll('.bg-zinc-800\\/40.rounded-lg')
    expect(stepBoxes).toHaveLength(3)
  })

  it('has proper purple color scheme', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('border-purple-500/20', 'hover:border-purple-400/40')
  })

  it('displays hover effect indicator', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    const hoverIndicator = container.querySelector('.bg-purple-400.rounded-full')
    expect(hoverIndicator).toBeInTheDocument()
  })

  it('handles keyboard interaction', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    const component = screen.getByText('Build Full Deck').closest('div')
    fireEvent.keyDown(component!, { key: 'Enter' })
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('shows wizard preview', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('Wizard Preview:')).toBeInTheDocument()
    expect(screen.getByText('Commander → Strategy → Budget → Power Level → Summary')).toBeInTheDocument()
  })

  it('displays deck editor features', () => {
    render(<DeckBuildingOption onClick={mockOnClick} />)

    expect(screen.getByText('Editor Features:')).toBeInTheDocument()
    expect(screen.getByText('Interactive statistics, card details, export options')).toBeInTheDocument()
  })

  it('shows accessibility attributes', () => {
    const { container } = render(<DeckBuildingOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveAttribute('role', 'button')
    expect(mainDiv).toHaveAttribute('tabIndex', '0')
  })
})