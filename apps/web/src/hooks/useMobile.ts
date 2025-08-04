import { useState, useEffect } from 'react'

// Hook to detect mobile devices and screen sizes
export function useMobile() {
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth
      const mobile = width < 768
      const tablet = width >= 768 && width < 1024
      
      setIsMobile(mobile)
      setIsTablet(tablet)
      setScreenSize(mobile ? 'mobile' : tablet ? 'tablet' : 'desktop')
    }

    // Check on mount
    checkDevice()

    // Listen for resize events
    window.addEventListener('resize', checkDevice)
    
    // Listen for orientation changes on mobile
    window.addEventListener('orientationchange', () => {
      // Delay to allow orientation change to complete
      setTimeout(checkDevice, 100)
    })

    return () => {
      window.removeEventListener('resize', checkDevice)
      window.removeEventListener('orientationchange', checkDevice)
    }
  }, [])

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    screenSize
  }
}

// Hook for media queries
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

// Common breakpoint hooks
export function useBreakpoints() {
  const isSm = useMediaQuery('(min-width: 640px)')
  const isMd = useMediaQuery('(min-width: 768px)')
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1280px)')
  const is2Xl = useMediaQuery('(min-width: 1536px)')

  return {
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    // Convenience properties
    isMobile: !isMd,
    isTablet: isMd && !isLg,
    isDesktop: isLg
  }
}

// Hook to detect touch device
export function useTouch() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - for older browsers
        navigator.msMaxTouchPoints > 0
      )
    }

    checkTouch()
  }, [])

  return isTouch
}