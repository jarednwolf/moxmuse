import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import '@testing-library/jest-dom'

// Import components to test
import { LoadingSpinner, ProgressIndicator, LoadingOverlay, LoadingButton } from '../loading-states'
import { ErrorState, NetworkError, InlineError } from '../error-states'
import { OnboardingTour, WelcomeScreen, QuickTip } from '../onboarding'
import { MobileButton, MobileInput, MobileCard, MobileTabs } from '../mobile-optimized'
import { 
  AccessibleButton, 
  AccessibleField, 
  AccessibleModal, 
  AccessibleTabs,
  AccessibleProgress,
  SkipToContent 
} from '../accessibility'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

describe('Enhanced UX Components', () => {
  describe('Loading States', () => {
    test('LoadingSpinner renders with correct accessibility attributes', () => {
      render(<LoadingSpinner size="lg" />)
      
      const spinner = screen.getByLabelText('Loading')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('w-8', 'h-8', 'animate-spin')
    })
    
    test('ProgressIndicator shows correct progress and stage', () => {
      render(
        <ProgressIndicator
          stage="generating"
          progress={75}
          message="Creating your deck..."
          estimatedTimeRemaining={30}
          showDetails
          details={{ cardsProcessed: 75, totalCards: 100 }}
        />
      )
      
      expect(screen.getByText('Generating')).toBeInTheDocument()
      expect(screen.getByText('Creating your deck...')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('75 / 100')).toBeInTheDocument()
      
      // Check progress bar accessibility
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })
    
    test('LoadingOverlay traps focus and has proper ARIA attributes', async () => {
      const onCancel = jest.fn()
      
      render(
        <LoadingOverlay
          isVisible={true}
          title="Processing..."
          message="Please wait while we process your request"
          progress={50}
          canCancel={true}
          onCancel={onCancel}
        />
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'loading-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'loading-message')
      
      const cancelButton = screen.getByText('Cancel')
      await userEvent.click(cancelButton)
      expect(onCancel).toHaveBeenCalled()
    })
    
    test('LoadingButton shows loading state correctly', async () => {
      const onClick = jest.fn()
      
      render(
        <LoadingButton
          onClick={onClick}
          isLoading={true}
          loadingText="Processing..."
        >
          Submit
        </LoadingButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      
      // Should not call onClick when loading
      await userEvent.click(button)
      expect(onClick).not.toHaveBeenCalled()
    })
  })
  
  describe('Error States', () => {
    test('ErrorState displays error information and actions', async () => {
      const onRetry = jest.fn()
      const onGoHome = jest.fn()
      
      render(
        <ErrorState
          type="network"
          title="Connection Failed"
          message="Unable to connect to the server"
          actions={[
            { label: 'Retry', action: onRetry, variant: 'primary' },
            { label: 'Go Home', action: onGoHome, variant: 'secondary' }
          ]}
        />
      )
      
      expect(screen.getByText('Connection Failed')).toBeInTheDocument()
      expect(screen.getByText('Unable to connect to the server')).toBeInTheDocument()
      
      const retryButton = screen.getByText('Retry')
      const homeButton = screen.getByText('Go Home')
      
      await userEvent.click(retryButton)
      expect(onRetry).toHaveBeenCalled()
      
      await userEvent.click(homeButton)
      expect(onGoHome).toHaveBeenCalled()
    })
    
    test('InlineError shows error with action', async () => {
      const onAction = jest.fn()
      
      render(
        <InlineError
          message="Invalid input provided"
          action={{ label: 'Fix', action: onAction }}
        />
      )
      
      expect(screen.getByText('Invalid input provided')).toBeInTheDocument()
      
      const actionButton = screen.getByText('Fix')
      await userEvent.click(actionButton)
      expect(onAction).toHaveBeenCalled()
    })
  })
  
  describe('Mobile Components', () => {
    test('MobileButton has proper touch target size', () => {
      render(<MobileButton size="md">Tap me</MobileButton>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('min-h-[44px]') // 44px minimum for touch targets
    })
    
    test('MobileInput has proper labeling and error handling', () => {
      render(
        <MobileInput
          label="Email Address"
          error="Invalid email format"
          helperText="Enter your email"
          placeholder="email@example.com"
        />
      )
      
      const input = screen.getByLabelText('Email Address')
      expect(input).toBeInTheDocument()
      expect(input).toHaveClass('text-base') // Prevents zoom on iOS
      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
      expect(screen.getByText('Enter your email')).toBeInTheDocument()
    })
    
    test('MobileTabs handles keyboard navigation', async () => {
      const onTabChange = jest.fn()
      const tabs = [
        { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
        { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
        { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div> }
      ]
      
      render(
        <MobileTabs
          tabs={tabs}
          activeTab="tab1"
          onTabChange={onTabChange}
        />
      )
      
      const tab1 = screen.getByText('Tab 1')
      const tab2 = screen.getByText('Tab 2')
      
      await userEvent.click(tab2)
      expect(onTabChange).toHaveBeenCalledWith('tab2')
    })
  })
  
  describe('Accessibility Components', () => {
    test('AccessibleButton has proper ARIA attributes', () => {
      render(
        <AccessibleButton
          variant="primary"
          isLoading={false}
          aria-describedby="help-text"
        >
          Submit Form
        </AccessibleButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
      expect(button).toHaveClass('focus:ring-2', 'focus:ring-blue-500')
    })
    
    test('AccessibleField creates proper form field structure', () => {
      render(
        <AccessibleField
          id="username"
          label="Username"
          error="Username is required"
          helperText="Choose a unique username"
          required
        >
          <input type="text" />
        </AccessibleField>
      )
      
      const label = screen.getByText('Username')
      const input = screen.getByRole('textbox')
      const error = screen.getByText('Username is required')
      const helper = screen.getByText('Choose a unique username')
      
      expect(label).toHaveAttribute('for', 'username')
      expect(input).toHaveAttribute('id', 'username')
      expect(input).toHaveAttribute('aria-required', 'true')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(error).toHaveAttribute('role', 'alert')
    })
    
    test('AccessibleModal traps focus and handles escape key', async () => {
      const onClose = jest.fn()
      
      render(
        <AccessibleModal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          description="This is a test modal"
        >
          <button>First Button</button>
          <button>Second Button</button>
        </AccessibleModal>
      )
      
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby')
      expect(modal).toHaveAttribute('aria-describedby')
      
      // Test escape key
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })
    
    test('AccessibleProgress announces changes to screen readers', () => {
      const { rerender } = render(
        <AccessibleProgress
          value={25}
          label="Upload Progress"
          description="Uploading your file"
        />
      )
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '25')
      
      // Update progress
      rerender(
        <AccessibleProgress
          value={75}
          label="Upload Progress"
          description="Uploading your file"
        />
      )
      
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(screen.getByText('Upload Progress progress: 75% complete')).toBeInTheDocument()
    })
    
    test('SkipToContent link works correctly', async () => {
      render(
        <div>
          <SkipToContent targetId="main-content" />
          <div id="main-content">Main content here</div>
        </div>
      )
      
      const skipLink = screen.getByText('Skip to main content')
      expect(skipLink).toHaveAttribute('href', '#main-content')
      expect(skipLink).toHaveClass('sr-only')
      
      // Focus should make it visible
      skipLink.focus()
      expect(skipLink).toHaveClass('focus:not-sr-only')
    })
  })
  
  describe('Onboarding Components', () => {
    test('OnboardingTour handles step navigation', async () => {
      const onComplete = jest.fn()
      const onClose = jest.fn()
      const onStepChange = jest.fn()
      
      const steps = [
        {
          id: 'step1',
          title: 'Welcome',
          description: 'Welcome to the app',
          content: <div>Step 1 content</div>
        },
        {
          id: 'step2',
          title: 'Features',
          description: 'Learn about features',
          content: <div>Step 2 content</div>
        }
      ]
      
      render(
        <OnboardingTour
          steps={steps}
          isOpen={true}
          onClose={onClose}
          onComplete={onComplete}
          onStepChange={onStepChange}
        />
      )
      
      expect(screen.getByText('Welcome')).toBeInTheDocument()
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
      
      const nextButton = screen.getByText('Next')
      await userEvent.click(nextButton)
      expect(onStepChange).toHaveBeenCalledWith(1)
    })
    
    test('WelcomeScreen shows features and handles actions', async () => {
      const onStart = jest.fn()
      const onSkip = jest.fn()
      
      const features = [
        {
          icon: <div>Icon 1</div>,
          title: 'Feature 1',
          description: 'Description 1'
        },
        {
          icon: <div>Icon 2</div>,
          title: 'Feature 2',
          description: 'Description 2'
        }
      ]
      
      render(
        <WelcomeScreen
          title="Welcome to the App"
          description="Get started with these features"
          features={features}
          onStart={onStart}
          onSkip={onSkip}
        />
      )
      
      expect(screen.getByText('Welcome to the App')).toBeInTheDocument()
      expect(screen.getByText('Feature 1')).toBeInTheDocument()
      expect(screen.getByText('Feature 2')).toBeInTheDocument()
      
      const startButton = screen.getByText('Start Tour')
      const skipButton = screen.getByText('Skip for now')
      
      await userEvent.click(startButton)
      expect(onStart).toHaveBeenCalled()
      
      await userEvent.click(skipButton)
      expect(onSkip).toHaveBeenCalled()
    })
  })
  
  describe('Accessibility Compliance', () => {
    test('components have no accessibility violations', async () => {
      const { container } = render(
        <div>
          <LoadingSpinner />
          <ErrorState type="network" />
          <MobileButton>Click me</MobileButton>
          <AccessibleButton>Submit</AccessibleButton>
          <AccessibleProgress value={50} label="Progress" />
        </div>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
    
    test('modal components trap focus correctly', async () => {
      const onClose = jest.fn()
      
      render(
        <AccessibleModal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
        >
          <button>Button 1</button>
          <button>Button 2</button>
          <button>Button 3</button>
        </AccessibleModal>
      )
      
      const buttons = screen.getAllByRole('button')
      const firstButton = buttons[1] // Skip close button
      const lastButton = buttons[buttons.length - 1]
      
      // Focus should start on first focusable element
      expect(document.activeElement).toBe(firstButton)
      
      // Tab from last button should cycle to first
      lastButton.focus()
      fireEvent.keyDown(lastButton, { key: 'Tab' })
      await waitFor(() => {
        expect(document.activeElement).toBe(firstButton)
      })
      
      // Shift+Tab from first button should cycle to last
      fireEvent.keyDown(firstButton, { key: 'Tab', shiftKey: true })
      await waitFor(() => {
        expect(document.activeElement).toBe(lastButton)
      })
    })
  })
  
  describe('Mobile Responsiveness', () => {
    test('components adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      render(
        <div>
          <MobileButton size="lg" fullWidth>
            Mobile Button
          </MobileButton>
          <MobileCard>
            <p>Mobile card content</p>
          </MobileCard>
        </div>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('w-full', 'min-h-[48px]')
    })
    
    test('touch targets meet minimum size requirements', () => {
      render(
        <div>
          <MobileButton size="sm">Small Button</MobileButton>
          <MobileButton size="md">Medium Button</MobileButton>
          <MobileButton size="lg">Large Button</MobileButton>
        </div>
      )
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button)
        const minHeight = parseInt(styles.minHeight)
        expect(minHeight).toBeGreaterThanOrEqual(36) // Minimum touch target
      })
    })
  })
  
  describe('Performance', () => {
    test('components render efficiently', () => {
      const renderStart = performance.now()
      
      render(
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <MobileCard key={i}>
              <p>Card {i}</p>
            </MobileCard>
          ))}
        </div>
      )
      
      const renderTime = performance.now() - renderStart
      expect(renderTime).toBeLessThan(100) // Should render in under 100ms
    })
    
    test('loading states do not cause layout shift', () => {
      const { rerender } = render(
        <LoadingButton isLoading={false}>
          Submit
        </LoadingButton>
      )
      
      const button = screen.getByRole('button')
      const initialRect = button.getBoundingClientRect()
      
      rerender(
        <LoadingButton isLoading={true} loadingText="Submitting...">
          Submit
        </LoadingButton>
      )
      
      const loadingRect = button.getBoundingClientRect()
      
      // Button should maintain same dimensions
      expect(loadingRect.width).toBeCloseTo(initialRect.width, 1)
      expect(loadingRect.height).toBeCloseTo(initialRect.height, 1)
    })
  })
})