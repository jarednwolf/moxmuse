'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  persistent?: boolean
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  updateToast: (id: string, updates: Partial<Toast>) => void
  clearAll: () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Convenience hooks for different toast types
export const useSuccessToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, description?: string) => {
    return addToast({ type: 'success', title, description })
  }, [addToast])
}

export const useErrorToast = () => {
  const { addToast } = useToast()
  return useCallback((title: string, description?: string, action?: Toast['action']) => {
    return addToast({ type: 'error', title, description, action, persistent: true })
  }, [addToast])
}

export const useLoadingToast = () => {
  const { addToast, updateToast, removeToast } = useToast()
  
  return useCallback((title: string, description?: string) => {
    const id = addToast({ 
      type: 'loading', 
      title, 
      description, 
      persistent: true 
    })
    
    return {
      id,
      success: (successTitle: string, successDescription?: string) => {
        updateToast(id, {
          type: 'success',
          title: successTitle,
          description: successDescription,
          persistent: false,
          duration: 4000
        })
      },
      error: (errorTitle: string, errorDescription?: string) => {
        updateToast(id, {
          type: 'error',
          title: errorTitle,
          description: errorDescription,
          persistent: true
        })
      },
      dismiss: () => removeToast(id)
    }
  }, [addToast, updateToast, removeToast])
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast
    }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto-remove non-persistent toasts
    if (!newToast.persistent && newToast.type !== 'loading') {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
    
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, ...updates } : toast
    ))
    
    // Handle duration for updated toasts
    if (updates.duration !== undefined && !updates.persistent) {
      setTimeout(() => {
        removeToast(id)
      }, updates.duration)
    }
  }, [removeToast])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast, clearAll }}>
      {children}
    </ToastContext.Provider>
  )
}

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const iconClass = "w-5 h-5 flex-shrink-0"
  
  switch (type) {
    case 'success':
      return <CheckCircle className={`${iconClass} text-green-400`} />
    case 'error':
      return <AlertCircle className={`${iconClass} text-red-400`} />
    case 'warning':
      return <AlertTriangle className={`${iconClass} text-yellow-400`} />
    case 'info':
      return <Info className={`${iconClass} text-blue-400`} />
    case 'loading':
      return <Loader2 className={`${iconClass} text-purple-400 animate-spin`} />
    default:
      return <Info className={`${iconClass} text-zinc-400`} />
  }
}

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false)

  const handleRemove = () => {
    setIsExiting(true)
    setTimeout(onRemove, 150) // Match animation duration
  }

  const getToastStyles = (type: ToastType) => {
    const baseStyles = "border-l-4 bg-zinc-800/95 backdrop-blur-sm border-zinc-700"
    
    switch (type) {
      case 'success':
        return `${baseStyles} border-l-green-500 shadow-green-500/10`
      case 'error':
        return `${baseStyles} border-l-red-500 shadow-red-500/10`
      case 'warning':
        return `${baseStyles} border-l-yellow-500 shadow-yellow-500/10`
      case 'info':
        return `${baseStyles} border-l-blue-500 shadow-blue-500/10`
      case 'loading':
        return `${baseStyles} border-l-purple-500 shadow-purple-500/10`
      default:
        return baseStyles
    }
  }

  return (
    <div
      className={`
        ${getToastStyles(toast.type)}
        rounded-lg shadow-lg p-4 mb-3 max-w-sm w-full
        transform transition-all duration-150 ease-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
    >
      <div className="flex items-start gap-3">
        <ToastIcon type={toast.type} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-100">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-xs text-zinc-400 mt-1">
                  {toast.description}
                </p>
              )}
            </div>
            
            {!toast.persistent && toast.type !== 'loading' && (
              <button
                onClick={handleRemove}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-xs text-purple-400 hover:text-purple-300 mt-2 font-medium"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </div>
  )
} 