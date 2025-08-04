import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeckGenerationEngine } from '../DeckGenerationEngine'
import { ConsultationData, GeneratedDeck } from '@moxmuse/shared'

// Mock the trpc client
const mockGenerateFullDeck = vi.fn()
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    tutor: {
      generateFullDeck: {
        mutate: mockGenerateFullDeck
      }
    }
  }
}))

// Mock the deck generation utilities
vi.mock('@/lib/deck-generation', () => ({
  assembleDeck: vi.fn(),
  enhanceDeckWithAnalysis: vi.fn(),
  buildDeckGenerationPrompt: vi.fn(),
  generateSessionId: vi.fn(() => 'test-session-id')
}))

describe('DeckGenerationEngine', () => {
  const mockOnDeckGenerated = vi.fn()
  const mockOnError = vi.fn()

  const mockConsultationData: ConsultationData = {
    buildingFullDeck: true,
    needsCommanderSuggestions: false,
    useCollection: false,
    commander: 'Atraxa, Praetors\' Voice',
    strategy: 'value',
    budget: 300,
    powerLevel: 3,
    winConditions: { primary: 'alternative' },
    interaction: { level: 'medium', types: ['removal'], timing: 'balanced' },
    complexityLevel: 'moderate'
  }

  const mockGeneratedDeck: GeneratedDeck = {
    id: 'test-deck-id',
    name: 'Test Deck',
    commander: 'Atraxa, Praetors\' Voice',
    format: 'commander',
    strategy: {
      name: 'Value Engine',
      description: 'A value-focused deck',
      archetype: 'value',
      themes: ['counters'],
      gameplan: 'Generate value',
      strengths: ['Card advantage'],
      weaknesses: ['Slow start']
    },
    winConditions: [],
    powerLevel: 3,
    estimatedBudget: 300,
    cards: [],
    categories: [],
    statistics: {
      manaCurve: {
        distribution: [0, 1, 2, 3, 4, 5, 6, 7],
        peakCMC: 3,
        averageCMC: 3.5,
        landRatio: 0.35
      },
      colorDistribution: {
        white: 5,
        blue: 5,
        black: 5,
        green: 5,
        colorless: 0,
        multicolor: 10,
        devotion: {}
      },
      typeDistribution: {
        creature: 30,
        instant: 10,
        sorcery: 15,
        artifact: 10,
        enchantment: 5,
        planeswalker: 2,
        land: 35,
        other: 3
      },
      rarityDistribution: {
        common: 20,
        uncommon: 30,
        rare: 40,
        mythic: 10
      },
      averageCMC: 3.5,
      totalValue: 300,
      landCount: 35,
      nonlandCount: 65
    },
    synergies: [],
    weaknesses: [],
    generatedAt: new Date(),
    consultationData: mockConsultationData
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateFullDeck.mockResolvedValue({
      cards: [],
      strategy: 'value',
      reasoning: 'Test reasoning'
    })
  })

  it('renders generation interface initially', () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    expect(screen.getByText('Ready to Generate')).toBeInTheDocument()
    expect(screen.getByText('Generate Deck')).toBeInTheDocument()
  })

  it('shows consultation summary', () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    expect(screen.getByText('Commander: Atraxa, Praetors\' Voice')).toBeInTheDocument()
    expect(screen.getByText('Strategy: Value')).toBeInTheDocument()
    expect(screen.getByText('Budget: $300')).toBeInTheDocument()
    expect(screen.getByText('Power Level: 3')).toBeInTheDocument()
  })

  it('starts generation when generate button is clicked', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText('Analyzing commander and strategy...')).toBeInTheDocument()
    })
  })

  it('shows progress during generation', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })

  it('progresses through generation phases', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    // Should progress through different phases
    await waitFor(() => {
      expect(screen.getByText(/Analyzing commander/)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Generating card recommendations/)).toBeInTheDocument()
    }, { timeout: 2000 })

    await waitFor(() => {
      expect(screen.getByText(/Assembling deck structure/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('calls onDeckGenerated when generation completes', async () => {
    const { assembleDeck, enhanceDeckWithAnalysis } = await import('@/lib/deck-generation')
    vi.mocked(assembleDeck).mockResolvedValue(mockGeneratedDeck)
    vi.mocked(enhanceDeckWithAnalysis).mockResolvedValue(mockGeneratedDeck)

    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(mockOnDeckGenerated).toHaveBeenCalledWith(mockGeneratedDeck)
    }, { timeout: 5000 })
  })

  it('handles generation errors', async () => {
    mockGenerateFullDeck.mockRejectedValue(new Error('Generation failed'))

    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  it('shows error message on generation failure', async () => {
    mockGenerateFullDeck.mockRejectedValue(new Error('API Error'))

    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText(/Generation failed/)).toBeInTheDocument()
    })
  })

  it('allows retry after error', async () => {
    mockGenerateFullDeck.mockRejectedValueOnce(new Error('First failure'))
    mockGenerateFullDeck.mockResolvedValueOnce({ cards: [], strategy: 'value' })

    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    const retryButton = screen.getByText('Retry')
    retryButton.click()

    await waitFor(() => {
      expect(mockGenerateFullDeck).toHaveBeenCalledTimes(2)
    })
  })

  it('shows cancel button during generation', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  it('handles generation cancellation', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    const cancelButton = screen.getByText('Cancel')
    cancelButton.click()

    expect(screen.getByText('Generate Deck')).toBeInTheDocument()
  })

  it('shows estimated time during generation', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(screen.getByText(/Estimated time remaining/)).toBeInTheDocument()
    })
  })

  it('builds correct generation prompt', async () => {
    const { buildDeckGenerationPrompt } = await import('@/lib/deck-generation')

    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(buildDeckGenerationPrompt).toHaveBeenCalledWith(
        mockConsultationData,
        "Atraxa, Praetors' Voice"
      )
    })
  })

  it('passes correct constraints to API', async () => {
    render(
      <DeckGenerationEngine
        consultationData={mockConsultationData}
        commander="Atraxa, Praetors' Voice"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    const generateButton = screen.getByText('Generate Deck')
    generateButton.click()

    await waitFor(() => {
      expect(mockGenerateFullDeck).toHaveBeenCalledWith({
        sessionId: 'test-session-id',
        prompt: expect.any(String),
        constraints: {
          budget: 300,
          powerLevel: 3,
          useCollection: false
        }
      })
    })
  })

  it('handles commander suggestions flow', () => {
    const dataWithSuggestions = {
      ...mockConsultationData,
      needsCommanderSuggestions: true,
      commander: undefined
    }

    render(
      <DeckGenerationEngine
        consultationData={dataWithSuggestions}
        commander="Suggested Commander"
        onDeckGenerated={mockOnDeckGenerated}
        onError={mockOnError}
      />
    )

    expect(screen.getByText('Commander: Suggested Commander')).toBeInTheDocument()
    expect(screen.getByText('(AI Suggested)')).toBeInTheDocument()
  })
})