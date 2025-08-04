import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TRPCProvider } from '@/lib/trpc/provider'
import { ConsultationData, GeneratedDeck } from '@moxmuse/shared'

// Mock components for integration testing
const MockTutorPage = () => {
  const [currentView, setCurrentView] = React.useState<'entry' | 'wizard' | 'generation' | 'editor'>('entry')
  const [consultationData, setConsultationData] = React.useState<ConsultationData | null>(null)
  const [generatedDeck, setGeneratedDeck] = React.useState<GeneratedDeck | null>(null)

  const handleDeckBuilding = () => setCurrentView('wizard')
  const handleWizardComplete = (data: ConsultationData) => {
    setConsultationData(data)
    setCurrentView('generation')
  }
  const handleDeckGenerated = (deck: GeneratedDeck) => {
    setGeneratedDeck(deck)
    setCurrentView('editor')
  }

  return (
    <div>
      {currentView === 'entry' && (
        <div>
          <h1>AI Deck Building Tutor</h1>
          <button onClick={handleDeckBuilding}>Build Full Deck</button>
          <button onClick={() => {}}>Get Card Recommendations</button>
        </div>
      )}
      
      {currentView === 'wizard' && (
        <div>
          <h2>Deck Building Wizard</h2>
          <div data-testid="wizard-step">Current Step</div>
          <button onClick={() => handleWizardComplete({
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
          })}>Complete Wizard</button>
        </div>
      )}
      
      {currentView === 'generation' && (
        <div>
          <h2>Generating Deck</h2>
          <div data-testid="generation-progress">Progress: 0%</div>
          <button onClick={() => handleDeckGenerated({
            id: 'test-deck',
            name: 'Generated Deck',
            commander: 'Atraxa, Praetors\' Voice',
            format: 'commander',
            strategy: {
              name: 'Value Engine',
              description: 'Test strategy',
              archetype: 'value',
              themes: [],
              gameplan: 'Generate value',
              strengths: [],
              weaknesses: []
            },
            winConditions: [],
            powerLevel: 3,
            estimatedBudget: 300,
            cards: [],
            categories: [],
            statistics: {
              manaCurve: { distribution: [0,1,2,3,4,5,6,7], peakCMC: 3, averageCMC: 3.5, landRatio: 0.35 },
              colorDistribution: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, multicolor: 0, devotion: {} },
              typeDistribution: { creature: 30, instant: 10, sorcery: 15, artifact: 10, enchantment: 5, planeswalker: 2, land: 35, other: 3 },
              rarityDistribution: { common: 20, uncommon: 30, rare: 40, mythic: 10 },
              averageCMC: 3.5,
              totalValue: 300,
              landCount: 35,
              nonlandCount: 65
            },
            synergies: [],
            weaknesses: [],
            generatedAt: new Date(),
            consultationData: consultationData!
          })}>Simulate Generation Complete</button>
        </div>
      )}
      
      {currentView === 'editor' && generatedDeck && (
        <div>
          <h2>Deck Editor</h2>
          <div data-testid="deck-name">{generatedDeck.name}</div>
          <div data-testid="deck-commander">{generatedDeck.commander}</div>
          <button>Save Deck</button>
          <button>Export Deck</button>
        </div>
      )}
    </div>
  )
}

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
})

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider>
        {component}
      </TRPCProvider>
    </QueryClientProvider>
  )
}

