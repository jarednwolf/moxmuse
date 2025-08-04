import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeckBuildingWizard } from '../../components/tutor/wizard/DeckBuildingWizard'
import { DeckGenerationEngine } from '../../components/tutor/DeckGenerationEngine'
import { DeckEditor } from '../../components/tutor/deck-editor/DeckEditor'
import { WizardProvider } from '../../contexts/WizardContext'
import { TutorDeckProvider } from '../../contexts/TutorDeckContext'

// Mock tRPC
const mockTrpc = {
  tutor: {
    generateCompleteDeck: {
      useMutation: vi.fn(() => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        data: null,
      })),
    },
    analyzeDecksRealTime: {
      useQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
      })),
    },
    getPersonalizedSuggestions: {
      useQuery: vi.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
      })),
    },
  },
}

vi.mock('../../lib/trpc/client', () => ({
  trpc: mockTrpc,
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock performance monitoring
vi.mock('../../../packages/api/src/services/performance/performance-monitor', () => ({
  performanceMonitor: {
    recordMetric: vi.fn(),
    recordUXMetric: vi.fn(),
    recordAIAccuracy: vi.fn(),
    recordMobilePerformance: vi.fn(),
  },
}))

describe('Complete Deck Generation Flow Integration', () => {
  let queryClient: QueryClient
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    user = userEvent.setup()
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
    vi.restoreAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <WizardProvider>
          <TutorDeckProvider>
            {component}
          </TutorDeckProvider>
        </WizardProvider>
      </QueryClientProvider>
    )
  }

  describe('End-to-End Deck Generation', () => {
    it('should complete full deck generation workflow', async () => {
      const mockGeneratedDeck = {
        id: 'generated-deck-123',
        name: 'AI Generated Deck',
        commander: 'Atraxa, Praetors\' Voice',
        cards: Array.from({ length: 99 }, (_, i) => ({
          id: `card-${i}`,
          name: `Generated Card ${i}`,
          quantity: 1,
          category: i < 35 ? 'lands' : i < 45 ? 'ramp' : 'spells',
          cmc: Math.floor(Math.random() * 8),
          types: ['Creature'],
          colors: ['G', 'W', 'U', 'B'],
        })),
        strategy: 'Counters',
        powerLevel: 7,
        budget: 200,
        generationProgress: {
          currentStep: 'complete',
          progress: 100,
          estimatedTimeRemaining: 0,
        },
      }

      // Mock successful deck generation
      const mockMutateAsync = vi.fn().mockResolvedValue(mockGeneratedDeck)
      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: false,
        isError: false,
        error: null,
        data: mockGeneratedDeck,
      })

      // Step 1: Render wizard
      renderWithProviders(<DeckBuildingWizard />)

      // Step 2: Complete commander selection
      const commanderInput = screen.getByLabelText(/commander/i)
      await user.type(commanderInput, 'Atraxa')
      
      const commanderOption = await screen.findByText(/Atraxa, Praetors' Voice/i)
      await user.click(commanderOption)

      // Step 3: Select strategy
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      const strategyOption = screen.getByLabelText(/counters/i)
      await user.click(strategyOption)
      await user.click(nextButton)

      // Step 4: Set power level
      const powerLevelSlider = screen.getByRole('slider', { name: /power level/i })
      fireEvent.change(powerLevelSlider, { target: { value: '7' } })
      await user.click(nextButton)

      // Step 5: Set budget
      const budgetInput = screen.getByLabelText(/budget/i)
      await user.clear(budgetInput)
      await user.type(budgetInput, '200')
      await user.click(nextButton)

      // Step 6: Complete remaining steps quickly
      const skipButtons = screen.queryAllByRole('button', { name: /skip/i })
      for (const skipButton of skipButtons) {
        await user.click(skipButton)
      }

      // Step 7: Generate deck
      const generateButton = screen.getByRole('button', { name: /generate deck/i })
      await user.click(generateButton)

      // Step 8: Wait for generation to complete
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            commander: 'Atraxa, Praetors\' Voice',
            strategy: 'Counters',
            powerLevel: 7,
            budget: 200,
          })
        )
      }, { timeout: 10000 })

      // Step 9: Verify deck was generated
      expect(screen.getByText('AI Generated Deck')).toBeInTheDocument()
      expect(screen.getByText('Atraxa, Praetors\' Voice')).toBeInTheDocument()
    })

    it('should handle generation errors gracefully', async () => {
      const mockError = new Error('Generation failed')
      const mockMutateAsync = vi.fn().mockRejectedValue(mockError)
      
      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: false,
        isError: true,
        error: mockError,
        data: null,
      })

      renderWithProviders(<DeckBuildingWizard />)

      // Complete wizard quickly
      const generateButton = screen.getByRole('button', { name: /generate deck/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText(/generation failed/i)).toBeInTheDocument()
      })

      // Should show retry option
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should show progress during generation', async () => {
      const mockGenerationProgress = [
        { currentStep: 'analyzing_commander', progress: 10, estimatedTimeRemaining: 25000 },
        { currentStep: 'researching_strategy', progress: 30, estimatedTimeRemaining: 20000 },
        { currentStep: 'selecting_cards', progress: 60, estimatedTimeRemaining: 10000 },
        { currentStep: 'optimizing_mana', progress: 80, estimatedTimeRemaining: 5000 },
        { currentStep: 'complete', progress: 100, estimatedTimeRemaining: 0 },
      ]

      let progressIndex = 0
      const mockMutateAsync = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            if (progressIndex < mockGenerationProgress.length - 1) {
              progressIndex++
            } else {
              clearInterval(interval)
              resolve({
                id: 'test-deck',
                name: 'Generated Deck',
                cards: [],
                generationProgress: mockGenerationProgress[progressIndex],
              })
            }
          }, 1000)
        })
      })

      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: true,
        isError: false,
        error: null,
        data: null,
      })

      renderWithProviders(<DeckGenerationEngine />)

      const generateButton = screen.getByRole('button', { name: /generate/i })
      await user.click(generateButton)

      // Should show progress indicators
      await waitFor(() => {
        expect(screen.getByText(/analyzing commander/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/researching strategy/i)).toBeInTheDocument()
      }, { timeout: 2000 })

      await waitFor(() => {
        expect(screen.getByText(/complete/i)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should validate wizard inputs before generation', async () => {
      renderWithProviders(<DeckBuildingWizard />)

      // Try to proceed without selecting commander
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Should show validation error
      expect(screen.getByText(/commander is required/i)).toBeInTheDocument()

      // Should not proceed to next step
      expect(screen.getByText(/select your commander/i)).toBeInTheDocument()
    })

    it('should allow cancellation during generation', async () => {
      let cancelled = false
      const mockMutateAsync = vi.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (cancelled) {
              reject(new Error('Generation cancelled'))
            } else {
              resolve({ id: 'test-deck', cards: [] })
            }
          }, 5000)

          // Simulate cancellation after 2 seconds
          setTimeout(() => {
            cancelled = true
            clearTimeout(timeout)
          }, 2000)
        })
      })

      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: true,
        isError: false,
        error: null,
        data: null,
      })

      renderWithProviders(<DeckGenerationEngine />)

      const generateButton = screen.getByRole('button', { name: /generate/i })
      await user.click(generateButton)

      // Wait for generation to start
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })

      // Cancel generation
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.getByText(/generation cancelled/i)).toBeInTheDocument()
      })
    })
  })

  describe('Deck Editor Integration', () => {
    const mockDeck = {
      id: 'test-deck-123',
      name: 'Test Deck',
      commander: 'Test Commander',
      cards: [
        {
          id: 'sol-ring',
          name: 'Sol Ring',
          quantity: 1,
          category: 'ramp',
          cmc: 1,
          types: ['Artifact'],
          colors: [],
        },
        {
          id: 'lightning-bolt',
          name: 'Lightning Bolt',
          quantity: 1,
          category: 'removal',
          cmc: 1,
          types: ['Instant'],
          colors: ['R'],
        },
      ],
      strategy: 'Aggro',
      powerLevel: 6,
      budget: 100,
    }

    it('should load deck in editor after generation', async () => {
      mockTrpc.tutor.analyzeDecksRealTime.useQuery.mockReturnValue({
        data: {
          synergyAnalysis: { synergyScore: 7.5, cardSynergies: [] },
          strategyAnalysis: { primaryStrategy: 'Aggro', strengths: ['Fast'] },
          recommendations: [],
        },
        isLoading: false,
        isError: false,
        error: null,
      })

      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should display deck information
      expect(screen.getByText('Test Deck')).toBeInTheDocument()
      expect(screen.getByText('Test Commander')).toBeInTheDocument()

      // Should display cards
      expect(screen.getByText('Sol Ring')).toBeInTheDocument()
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument()

      // Should display statistics
      expect(screen.getByText(/mana curve/i)).toBeInTheDocument()
      expect(screen.getByText(/color distribution/i)).toBeInTheDocument()
    })

    it('should update statistics when cards are modified', async () => {
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Find and click add button for Sol Ring
      const addButtons = screen.getAllByRole('button', { name: /\+/i })
      await user.click(addButtons[0])

      // Statistics should update
      await waitFor(() => {
        // The total card count should increase
        expect(screen.getByText(/3 cards/i)).toBeInTheDocument()
      })
    })

    it('should display AI insights when available', async () => {
      const mockInsights = {
        synergyAnalysis: {
          synergyScore: 8.2,
          cardSynergies: [
            {
              cardA: 'Sol Ring',
              cardB: 'Lightning Bolt',
              strength: 7,
              description: 'Mana acceleration enables faster spells',
            },
          ],
        },
        strategyAnalysis: {
          primaryStrategy: 'Aggro',
          strengths: ['Fast clock', 'Consistent mana'],
          weaknesses: [
            {
              weakness: 'Vulnerable to board wipes',
              severity: 'major',
              solutions: ['Add protection spells'],
            },
          ],
        },
        recommendations: [
          {
            type: 'add_card',
            priority: 'high',
            description: 'Consider adding Heroic Intervention',
            reasoning: 'Protects against board wipes',
          },
        ],
      }

      mockTrpc.tutor.analyzeDecksRealTime.useQuery.mockReturnValue({
        data: mockInsights,
        isLoading: false,
        isError: false,
        error: null,
      })

      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should display AI insights
      expect(screen.getByText(/synergy score: 8.2/i)).toBeInTheDocument()
      expect(screen.getByText(/fast clock/i)).toBeInTheDocument()
      expect(screen.getByText(/vulnerable to board wipes/i)).toBeInTheDocument()
      expect(screen.getByText(/heroic intervention/i)).toBeInTheDocument()
    })

    it('should handle real-time analysis updates', async () => {
      let analysisData = {
        synergyAnalysis: { synergyScore: 6.0 },
        strategyAnalysis: { primaryStrategy: 'Midrange' },
        recommendations: [],
      }

      const mockQuery = vi.fn(() => ({
        data: analysisData,
        isLoading: false,
        isError: false,
        error: null,
      }))

      mockTrpc.tutor.analyzeDecksRealTime.useQuery.mockImplementation(mockQuery)

      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Initial analysis
      expect(screen.getByText(/synergy score: 6.0/i)).toBeInTheDocument()

      // Simulate analysis update
      analysisData = {
        synergyAnalysis: { synergyScore: 7.5 },
        strategyAnalysis: { primaryStrategy: 'Aggro' },
        recommendations: [
          {
            type: 'add_card',
            description: 'Add more aggressive creatures',
          },
        ],
      }

      // Trigger re-render
      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Should show updated analysis
      expect(screen.getByText(/synergy score: 7.5/i)).toBeInTheDocument()
      expect(screen.getByText(/add more aggressive creatures/i)).toBeInTheDocument()
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should record performance metrics during generation', async () => {
      const { performanceMonitor } = await import('../../../packages/api/src/services/performance/performance-monitor')

      const mockMutateAsync = vi.fn().mockResolvedValue({
        id: 'test-deck',
        cards: [],
        generationTime: 5000,
      })

      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: false,
        isError: false,
        error: null,
        data: null,
      })

      renderWithProviders(<DeckGenerationEngine />)

      const generateButton = screen.getByRole('button', { name: /generate/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(performanceMonitor.recordMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            metricType: 'ai_processing_time',
            value: expect.any(Number),
            unit: 'ms',
          })
        )
      })
    })

    it('should record user experience metrics', async () => {
      const { performanceMonitor } = await import('../../../packages/api/src/services/performance/performance-monitor')

      renderWithProviders(<DeckBuildingWizard />)

      // Simulate user interaction
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(performanceMonitor.recordUXMetric).toHaveBeenCalledWith(
          expect.objectContaining({
            metricType: 'task_completion_time',
            value: expect.any(Number),
          })
        )
      })
    })

    it('should record AI accuracy metrics', async () => {
      const { performanceMonitor } = await import('../../../packages/api/src/services/performance/performance-monitor')

      mockTrpc.tutor.getPersonalizedSuggestions.useQuery.mockReturnValue({
        data: [
          {
            id: 'suggestion-1',
            type: 'add_card',
            confidence: 0.85,
            accepted: true,
          },
        ],
        isLoading: false,
        isError: false,
        error: null,
      })

      renderWithProviders(<DeckEditor deck={mockDeck} />)

      // Simulate accepting a suggestion
      const acceptButton = screen.getByRole('button', { name: /accept/i })
      await user.click(acceptButton)

      await waitFor(() => {
        expect(performanceMonitor.recordAIAccuracy).toHaveBeenCalledWith(
          expect.objectContaining({
            aiTaskType: 'personalized_suggestions',
            accuracy: 0.85,
            suggestionAccepted: true,
          })
        )
      })
    })
  })

  describe('Error Recovery', () => {
    it('should recover from network errors', async () => {
      // Simulate network error then success
      const mockMutateAsync = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'recovered-deck', cards: [] })

      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        data: null,
      })

      renderWithProviders(<DeckGenerationEngine />)

      const generateButton = screen.getByRole('button', { name: /generate/i })
      await user.click(generateButton)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      // Should succeed on retry
      await waitFor(() => {
        expect(screen.getByText(/generation complete/i)).toBeInTheDocument()
      })
    })

    it('should handle partial generation failures', async () => {
      const partialDeck = {
        id: 'partial-deck',
        cards: Array.from({ length: 60 }, (_, i) => ({
          id: `card-${i}`,
          name: `Card ${i}`,
          quantity: 1,
        })),
        generationErrors: [
          'Could not find suitable win conditions',
          'Mana base optimization failed',
        ],
      }

      const mockMutateAsync = vi.fn().mockResolvedValue(partialDeck)

      mockTrpc.tutor.generateCompleteDeck.useMutation.mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockMutateAsync,
        isLoading: false,
        isError: false,
        error: null,
        data: partialDeck,
      })

      renderWithProviders(<DeckGenerationEngine />)

      const generateButton = screen.getByRole('button', { name: /generate/i })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText(/partial generation/i)).toBeInTheDocument()
        expect(screen.getByText(/60 cards generated/i)).toBeInTheDocument()
        expect(screen.getByText(/could not find suitable win conditions/i)).toBeInTheDocument()
      })

      // Should offer to complete manually
      expect(screen.getByRole('button', { name: /complete manually/i })).toBeInTheDocument()
    })
  })
})