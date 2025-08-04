import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WizardContainer } from '../WizardContainer'

describe('WizardContainer', () => {
  it('renders children correctly', () => {
    render(
      <WizardContainer>
        <div data-testid="test-child">Test Content</div>
      </WizardContainer>
    )

    expect(screen.getByTestId('test-child')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(
      <WizardContainer>
        <div>Content</div>
      </WizardContainer>
    )

    const wizardContainer = container.firstChild as HTMLElement
    expect(wizardContainer).toHaveClass('max-w-4xl', 'mx-auto', 'p-6')
  })

  it('renders with proper structure', () => {
    const { container } = render(
      <WizardContainer>
        <div>Content</div>
      </WizardContainer>
    )

    expect(container.firstChild).toBeInstanceOf(HTMLDivElement)
  })

  it('handles multiple children', () => {
    render(
      <WizardContainer>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </WizardContainer>
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
    expect(screen.getByTestId('child-3')).toBeInTheDocument()
  })

  it('handles empty children', () => {
    const { container } = render(<WizardContainer />)
    
    const wizardContainer = container.firstChild as HTMLElement
    expect(wizardContainer).toBeInTheDocument()
    expect(wizardContainer.children).toHaveLength(0)
  })
})