'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  Home, 
  Wand2, 
  Library, 
  User, 
  Settings, 
  Menu, 
  X,
  ChevronUp,
  Accessibility
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SkipToContent, AccessibleHeading } from '../ui/accessibility'
import { MobileNav, MobileButton, MobileSheet } from '../ui/mobile-optimized'
import { LoadingOverlay } from '../ui/loading-states'

interface AccessibleLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
  showNavigation?: boolean
  isLoading?: boolean
  loadingMessage?: string
}

export function AccessibleLayout({
  children,
  title,
  description,
  showNavigation = true,
  isLoading = false,
  loadingMessage
}: AccessibleLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [fontSize, setFontSize] = useState('normal')
  
  // Check for accessibility preferences
  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches)
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])
  
  // Load accessibility preferences from localStorage
  useEffect(() => {
    const savedHighContrast = localStorage.getItem('high-contrast') === 'true'
    const savedFontSize = localStorage.getItem('font-size') || 'normal'
    
    setHighContrast(savedHighContrast)
    setFontSize(savedFontSize)
    
    // Apply preferences to document
    if (savedHighContrast) {
      document.documentElement.classList.add('high-contrast')
    }
    document.documentElement.setAttribute('data-font-size', savedFontSize)
  }, [])
  
  // Handle scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home className="w-5 h-5" />,
      onClick: () => router.push('/'),
      active: pathname === '/'
    },
    {
      id: 'tutor',
      label: 'AI Tutor',
      icon: <Wand2 className="w-5 h-5" />,
      onClick: () => router.push('/tutor'),
      active: pathname.startsWith('/tutor')
    },
    {
      id: 'decks',
      label: 'My Decks',
      icon: <Library className="w-5 h-5" />,
      onClick: () => router.push('/decks'),
      active: pathname.startsWith('/decks')
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-5 h-5" />,
      onClick: () => router.push('/profile'),
      active: pathname.startsWith('/profile')
    }
  ]
  
  const toggleHighContrast = () => {
    const newValue = !highContrast
    setHighContrast(newValue)
    localStorage.setItem('high-contrast', newValue.toString())
    
    if (newValue) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }
  
  const changeFontSize = (size: 'small' | 'normal' | 'large') => {
    setFontSize(size)
    localStorage.setItem('font-size', size)
    document.documentElement.setAttribute('data-font-size', size)
  }
  
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? 'auto' : 'smooth'
    })
  }
  
  return (
    <div className={cn(
      'min-h-screen bg-zinc-900 text-zinc-100',
      highContrast && 'high-contrast',
      reducedMotion && 'reduce-motion'
    )}>
      {/* Skip to content link */}
      <SkipToContent />
      
      {/* Loading overlay */}
      <LoadingOverlay
        isVisible={isLoading}
        title="Loading..."
        message={loadingMessage}
      />
      
      {/* Header */}
      <header 
        className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700/50"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <button
                onClick={() => router.push('/')}
                className="text-xl font-bold text-white hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                TolarianTutor
              </button>
            </div>
            
            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center space-x-4" role="navigation" aria-label="Main navigation">
              {navigationItems.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    item.active
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  )}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setShowMobileMenu(true)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Open main menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
            
            {/* Accessibility menu button */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Accessibility options"
              title="Accessibility options"
            >
              <Accessibility className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      
      {/* Mobile navigation sheet */}
      <MobileSheet
        isOpen={showMobileMenu}
        onClose={() => setShowMobileMenu(false)}
        title="Menu"
        position="bottom"
        size="md"
      >
        <div className="p-4 space-y-6">
          {/* Navigation items */}
          <nav role="navigation" aria-label="Mobile navigation">
            <div className="space-y-2">
              {navigationItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick()
                    setShowMobileMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    item.active
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  )}
                  aria-current={item.active ? 'page' : undefined}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
          
          {/* Accessibility options */}
          <div className="border-t border-zinc-700 pt-6">
            <AccessibleHeading level={3} className="text-lg font-semibold text-zinc-100 mb-4">
              Accessibility Options
            </AccessibleHeading>
            
            <div className="space-y-4">
              {/* High contrast toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="high-contrast" className="text-sm text-zinc-300">
                  High Contrast
                </label>
                <button
                  id="high-contrast"
                  onClick={toggleHighContrast}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                    highContrast ? 'bg-blue-600' : 'bg-zinc-600'
                  )}
                  role="switch"
                  aria-checked={highContrast}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              
              {/* Font size options */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">
                  Font Size
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'small', label: 'Small' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'large', label: 'Large' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => changeFontSize(option.value as any)}
                      className={cn(
                        'px-3 py-2 text-xs rounded-lg transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        fontSize === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Reduced motion info */}
              <div className="text-sm text-zinc-400">
                <p>
                  {reducedMotion 
                    ? '✓ Reduced motion is enabled'
                    : 'Reduced motion: Not enabled'
                  }
                </p>
                <p className="text-xs mt-1">
                  This is controlled by your system preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </MobileSheet>
      
      {/* Main content */}
      <main 
        id="main-content"
        className="flex-1"
        role="main"
        tabIndex={-1}
      >
        {/* Page header */}
        {(title || description) && (
          <div className="bg-zinc-800/50 border-b border-zinc-700/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {title && (
                <AccessibleHeading level={1} className="text-2xl font-bold text-white mb-2">
                  {title}
                </AccessibleHeading>
              )}
              {description && (
                <p className="text-zinc-300">{description}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Page content */}
        {children}
      </main>
      
      {/* Mobile bottom navigation */}
      {showNavigation && (
        <MobileNav
          items={navigationItems.map(item => ({
            ...item,
            badge: undefined // Add badges if needed
          }))}
          activeItem={navigationItems.find(item => item.active)?.id}
        />
      )}
      
      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 z-30 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

// CSS for accessibility features (add to globals.css)
export const accessibilityStyles = `
/* High contrast mode */
.high-contrast {
  --zinc-50: #ffffff;
  --zinc-100: #f5f5f5;
  --zinc-200: #e5e5e5;
  --zinc-300: #d4d4d4;
  --zinc-400: #a3a3a3;
  --zinc-500: #737373;
  --zinc-600: #525252;
  --zinc-700: #404040;
  --zinc-800: #262626;
  --zinc-900: #171717;
  --zinc-950: #0a0a0a;
}

.high-contrast button:focus,
.high-contrast input:focus,
.high-contrast select:focus,
.high-contrast textarea:focus {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* Font size variations */
[data-font-size="small"] {
  font-size: 14px;
}

[data-font-size="normal"] {
  font-size: 16px;
}

[data-font-size="large"] {
  font-size: 18px;
}

/* Reduced motion */
.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

/* Focus indicators */
.focus-visible:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only.focus:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 0.5rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
  background: #1f2937;
  color: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 0.375rem;
  z-index: 9999;
}

/* Touch targets */
@media (pointer: coarse) {
  button,
  input,
  select,
  textarea,
  a {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }
  
  * {
    background: transparent !important;
    color: black !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  
  a,
  a:visited {
    text-decoration: underline;
  }
  
  a[href]:after {
    content: " (" attr(href) ")";
  }
  
  abbr[title]:after {
    content: " (" attr(title) ")";
  }
}
`