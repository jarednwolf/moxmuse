import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WizardProgress } from '../WizardProgress'

describe('WizardProgress', () => {
  it('renders progress information correctly', () => {
    render(<WizardProgress current={2} total={5} />)

    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })

  it('calculates progress percentage correctly', () => {
    const { container } = render(<WizardProgress current={2} total={5} />)
    
    // Progress should be (2 + 1) / 5 * 100 = 60%
    const progressBar = container.querySelector('[style*="width: 60%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('handles first step correctly', () => {
    render(<WizardProgress current={0} total={3} />)

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    
    const { container } = render(<WizardProgress current={0} total={3} />)
    const progressBar = container.querySelector('[style*="width: 33.33%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('handles last step correctly', () => {
    render(<WizardProgress current={4} total={5} />)

    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument()
    
    const { container } = render(<WizardProgress current={4} total={5} />)
    const progressBar = container.querySelector('[style*="width: 100%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('handles single step wizard', () => {
    render(<WizardProgress current={0} total={1} />)

    expect(screen.getByText('Step 1 of 1')).toBeInTheDocument()
    
    const { container } = render(<WizardProgress current={0} total={1} />)
    const progressBar = container.querySelector('[style*="width: 100%"]')
    expect(progressBar).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<WizardProgress current={1} total={3} />)

    const progressContainer = container.querySelector('.bg-zinc-800')
    expect(progressContainer).toBeInTheDocument()
    
    const progressBar = container.querySelector('.bg-gradient-to-r')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows step indicators when provided', () => {
    const steps = ['Commander', 'Strategy', 'Budget', 'Summary']
    render(<WizardProgress current={1} total={4} steps={steps} />)

    expect(screen.getByText('Commander')).toBeInTheDocument()
    expect(screen.getByText('Strategy')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('highlights current step when step names provided', () => {
    const steps = ['Commander', 'Strategy', 'Budget']
    const { container } = render(<WizardProgress current={1} total={3} steps={steps} />)

    // Current step (Strategy) should have different styling
    const currentStepElement = screen.getByText('Strategy').closest('div')
    expect(currentStepElement).toHaveClass('text-purple-400')
  })

  it('shows completed steps with different styling', () => {
    const steps = ['Commander', 'Strategy', 'Budget']
    const { container } = render(<WizardProgress current={2} total={3} steps={steps} />)

    // Completed steps should have checkmark or different styling
    const completedStep = screen.getByText('Commander').closest('div')
    expect(completedStep).toHaveClass('text-green-400')
  })

  it('handles edge case with zero total', () => {
    render(<WizardProgress current={0} total={0} />)

    expect(screen.getByText('Step 1 of 0')).toBeInTheDocument()
  })

  it('handles edge case with current greater than total', () => {
    render(<WizardProgress current={5} total={3} />)

    expect(screen.getByText('Step 6 of 3')).toBeInTheDocument()
    
    const { container } = render(<WizardProgress current={5} total={3} />)
    const progressBar = container.querySelector('[style*="width: 100%"]')
    expect(progressBar).toBeInTheDocument()
  })
})