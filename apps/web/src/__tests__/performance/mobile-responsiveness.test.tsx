import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileDeckEditor } from '../../components/tutor/deck-editor/MobileDeckEditor'
import { MobileCardList } from '../../components/tutor/deck-editor/MobileCardList'
import { MobileStatistics } from '../../components/tutor/deck-editor/MobileStatistics'
import { performanceMonitor } from '../../../packages/api/src/services/performance/performance-monitor'

// Mock performance monitoring
vi.mock('../../../packages/api/src/services/performance/performance-monitor', () => ({
  performanceMonitor: {
    recordMobilePerformance: vi.fn(),
    recordUXMetric: vi.fn(),
    recordMetric: vi.fn(),
  },
}))

// Mock intersection observer for virtualization
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.IntersectionObserver = mockIntersectionObserver

// Mock ResizeObserver
const mockResizeObserver = vi.fn()
mockResizeObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.ResizeObserver = mockResizeObserver

// Mock touch events
const createTouchEvent = (type: string, touches: Array<{ clientX: number; clientY: number }>) => {
  return new TouchEvent(type, {
    touches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })) as any,
    changedTouches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })) as any,
    targetTouches: touches.map(touch => ({
      ...touch,
      identifier: 0,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })) as any,
  })
}

describe('Mobile Responsiveness Performance Tests', () => {
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

    // Mock viewport for mobile testing
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // iPhone width
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667, // iPhone height
    })

    // Mock touch support
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5,
    })
  })

  afterEach(() => {
    queryClient.clear()
    vi.restoreAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    )
  }

  const mockDeck = {
    id: 'mobile-test-deck',
    name: 'Mobile Test Deck',
    commander: 'Mobile Commander',
    cards: Array.from({ length: 100 }, (_, i) => ({
      id: `card-${i}`,
      name: `Card ${i}`,
      quantity: 1,
      category: i < 35 ? 'lands' : i < 45 ? 'ramp' : 'spells',
      cmc: Math.floor(i / 10),
      types: ['Creature'],
      colors: ['R'],
    })),
    strategy: 'Aggro',
    powerLevel: 6,
    budget: 100,
  }

  describe('Touch Response Performance', () => {
    it('should respond to touch events within 100ms', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const cardElement = screen.getAllByTestId('mobile-card-item')[0]
      const startTime = performance.now()

      // Simulate touch event
      fireEvent.touchStart(cardElement, {
        touches: [{ clientX: 100, clientY: 100 }],
      })

      await waitFor(() => {
        const endTime = performance.now()
        const responseTime = endTime - startTime
        expect(responseTime).toBeLessThan(100) // Should respond within 100ms
      })

      // Verify performance metric was recorded
      expect(performanceMonitor.recordMobilePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            touchResponseTime: expect.any(Number),
          }),
        })
      )
    })

    it('should handle rapid touch events without lag', async () => {
      renderWithProviders(<MobileCardList cards={mockDeck.cards.slice(0, 10)} />)

      const cardElements = screen.getAllByTestId('mobile-card-item')
      const touchTimes: number[] = []

      // Simulate rapid touches
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        
        fireEvent.touchStart(cardElements[i % cardElements.length], {
          touches: [{ clientX: 100 + i * 10, clientY: 100 + i * 10 }],
        })
        
        await waitFor(() => {
          // Wait for visual feedback
          expect(cardElements[i % cardElements.length]).toHaveClass('touch-active')
        })
        
        const endTime = performance.now()
        touchTimes.push(endTime - startTime)
      }

      // All touches should be responsive
      touchTimes.forEach(time => {
        expect(time).toBeLessThan(100)
      })

      // Average response time should be good
      const avgTime = touchTimes.reduce((sum, time) => sum + time, 0) / touchTimes.length
      expect(avgTime).toBeLessThan(50)
    })

    it('should provide haptic feedback on supported devices', async () => {
      // Mock vibrate API
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        writable: true,
        configurable: true,
        value: mockVibrate,
      })

      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const addButton = screen.getAllByRole('button', { name: /add/i })[0]
      
      fireEvent.touchStart(addButton)
      await user.click(addButton)

      // Should trigger haptic feedback
      expect(mockVibrate).toHaveBeenCalledWith(50)
    })
  })

  describe('Gesture Recognition Performance', () => {
    it('should recognize swipe gestures accurately', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const container = screen.getByTestId('mobile-deck-editor')
      let gestureRecognized = false

      // Add gesture listener
      container.addEventListener('swipe', () => {
        gestureRecognized = true
      })

      // Simulate swipe gesture
      const startTime = performance.now()
      
      fireEvent.touchStart(container, {
        touches: [{ clientX: 300, clientY: 300 }],
      })

      fireEvent.touchMove(container, {
        touches: [{ clientX: 100, clientY: 300 }],
      })

      fireEvent.touchEnd(container, {
        changedTouches: [{ clientX: 100, clientY: 300 }],
      })

      await waitFor(() => {
        const endTime = performance.now()
        const recognitionTime = endTime - startTime
        expect(recognitionTime).toBeLessThan(200) // Should recognize within 200ms
      })

      // Verify gesture was recognized
      expect(gestureRecognized).toBe(true)

      // Verify performance metric
      expect(performanceMonitor.recordMobilePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            gestureRecognitionAccuracy: expect.any(Number),
          }),
        })
      )
    })

    it('should handle pinch-to-zoom gestures smoothly', async () => {
      renderWithProviders(<MobileCardList cards={mockDeck.cards.slice(0, 20)} />)

      const container = screen.getByTestId('mobile-card-list')
      const frameRates: number[] = []
      let lastFrameTime = performance.now()

      // Monitor frame rate during gesture
      const frameCallback = () => {
        const currentTime = performance.now()
        const frameTime = currentTime - lastFrameTime
        frameRates.push(1000 / frameTime) // Convert to FPS
        lastFrameTime = currentTime
      }

      // Start monitoring
      const animationId = requestAnimationFrame(function monitor() {
        frameCallback()
        if (frameRates.length < 30) { // Monitor for ~0.5 seconds at 60fps
          requestAnimationFrame(monitor)
        }
      })

      // Simulate pinch gesture
      fireEvent.touchStart(container, {
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      })

      // Simulate zoom out
      for (let i = 0; i < 10; i++) {
        fireEvent.touchMove(container, {
          touches: [
            { clientX: 100 - i * 5, clientY: 100 - i * 5 },
            { clientX: 200 + i * 5, clientY: 200 + i * 5 },
          ],
        })
        await new Promise(resolve => setTimeout(resolve, 16)) // ~60fps
      }

      fireEvent.touchEnd(container)

      await waitFor(() => {
        // Should maintain good frame rate
        const avgFPS = frameRates.reduce((sum, fps) => sum + fps, 0) / frameRates.length
        expect(avgFPS).toBeGreaterThan(45) // Should maintain at least 45 FPS
      })

      cancelAnimationFrame(animationId)
    })
  })

  describe('Scroll Performance', () => {
    it('should maintain smooth scrolling with large lists', async () => {
      const largeDeck = {
        ...mockDeck,
        cards: Array.from({ length: 1000 }, (_, i) => ({
          id: `card-${i}`,
          name: `Card ${i}`,
          quantity: 1,
          category: 'spells',
          cmc: i % 8,
          types: ['Creature'],
          colors: ['R'],
        })),
      }

      renderWithProviders(<MobileCardList cards={largeDeck.cards} />)

      const scrollContainer = screen.getByTestId('virtualized-scroll-container')
      const scrollTimes: number[] = []

      // Simulate multiple scroll events
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now()
        
        fireEvent.scroll(scrollContainer, {
          target: { scrollTop: i * 100 },
        })

        await waitFor(() => {
          // Wait for scroll to complete
          expect(scrollContainer.scrollTop).toBe(i * 100)
        })

        const endTime = performance.now()
        scrollTimes.push(endTime - startTime)
      }

      // All scroll events should be fast
      scrollTimes.forEach(time => {
        expect(time).toBeLessThan(16) // Should complete within one frame (16ms at 60fps)
      })

      // Verify scroll performance metric
      expect(performanceMonitor.recordMobilePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            scrollPerformance: expect.any(Number),
          }),
        })
      )
    })

    it('should use virtualization for large lists', async () => {
      const largeDeck = {
        ...mockDeck,
        cards: Array.from({ length: 500 }, (_, i) => ({
          id: `card-${i}`,
          name: `Card ${i}`,
          quantity: 1,
        })),
      }

      renderWithProviders(<MobileCardList cards={largeDeck.cards} />)

      // Should only render visible items
      const renderedItems = screen.getAllByTestId('mobile-card-item')
      expect(renderedItems.length).toBeLessThan(50) // Should render much fewer than total

      // Should render more items when scrolling
      const scrollContainer = screen.getByTestId('virtualized-scroll-container')
      fireEvent.scroll(scrollContainer, {
        target: { scrollTop: 1000 },
      })

      await waitFor(() => {
        const newRenderedItems = screen.getAllByTestId('mobile-card-item')
        expect(newRenderedItems.length).toBeGreaterThan(0)
        expect(newRenderedItems.length).toBeLessThan(100) // Still virtualized
      })
    })
  })

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // Simulate heavy usage
      for (let i = 0; i < 10; i++) {
        const cardElements = screen.getAllByTestId('mobile-card-item')
        
        // Interact with multiple cards
        for (let j = 0; j < Math.min(5, cardElements.length); j++) {
          fireEvent.touchStart(cardElements[j])
          fireEvent.touchEnd(cardElements[j])
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)

      // Verify memory usage metric
      expect(performanceMonitor.recordMobilePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            memoryUsage: expect.any(Number),
          }),
        })
      )
    })

    it('should clean up resources when unmounting', async () => {
      const { unmount } = renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // Verify observers were set up
      expect(mockIntersectionObserver).toHaveBeenCalled()
      expect(mockResizeObserver).toHaveBeenCalled()

      unmount()

      // Should clean up observers
      expect(mockIntersectionObserver().disconnect).toHaveBeenCalled()
      expect(mockResizeObserver().disconnect).toHaveBeenCalled()
    })
  })

  describe('Render Performance', () => {
    it('should render initial view quickly', async () => {
      const startTime = performance.now()

      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      await waitFor(() => {
        expect(screen.getByText('Mobile Test Deck')).toBeInTheDocument()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render within 500ms
      expect(renderTime).toBeLessThan(500)

      // Verify render performance metric
      expect(performanceMonitor.recordMobilePerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            renderTime: expect.any(Number),
          }),
        })
      )
    })

    it('should handle orientation changes smoothly', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // Simulate orientation change
      Object.defineProperty(window, 'innerWidth', { value: 667 })
      Object.defineProperty(window, 'innerHeight', { value: 375 })

      const startTime = performance.now()
      fireEvent(window, new Event('orientationchange'))

      await waitFor(() => {
        // Layout should adapt to new orientation
        const container = screen.getByTestId('mobile-deck-editor')
        expect(container).toHaveClass('landscape')
      })

      const endTime = performance.now()
      const adaptationTime = endTime - startTime

      // Should adapt quickly
      expect(adaptationTime).toBeLessThan(200)
    })

    it('should optimize re-renders', async () => {
      let renderCount = 0
      const TestComponent = () => {
        renderCount++
        return <MobileStatistics deck={mockDeck} />
      }

      const { rerender } = renderWithProviders(<TestComponent />)

      const initialRenderCount = renderCount

      // Update with same props - should not re-render
      rerender(<TestComponent />)
      expect(renderCount).toBe(initialRenderCount)

      // Update with different props - should re-render
      const updatedDeck = { ...mockDeck, name: 'Updated Deck' }
      const UpdatedTestComponent = () => {
        renderCount++
        return <MobileStatistics deck={updatedDeck} />
      }

      rerender(<UpdatedTestComponent />)
      expect(renderCount).toBe(initialRenderCount + 1)
    })
  })

  describe('Network Performance on Mobile', () => {
    it('should handle slow network conditions', async () => {
      // Mock slow network
      const slowFetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true, json: () => ({}) }), 3000))
      )
      global.fetch = slowFetch

      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // Should show loading state
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()

      // Should not block UI interactions
      const cardElement = screen.getAllByTestId('mobile-card-item')[0]
      fireEvent.touchStart(cardElement)

      // UI should still be responsive
      await waitFor(() => {
        expect(cardElement).toHaveClass('touch-active')
      })
    })

    it('should implement offline functionality', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      })

      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      // Should show offline indicator
      expect(screen.getByText(/offline/i)).toBeInTheDocument()

      // Should still allow basic interactions
      const cardElement = screen.getAllByTestId('mobile-card-item')[0]
      fireEvent.touchStart(cardElement)

      await waitFor(() => {
        expect(cardElement).toHaveClass('touch-active')
      })
    })
  })

  describe('Accessibility Performance', () => {
    it('should maintain performance with screen reader support', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const startTime = performance.now()

      // Simulate screen reader navigation
      const cardElements = screen.getAllByTestId('mobile-card-item')
      for (const element of cardElements.slice(0, 10)) {
        fireEvent.focus(element)
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const endTime = performance.now()
      const navigationTime = endTime - startTime

      // Should maintain good performance with accessibility features
      expect(navigationTime).toBeLessThan(1000)

      // All elements should have proper ARIA labels
      cardElements.forEach(element => {
        expect(element).toHaveAttribute('aria-label')
        expect(element).toHaveAttribute('role')
      })
    })

    it('should support keyboard navigation on mobile', async () => {
      renderWithProviders(<MobileDeckEditor deck={mockDeck} />)

      const firstCard = screen.getAllByTestId('mobile-card-item')[0]
      firstCard.focus()

      const startTime = performance.now()

      // Simulate keyboard navigation
      fireEvent.keyDown(firstCard, { key: 'ArrowDown' })

      await waitFor(() => {
        const secondCard = screen.getAllByTestId('mobile-card-item')[1]
        expect(secondCard).toHaveFocus()
      })

      const endTime = performance.now()
      const keyboardResponseTime = endTime - startTime

      // Keyboard navigation should be responsive
      expect(keyboardResponseTime).toBeLessThan(100)
    })
  })
})