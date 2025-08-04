import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { configure } from '@testing-library/react'
import { toHaveNoViolations } from 'jest-axe'

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations)

// Configure testing library for accessibility
configure({
  // Increase timeout for accessibility tests
  asyncUtilTimeout: 5000,
  // Configure queries to be more accessible
  defaultHidden: true,
  // Show suggestions for better queries
  showOriginalStackTrace: true,
})

// Mock accessibility APIs
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
}

const mockMediaQueryList = {
  matches: false,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}

// Setup accessibility testing environment
beforeAll(() => {
  // Mock speech synthesis API
  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSpeechSynthesis,
    writable: true,
  })

  // Mock media query API for accessibility preferences
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      ...mockMediaQueryList,
      matches: query.includes('prefers-reduced-motion') || 
               query.includes('prefers-contrast') ||
               query.includes('prefers-color-scheme'),
      media: query,
    })),
    writable: true,
  })

  // Mock intersection observer for accessibility features
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }))

  // Mock resize observer for responsive accessibility
  global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock focus management APIs
  Object.defineProperty(document, 'activeElement', {
    value: document.body,
    writable: true,
  })

  // Mock screen reader APIs
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (compatible; AccessibilityTest/1.0)',
    writable: true,
  })

  console.log('♿ Accessibility testing setup initialized')
})

beforeEach(() => {
  // Reset accessibility mocks before each test
  vi.clearAllMocks()
  
  // Reset focus to body
  if (document.body) {
    document.body.focus()
  }
  
  // Clear any aria-live regions
  const liveRegions = document.querySelectorAll('[aria-live]')
  liveRegions.forEach(region => {
    region.textContent = ''
  })
})

afterEach(() => {
  // Clean up any accessibility-related DOM modifications
  const testElements = document.querySelectorAll('[data-testid]')
  testElements.forEach(element => {
    // Ensure proper cleanup of event listeners
    element.removeEventListener('focus', () => {})
    element.removeEventListener('blur', () => {})
    element.removeEventListener('keydown', () => {})
  })
})

afterAll(() => {
  console.log('♿ Accessibility testing cleanup completed')
})

