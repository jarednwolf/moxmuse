/**
 * Mobile Performance Optimization Utilities
 * 
 * This module provides utilities for optimizing mobile performance including:
 * - Bundle size reduction through dynamic imports
 * - Image optimization and lazy loading
 * - Memory management for large lists
 * - Network request optimization
 * - Touch interaction optimization
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// Dynamic import utilities for code splitting
export const dynamicImports = {
  // Lazy load heavy chart components
  loadChartComponents: () => Promise.resolve({ default: null }),
  
  // Lazy load card database components
  loadCardDatabase: () => Promise.resolve({ default: null }),
  
  // Lazy load AI components
  loadAIComponents: () => Promise.resolve({ default: null }),
  
  // Lazy load advanced statistics
  loadAdvancedStats: () => Promise.resolve({ default: null }),
  
  // Lazy load export utilities
  loadExportUtils: () => Promise.resolve({ default: null })
}

// Image optimization utilities
export interface ImageOptimizationOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  lazy?: boolean
  placeholder?: 'blur' | 'empty'
}

export function optimizeImageUrl(
  originalUrl: string, 
  options: ImageOptimizationOptions = {}
): string {
  const {
    width,
    height,
    quality = 80,
    format = 'webp',
    lazy = true
  } = options
  
  // For Scryfall images, use their optimization parameters
  if (originalUrl.includes('scryfall.com')) {
    const url = new URL(originalUrl)
    if (width) url.searchParams.set('w', width.toString())
    if (height) url.searchParams.set('h', height.toString())
    url.searchParams.set('format', format)
    url.searchParams.set('q', quality.toString())
    return url.toString()
  }
  
  // For other images, return as-is or implement your own optimization
  return originalUrl
}

// Lazy loading hook for images
export function useLazyImage(src: string, options: ImageOptimizationOptions = {}) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  
  useEffect(() => {
    if (!options.lazy) {
      setIsInView(true)
      return
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )
    
    if (imgRef.current) {
      observer.observe(imgRef.current)
    }
    
    return () => observer.disconnect()
  }, [options.lazy])
  
  useEffect(() => {
    if (!isInView) return
    
    const img = new Image()
    img.onload = () => setIsLoaded(true)
    img.onerror = () => setError('Failed to load image')
    img.src = optimizeImageUrl(src, options)
  }, [isInView, src, options])
  
  return {
    ref: imgRef,
    isLoaded,
    isInView,
    error,
    src: isInView ? optimizeImageUrl(src, options) : undefined
  }
}

// Memory management for large lists
export function useVirtualizedMemory<T>(
  items: T[],
  maxCachedItems: number = 100
) {
  const [cachedItems, setCachedItems] = useState<Map<number, T>>(new Map())
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  
  const updateVisibleRange = useCallback((start: number, end: number) => {
    setVisibleRange({ start, end })
    
    // Clean up items outside the visible range + buffer
    const buffer = 20
    const minIndex = Math.max(0, start - buffer)
    const maxIndex = Math.min(items.length - 1, end + buffer)
    
    setCachedItems(prev => {
      const newCache = new Map()
      
      // Keep items in visible range + buffer
      for (let i = minIndex; i <= maxIndex; i++) {
        if (prev.has(i)) {
          newCache.set(i, prev.get(i)!)
        } else if (i < items.length) {
          newCache.set(i, items[i])
        }
      }
      
      // Limit total cached items
      if (newCache.size > maxCachedItems) {
        const entries = Array.from(newCache.entries())
        const toKeep = entries.slice(-maxCachedItems)
        return new Map(toKeep)
      }
      
      return newCache
    })
  }, [items, maxCachedItems])
  
  return {
    cachedItems,
    visibleRange,
    updateVisibleRange,
    getItem: (index: number) => cachedItems.get(index) || items[index]
  }
}

// Network request optimization
export interface RequestCacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size
  key?: string // Custom cache key
}

class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private maxSize: number
  
  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }
  
  set(key: string, data: any, ttl = 5 * 60 * 1000) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }
  
  get(key: string) {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }
  
  clear() {
    this.cache.clear()
  }
  
  size() {
    return this.cache.size
  }
}

const requestCache = new RequestCache()

export async function cachedFetch<T>(
  url: string, 
  options: RequestInit & RequestCacheOptions = {}
): Promise<T> {
  const { ttl, maxSize, key, ...fetchOptions } = options
  const cacheKey = key || `${url}-${JSON.stringify(fetchOptions)}`
  
  // Check cache first
  const cached = requestCache.get(cacheKey)
  if (cached) {
    return cached
  }
  
  // Fetch and cache
  const response = await fetch(url, fetchOptions)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  const data = await response.json()
  requestCache.set(cacheKey, data, ttl)
  
  return data
}

// Touch interaction optimization
export function useTouchOptimization() {
  const [touchDevice, setTouchDevice] = useState(false)
  const [touchSupport, setTouchSupport] = useState(false)
  
  useEffect(() => {
    // Detect touch device
    const hasTouchScreen = 'ontouchstart' in window || 
                          navigator.maxTouchPoints > 0 || 
                          (navigator as any).msMaxTouchPoints > 0
    
    setTouchDevice(hasTouchScreen)
    setTouchSupport('ontouchstart' in window)
    
    // Optimize for touch devices
    if (hasTouchScreen) {
      // Disable hover effects on touch devices
      document.documentElement.classList.add('touch-device')
      
      // Optimize scroll behavior
      document.documentElement.style.setProperty('-webkit-overflow-scrolling', 'touch')
      
      // Prevent zoom on double tap for form inputs
      const viewport = document.querySelector('meta[name=viewport]')
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
        )
      }
    }
  }, [])
  
  return {
    touchDevice,
    touchSupport,
    // Optimized event handlers
    getTouchEventOptions: () => ({ passive: true }),
    getScrollEventOptions: () => ({ passive: true })
  }
}

// Bundle size monitoring
export function getBundleInfo() {
  if (typeof window === 'undefined') return null
  
  const performance = window.performance
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  
  return {
    // Page load metrics
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    
    // Resource timing
    resources: performance.getEntriesByType('resource').map(resource => ({
      name: resource.name,
      size: (resource as any).transferSize || 0,
      duration: resource.duration
    })),
    
    // Memory usage (if available)
    memory: (performance as any).memory ? {
      used: (performance as any).memory.usedJSHeapSize,
      total: (performance as any).memory.totalJSHeapSize,
      limit: (performance as any).memory.jsHeapSizeLimit
    } : null
  }
}

// Performance monitoring hook
export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<any>(null)
  
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getBundleInfo())
    }
    
    // Initial measurement
    updateMetrics()
    
    // Update on page load complete
    window.addEventListener('load', updateMetrics)
    
    // Periodic updates
    const interval = setInterval(updateMetrics, 30000) // Every 30 seconds
    
    return () => {
      window.removeEventListener('load', updateMetrics)
      clearInterval(interval)
    }
  }, [])
  
  return metrics
}

// Preload critical resources
export function preloadCriticalResources() {
  if (typeof window === 'undefined') return
  
  // Preload critical fonts
  const fontPreloads = [
    '/fonts/inter-var.woff2',
    '/fonts/jetbrains-mono.woff2'
  ]
  
  fontPreloads.forEach(font => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.crossOrigin = 'anonymous'
    link.href = font
    document.head.appendChild(link)
  })
  
  // Preload critical images
  const imagePreloads = [
    '/images/logo.webp',
    '/images/placeholder-card.webp'
  ]
  
  imagePreloads.forEach(image => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = image
    document.head.appendChild(link)
  })
}

// Service worker utilities for offline support
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  
  return navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('SW registered: ', registration)
      return registration
    })
    .catch(registrationError => {
      console.log('SW registration failed: ', registrationError)
      return null
    })
}

// Cleanup utilities
export function cleanupResources() {
  // Clear request cache
  requestCache.clear()
  
  // Clear any intervals or timeouts
  // (This would be called on component unmount)
  
  // Force garbage collection if available
  if ((window as any).gc) {
    (window as any).gc()
  }
}

// Mobile-specific utilities
export const mobileUtils = {
  // Check if device is mobile
  isMobile: () => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768 || 'ontouchstart' in window
  },
  
  // Get device pixel ratio
  getPixelRatio: () => {
    if (typeof window === 'undefined') return 1
    return window.devicePixelRatio || 1
  },
  
  // Get viewport dimensions
  getViewport: () => {
    if (typeof window === 'undefined') return { width: 0, height: 0 }
    return {
      width: window.innerWidth,
      height: window.innerHeight
    }
  },
  
  // Check if device supports WebP
  supportsWebP: () => {
    if (typeof window === 'undefined') return false
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  },
  
  // Haptic feedback
  vibrate: (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }
}

export default {
  dynamicImports,
  optimizeImageUrl,
  useLazyImage,
  useVirtualizedMemory,
  cachedFetch,
  useTouchOptimization,
  getBundleInfo,
  usePerformanceMonitoring,
  preloadCriticalResources,
  registerServiceWorker,
  cleanupResources,
  mobileUtils
}