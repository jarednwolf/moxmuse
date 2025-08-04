'use client'

import { useRef, useCallback, useEffect } from 'react'

interface GestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onPinchStart?: (scale: number) => void
  onPinch?: (scale: number, velocity: number) => void
  onPinchEnd?: (scale: number) => void
  onRotate?: (angle: number) => void
  onTap?: (x: number, y: number) => void
  onDoubleTap?: (x: number, y: number) => void
  onLongPress?: (x: number, y: number) => void
  threshold?: number
  longPressDelay?: number
  preventDefaultTouchmove?: boolean
}

interface TouchPoint {
  x: number
  y: number
  time: number
  identifier: number
}

interface GestureState {
  touches: TouchPoint[]
  initialDistance?: number
  initialAngle?: number
  initialScale: number
  lastScale: number
  isGesturing: boolean
  tapCount: number
  lastTapTime: number
  longPressTimer?: NodeJS.Timeout
}

export function useGestures(options: GestureOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onPinchStart,
    onPinch,
    onPinchEnd,
    onRotate,
    onTap,
    onDoubleTap,
    onLongPress,
    threshold = 50,
    longPressDelay = 500,
    preventDefaultTouchmove = false
  } = options

  const gestureState = useRef<GestureState>({
    touches: [],
    initialScale: 1,
    lastScale: 1,
    isGesturing: false,
    tapCount: 0,
    lastTapTime: 0
  })

  const calculateDistance = useCallback((touch1: TouchPoint, touch2: TouchPoint): number => {
    const dx = touch1.x - touch2.x
    const dy = touch1.y - touch2.y
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  const calculateAngle = useCallback((touch1: TouchPoint, touch2: TouchPoint): number => {
    return Math.atan2(touch2.y - touch1.y, touch2.x - touch1.x) * 180 / Math.PI
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touches = Array.from(e.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      identifier: touch.identifier
    }))

    gestureState.current.touches = touches
    gestureState.current.isGesturing = touches.length > 1

    if (touches.length === 1) {
      // Single touch - potential tap or long press
      const touch = touches[0]
      
      // Clear any existing long press timer
      if (gestureState.current.longPressTimer) {
        clearTimeout(gestureState.current.longPressTimer)
      }

      // Start long press timer
      if (onLongPress) {
        gestureState.current.longPressTimer = setTimeout(() => {
          onLongPress(touch.x, touch.y)
          // Haptic feedback for long press
          if ('vibrate' in navigator) {
            navigator.vibrate(50)
          }
        }, longPressDelay)
      }
    } else if (touches.length === 2) {
      // Two finger gesture - pinch/zoom/rotate
      const [touch1, touch2] = touches
      const distance = calculateDistance(touch1, touch2)
      const angle = calculateAngle(touch1, touch2)

      gestureState.current.initialDistance = distance
      gestureState.current.initialAngle = angle
      gestureState.current.initialScale = gestureState.current.lastScale

      if (onPinchStart) {
        onPinchStart(gestureState.current.lastScale)
      }
    }
  }, [calculateDistance, calculateAngle, onLongPress, onPinchStart, longPressDelay])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmove) {
      e.preventDefault()
    }

    const touches = Array.from(e.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      identifier: touch.identifier
    }))

    // Clear long press timer on move
    if (gestureState.current.longPressTimer) {
      clearTimeout(gestureState.current.longPressTimer)
      gestureState.current.longPressTimer = undefined
    }

    if (touches.length === 2 && gestureState.current.initialDistance) {
      // Handle pinch/zoom
      const [touch1, touch2] = touches
      const currentDistance = calculateDistance(touch1, touch2)
      const currentAngle = calculateAngle(touch1, touch2)

      if (gestureState.current.initialDistance > 0) {
        const scale = (currentDistance / gestureState.current.initialDistance) * gestureState.current.initialScale
        const velocity = Math.abs(scale - gestureState.current.lastScale)

        if (onPinch) {
          onPinch(scale, velocity)
        }

        // Handle rotation
        if (onRotate && gestureState.current.initialAngle !== undefined) {
          const angleDiff = currentAngle - gestureState.current.initialAngle
          onRotate(angleDiff)
        }
      }
    }

    gestureState.current.touches = touches
  }, [calculateDistance, calculateAngle, onPinch, onRotate, preventDefaultTouchmove])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const remainingTouches = Array.from(e.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      identifier: touch.identifier
    }))

    // Clear long press timer
    if (gestureState.current.longPressTimer) {
      clearTimeout(gestureState.current.longPressTimer)
      gestureState.current.longPressTimer = undefined
    }

    if (remainingTouches.length === 0) {
      // All touches ended
      const originalTouches = gestureState.current.touches
      
      if (originalTouches.length === 1 && !gestureState.current.isGesturing) {
        // Single tap
        const touch = originalTouches[0]
        const endTime = Date.now()
        const duration = endTime - touch.time

        // Only process as tap if it was quick and didn't move much
        if (duration < 300) {
          const currentTime = Date.now()
          const timeSinceLastTap = currentTime - gestureState.current.lastTapTime

          if (timeSinceLastTap < 300 && gestureState.current.tapCount === 1) {
            // Double tap
            gestureState.current.tapCount = 0
            if (onDoubleTap) {
              onDoubleTap(touch.x, touch.y)
              // Haptic feedback for double tap
              if ('vibrate' in navigator) {
                navigator.vibrate([25, 25, 25])
              }
            }
          } else {
            // Single tap (with delay to detect potential double tap)
            gestureState.current.tapCount = 1
            gestureState.current.lastTapTime = currentTime
            
            setTimeout(() => {
              if (gestureState.current.tapCount === 1) {
                gestureState.current.tapCount = 0
                if (onTap) {
                  onTap(touch.x, touch.y)
                  // Light haptic feedback for tap
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10)
                  }
                }
              }
            }, 300)
          }
        }
      } else if (originalTouches.length === 1 && gestureState.current.isGesturing) {
        // Swipe gesture
        const touch = originalTouches[0]
        const changedTouch = Array.from(e.changedTouches)[0]
        
        if (changedTouch) {
          const deltaX = changedTouch.clientX - touch.x
          const deltaY = changedTouch.clientY - touch.y
          const deltaTime = Date.now() - touch.time

          // Only process swipes that are fast enough
          if (deltaTime < 300) {
            const absDeltaX = Math.abs(deltaX)
            const absDeltaY = Math.abs(deltaY)

            if (absDeltaX > threshold || absDeltaY > threshold) {
              if (absDeltaX > absDeltaY) {
                // Horizontal swipe
                if (deltaX > 0) {
                  onSwipeRight?.()
                } else {
                  onSwipeLeft?.()
                }
              } else {
                // Vertical swipe
                if (deltaY > 0) {
                  onSwipeDown?.()
                } else {
                  onSwipeUp?.()
                }
              }
              
              // Haptic feedback for swipe
              if ('vibrate' in navigator) {
                navigator.vibrate(30)
              }
            }
          }
        }
      } else if (originalTouches.length === 2) {
        // End of pinch gesture
        if (onPinchEnd) {
          onPinchEnd(gestureState.current.lastScale)
        }
      }

      // Reset gesture state
      gestureState.current.touches = []
      gestureState.current.isGesturing = false
      gestureState.current.initialDistance = undefined
      gestureState.current.initialAngle = undefined
    } else {
      // Some touches remain
      gestureState.current.touches = remainingTouches
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap, onPinchEnd, threshold])

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

// Hook for haptic feedback
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }, [])

  const tapFeedback = useCallback(() => vibrate(10), [vibrate])
  const successFeedback = useCallback(() => vibrate([50, 50, 50]), [vibrate])
  const errorFeedback = useCallback(() => vibrate([100, 50, 100]), [vibrate])
  const longPressFeedback = useCallback(() => vibrate(50), [vibrate])
  const swipeFeedback = useCallback(() => vibrate(30), [vibrate])

  return {
    vibrate,
    tapFeedback,
    successFeedback,
    errorFeedback,
    longPressFeedback,
    swipeFeedback
  }
}