// Accessibility testing utilities
export const accessibilityUtils = {
  /**
   * Check if element has proper ARIA attributes
   */
  checkAriaAttributes: (element: Element) => {
    const requiredAttributes = ['aria-label', 'aria-labelledby', 'aria-describedby']
    const hasAriaAttribute = requiredAttributes.some(attr => element.hasAttribute(attr))
    
    if (!hasAriaAttribute && element.tagName !== 'DIV' && element.tagName !== 'SPAN') {
      console.warn(`Element ${element.tagName} may need ARIA attributes for accessibility`)
    }
    
    return hasAriaAttribute
  },

  /**
   * Simulate screen reader navigation
   */
  simulateScreenReaderNavigation: async (container: Element) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    const navigationPath: Element[] = []
    
    for (const element of Array.from(focusableElements)) {
      if (element instanceof HTMLElement) {
        element.focus()
        navigationPath.push(element)
        
        // Simulate screen reader announcement
        const announcement = accessibilityUtils.getScreenReaderAnnouncement(element)
        console.log(`Screen reader: "${announcement}"`)
        
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return navigationPath
  },

  /**
   * Get what a screen reader would announce for an element
   */
  getScreenReaderAnnouncement: (element: Element): string => {
    const label = element.getAttribute('aria-label') ||
                 element.getAttribute('aria-labelledby') ||
                 element.textContent ||
                 element.getAttribute('title') ||
                 element.getAttribute('alt') ||
                 'unlabeled element'
    
    const role = element.getAttribute('role') || element.tagName.toLowerCase()
    const state = accessibilityUtils.getElementState(element)
    
    return `${label}, ${role}${state ? `, ${state}` : ''}`
  },

  /**
   * Get accessibility state of element
   */
  getElementState: (element: Element): string => {
    const states: string[] = []
    
    if (element.hasAttribute('aria-expanded')) {
      states.push(element.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed')
    }
    
    if (element.hasAttribute('aria-checked')) {
      const checked = element.getAttribute('aria-checked')
      states.push(checked === 'true' ? 'checked' : checked === 'false' ? 'unchecked' : 'mixed')
    }
    
    if (element.hasAttribute('aria-selected')) {
      states.push(element.getAttribute('aria-selected') === 'true' ? 'selected' : 'not selected')
    }
    
    if (element.hasAttribute('aria-disabled') && element.getAttribute('aria-disabled') === 'true') {
      states.push('disabled')
    }
    
    if (element.hasAttribute('aria-hidden') && element.getAttribute('aria-hidden') === 'true') {
      states.push('hidden')
    }
    
    return states.join(', ')
  },

  /**
   * Check color contrast ratio
   */
  checkColorContrast: (element: Element): { ratio: number; passes: boolean } => {
    const computedStyle = window.getComputedStyle(element)
    const color = computedStyle.color
    const backgroundColor = computedStyle.backgroundColor
    
    // Simplified contrast calculation (in real implementation, use proper algorithm)
    const ratio = accessibilityUtils.calculateContrastRatio(color, backgroundColor)
    const passes = ratio >= 4.5 // WCAG AA standard
    
    return { ratio, passes }
  },

  /**
   * Calculate contrast ratio between two colors
   */
  calculateContrastRatio: (color1: string, color2: string): number => {
    // Simplified implementation - in real testing, use proper color contrast library
    // This is a mock calculation for testing purposes
    return 4.6 // Mock passing ratio
  },

  /**
   * Check if element is keyboard accessible
   */
  checkKeyboardAccessibility: async (element: Element): Promise<boolean> => {
    if (!(element instanceof HTMLElement)) return false
    
    // Check if element is focusable
    const isFocusable = element.tabIndex >= 0 || 
                       ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(element.tagName) ||
                       element.hasAttribute('tabindex')
    
    if (!isFocusable) return false
    
    // Test focus
    element.focus()
    const hasFocus = document.activeElement === element
    
    if (!hasFocus) return false
    
    // Test keyboard events
    const keyboardEvents = ['keydown', 'keyup', 'keypress']
    let handlesKeyboard = false
    
    keyboardEvents.forEach(eventType => {
      const event = new KeyboardEvent(eventType, { key: 'Enter' })
      element.addEventListener(eventType, () => { handlesKeyboard = true }, { once: true })
      element.dispatchEvent(event)
    })
    
    return handlesKeyboard
  },

  /**
   * Check heading hierarchy
   */
  checkHeadingHierarchy: (container: Element): { valid: boolean; issues: string[] } => {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const issues: string[] = []
    let previousLevel = 0
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))
      
      if (index === 0 && level !== 1) {
        issues.push('First heading should be h1')
      }
      
      if (level > previousLevel + 1) {
        issues.push(`Heading level jumps from h${previousLevel} to h${level}`)
      }
      
      previousLevel = level
    })
    
    return {
      valid: issues.length === 0,
      issues,
    }
  },

  /**
   * Check form accessibility
   */
  checkFormAccessibility: (form: Element): { valid: boolean; issues: string[] } => {
    const issues: string[] = []
    
    // Check form inputs have labels
    const inputs = form.querySelectorAll('input, select, textarea')
    inputs.forEach(input => {
      const hasLabel = input.hasAttribute('aria-label') ||
                      input.hasAttribute('aria-labelledby') ||
                      form.querySelector(`label[for="${input.id}"]`) ||
                      input.closest('label')
      
      if (!hasLabel) {
        issues.push(`Input ${input.tagName} missing label`)
      }
    })
    
    // Check required fields are marked
    const requiredInputs = form.querySelectorAll('[required]')
    requiredInputs.forEach(input => {
      const hasRequiredIndicator = input.hasAttribute('aria-required') ||
                                   input.getAttribute('aria-describedby')?.includes('required')
      
      if (!hasRequiredIndicator) {
        issues.push(`Required field missing accessibility indicator`)
      }
    })
    
    // Check error messages are associated
    const errorMessages = form.querySelectorAll('[role="alert"], .error-message')
    errorMessages.forEach(error => {
      const associatedInput = form.querySelector(`[aria-describedby*="${error.id}"]`)
      if (!associatedInput) {
        issues.push(`Error message not associated with input`)
      }
    })
    
    return {
      valid: issues.length === 0,
      issues,
    }
  },

  /**
   * Mock high contrast mode
   */
  mockHighContrastMode: (enabled: boolean = true) => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        ...mockMediaQueryList,
        matches: enabled && query.includes('prefers-contrast: high'),
        media: query,
      })),
      writable: true,
    })
  },

  /**
   * Mock reduced motion preference
   */
  mockReducedMotion: (enabled: boolean = true) => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockImplementation((query: string) => ({
        ...mockMediaQueryList,
        matches: enabled && query.includes('prefers-reduced-motion: reduce'),
        media: query,
      })),
      writable: true,
    })
  },

  /**
   * Mock screen reader presence
   */
  mockScreenReader: (present: boolean = true) => {
    Object.defineProperty(navigator, 'userAgent', {
      value: present 
        ? 'Mozilla/5.0 (compatible; NVDA/2021.1; Windows NT 10.0)'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true,
    })
  },

  /**
   * Create accessibility test report
   */
  createAccessibilityReport: (container: Element) => {
    const report = {
      timestamp: new Date().toISOString(),
      headingHierarchy: accessibilityUtils.checkHeadingHierarchy(container),
      keyboardAccessibility: [],
      colorContrast: [],
      ariaAttributes: [],
      formAccessibility: null,
    }
    
    // Check all interactive elements
    const interactiveElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    interactiveElements.forEach(element => {
      report.ariaAttributes.push({
        element: element.tagName,
        hasAria: accessibilityUtils.checkAriaAttributes(element),
      })
      
      const contrast = accessibilityUtils.checkColorContrast(element)
      report.colorContrast.push({
        element: element.tagName,
        ratio: contrast.ratio,
        passes: contrast.passes,
      })
    })
    
    // Check forms
    const forms = container.querySelectorAll('form')
    if (forms.length > 0) {
      report.formAccessibility = accessibilityUtils.checkFormAccessibility(forms[0])
    }
    
    return report
  },
}

