import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommanderStep } from '../CommanderStep'
import { ConsultationData } from '@moxmuse/shared'

describe('CommanderStep', () => {
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

  it('renders commander selection options', () => {
    render(
      <CommanderStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    expect(screen.getByText('Do you know what commander you want to use?')).toBeInTheDocument()
    expect(screen.getByText('Yes, I have a commander in mind')).toBeInTheDocument()
    expect(screen.getByText('No, I need suggestions')).toBeInTheDocument()
  })

  it('shows commander input when user knows commander', () => {
    const dataWithCommander = {
      ...defaultData,
      needsCommanderSuggestions: false
    }

    render(
      <CommanderStep
        data={dataWithCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    expect(screen.getByPlaceholderText('Enter commander name...')).toBeInTheDocument()
  })

  it('calls onChange when commander selection changes', () => {
    render(
      <CommanderStep
        data={defaultData}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    fireEvent.click(screen.getByText('No, I need suggestions'))
    expect(mockOnChange).toHaveBeenCalledWith({
      needsCommanderSuggestions: true
    })
  })

  it('calls onChange when commander name is entered', () => {
    const dataWithCommander = {
      ...defaultData,
      needsCommanderSuggestions: false
    }

    render(
      <CommanderStep
        data={dataWithCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    const input = screen.getByPlaceholderText('Enter commander name...')
    fireEvent.change(input, { target: { value: 'Atraxa, Praetors\' Voice' } })
    
    expect(mockOnChange).toHaveBeenCalledWith({
      commander: 'Atraxa, Praetors\' Voice'
    })
  })

  it('shows commander suggestions when selected', () => {
    const dataWithSuggestions = {
      ...defaultData,
      needsCommanderSuggestions: true
    }

    render(
      <CommanderStep
        data={dataWithSuggestions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    expect(screen.getByText('Great! We\'ll suggest commanders based on your preferences.')).toBeInTheDocument()
  })

  it('validates commander input correctly', () => {
    const dataWithEmptyCommander = {
      ...defaultData,
      needsCommanderSuggestions: false,
      commander: ''
    }

    render(
      <CommanderStep
        data={dataWithEmptyCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    // Next button should be disabled when commander is empty
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()
  })

  it('enables next button when commander is provided', () => {
    const dataWithCommander = {
      ...defaultData,
      needsCommanderSuggestions: false,
      commander: 'Atraxa, Praetors\' Voice'
    }

    render(
      <CommanderStep
        data={dataWithCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('enables next button when suggestions are selected', () => {
    const dataWithSuggestions = {
      ...defaultData,
      needsCommanderSuggestions: true
    }

    render(
      <CommanderStep
        data={dataWithSuggestions}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    const nextButton = screen.getByText('Next')
    expect(nextButton).not.toBeDisabled()
  })

  it('shows commander search suggestions', () => {
    const dataWithCommander = {
      ...defaultData,
      needsCommanderSuggestions: false
    }

    render(
      <CommanderStep
        data={dataWithCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    const input = screen.getByPlaceholderText('Enter commander name...')
    fireEvent.change(input, { target: { value: 'Atr' } })

    // Should show search suggestions (mocked)
    expect(screen.getByText('Popular commanders:')).toBeInTheDocument()
  })

  it('handles commander color identity display', () => {
    const dataWithCommander = {
      ...defaultData,
      needsCommanderSuggestions: false,
      commander: 'Atraxa, Praetors\' Voice',
      commanderColors: ['W', 'U', 'B', 'G']
    }

    render(
      <CommanderStep
        data={dataWithCommander}
        onChange={mockOnChange}
        onNext={mockOnNext}
        onBack={mockOnBack}
        isFirstStep={true}
      />
    )

    // Should show color identity indicators
    expect(screen.getByText('Color Identity: WUBG')).toBeInTheDocument()
  })
})