import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WinConditionsStep } from '../WinConditionsStep'
import { ConsultationData } from '@moxmuse/shared'

describe('WinConditionsStep', () => {
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

  it('renders win condition options', () => {
    render(
      <WinConditionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Win Conditions')).toBeInTheDocument()
    expect(screen.getByText('Combat Damage')).toBeInTheDocument()
    expect(screen.getByText('Combo')).toBeInTheDocument()
    expect(screen.getByText('Alternative Win')).toBeInTheDocument()
    expect(screen.getByText('Control Victory')).toBeInTheDocument()
  })

  it('shows combat style options when combat is selected', () => {
    const dataWithCombat = {
      ...defaultData,
      winConditions: { primary: 'combat' as const }
    }

    render(
      <WinConditionsStep
        data={dataWithCombat}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Combat Style')).toBeInTheDocument()
    expect(screen.getByText('Aggressive Swarm')).toBeInTheDocument()
    expect(screen.getByText('Voltron')).toBeInTheDocument()
    expect(screen.getByText('Token Army')).toBeInTheDocument()
    expect(screen.getByText('Big Creatures')).toBeInTheDocument()
  })

  it('shows combo type options when combo is selected', () => {
    const dataWithCombo = {
      ...defaultData,
      winConditions: { primary: 'combo' as const }
    }

    render(
      <WinConditionsStep
        data={dataWithCombo}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Combo Type')).toBeInTheDocument()
    expect(screen.getByText('Infinite Combos')).toBeInTheDocument()
    expect(screen.getByText('Synergy Combos')).toBeInTheDocument()
    expect(screen.getByText('Engine Combos')).toBeInTheDocument()
  })

  it('calls onChange when primary win condition is selected', () => {
    render(
      <WinConditionsStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    fireEvent.click(screen.getByText('Combat Damage'))
    expect(mockOnChange).toHaveBeenCalledWith({
      winConditions: { primary: 'combat' }
    })
  })

  it('shows secondary win conditions textarea when primary is selected', () => {
    const dataWithPrimary = {
      ...defaultData,
      winConditions: { primary: 'combat' as const }
    }

    render(
      <WinConditionsStep
        data={dataWithPrimary}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Secondary Win Conditions')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., Commander damage, mill, burn, planeswalker ultimates')).toBeInTheDocument()
  })

  it('shows win condition summary when conditions are set', () => {
    const dataWithConditions = {
      ...defaultData,
      winConditions: {
        primary: 'combat' as const,
        combatStyle: 'voltron' as const,
        secondary: ['Commander damage', 'Mill']
      }
    }

    render(
      <WinConditionsStep
        data={dataWithConditions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={false}
      />
    )

    expect(screen.getByText('Win Condition Summary')).toBeInTheDocument()
    
    // Check that the summary section contains the expected elements
    const summarySection = screen.getByText('Win Condition Summary').closest('div')
    expect(summarySection).toBeInTheDocument()
    expect(summarySection).toHaveTextContent('Primary: Combat Damage (Voltron)')
    expect(summarySection).toHaveTextContent('Secondary: Commander damage, Mill')
  })
})