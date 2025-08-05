import { lazy, Suspense, ComponentType, ReactNode, Component, ReactElement } from 'react'

// Simple Error Boundary component
class SimpleErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Code splitting error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

/**
 * Advanced Code Splitting and Lazy Loading System
 * Provides intelligent component loading with error boundaries and loading states
 */

interface LazyComponentOptions {
  fallback?: ReactNode
  errorFallback?: ReactNode
  preload?: boolean
  retryCount?: number
  timeout?: number
}

interface ChunkInfo {
  name: string
  size?: number
  loadTime?: number
  error?: Error
  retryCount: number
}

/**
 * Enhanced lazy loading with retry logic and performance tracking
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyComponentOptions = {}
): ComponentType<any> {
  const {
    fallback = <div className="animate-pulse bg-gray-200 h-32 rounded" />,
    errorFallback = <div className="text-red-500 p-4">Failed to load component</div>,
    preload = false,
    retryCount = 3,
    timeout = 10000
  } = options

  // Track chunk loading performance
  const chunkInfo: ChunkInfo = {
    name: importFn.toString().match(/import\(['"`](.+?)['"`]\)/)?.[1] || 'unknown',
    retryCount: 0
  }

  // Enhanced import function with retry logic
  const enhancedImportFn = async (): Promise<{ default: T }> => {
    const startTime = performance.now()
    
    const attemptLoad = async (attempt: number): Promise<{ default: T }> => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Component load timeout')), timeout)
        })

        const loadPromise = importFn()
        const result = await Promise.race([loadPromise, timeoutPromise])
        
        // Track successful load
        chunkInfo.loadTime = performance.now() - startTime
        console.log(`📦 Loaded chunk: ${chunkInfo.name} in ${chunkInfo.loadTime.toFixed(2)}ms`)
        
        return result
      } catch (error) {
        chunkInfo.error = error as Error
        chunkInfo.retryCount = attempt

        if (attempt < retryCount) {
          console.warn(`🔄 Retrying chunk load: ${chunkInfo.name} (attempt ${attempt + 1}/${retryCount})`)
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          return attemptLoad(attempt + 1)
        }

        console.error(`❌ Failed to load chunk: ${chunkInfo.name} after ${retryCount} attempts`, error)
        throw error
      }
    }

    return attemptLoad(1)
  }

  const LazyComponent = lazy(enhancedImportFn)

  // Preload if requested
  if (preload && typeof window !== 'undefined') {
    // Preload after a short delay to not block initial render
    setTimeout(() => {
      enhancedImportFn().catch(() => {
        // Ignore preload errors
      })
    }, 100)
  }

  // Return wrapped component with error boundary and suspense
  return function WrappedLazyComponent(props: any) {
    return (
      <SimpleErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback}>
          <LazyComponent {...props} />
        </Suspense>
      </SimpleErrorBoundary>
    )
  }
}

/**
 * Route-based code splitting for Next.js pages
 */
export const createLazyPage = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  pageName: string
) => {
  return createLazyComponent(importFn, {
    fallback: (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {pageName}...</p>
        </div>
      </div>
    ),
    errorFallback: (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Page</h2>
          <p className="text-gray-600 mb-4">There was an error loading {pageName}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    ),
    retryCount: 3,
    timeout: 15000
  })
}

/**
 * Feature-based code splitting for large components
 */
export const LazyComponents = {
  // Tutor components - using existing components
  DeckGenerationEngine: createLazyComponent(
    () => import('../../../components/tutor/DeckGenerationEngine').then(module => ({ default: module.DeckGenerationEngine })),
    {
      fallback: <div className="h-96 bg-gray-100 animate-pulse rounded-lg" />,
      preload: true
    }
  ),

  ConsultationWizard: createLazyComponent(
    () => import('../../../components/tutor/ConsultationWizard').then(module => ({ default: module.ConsultationWizard })),
    {
      fallback: <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
      preload: true
    }
  ),

  DeckEditor: createLazyComponent(
    () => import('../../../components/tutor/DeckEditor').then(module => ({ default: module.DeckEditor })),
    {
      fallback: <div className="h-screen bg-gray-100 animate-pulse" />
    }
  ),

  AnalysisPanel: createLazyComponent(
    () => import('../../../components/tutor/AnalysisPanel').then(module => ({ default: module.AnalysisPanel })),
    {
      fallback: <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    }
  )
}

/**
 * Intelligent preloading based on user behavior
 */
export class IntelligentPreloader {
  private preloadedChunks = new Set<string>()
  private intersectionObserver?: IntersectionObserver
  private hoverTimeouts = new Map<string, NodeJS.Timeout>()

  constructor() {
    this.setupIntersectionObserver()
    this.setupHoverPreloading()
  }

