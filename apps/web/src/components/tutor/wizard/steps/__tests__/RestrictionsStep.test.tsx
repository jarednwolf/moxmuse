import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RestrictionsStep } from '../RestrictionsStep'
import { ConsultationData } from '@moxmuse/shared'

describe('RestrictionsStep', () => {
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

  it('renders restrictions options', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Deck Restrictions')).toBeInTheDocument()
    expect(screen.getByText('Strategies to Avoid')).toBeInTheDocument()
    expect(screen.getByText('Cards to Avoid')).toBeInTheDocument()
  })

  it('shows common strategy restrictions', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Stax')).toBeInTheDocument()
    expect(screen.getByText('Mass Land Destruction')).toBeInTheDocument()
    expect(screen.getByText('Infinite Combos')).toBeInTheDocument()
    expect(screen.getByText('Extra Turns')).toBeInTheDocument()
  })

  it('handles strategy restriction selection', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Stax'))
    expect(mockOnChange).toHaveBeenCalledWith({
      avoidStrategies: ['stax']
    })
  })

  it('shows card restriction input', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByPlaceholderText('e.g., Winter Orb, Armageddon, Cyclonic Rift')).toBeInTheDocument()
  })

  it('handles card restriction input', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const cardInput = screen.getByPlaceholderText('e.g., Winter Orb, Armageddon, Cyclonic Rift')
    fireEvent.change(cardInput, { target: { value: 'Winter Orb, Armageddon' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      avoidCards: ['Winter Orb', 'Armageddon']
    })
  })

  it('shows pet cards section', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Pet Cards (Optional)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Cards you really want to include...')).toBeInTheDocument()
  })

  it('handles pet cards input', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const petCardsInput = screen.getByPlaceholderText('Cards you really want to include...')
    fireEvent.change(petCardsInput, { target: { value: 'Lightning Bolt, Counterspell' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      petCards: ['Lightning Bolt', 'Counterspell']
    })
  })

  it('shows selected restrictions', () => {
    const dataWithRestrictions = {
      ...defaultData,
      avoidStrategies: ['stax', 'mld'],
      avoidCards: ['Winter Orb', 'Armageddon']
    }

    render(
      <RestrictionsStep
        data={dataWithRestrictions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const staxOption = screen.getByText('Stax').closest('div')
    expect(staxOption).toHaveClass('bg-red-500/20')

    const mldOption = screen.getByText('Mass Land Destruction').closest('div')
    expect(mldOption).toHaveClass('bg-red-500/20')
  })

  it('allows deselecting restrictions', () => {
    const dataWithRestrictions = {
      ...defaultData,
      avoidStrategies: ['stax', 'infinite-combos']
    }

    render(
      <RestrictionsStep
        data={dataWithRestrictions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Stax'))
    expect(mockOnChange).toHaveBeenCalledWith({
      avoidStrategies: ['infinite-combos']
    })
  })

  it('shows restriction explanations', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText(/Prevents opponents from playing/)).toBeInTheDocument()
    expect(screen.getByText(/Destroys multiple lands/)).toBeInTheDocument()
  })

  it('validates restrictions (optional step)', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    // Next button should be enabled even without restrictions (optional step)
    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows restriction summary', () => {
    const dataWithRestrictions = {
      ...defaultData,
      avoidStrategies: ['stax'],
      avoidCards: ['Winter Orb'],
      petCards: ['Lightning Bolt']
    }

    render(
      <RestrictionsStep
        data={dataWithRestrictions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Restriction Summary')).toBeInTheDocument()
    expect(screen.getByText('Avoiding: 1 strategy, 1 card')).toBeInTheDocument()
    expect(screen.getByText('Including: 1 pet card')).toBeInTheDocument()
  })

  it('handles common card restriction presets', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Common Restrictions')).toBeInTheDocument()
    expect(screen.getByText('No Fast Mana')).toBeInTheDocument()
    expect(screen.getByText('No Tutors')).toBeInTheDocument()
    expect(screen.getByText('No Free Spells')).toBeInTheDocument()
  })

  it('handles preset restriction selection', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('No Fast Mana'))
    expect(mockOnChange).toHaveBeenCalledWith({
      avoidCards: ['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox']
    })
  })

  it('shows restriction impact warnings', () => {
    const dataWithManyRestrictions = {
      ...defaultData,
      avoidStrategies: ['stax', 'combo', 'mld'],
      avoidCards: ['Sol Ring', 'Cyclonic Rift', 'Rhystic Study']
    }

    render(
      <RestrictionsStep
        data={dataWithManyRestrictions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Warning: Many restrictions may limit deck options')).toBeInTheDocument()
  })

  it('handles playgroup-specific restrictions', () => {
    render(
      <RestrictionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Playgroup Rules')).toBeInTheDocument()
    expect(screen.getByText('House ban list')).toBeInTheDocument()
    expect(screen.getByText('Gentleman\'s agreement')).toBeInTheDocument()
  })
})