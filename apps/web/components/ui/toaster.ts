'use client'

import { useCallback } from 'react'

type ToastOptions = {
  label?: string
  onClick?: () => void
}

export function useSuccessToast() {
  return useCallback((title: string, message?: string) => {
    // Minimal client-side toast shim for production build
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log(`[SUCCESS] ${title}${message ? `: ${message}` : ''}`)
    }
  }, [])
}

export function useErrorToast() {
  return useCallback((title: string, message?: string, _action?: ToastOptions) => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${title}${message ? `: ${message}` : ''}`)
    }
  }, [])
}