  private setupIntersectionObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const preloadTarget = entry.target.getAttribute('data-preload')
            if (preloadTarget && !this.preloadedChunks.has(preloadTarget)) {
              this.preloadChunk(preloadTarget)
            }
          }
        })
      },
      {
        rootMargin: '50px' // Start preloading 50px before element comes into view
      }
    )
  }

  private setupHoverPreloading() {
    if (typeof window === 'undefined') return

    document.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement
      const preloadTarget = target.getAttribute('data-preload-hover')
      
      if (preloadTarget && !this.preloadedChunks.has(preloadTarget)) {
        // Delay preloading to avoid unnecessary loads on quick hovers
        const timeout = setTimeout(() => {
          this.preloadChunk(preloadTarget)
        }, 200)
        
        this.hoverTimeouts.set(preloadTarget, timeout)
      }
    })

    document.addEventListener('mouseout', (event) => {
      const target = event.target as HTMLElement
      const preloadTarget = target.getAttribute('data-preload-hover')
      
      if (preloadTarget) {
        const timeout = this.hoverTimeouts.get(preloadTarget)
        if (timeout) {
          clearTimeout(timeout)
          this.hoverTimeouts.delete(preloadTarget)
        }
      }
    })
  }

  private async preloadChunk(chunkName: string) {
    if (this.preloadedChunks.has(chunkName)) return

    try {
      console.log(`🚀 Preloading chunk: ${chunkName}`)
      
      // Map chunk names to import functions
      const chunkMap: Record<string, () => Promise<any>> = {
        'deck-generation': () => import('../../../components/tutor/DeckGenerationEngine'),
        'consultation-wizard': () => import('../../../components/tutor/ConsultationWizard'),
        'deck-editor': () => import('../../../components/tutor/DeckEditor'),
        'analysis-panel': () => import('../../../components/tutor/AnalysisPanel')
      }

      const importFn = chunkMap[chunkName]
      if (importFn) {
        await importFn()
        this.preloadedChunks.add(chunkName)
        console.log(`✅ Preloaded chunk: ${chunkName}`)
      }
    } catch (error) {
      console.warn(`⚠️ Failed to preload chunk: ${chunkName}`, error)
    }
  }

  observeElement(element: HTMLElement, chunkName: string) {
    if (this.intersectionObserver) {
      element.setAttribute('data-preload', chunkName)
      this.intersectionObserver.observe(element)
    }
  }

  unobserveElement(element: HTMLElement) {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element)
    }
  }

  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }
    this.hoverTimeouts.forEach(timeout => clearTimeout(timeout))
    this.hoverTimeouts.clear()
  }
}

// Global preloader instance
export const intelligentPreloader = new IntelligentPreloader()

/**
 * Hook for component-level preloading
 */
export function usePreloader() {
  const preloadChunk = (chunkName: string) => {
    intelligentPreloader['preloadChunk'](chunkName)
  }

  const observeElement = (element: HTMLElement | null, chunkName: string) => {
    if (element) {
      intelligentPreloader.observeElement(element, chunkName)
    }
  }

  return { preloadChunk, observeElement }
}

/**
 * Bundle size analyzer for development
 */
export class BundleAnalyzer {
  private chunkSizes = new Map<string, number>()
  private loadTimes = new Map<string, number>()

  recordChunkLoad(chunkName: string, size: number, loadTime: number) {
    this.chunkSizes.set(chunkName, size)
    this.loadTimes.set(chunkName, loadTime)
  }

  getAnalysis() {
    const totalSize = Array.from(this.chunkSizes.values()).reduce((a, b) => a + b, 0)
    const avgLoadTime = Array.from(this.loadTimes.values()).reduce((a, b) => a + b, 0) / this.loadTimes.size

    return {
      totalChunks: this.chunkSizes.size,
      totalSize: totalSize,
      averageLoadTime: avgLoadTime,
      chunks: Array.from(this.chunkSizes.entries()).map(([name, size]) => ({
        name,
        size,
        loadTime: this.loadTimes.get(name) || 0,
        sizePercentage: (size / totalSize) * 100
      })).sort((a, b) => b.size - a.size)
    }
  }

  logAnalysis() {
    if (process.env.NODE_ENV === 'development') {
      const analysis = this.getAnalysis()
      console.group('📊 Bundle Analysis')
      console.log(`Total chunks: ${analysis.totalChunks}`)
      console.log(`Total size: ${(analysis.totalSize / 1024).toFixed(2)} KB`)
      console.log(`Average load time: ${analysis.averageLoadTime.toFixed(2)}ms`)
      console.table(analysis.chunks)
      console.groupEnd()
    }
  }
}

export const bundleAnalyzer = new BundleAnalyzer()

/**
 * Performance-aware component wrapper
 */
export function withPerformanceTracking<P extends object>(
  Component: ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    const startTime = performance.now()

    // Track render time
    const trackRender = () => {
      const renderTime = performance.now() - startTime
      if (renderTime > 16) { // Longer than one frame
        console.warn(`🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`)
      }
    }

    // Use effect to track after render
    if (typeof window !== 'undefined') {
      setTimeout(trackRender, 0)
    }

    return <Component {...props} />
  }
}