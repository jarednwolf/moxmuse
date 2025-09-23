'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, MoreVertical, Menu, X } from 'lucide-react'

// Touch gesture hook
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold = 50
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }, [])
  
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }, [])
  
  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return
    
    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > threshold
    const isRightSwipe = distanceX < -threshold
    const isUpSwipe = distanceY > threshold
    const isDownSwipe = distanceY < -threshold
    
    // Prioritize horizontal swipes over vertical
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && onSwipeLeft) onSwipeLeft()
      if (isRightSwipe && onSwipeRight) onSwipeRight()
    } else {
      if (isUpSwipe && onSwipeUp) onSwipeUp()
      if (isDownSwipe && onSwipeDown) onSwipeDown()
    }
  }, [touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown])
  
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  }
}

// Mobile-optimized button component
export interface MobileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  children: React.ReactNode
}

export function MobileButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...props
}: MobileButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900'
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white focus:ring-blue-500',
    secondary: 'bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-800 text-zinc-100 focus:ring-zinc-500',
    ghost: 'hover:bg-zinc-800 active:bg-zinc-700 text-zinc-300 focus:ring-zinc-500',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white focus:ring-red-500'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-sm min-h-[44px]',
    lg: 'px-6 py-4 text-base min-h-[48px]',
    xl: 'px-8 py-5 text-lg min-h-[56px]'
  }
  
  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Mobile-optimized input component
export interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function MobileInput({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className,
  ...props
}: MobileInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-zinc-200">
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400">
            {leftIcon}
          </div>
        )}
        
        <input
          className={cn(
            'w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-400',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'min-h-[44px] text-base', // Prevent zoom on iOS
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400">
            {rightIcon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      
      {helperText && !error && (
        <p className="text-sm text-zinc-400">{helperText}</p>
      )}
    </div>
  )
}

// Mobile-optimized select component
export interface MobileSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export function MobileSelect({
  label,
  error,
  options,
  className,
  ...props
}: MobileSelectProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-zinc-200">
          {label}
        </label>
      )}
      
      <select
        className={cn(
          'w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'min-h-[44px] text-base appearance-none',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}

// Mobile-optimized card component
export interface MobileCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onClick?: () => void
}

export function MobileCard({
  children,
  className,
  padding = 'md',
  interactive = false,
  onClick
}: MobileCardProps) {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }
  
  return (
    <div
      className={cn(
        'bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50 rounded-lg',
        paddingClasses[padding],
        interactive && 'active:scale-[0.98] transition-transform cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Mobile-optimized modal/sheet component
export interface MobileSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  position?: 'bottom' | 'top' | 'center'
  size?: 'sm' | 'md' | 'lg' | 'full'
}

export function MobileSheet({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
  size = 'md'
}: MobileSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])
  
  if (!isVisible) return null
  
  const sizeClasses = {
    sm: 'max-h-[40vh]',
    md: 'max-h-[60vh]',
    lg: 'max-h-[80vh]',
    full: 'h-full'
  }
  
  const positionClasses = {
    bottom: 'items-end',
    top: 'items-start',
    center: 'items-center'
  }
  
  const sheetClasses = {
    bottom: isOpen ? 'translate-y-0' : 'translate-y-full',
    top: isOpen ? 'translate-y-0' : '-translate-y-full',
    center: isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
  }
  
  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 flex p-4',
        positionClasses[position]
      )}
    >
      {/* Backdrop */}
      <div 
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      
      {/* Sheet content */}
      <div
        className={cn(
          'relative w-full bg-zinc-900 rounded-t-xl border border-zinc-700/50 shadow-2xl transition-all duration-300',
          sizeClasses[size],
          sheetClasses[position],
          position === 'center' && 'rounded-xl max-w-md mx-auto'
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-zinc-700/50">
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Mobile-optimized tabs component
export interface MobileTabsProps {
  tabs: Array<{
    id: string
    label: string
    content: React.ReactNode
    badge?: string | number
  }>
  activeTab: string
  onTabChange: (tabId: string) => void
  scrollable?: boolean
}

export function MobileTabs({
  tabs,
  activeTab,
  onTabChange,
  scrollable = true
}: MobileTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const scrollToActiveTab = useCallback(() => {
    if (!scrollRef.current) return
    
    const activeButton = scrollRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', inline: 'center' })
    }
  }, [activeTab])
  
  useEffect(() => {
    scrollToActiveTab()
  }, [scrollToActiveTab])
  
  return (
    <div className="w-full">
      {/* Tab buttons */}
      <div 
        ref={scrollRef}
        className={cn(
          'flex border-b border-zinc-700/50',
          scrollable ? 'overflow-x-auto scrollbar-hide' : 'overflow-hidden'
        )}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            data-tab={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors min-h-[44px]',
              'border-b-2 border-transparent',
              activeTab === tab.id
                ? 'text-blue-400 border-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className="px-2 py-0.5 bg-zinc-700 text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div className="mt-4">
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  )
}

// Mobile-optimized navigation component
export interface MobileNavProps {
  items: Array<{
    id: string
    label: string
    icon?: React.ReactNode
    onClick: () => void
    badge?: string | number
  }>
  activeItem?: string
}

export function MobileNav({ items, activeItem }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/50 z-40">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0 flex-1',
              activeItem === item.id
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {item.icon && (
              <div className="relative">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-red-500 text-xs text-white rounded-full min-w-[16px] h-4 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
            )}
            <span className="text-xs font-medium truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

// Mobile-optimized stepper component
export interface MobileStepperProps {
  steps: Array<{
    id: string
    title: string
    description?: string
    completed?: boolean
  }>
  currentStep: string
  onStepClick?: (stepId: string) => void
  orientation?: 'horizontal' | 'vertical'
}

export function MobileStepper({
  steps,
  currentStep,
  onStepClick,
  orientation = 'horizontal'
}: MobileStepperProps) {
  const currentIndex = steps.findIndex(step => step.id === currentStep)
  
  if (orientation === 'vertical') {
    return (
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isCompleted = step.completed || index < currentIndex
          const isClickable = onStepClick && (isCompleted || isActive)
          
          return (
            <div key={step.id} className="flex items-start gap-3">
              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-700 text-zinc-400',
                  isClickable && 'hover:scale-105 active:scale-95'
                )}
              >
                {isCompleted ? '✓' : index + 1}
              </button>
              
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-zinc-100' : 'text-zinc-300'
                )}>
                  {step.title}
                </h3>
                {step.description && (
                  <p className="text-xs text-zinc-400 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = step.completed || index < currentIndex
        const isClickable = onStepClick && (isCompleted || isActive)
        
        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-0',
                isActive && 'bg-blue-500/10',
                isClickable && 'hover:bg-zinc-800 active:scale-95'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              )}>
                {isCompleted ? '✓' : index + 1}
              </div>
              <span className={cn(
                'text-xs font-medium truncate',
                isActive ? 'text-zinc-100' : 'text-zinc-400'
              )}>
                {step.title}
              </span>
            </button>
            
            {index < steps.length - 1 && (
              <div className="w-8 h-px bg-zinc-700 flex-shrink-0" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Mobile-optimized pull-to-refresh component
export interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  threshold?: number
  disabled?: boolean
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [startY, setStartY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    setStartY(e.touches[0].clientY)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || !containerRef.current) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - startY
    
    // Only allow pull down when at the top of the container
    if (containerRef.current.scrollTop === 0 && distance > 0) {
      e.preventDefault()
      setPullDistance(Math.min(distance, threshold * 1.5))
    }
  }
  
  const handleTouchEnd = async () => {
    if (disabled || isRefreshing) return
    
    if (pullDistance >= threshold) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    
    setPullDistance(0)
  }
  
  const pullProgress = Math.min(pullDistance / threshold, 1)
  
  return (
    <div
      ref={containerRef}
      className="relative overflow-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center py-4 bg-zinc-800/90 backdrop-blur-sm z-10"
          style={{ 
            transform: `translateY(${pullDistance - threshold}px)`,
            opacity: pullProgress
          }}
        >
          <div className={cn(
            'w-6 h-6 border-2 border-zinc-400 border-t-blue-500 rounded-full',
            (isRefreshing || pullProgress >= 1) && 'animate-spin'
          )} />
          <span className="ml-2 text-sm text-zinc-300">
            {isRefreshing 
              ? 'Refreshing...' 
              : pullProgress >= 1 
              ? 'Release to refresh' 
              : 'Pull to refresh'
            }
          </span>
        </div>
      )}
      
      {/* Content */}
      <div style={{ transform: `translateY(${Math.min(pullDistance, threshold)}px)` }}>
        {children}
      </div>
    </div>
  )
}