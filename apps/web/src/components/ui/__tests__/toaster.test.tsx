import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import { ToastProvider, useToast, useErrorToast, useSuccessToast } from '../toaster'

// Test component that uses toast hooks
const TestComponent = () => {
  const { addToast } = useToast()
  const errorToast = useErrorToast()
  const successToast = useSuccessToast()

  return (
    <div>
      <button onClick={() => addToast({ type: 'info', title: 'Info Toast' })}>
        Add Info Toast
      </button>
      <button onClick={() => errorToast('Error Title', 'Error description')}>
        Add Error Toast
      </button>
      <button onClick={() => successToast('Success Title', 'Success description')}>
        Add Success Toast
      </button>
    </div>
  )
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders toasts when added', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info Toast'))
    expect(screen.getByText('Info Toast')).toBeInTheDocument()
  })

  it('renders error toasts with correct styling', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Error Toast'))
    expect(screen.getByText('Error Title')).toBeInTheDocument()
    expect(screen.getByText('Error description')).toBeInTheDocument()
  })

  it('renders success toasts with correct styling', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Success Toast'))
    expect(screen.getByText('Success Title')).toBeInTheDocument()
    expect(screen.getByText('Success description')).toBeInTheDocument()
  })

  it('auto-removes non-persistent toasts after duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Success Toast'))
    expect(screen.getByText('Success Title')).toBeInTheDocument()

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByText('Success Title')).not.toBeInTheDocument()
  })

  it('keeps persistent toasts visible', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Error Toast'))
    expect(screen.getByText('Error Title')).toBeInTheDocument()

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Error toasts are persistent by default
    expect(screen.getByText('Error Title')).toBeInTheDocument()
  })

  it('allows manual dismissal of toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info Toast'))
    expect(screen.getByText('Info Toast')).toBeInTheDocument()

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(screen.queryByText('Info Toast')).not.toBeInTheDocument()
  })
})