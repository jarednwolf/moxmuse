'use client'

import React, { forwardRef } from 'react'
import { useMobile } from '@/hooks/useMobile'
import { useLongPress } from '@/hooks/useSwipeGestures'
import { cn } from '@/lib/utils'

// Touch-optimized button with proper accessibility
interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onLongPress?: () => void
  longPressDelay?: number
}

export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    className, 
    children, 
    onLongPress,
    longPressDelay = 500,
    ...props 
  }, ref) => {
    const { isMobile } = useMobile()
    
    const longPressProps = onLongPress ? useLongPress({
      onLongPress,
      delay: longPressDelay
    }) : {}

    const baseClasses = cn(
      'relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'active:scale-95',
      // Ensure minimum touch target size on mobile (44px)
      isMobile && 'min-h-[44px] min-w-[44px]'
    )

    const variantClasses = {
      primary: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600',
      secondary: 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600',
      ghost: 'text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100',
      outline: 'border border-zinc-600 text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100'
    }

    const sizeClasses = {
      sm: isMobile ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs',
      md: isMobile ? 'px-4 py-3 text-base' : 'px-4 py-2 text-sm',
      lg: isMobile ? 'px-6 py-4 text-lg' : 'px-6 py-3 text-base'
    }

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        {...longPressProps}
        {...props}
      >
        {children}
      </button>
    )
  }
)

TouchButton.displayName = 'TouchButton'

// Touch-optimized card component
interface TouchCardProps {
  children: React.ReactNode
  onClick?: () => void
  onLongPress?: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function TouchCard({
  children,
  onClick,
  onLongPress,
  selected = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
  ...props
}: TouchCardProps) {
  const { isMobile } = useMobile()
  
  const longPressProps = onLongPress ? useLongPress({
    onLongPress,
    delay: 500
  }) : {}

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick && !disabled) {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'relative rounded-lg border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900',
        onClick && !disabled && 'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        selected 
          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
          : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50',
        !disabled && onClick && 'hover:scale-[1.02] active:scale-[0.98]',
        // Ensure adequate touch target
        isMobile && 'min-h-[44px]',
        className
      )}
      {...longPressProps}
      {...props}
    >
      {children}
    </div>
  )
}

// Accessible toggle switch for mobile
interface TouchToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

export function TouchToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className
}: TouchToggleProps) {
  const { isMobile } = useMobile()

  return (
    <label className={cn(
      'flex items-center gap-3 cursor-pointer',
      disabled && 'opacity-50 cursor-not-allowed',
      // Ensure adequate touch target
      isMobile && 'min-h-[44px] py-2',
      className
    )}>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div className={cn(
          'w-11 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-purple-500' : 'bg-zinc-600'
        )}>
          <div className={cn(
            'w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200',
            'absolute top-0.5',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium text-zinc-200',
          isMobile ? 'text-base' : 'text-sm'
        )}>
          {label}
        </div>
        {description && (
          <div className={cn(
            'text-zinc-400',
            isMobile ? 'text-sm' : 'text-xs'
          )}>
            {description}
          </div>
        )}
      </div>
    </label>
  )
}

// Touch-optimized input field
interface TouchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const TouchInput = forwardRef<HTMLInputElement, TouchInputProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    const { isMobile } = useMobile()

    return (
      <div className="space-y-2">
        {label && (
          <label className={cn(
            'block font-medium text-zinc-200',
            isMobile ? 'text-base' : 'text-sm'
          )}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-zinc-800/50 text-zinc-100 placeholder-zinc-400',
            'focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50',
            'transition-all duration-200',
            error 
              ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
              : 'border-zinc-700',
            // Larger touch targets on mobile
            isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm',
            className
          )}
          {...props}
        />
        {error && (
          <p className={cn(
            'text-red-400',
            isMobile ? 'text-sm' : 'text-xs'
          )}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className={cn(
            'text-zinc-500',
            isMobile ? 'text-sm' : 'text-xs'
          )}>
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

TouchInput.displayName = 'TouchInput'