'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fallbackSrc?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  priority?: boolean
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  onError?: () => void
  sizes?: string
  quality?: number
  fill?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  fallbackSrc,
  placeholder = 'blur',
  blurDataURL,
  priority = false,
  loading = 'lazy',
  onLoad,
  onError,
  sizes,
  quality = 75,
  fill = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoading(false)
    
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
      setHasError(false)
      setIsLoading(true)
    }
    
    onError?.()
  }, [fallbackSrc, currentSrc, onError])

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || generateBlurDataURL(width || 400, height || 300)

  if (hasError && !fallbackSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-xs">Image not available</span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading skeleton */}
      {isLoading && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={{ width, height }}
        />
      )}

      <Image
        src={currentSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        placeholder={placeholder}
        blurDataURL={placeholder === 'blur' ? defaultBlurDataURL : undefined}
        priority={priority}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        sizes={sizes}
        quality={quality}
      />
    </div>
  )
}

// Progressive image component with intersection observer
interface ProgressiveImageProps extends OptimizedImageProps {
  lowQualitySrc?: string
  threshold?: number
  rootMargin?: string
}

export function ProgressiveImage({
  src,
  lowQualitySrc,
  threshold = 0.1,
  rootMargin = '50px',
  ...props
}: ProgressiveImageProps) {
  const [isInView, setIsInView] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || src)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [threshold, rootMargin])

  useEffect(() => {
    if (isInView && lowQualitySrc && currentSrc === lowQualitySrc) {
      // Load high quality image
      const img = new window.Image()
      img.onload = () => {
        setCurrentSrc(src)
      }
      img.src = src
    }
  }, [isInView, src, lowQualitySrc, currentSrc])

  return (
    <div ref={imgRef}>
      <OptimizedImage
        {...props}
        src={isInView ? currentSrc : lowQualitySrc || src}
        loading={isInView ? 'eager' : 'lazy'}
      />
    </div>
  )
}

// Card image component with MTG-specific optimizations
interface CardImageProps {
  card: {
    id: string
    name: string
    imageUris?: Record<string, string>
  }
  size?: 'small' | 'normal' | 'large' | 'art_crop' | 'border_crop'
  className?: string
  priority?: boolean
  onClick?: () => void
}

export function CardImage({
  card,
  size = 'normal',
  className,
  priority = false,
  onClick,
}: CardImageProps) {
  const imageUrl = card.imageUris?.[size]
  const fallbackUrl = card.imageUris?.normal || card.imageUris?.small
  
  // Generate low quality placeholder from art crop
  const lowQualityUrl = card.imageUris?.art_crop

  const dimensions = {
    small: { width: 146, height: 204 },
    normal: { width: 488, height: 680 },
    large: { width: 672, height: 936 },
    art_crop: { width: 626, height: 457 },
    border_crop: { width: 480, height: 680 },
  }

  const { width, height } = dimensions[size]

  if (!imageUrl && !fallbackUrl) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground rounded-lg border',
          onClick && 'cursor-pointer hover:bg-muted/80',
          className
        )}
        style={{ width, height }}
        onClick={onClick}
      >
        <span className="text-xs text-center p-2">{card.name}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden shadow-md',
        onClick && 'cursor-pointer hover:shadow-lg transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <ProgressiveImage
        src={imageUrl || fallbackUrl!}
        lowQualitySrc={lowQualityUrl}
        alt={card.name}
        width={width}
        height={height}
        priority={priority}
        fallbackSrc={fallbackUrl}
        sizes={`${width}px`}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

// Image gallery with lazy loading
interface ImageGalleryProps {
  images: Array<{
    id: string
    src: string
    alt: string
    thumbnail?: string
  }>
  columns?: number
  gap?: number
  onImageClick?: (image: any, index: number) => void
  className?: string
}

export function ImageGallery({
  images,
  columns = 3,
  gap = 16,
  onImageClick,
  className,
}: ImageGalleryProps) {
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {images.map((image, index) => (
        <div
          key={image.id}
          className="aspect-square cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onImageClick?.(image, index)}
        >
          <ProgressiveImage
            src={image.src}
            lowQualitySrc={image.thumbnail}
            alt={image.alt}
            fill
            className="rounded-lg overflow-hidden"
            sizes={`(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw`}
          />
        </div>
      ))}
    </div>
  )
}

// Utility function to generate blur data URL
function generateBlurDataURL(width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  
  // Create a simple gradient blur effect
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#f3f4f6')
  gradient.addColorStop(1, '#e5e7eb')
  
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  
  return canvas.toDataURL()
}

// Hook for preloading images
export function useImagePreloader() {
  const preloadedImages = useRef(new Set<string>())

  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (preloadedImages.current.has(src)) {
        resolve()
        return
      }

      const img = new window.Image()
      img.onload = () => {
        preloadedImages.current.add(src)
        resolve()
      }
      img.onerror = reject
      img.src = src
    })
  }, [])

  const preloadImages = useCallback((sources: string[]): Promise<void[]> => {
    return Promise.all(sources.map(preloadImage))
  }, [preloadImage])

  return { preloadImage, preloadImages }
}