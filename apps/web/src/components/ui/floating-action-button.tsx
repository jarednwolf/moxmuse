'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useGestures'
import { useMobile } from '@/hooks/useMobile'
import { 
  Plus, 
  Save, 
  Share2, 
  Download, 
  Upload, 
  Search, 
  Mic, 
  Settings,
  X,
  ChevronUp
} from 'lucide-react'

interface FloatingAction {
  id: string
  icon: React.ReactNode
  label: string
  action: () => void
  color?: string
  disabled?: boolean
}

interface FloatingActionButtonProps {
  actions: FloatingAction[]
  className?: string
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal'
}

const actionIcons = {
  'add-card': <Plus className="h-5 w-5" />,
  'save': <Save className="h-5 w-5" />,
  'share': <Share2 className="h-5 w-5" />,
  'export': <Download className="h-5 w-5" />,
  'import': <Upload className="h-5 w-5" />,
  'search': <Search className="h-5 w-5" />,
  'voice': <Mic className="h-5 w-5" />,
  'settings': <Settings className="h-5 w-5" />
}

const defaultActions: FloatingAction[] = [
  {
    id: 'add-card',
    icon: actionIcons['add-card'],
    label: 'Add Card',
    action: () => {},
    color: 'bg-green-600 hover:bg-green-500'
  },
  {
    id: 'save',
    icon: actionIcons['save'],
    label: 'Save Deck',
    action: () => {},
    color: 'bg-blue-600 hover:bg-blue-500'
  },
  {
    id: 'share',
    icon: actionIcons['share'],
    label: 'Share',
    action: () => {},
    color: 'bg-purple-600 hover:bg-purple-500'
  }
]

export function FloatingActionButton({
  actions = defaultActions,
  className,
  position = 'bottom-right',
  size = 'md',
  variant = 'default'
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { isMobile } = useMobile()
  const { tapFeedback, successFeedback } = useHapticFeedback()

  const handleMainButtonClick = useCallback(() => {
    tapFeedback()
    setIsExpanded(!isExpanded)
  }, [isExpanded, tapFeedback])

  const handleActionClick = useCallback((action: FloatingAction) => {
    if (action.disabled) return
    
    successFeedback()
    action.action()
    setIsExpanded(false)
  }, [successFeedback])

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2'
  }

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const actionSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14'
  }

  if (!isMobile) {
    return null // Only show on mobile
  }

  return (
    <div className={cn(
      'fixed z-50',
      positionClasses[position],
      className
    )}>
      {/* Action Items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-4 flex flex-col-reverse gap-3"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  y: 20, 
                  scale: 0.8,
                  transition: { delay: (actions.length - index - 1) * 0.05 }
                }}
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={cn(
                  'flex items-center justify-center rounded-full shadow-lg',
                  'text-white font-medium transition-all duration-200',
                  'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                  actionSizeClasses[size],
                  action.color || 'bg-zinc-700 hover:bg-zinc-600',
                  variant === 'minimal' && 'bg-zinc-800/90 backdrop-blur-sm border border-zinc-600'
                )}
                style={{
                  minHeight: '44px', // iOS touch target minimum
                  minWidth: '44px'
                }}
              >
                {action.icon}
                
                {/* Tooltip */}
                <div className="absolute right-full mr-3 px-2 py-1 bg-zinc-900 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                  {action.label}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <motion.button
        onClick={handleMainButtonClick}
        className={cn(
          'flex items-center justify-center rounded-full shadow-lg',
          'bg-purple-600 hover:bg-purple-500 text-white',
          'transition-all duration-200 active:scale-95',
          sizeClasses[size],
          variant === 'minimal' && 'bg-zinc-800/90 backdrop-blur-sm border border-zinc-600'
        )}
        style={{
          minHeight: '44px', // iOS touch target minimum
          minWidth: '44px'
        }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isExpanded ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isExpanded ? (
          <X className="h-6 w-6" />
        ) : (
          <ChevronUp className="h-6 w-6" />
        )}
      </motion.button>

      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
            onClick={() => setIsExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Quick Actions Hook for common deck building actions
export function useQuickActions() {
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const quickActions: FloatingAction[] = [
    {
      id: 'add-card',
      icon: actionIcons['add-card'],
      label: 'Add Card',
      action: () => setIsSearchOpen(true),
      color: 'bg-green-600 hover:bg-green-500'
    },
    {
      id: 'voice',
      icon: actionIcons['voice'],
      label: isVoiceActive ? 'Stop Voice' : 'Voice Search',
      action: () => setIsVoiceActive(!isVoiceActive),
      color: isVoiceActive 
        ? 'bg-red-600 hover:bg-red-500' 
        : 'bg-blue-600 hover:bg-blue-500'
    },
    {
      id: 'save',
      icon: actionIcons['save'],
      label: 'Save Deck',
      action: () => {
        // Implement save functionality
        console.log('Saving deck...')
      },
      color: 'bg-purple-600 hover:bg-purple-500'
    },
    {
      id: 'share',
      icon: actionIcons['share'],
      label: 'Share Deck',
      action: () => {
        // Implement share functionality
        if (navigator.share) {
          navigator.share({
            title: 'My MTG Deck',
            text: 'Check out my deck!',
            url: window.location.href
          })
        }
      },
      color: 'bg-orange-600 hover:bg-orange-500'
    }
  ]

  return {
    quickActions,
    isVoiceActive,
    setIsVoiceActive,
    isSearchOpen,
    setIsSearchOpen
  }
}