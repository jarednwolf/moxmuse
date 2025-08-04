import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardRecommendationOption } from '../CardRecommendationOption'

describe('CardRecommendationOption', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the main title and subtitle', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(screen.getByText('Get Card Recommendations')).toBeInTheDocument()
    expect(screen.getByText('Individual card suggestions')).toBeInTheDocument()
  })

  it('renders the main description', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(
      screen.getByText(/Chat with me about specific cards, strategies, or improvements for your existing deck/)
    ).toBeInTheDocument()
  })

  it('renders all feature sections', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(screen.getByText('Targeted Card Search')).toBeInTheDocument()
    expect(screen.getByText('Deck Improvement Ideas')).toBeInTheDocument()
    expect(screen.getByText('Interactive Chat')).toBeInTheDocument()
  })

  it('renders feature descriptions', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(
      screen.getByText('Find specific cards for removal, ramp, card draw, or any other deck needs')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Get suggestions to upgrade your existing deck or explore new strategies')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ask follow-up questions and refine recommendations through natural conversation')
    ).toBeInTheDocument()
  })

  it('displays example queries', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(screen.getByText('"I need better card draw for my Atraxa deck"')).toBeInTheDocument()
    expect(screen.getByText('"What\'s the best removal for artifact decks?"')).toBeInTheDocument()
    expect(screen.getByText('"Show me budget alternatives to expensive cards"')).toBeInTheDocument()
  })

  it('displays the response time indicator', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(screen.getByText('Instant responses')).toBeInTheDocument()
  })

  it('displays the action text', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(screen.getByText('Start Chatting')).toBeInTheDocument()
  })

  it('displays the help text', () => {
    render(<CardRecommendationOption onClick={mockOnClick} />)

    expect(
      screen.getByText('Ask me anything about Magic cards and deck building')
    ).toBeInTheDocument()
  })

  it('calls onClick when the component is clicked', async () => {
    const user = userEvent.setup()
    
    render(<CardRecommendationOption onClick={mockOnClick} />)

    const component = screen.getByText('Get Card Recommendations').closest('div')
    expect(component).toBeInTheDocument()
    
    await user.click(component!)
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('has proper hover and transition classes', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('group', 'cursor-pointer', 'hover:scale-[1.02]', 'transition-all')
  })

  it('has proper gradient and styling classes', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-emerald-900/20', 'to-teal-900/20')
  })

  it('renders the message square icon', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    // The MessageSquare icon should be present in the header
    const iconContainer = container.querySelector('.w-12.h-12.bg-gradient-to-br')
    expect(iconContainer).toBeInTheDocument()
  })

  it('renders feature icons', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    // Should have 3 feature icons (Search, Lightbulb, Zap)
    const featureIcons = container.querySelectorAll('.w-6.h-6.bg-emerald-500\\/20, .w-6.h-6.bg-teal-500\\/20, .w-6.h-6.bg-blue-500\\/20')
    expect(featureIcons.length).toBeGreaterThan(0)
  })

  it('renders example query boxes', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    // Should have 3 example query boxes
    const queryBoxes = container.querySelectorAll('.bg-zinc-800\\/40.rounded-lg')
    expect(queryBoxes).toHaveLength(3)
  })

  it('has proper emerald color scheme', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    const mainDiv = container.firstChild as HTMLElement
    expect(mainDiv).toHaveClass('border-emerald-500/20', 'hover:border-emerald-400/40')
  })

  it('displays hover effect indicator', () => {
    const { container } = render(<CardRecommendationOption onClick={mockOnClick} />)

    const hoverIndicator = container.querySelector('.bg-emerald-400.rounded-full')
    expect(hoverIndicator).toBeInTheDocument()
  })
})