'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Skip to content link for keyboard navigation
export function SkipToContent({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium transition-all"
    >
      Skip to main content
    </a>
  )
}

// Screen reader only text
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>
}

// Accessible heading component with proper hierarchy
export interface AccessibleHeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: React.ReactNode
  className?: string
  id?: string
}

export function AccessibleHeading({ level, children, className, id }: AccessibleHeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements
  
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  )
}

// Focus trap for modals and dialogs
export function FocusTrap({ 
  children, 
  isActive = true,
  restoreFocus = true 
}: { 
  children: React.ReactNode
  isActive?: boolean
  restoreFocus?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  
  useEffect(() => {
    if (!isActive) return
    
    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement
    
    const container = containerRef.current
    if (!container) return
    
    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>
    
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    
    // Focus the first element
    if (firstElement) {
      firstElement.focus()
    }
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }
    
    document.addEventListener('keydown', handleTabKey)
    
    return () => {
      document.removeEventListener('keydown', handleTabKey)
      
      // Restore focus to the previously focused element
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isActive, restoreFocus])
  
  return (
    <div ref={containerRef}>
      {children}
    </div>
  )
}

// Accessible button with proper ARIA attributes
export interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
}

export function AccessibleButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  children,
  disabled,
  className,
  ...props
}: AccessibleButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900'
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100 focus:ring-zinc-500',
    ghost: 'hover:bg-zinc-800 text-zinc-300 focus:ring-zinc-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  }
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-describedby={isLoading ? 'loading-description' : undefined}
      {...props}
    >
      {isLoading && (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <ScreenReaderOnly id="loading-description">
            {loadingText || 'Loading...'}
          </ScreenReaderOnly>
        </>
      )}
      {isLoading && loadingText ? loadingText : children}
    </button>
  )
}

// Accessible form field with proper labeling
export interface AccessibleFieldProps {
  id: string
  label: string
  children: React.ReactNode
  error?: string
  helperText?: string
  required?: boolean
  className?: string
}

export function AccessibleField({
  id,
  label,
  children,
  error,
  helperText,
  required = false,
  className
}: AccessibleFieldProps) {
  const errorId = error ? `${id}-error` : undefined
  const helperId = helperText ? `${id}-helper` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ')
  
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-200">
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {React.cloneElement(children as React.ReactElement, {
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? 'true' : undefined,
        'aria-required': required
      })}
      
      {helperText && (
        <p id={helperId} className="text-sm text-zinc-400">
          {helperText}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// Accessible modal/dialog component
export interface AccessibleModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true
}: AccessibleModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const titleId = `modal-title-${React.useId()}`
  const descriptionId = description ? `modal-description-${React.useId()}` : undefined
  
  useEffect(() => {
    if (!closeOnEscape) return
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose, closeOnEscape])
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  }
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Modal content */}
      <FocusTrap isActive={isOpen}>
        <div
          ref={modalRef}
          className={cn(
            'relative bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-2xl w-full',
            sizeClasses[size]
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-700/50">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-zinc-100">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-zinc-400 mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}

// Accessible tabs component
export interface AccessibleTabsProps {
  tabs: Array<{
    id: string
    label: string
    content: React.ReactNode
    disabled?: boolean
  }>
  activeTab: string
  onTabChange: (tabId: string) => void
  orientation?: 'horizontal' | 'vertical'
}

export function AccessibleTabs({
  tabs,
  activeTab,
  onTabChange,
  orientation = 'horizontal'
}: AccessibleTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabListId = `tablist-${React.useId()}`
  
  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === tabId)
    let nextIndex = currentIndex
    
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        break
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        e.preventDefault()
        nextIndex = 0
        break
      case 'End':
        e.preventDefault()
        nextIndex = tabs.length - 1
        break
      default:
        return
    }
    
    const nextTab = tabs[nextIndex]
    if (nextTab && !nextTab.disabled) {
      onTabChange(nextTab.id)
      
      // Focus the next tab button
      const nextButton = tabListRef.current?.querySelector(`[data-tab="${nextTab.id}"]`) as HTMLButtonElement
      nextButton?.focus()
    }
  }
  
  return (
    <div>
      {/* Tab list */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          'flex border-b border-zinc-700/50',
          orientation === 'vertical' && 'flex-col border-b-0 border-r'
        )}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-tab={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
              'border-b-2 border-transparent',
              activeTab === tab.id
                ? 'text-blue-400 border-blue-400'
                : 'text-zinc-400 hover:text-zinc-200',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab panels */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`tabpanel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="mt-4 focus:outline-none"
          tabIndex={0}
        >
          {activeTab === tab.id && tab.content}
        </div>
      ))}
    </div>
  )
}

// Live region for dynamic content announcements
export interface LiveRegionProps {
  children: React.ReactNode
  politeness?: 'polite' | 'assertive' | 'off'
  atomic?: boolean
  relevant?: 'additions' | 'removals' | 'text' | 'all'
}

export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = false,
  relevant = 'additions text'
}: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className="sr-only"
    >
      {children}
    </div>
  )
}

// Progress indicator with proper ARIA attributes
export interface AccessibleProgressProps {
  value: number
  max?: number
  label?: string
  description?: string
  showPercentage?: boolean
  className?: string
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  description,
  showPercentage = true,
  className
}: AccessibleProgressProps) {
  const percentage = Math.round((value / max) * 100)
  const progressId = `progress-${React.useId()}`
  const labelId = label ? `${progressId}-label` : undefined
  const descriptionId = description ? `${progressId}-description` : undefined
  
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label id={labelId} className="text-sm font-medium text-zinc-200">
            {label}
          </label>
          {showPercentage && (
            <span className="text-sm text-zinc-400">{percentage}%</span>
          )}
        </div>
      )}
      
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden"
      >
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {description && (
        <p id={descriptionId} className="text-sm text-zinc-400">
          {description}
        </p>
      )}
      
      <LiveRegion>
        {label} progress: {percentage}% complete
      </LiveRegion>
    </div>
  )
}

// Accessible tooltip component
export interface AccessibleTooltipProps {
  content: string
  children: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function AccessibleTooltip({
  content,
  children,
  placement = 'top',
  delay = 500
}: AccessibleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const tooltipId = `tooltip-${React.useId()}`
  
  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }
  
  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }
  
  return (
    <div className="relative inline-block">
      {React.cloneElement(children as React.ReactElement, {
        'aria-describedby': tooltipId,
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip
      })}
      
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-sm text-white bg-zinc-800 rounded shadow-lg whitespace-nowrap',
            placement === 'top' && 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
            placement === 'bottom' && 'top-full left-1/2 transform -translate-x-1/2 mt-1',
            placement === 'left' && 'right-full top-1/2 transform -translate-y-1/2 mr-1',
            placement === 'right' && 'left-full top-1/2 transform -translate-y-1/2 ml-1'
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}