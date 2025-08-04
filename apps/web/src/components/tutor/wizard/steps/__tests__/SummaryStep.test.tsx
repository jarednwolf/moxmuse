import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SummaryStep } from '../SummaryStep'
import { ConsultationData } from '@moxmuse/shared'

describe('SummaryStep', () => {
  const mockOnChange = vi.fn()
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  const completeData: ConsultationData = {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false,
    commander: 'Atraxa, Praetors\' Voice',
    commanderColors: ['W', 'U', 'B', 'G'],
    strategy: 'value',
    themes: ['Planeswalkers', '+1/+1 counters'],
    customTheme: 'Superfriends value engine',
    budget: 300,
    powerLevel: 3,
    winConditions: {
      primary: 'alternative',
      secondary: ['Planeswalker ultimates', 'Combat damage']
    },
    interaction: {
      level: 'medium',
      types: ['removal', 'counterspells'],
      timing: 'balanced'
    },
    avoidStrategies: ['stax'],
    avoidCards: ['Winter Orb'],
    petCards: ['Doubling Season'],
    complexityLevel: 'moderate'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders summary title', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Deck Summary')).toBeInTheDocument()
    expect(screen.getByText('Review your deck preferences before generation')).toBeInTheDocument()
  })

  it('displays commander information', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Commander')).toBeInTheDocument()
    expect(screen.getByText('Atraxa, Praetors\' Voice')).toBeInTheDocument()
    expect(screen.getByText('WUBG')).toBeInTheDocument()
  })

  it('displays strategy information', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Strategy')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
    expect(screen.getByText('Themes: Planeswalkers, +1/+1 counters')).toBeInTheDocument()
    expect(screen.getByText('Custom: Superfriends value engine')).toBeInTheDocument()
  })

  it('displays budget and power level', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Budget & Power')).toBeInTheDocument()
    expect(screen.getByText('$300')).toBeInTheDocument()
    expect(screen.getByText('Bracket 3 - Optimized')).toBeInTheDocument()
  })

  it('displays win conditions', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Win Conditions')).toBeInTheDocument()
    expect(screen.getByText('Primary: Alternative Win')).toBeInTheDocument()
    expect(screen.getByText('Secondary: Planeswalker ultimates, Combat damage')).toBeInTheDocument()
  })

  it('displays interaction preferences', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Interaction')).toBeInTheDocument()
    expect(screen.getByText('Level: Medium')).toBeInTheDocument()
    expect(screen.getByText('Types: Removal, Counterspells')).toBeInTheDocument()
    expect(screen.getByText('Timing: Balanced')).toBeInTheDocument()
  })

  it('displays restrictions', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Restrictions')).toBeInTheDocument()
    expect(screen.getByText('Avoid strategies: Stax')).toBeInTheDocument()
    expect(screen.getByText('Avoid cards: Winter Orb')).toBeInTheDocument()
    expect(screen.getByText('Pet cards: Doubling Season')).toBeInTheDocument()
  })

  it('displays complexity level', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Complexity')).toBeInTheDocument()
    expect(screen.getByText('Moderate')).toBeInTheDocument()
  })

  it('shows collection usage', () => {
    const dataWithCollection = {
      ...completeData,
      useCollection: true
    }

    render(
      <SummaryStep
        data={dataWithCollection}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Using collection: Yes')).toBeInTheDocument()
  })

  it('handles commander suggestions flow', () => {
    const dataWithSuggestions = {
      ...completeData,
      needsCommanderSuggestions: true,
      commander: undefined
    }

    render(
      <SummaryStep
        data={dataWithSuggestions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Commander: Will be suggested')).toBeInTheDocument()
  })

  it('shows generate deck button', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    expect(generateButton).toBeInTheDocument()
    expect(generateButton).not.toBeDisabled()
  })

  it('shows estimated generation time', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Estimated time: 30-60 seconds')).toBeInTheDocument()
  })

  it('shows deck preview information', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Your deck will include:')).toBeInTheDocument()
    expect(screen.getByText('100 cards total')).toBeInTheDocument()
    expect(screen.getByText('Categorized by function')).toBeInTheDocument()
    expect(screen.getByText('Strategy explanation')).toBeInTheDocument()
    expect(screen.getByText('Upgrade suggestions')).toBeInTheDocument()
  })

  it('allows editing previous steps', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    const editButtons = screen.getAllByText('Edit')
    expect(editButtons.length).toBeGreaterThan(0)
  })

  it('shows validation warnings for incomplete data', () => {
    const incompleteData = {
      ...completeData,
      strategy: undefined,
      budget: undefined
    }

    render(
      <SummaryStep
        data={incompleteData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Please complete all required steps')).toBeInTheDocument()
    
    const generateButton = screen.getByText('Generate Deck')
    expect(generateButton).toBeDisabled()
  })

  it('shows deck statistics preview', () => {
    render(
      <SummaryStep
        data={completeData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Expected deck composition:')).toBeInTheDocument()
    expect(screen.getByText('~35 lands')).toBeInTheDocument()
    expect(screen.getByText('~10 ramp spells')).toBeInTheDocument()
    expect(screen.getByText('~8 card draw')).toBeInTheDocument()
    expect(screen.getByText('~6 removal spells')).toBeInTheDocument()
  })

  it('handles missing optional fields gracefully', () => {
    const minimalData: ConsultationData = {
      buildingFullDeck: true,
      needsCommanderSuggestions: false,
      useCollection: false,
      commander: 'Atraxa, Praetors\' Voice',
      strategy: 'value',
      budget: 200,
      powerLevel: 2,
      winConditions: { primary: 'combat' },
      interaction: { level: 'medium', types: [], timing: 'balanced' },
      complexityLevel: 'simple'
    }

    render(
      <SummaryStep
        data={minimalData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('No restrictions')).toBeInTheDocument()
    expect(screen.getByText('No themes specified')).toBeInTheDocument()
  })
})