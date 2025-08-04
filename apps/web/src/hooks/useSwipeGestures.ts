import { useRef, useCallback, useEffect } from 'react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
  preventDefaultTouchmove?: boolean
}

interface TouchPoint {
  x: number
  y: number
  time: number
}

export function useSwipeGestures({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  preventDefaultTouchmove = false
}: SwipeGestureOptions) {
  const touchStart = useRef<TouchPoint | null>(null)
  const touchEnd = useRef<TouchPoint | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
      touchEnd.current = null
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmove) {
      e.preventDefault()
    }
  }, [preventDefaultTouchmove])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touch = e.changedTouches[0]
    if (touch && touchStart.current) {
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }

      const deltaX = touchEnd.current.x - touchStart.current.x
      const deltaY = touchEnd.current.y - touchStart.current.y
      const deltaTime = touchEnd.current.time - touchStart.current.time

      // Only process swipes that are fast enough (within 300ms)
      if (deltaTime > 300) return

      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Determine if this is a horizontal or vertical swipe
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        if (absDeltaX > threshold) {
          if (deltaX > 0) {
            onSwipeRight?.()
          } else {
            onSwipeLeft?.()
          }
        }
      } else {
        // Vertical swipe
        if (absDeltaY > threshold) {
          if (deltaY > 0) {
            onSwipeDown?.()
          } else {
            onSwipeUp?.()
          }
        }
      }
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold])

  const attachListeners = useCallback((element: HTMLElement | null) => {
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmove })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventDefaultTouchmove])

  return { attachListeners }
}

// Hook for detecting long press gestures
interface LongPressOptions {
  onLongPress: () => void
  delay?: number
  shouldPreventDefault?: boolean
}

export function useLongPress({
  onLongPress,
  delay = 500,
  shouldPreventDefault = true
}: LongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isLongPress = useRef(false)

  const start = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    if (shouldPreventDefault) {
      event.preventDefault()
    }

    isLongPress.current = false
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true
      onLongPress()
    }, delay)
  }, [onLongPress, delay, shouldPreventDefault])

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  const clickHandler = useCallback((event: React.MouseEvent) => {
    if (isLongPress.current) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchEnd: clear,
    onClick: clickHandler
  }
}