'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMobile } from '@/hooks/useMobile'

interface AdaptiveLayoutProps {
  children: React.ReactNode
  className?: string
  portraitLayout?: React.ReactNode
  landscapeLayout?: React.ReactNode
  onOrientationChange?: (orientation: 'portrait' | 'landscape') => void
}

interface OrientationState {
  orientation: 'portrait' | 'landscape'
  angle: number
  width: number
  height: number
}

export function AdaptiveLayout({
  children,
  className,
  portraitLayout,
  landscapeLayout,
  onOrientationChange
}: AdaptiveLayoutProps) {
  const { isMobile } = useMobile()
  const [orientationState, setOrientationState] = useState<OrientationState>({
    orientation: 'portrait',
    angle: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  })

  const updateOrientation = useCallback(() => {
    if (typeof window === 'undefined') return

    const width = window.innerWidth
    const height = window.innerHeight
    const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait'
    const angle = screen.orientation?.angle || 0

    const newState = {
      orientation,
      angle,
      width,
      height
    }

    setOrientationState(newState)
    onOrientationChange?.(orientation)
  }, [onOrientationChange])

  useEffect(() => {
    if (!isMobile) return

    // Initial check
    updateOrientation()

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to allow the browser to update dimensions
      setTimeout(updateOrientation, 100)
    }

    const handleResize = () => {
      updateOrientation()
    }

    // Multiple event listeners for better compatibility
    window.addEventListener('orientationchange', handleOrientationChange)
    window.addEventListener('resize', handleResize)
    screen.orientation?.addEventListener('change', handleOrientationChange)

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.removeEventListener('resize', handleResize)
      screen.orientation?.removeEventListener('change', handleOrientationChange)
    }
  }, [isMobile, updateOrientation])

  if (!isMobile) {
    return <div className={className}>{children}</div>
  }

  const isPortrait = orientationState.orientation === 'portrait'
  const isLandscape = orientationState.orientation === 'landscape'

  return (
    <div 
      className={cn(
        'adaptive-layout transition-all duration-300',
        isPortrait && 'portrait-mode',
        isLandscape && 'landscape-mode',
        className
      )}
      style={{
        '--viewport-width': `${orientationState.width}px`,
        '--viewport-height': `${orientationState.height}px`,
        '--orientation-angle': `${orientationState.angle}deg`
      } as React.CSSProperties}
    >
      <AnimatePresence mode="wait">
        {isPortrait && portraitLayout && (
          <motion.div
            key="portrait"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="portrait-layout h-full"
          >
            {portraitLayout}
          </motion.div>
        )}

        {isLandscape && landscapeLayout && (
          <motion.div
            key="landscape"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="landscape-layout h-full"
          >
            {landscapeLayout}
          </motion.div>
        )}

        {(!portraitLayout || !landscapeLayout) && (
          <motion.div
            key="default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="default-layout h-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Hook for orientation-aware components
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const { isMobile } = useMobile()

  useEffect(() => {
    if (!isMobile) return

    const updateOrientation = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const newOrientation = width > height ? 'landscape' : 'portrait'
      
      setOrientation(newOrientation)
      setDimensions({ width, height })
    }

    updateOrientation()

    const handleChange = () => {
      setTimeout(updateOrientation, 100)
    }

    window.addEventListener('orientationchange', handleChange)
    window.addEventListener('resize', handleChange)

    return () => {
      window.removeEventListener('orientationchange', handleChange)
      window.removeEventListener('resize', handleChange)
    }
  }, [isMobile])

  return {
    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    dimensions,
    isMobile
  }
}

// Responsive grid component that adapts to orientation
interface ResponsiveGridProps {
  children: React.ReactNode
  portraitCols?: number
  landscapeCols?: number
  gap?: number
  className?: string
}

export function ResponsiveGrid({
  children,
  portraitCols = 1,
  landscapeCols = 2,
  gap = 4,
  className
}: ResponsiveGridProps) {
  const { orientation } = useOrientation()
  
  const cols = orientation === 'landscape' ? landscapeCols : portraitCols
  
  return (
    <div
      className={cn(
        'grid transition-all duration-300',
        className
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap * 0.25}rem`
      }}
    >
      {children}
    </div>
  )
}

// Orientation-aware container
interface OrientationContainerProps {
  children: React.ReactNode
  portraitClassName?: string
  landscapeClassName?: string
  className?: string
}

export function OrientationContainer({
  children,
  portraitClassName,
  landscapeClassName,
  className
}: OrientationContainerProps) {
  const { orientation } = useOrientation()
  
  return (
    <div className={cn(
      className,
      orientation === 'portrait' && portraitClassName,
      orientation === 'landscape' && landscapeClassName
    )}>
      {children}
    </div>
  )
}

// Safe area component for mobile devices
interface SafeAreaProps {
  children: React.ReactNode
  className?: string
  top?: boolean
  bottom?: boolean
  left?: boolean
  right?: boolean
}

export function SafeArea({
  children,
  className,
  top = true,
  bottom = true,
  left = true,
  right = true
}: SafeAreaProps) {
  const { isMobile } = useMobile()

  if (!isMobile) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      className={cn(
        'safe-area',
        top && 'pt-safe-top',
        bottom && 'pb-safe-bottom',
        left && 'pl-safe-left',
        right && 'pr-safe-right',
        className
      )}
      style={{
        paddingTop: top ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: left ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: right ? 'env(safe-area-inset-right)' : undefined
      }}
    >
      {children}
    </div>
  )
}