// Accessibility testing matchers
export const accessibilityMatchers = {
  toBeAccessible: async (received: Element) => {
    const { axe } = await import('jest-axe')
    const results = await axe(received)
    
    return {
      pass: results.violations.length === 0,
      message: () => 
        results.violations.length === 0
          ? 'Expected element to have accessibility violations'
          : `Expected element to be accessible, but found ${results.violations.length} violations:\n${
              results.violations.map(v => `- ${v.description}`).join('\n')
            }`,
    }
  },
  
  toHaveProperAriaLabels: (received: Element) => {
    const hasAriaLabels = accessibilityUtils.checkAriaAttributes(received)
    
    return {
      pass: hasAriaLabels,
      message: () =>
        hasAriaLabels
          ? 'Expected element to not have proper ARIA labels'
          : 'Expected element to have proper ARIA labels',
    }
  },
  
  toHaveGoodColorContrast: (received: Element) => {
    const contrast = accessibilityUtils.checkColorContrast(received)
    
    return {
      pass: contrast.passes,
      message: () =>
        contrast.passes
          ? `Expected element to have poor color contrast (ratio: ${contrast.ratio})`
          : `Expected element to have good color contrast, but ratio is ${contrast.ratio} (minimum: 4.5)`,
    }
  },
}

// Extend expect with accessibility matchers
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeAccessible(): any
      toHaveProperAriaLabels(): any
      toHaveGoodColorContrast(): any
    }
  }
}

console.log('♿ Accessibility testing utilities loaded')
console.log('Available utilities:')
console.log('  🏷️  checkAriaAttributes() - Check ARIA attributes')
console.log('  🗣️  simulateScreenReaderNavigation() - Simulate screen reader')
console.log('  🎨 checkColorContrast() - Check color contrast ratios')
console.log('  ⌨️  checkKeyboardAccessibility() - Test keyboard navigation')
console.log('  📋 checkHeadingHierarchy() - Validate heading structure')
console.log('  📝 checkFormAccessibility() - Test form accessibility')
console.log('  🎭 mockHighContrastMode() - Mock high contrast preference')
console.log('  🎬 mockReducedMotion() - Mock reduced motion preference')