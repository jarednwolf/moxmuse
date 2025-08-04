'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useMobile } from './useMobile'
import { useHapticFeedback } from './useGestures'

interface KeyboardShortcut {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  action: () => void
  description: string
  category?: string
}

interface MobileKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
  showHelpOnLongPress?: boolean
}

export function useMobileKeyboardShortcuts({
  shortcuts,
  enabled = true,
  showHelpOnLongPress = true
}: MobileKeyboardShortcutsOptions) {
  const { isMobile } = useMobile()
  const { tapFeedback } = useHapticFeedback()
  const helpTimeoutRef = useRef<NodeJS.Timeout>()
  const pressedKeysRef = useRef<Set<string>>(new Set())

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !isMobile) return

    const { key, metaKey, ctrlKey, altKey, shiftKey } = event
    
    // Track pressed keys for combinations
    pressedKeysRef.current.add(key.toLowerCase())

    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === key.toLowerCase()
      const metaMatch = !!shortcut.metaKey === metaKey
      const ctrlMatch = !!shortcut.ctrlKey === ctrlKey
      const altMatch = !!shortcut.altKey === altKey
      const shiftMatch = !!shortcut.shiftKey === shiftKey

      return keyMatch && metaMatch && ctrlMatch && altMatch && shiftMatch
    })

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      
      // Haptic feedback for shortcut activation
      tapFeedback()
      
      // Execute shortcut action
      matchingShortcut.action()
    }

    // Show help on long press of any key (mobile-specific)
    if (showHelpOnLongPress && isMobile) {
      helpTimeoutRef.current = setTimeout(() => {
        showShortcutHelp()
      }, 1000)
    }
  }, [enabled, isMobile, shortcuts, tapFeedback, showHelpOnLongPress])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const { key } = event
    
    // Remove from pressed keys
    pressedKeysRef.current.delete(key.toLowerCase())
    
    // Clear help timeout
    if (helpTimeoutRef.current) {
      clearTimeout(helpTimeoutRef.current)
      helpTimeoutRef.current = undefined
    }
  }, [])

  const showShortcutHelp = useCallback(() => {
    // Create and show help modal
    const helpModal = document.createElement('div')
    helpModal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'
    
    const helpContent = document.createElement('div')
    helpContent.className = 'bg-zinc-900 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto'
    
    // Group shortcuts by category
    const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
      const category = shortcut.category || 'General'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(shortcut)
      return groups
    }, {} as Record<string, KeyboardShortcut[]>)

    let helpHTML = '<h2 class="text-xl font-bold text-zinc-100 mb-4">Keyboard Shortcuts</h2>'
    
    Object.entries(groupedShortcuts).forEach(([category, categoryShortcuts]) => {
      helpHTML += `<div class="mb-4">
        <h3 class="text-lg font-semibold text-zinc-200 mb-2">${category}</h3>
        <div class="space-y-2">`
      
      categoryShortcuts.forEach(shortcut => {
        const keyCombo = formatKeyCombo(shortcut)
        helpHTML += `
          <div class="flex items-center justify-between text-sm">
            <span class="text-zinc-300">${shortcut.description}</span>
            <kbd class="px-2 py-1 bg-zinc-700 text-zinc-200 rounded text-xs font-mono">${keyCombo}</kbd>
          </div>`
      })
      
      helpHTML += '</div></div>'
    })
    
    helpHTML += `
      <div class="mt-6 flex justify-end">
        <button class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors">
          Close
        </button>
      </div>`
    
    helpContent.innerHTML = helpHTML
    helpModal.appendChild(helpContent)
    
    // Add close functionality
    const closeButton = helpContent.querySelector('button')
    const closeModal = () => {
      document.body.removeChild(helpModal)
    }
    
    closeButton?.addEventListener('click', closeModal)
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeModal()
      }
    })
    
    document.body.appendChild(helpModal)
  }, [shortcuts])

  useEffect(() => {
    if (!enabled || !isMobile) return

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      
      if (helpTimeoutRef.current) {
        clearTimeout(helpTimeoutRef.current)
      }
    }
  }, [enabled, isMobile, handleKeyDown, handleKeyUp])

  return {
    showShortcutHelp,
    pressedKeys: Array.from(pressedKeysRef.current)
  }
}

function formatKeyCombo(shortcut: KeyboardShortcut): string {
  const parts: string[] = []
  
  if (shortcut.metaKey) parts.push('⌘')
  if (shortcut.ctrlKey) parts.push('Ctrl')
  if (shortcut.altKey) parts.push('Alt')
  if (shortcut.shiftKey) parts.push('⇧')
  
  parts.push(shortcut.key.toUpperCase())
  
  return parts.join(' + ')
}

// Common mobile keyboard shortcuts for deck building
export function useDeckBuildingShortcuts({
  onSave,
  onShare,
  onSearch,
  onAddCard,
  onUndo,
  onRedo,
  onToggleStats,
  onToggleAI,
  onVoiceToggle
}: {
  onSave?: () => void
  onShare?: () => void
  onSearch?: () => void
  onAddCard?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onToggleStats?: () => void
  onToggleAI?: () => void
  onVoiceToggle?: () => void
}) {
  const shortcuts: KeyboardShortcut[] = [
    // File operations
    {
      key: 's',
      metaKey: true,
      action: () => onSave?.(),
      description: 'Save deck',
      category: 'File'
    },
    {
      key: 's',
      ctrlKey: true,
      action: () => onSave?.(),
      description: 'Save deck',
      category: 'File'
    },
    {
      key: 'Enter',
      metaKey: true,
      action: () => onShare?.(),
      description: 'Share deck',
      category: 'File'
    },
    
    // Navigation
    {
      key: 'f',
      metaKey: true,
      action: () => onSearch?.(),
      description: 'Search cards',
      category: 'Navigation'
    },
    {
      key: 'f',
      ctrlKey: true,
      action: () => onSearch?.(),
      description: 'Search cards',
      category: 'Navigation'
    },
    {
      key: '1',
      altKey: true,
      action: () => onToggleStats?.(),
      description: 'Toggle statistics',
      category: 'Navigation'
    },
    {
      key: '2',
      altKey: true,
      action: () => onToggleAI?.(),
      description: 'Toggle AI insights',
      category: 'Navigation'
    },
    
    // Editing
    {
      key: 'n',
      metaKey: true,
      action: () => onAddCard?.(),
      description: 'Add new card',
      category: 'Editing'
    },
    {
      key: 'n',
      ctrlKey: true,
      action: () => onAddCard?.(),
      description: 'Add new card',
      category: 'Editing'
    },
    {
      key: 'z',
      metaKey: true,
      action: () => onUndo?.(),
      description: 'Undo',
      category: 'Editing'
    },
    {
      key: 'z',
      ctrlKey: true,
      action: () => onUndo?.(),
      description: 'Undo',
      category: 'Editing'
    },
    {
      key: 'y',
      metaKey: true,
      action: () => onRedo?.(),
      description: 'Redo',
      category: 'Editing'
    },
    {
      key: 'y',
      ctrlKey: true,
      action: () => onRedo?.(),
      description: 'Redo',
      category: 'Editing'
    },
    
    // Voice and accessibility
    {
      key: 'v',
      altKey: true,
      action: () => onVoiceToggle?.(),
      description: 'Toggle voice commands',
      category: 'Accessibility'
    },
    {
      key: '/',
      action: () => onSearch?.(),
      description: 'Quick search',
      category: 'Quick Actions'
    }
  ]

  return useMobileKeyboardShortcuts({
    shortcuts,
    enabled: true,
    showHelpOnLongPress: true
  })
}