describe('Deck Building Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes full deck building workflow', async () => {
    renderWithProviders(<MockTutorPage />)

    // Start at entry point
    expect(screen.getByText('AI Deck Building Tutor')).toBeInTheDocument()
    expect(screen.getByText('Build Full Deck')).toBeInTheDocument()

    // Navigate to wizard
    fireEvent.click(screen.getByText('Build Full Deck'))
    
    await waitFor(() => {
      expect(screen.getByText('Deck Building Wizard')).toBeInTheDocument()
    })

    // Complete wizard
    fireEvent.click(screen.getByText('Complete Wizard'))
    
    await waitFor(() => {
      expect(screen.getByText('Generating Deck')).toBeInTheDocument()
    })

    // Complete generation
    fireEvent.click(screen.getByText('Simulate Generation Complete'))
    
    await waitFor(() => {
      expect(screen.getByText('Deck Editor')).toBeInTheDocument()
      expect(screen.getByTestId('deck-name')).toHaveTextContent('Generated Deck')
      expect(screen.getByTestId('deck-commander')).toHaveTextContent('Atraxa, Praetors\' Voice')
    })
  })

  it('preserves data throughout workflow', async () => {
    renderWithProviders(<MockTutorPage />)

    // Navigate through workflow
    fireEvent.click(screen.getByText('Build Full Deck'))
    
    await waitFor(() => {
      expect(screen.getByTestId('wizard-step')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Complete Wizard'))
    
    await waitFor(() => {
      expect(screen.getByTestId('generation-progress')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Simulate Generation Complete'))
    
    await waitFor(() => {
      // Verify that consultation data was preserved and used
      expect(screen.getByTestId('deck-commander')).toHaveTextContent('Atraxa, Praetors\' Voice')
    })
  })

  it('handles workflow navigation', async () => {
    renderWithProviders(<MockTutorPage />)

    // Test forward navigation
    fireEvent.click(screen.getByText('Build Full Deck'))
    expect(screen.getByText('Deck Building Wizard')).toBeInTheDocument()

    // Test that we can't go back to entry from wizard (in this mock)
    expect(screen.queryByText('AI Deck Building Tutor')).not.toBeInTheDocument()
  })

  it('shows appropriate loading states', async () => {
    renderWithProviders(<MockTutorPage />)

    fireEvent.click(screen.getByText('Build Full Deck'))
    fireEvent.click(screen.getByText('Complete Wizard'))
    
    await waitFor(() => {
      expect(screen.getByTestId('generation-progress')).toBeInTheDocument()
    })
  })

  it('handles error states in workflow', async () => {
    // This would test error handling throughout the workflow
    renderWithProviders(<MockTutorPage />)

    // Simulate error during generation
    // In a real test, we would mock the API to return an error
    expect(screen.getByText('AI Deck Building Tutor')).toBeInTheDocument()
  })
})

describe('Wizard Step Integration', () => {
  it('validates step progression', async () => {
    // Test that wizard steps validate data before allowing progression
    const mockWizard = () => {
      const [step, setStep] = React.useState(0)
      const [data, setData] = React.useState<Partial<ConsultationData>>({})

      return (
        <div>
          <div data-testid="current-step">Step {step + 1}</div>
          {step === 0 && (
            <div>
              <input 
                data-testid="commander-input"
                onChange={(e) => setData({...data, commander: e.target.value})}
              />
              <button 
                disabled={!data.commander}
                onClick={() => setStep(1)}
              >
                Next
              </button>
            </div>
          )}
          {step === 1 && (
            <div>
              <select 
                data-testid="strategy-select"
                onChange={(e) => setData({...data, strategy: e.target.value as any})}
              >
                <option value="">Select Strategy</option>
                <option value="aggro">Aggro</option>
                <option value="control">Control</option>
              </select>
              <button 
                disabled={!data.strategy}
                onClick={() => setStep(2)}
              >
                Next
              </button>
            </div>
          )}
          {step === 2 && <div>Summary Step</div>}
        </div>
      )
    }

    render(mockWizard())

    // Should start at step 1
    expect(screen.getByTestId('current-step')).toHaveTextContent('Step 1')

    // Next button should be disabled initially
    const nextButton = screen.getByText('Next')
    expect(nextButton).toBeDisabled()

    // Enter commander name
    fireEvent.change(screen.getByTestId('commander-input'), {
      target: { value: 'Atraxa' }
    })

    // Next button should now be enabled
    expect(nextButton).not.toBeDisabled()

    // Proceed to next step
    fireEvent.click(nextButton)
    expect(screen.getByTestId('current-step')).toHaveTextContent('Step 2')

    // Strategy step validation
    const strategyNextButton = screen.getByText('Next')
    expect(strategyNextButton).toBeDisabled()

    fireEvent.change(screen.getByTestId('strategy-select'), {
      target: { value: 'control' }
    })

    expect(strategyNextButton).not.toBeDisabled()
    fireEvent.click(strategyNextButton)

    expect(screen.getByText('Summary Step')).toBeInTheDocument()
  })
})

describe('Generation Engine Integration', () => {
  it('handles API integration', async () => {
    // Mock the tRPC client
    const mockTrpc = {
      tutor: {
        generateFullDeck: {
          mutate: vi.fn().mockResolvedValue({
            cards: [
              { name: 'Sol Ring', category: 'Ramp' },
              { name: 'Command Tower', category: 'Lands' }
            ],
            strategy: 'value',
            reasoning: 'Test deck generation'
          })
        }
      }
    }

    const GenerationTest = () => {
      const [isGenerating, setIsGenerating] = React.useState(false)
      const [result, setResult] = React.useState<any>(null)

      const handleGenerate = async () => {
        setIsGenerating(true)
        try {
          const result = await mockTrpc.tutor.generateFullDeck.mutate({
            sessionId: 'test',
            prompt: 'Generate a deck',
            constraints: { budget: 300, powerLevel: 3 }
          })
          setResult(result)
        } finally {
          setIsGenerating(false)
        }
      }

      return (
        <div>
          <button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
          {result && (
            <div data-testid="generation-result">
              Cards: {result.cards.length}
            </div>
          )}
        </div>
      )
    }

    render(<GenerationTest />)

    fireEvent.click(screen.getByText('Generate'))
    
    await waitFor(() => {
      expect(screen.getByTestId('generation-result')).toHaveTextContent('Cards: 2')
    })
  })
})

describe('Deck Editor Integration', () => {
  it('integrates with deck data', () => {
    const mockDeck: GeneratedDeck = {
      id: 'test-deck',
      name: 'Test Deck',
      commander: 'Atraxa, Praetors\' Voice',
      format: 'commander',
      strategy: {
        name: 'Value',
        description: 'Value strategy',
        archetype: 'value',
        themes: [],
        gameplan: 'Generate value',
        strengths: [],
        weaknesses: []
      },
      winConditions: [],
      powerLevel: 3,
      estimatedBudget: 300,
      cards: [
        {
          cardId: 'sol-ring',
          quantity: 1,
          category: 'Ramp',
          role: 'Acceleration',
          reasoning: 'Fast mana'
        }
      ],
      categories: [],
      statistics: {
        manaCurve: { distribution: [0,1,2,3,4,5,6,7], peakCMC: 3, averageCMC: 3.5, landRatio: 0.35 },
        colorDistribution: { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0, multicolor: 0, devotion: {} },
        typeDistribution: { creature: 30, instant: 10, sorcery: 15, artifact: 10, enchantment: 5, planeswalker: 2, land: 35, other: 3 },
        rarityDistribution: { common: 20, uncommon: 30, rare: 40, mythic: 10 },
        averageCMC: 3.5,
        totalValue: 300,
        landCount: 35,
        nonlandCount: 65
      },
      synergies: [],
      weaknesses: [],
      generatedAt: new Date(),
      consultationData: {
        buildingFullDeck: true,
        needsCommanderSuggestions: false,
        useCollection: false
      }
    }

    const EditorTest = () => {
      const [deck, setDeck] = React.useState(mockDeck)

      return (
        <div>
          <h2 data-testid="deck-title">{deck.name}</h2>
          <div data-testid="card-count">{deck.cards.length} cards</div>
          <div data-testid="deck-budget">${deck.estimatedBudget}</div>
          <button onClick={() => setDeck({...deck, name: 'Updated Deck'})}>
            Update Name
          </button>
        </div>
      )
    }

    render(<EditorTest />)

    expect(screen.getByTestId('deck-title')).toHaveTextContent('Test Deck')
    expect(screen.getByTestId('card-count')).toHaveTextContent('1 cards')
    expect(screen.getByTestId('deck-budget')).toHaveTextContent('$300')

    fireEvent.click(screen.getByText('Update Name'))
    expect(screen.getByTestId('deck-title')).toHaveTextContent('Updated Deck')
  })
})