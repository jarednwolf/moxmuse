'use client'

import React, { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fallbackSrc?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({
  src,
  alt,
  width = 200,
  height = 280,
  className,
  fallbackSrc,
  placeholder = 'empty',
  blurDataURL,
  priority = false,
  onLoad,
  onError
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the image comes into view
        threshold: 0.1
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [priority, isInView])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
    
    // Performance monitoring
    if (process.env.NODE_ENV === 'development') {
      import('@/lib/performance/monitor').then(({ measureImageLoadTime }) => {
        measureImageLoadTime(src, performance.now(), false)
      })
    }
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  // Generate a simple blur placeholder if none provided
  const defaultBlurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=='

  return (
    <div
      ref={imgRef}
      className={cn(
        'relative overflow-hidden bg-zinc-800 rounded-lg',
        className
      )}
      style={{ width, height }}
    >
      {/* Loading placeholder */}
      {!isInView && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Image */}
      {isInView && (
        <>
          {!hasError ? (
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
              className={cn(
                'transition-opacity duration-300',
                isLoaded ? 'opacity-100' : 'opacity-0'
              )}
              placeholder={placeholder}
              blurDataURL={blurDataURL || defaultBlurDataURL}
              priority={priority}
              onLoad={handleLoad}
              onError={handleError}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            // Fallback image or placeholder
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-400">
              {fallbackSrc ? (
                <Image
                  src={fallbackSrc}
                  alt={alt}
                  width={width}
                  height={height}
                  className="opacity-50"
                />
              ) : (
                <div className="text-center">
                  <div className="text-2xl mb-2">🃏</div>
                  <div className="text-xs">Image unavailable</div>
                </div>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/80">
              <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          )}
        </>
      )}
    </div>
  )
}