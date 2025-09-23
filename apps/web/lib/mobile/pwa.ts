/**
 * Progressive Web App Utilities
 * 
 * Handles PWA installation, offline detection, and mobile-specific features
 */

import { useState, useEffect, useCallback } from 'react'

// PWA Installation Interface
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// PWA Installation Hook
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  
  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone = (window.navigator as any).standalone === true
      setIsInstalled(isStandalone || isIOSStandalone)
    }
    
    checkInstalled()
    
    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setInstallPrompt(promptEvent)
      setIsInstallable(true)
    }
    
    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
    }
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])
  
  const install = useCallback(async () => {
    if (!installPrompt) return false
    
    try {
      await installPrompt.prompt()
      const choiceResult = await installPrompt.userChoice
      
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
        setInstallPrompt(null)
        return true
      }
      
      return false
    } catch (error) {
      console.error('PWA install failed:', error)
      return false
    }
  }, [installPrompt])
  
  return {
    isInstallable,
    isInstalled,
    install
  }
}

// Offline Detection Hook
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine
      setIsOnline(online)
      
      if (!online) {
        setWasOffline(true)
      }
    }
    
    // Initial check
    updateOnlineStatus()
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])
  
  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline
  }
}

// Service Worker Registration
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    
    console.log('Service Worker registered:', registration)
    
    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('New service worker version available')
            
            // Notify user about update
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('App Update Available', {
                body: 'A new version of MoxMuse is available. Refresh to update.',
                icon: '/icons/icon-192x192.png'
              })
            }
          }
        })
      }
    })
    
    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

// Background Sync
export function requestBackgroundSync(tag: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      reject(new Error('Background sync not supported'))
      return
    }
    
    navigator.serviceWorker.ready.then(registration => {
      return registration.sync.register(tag)
    }).then(() => {
      console.log('Background sync registered:', tag)
      resolve()
    }).catch(error => {
      console.error('Background sync registration failed:', error)
      reject(error)
    })
  })
}

// Push Notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  
  if (Notification.permission === 'granted') {
    return 'granted'
  }
  
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  
  const permission = await Notification.requestPermission()
  return permission
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }
  
  try {
    const registration = await navigator.serviceWorker.ready
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    })
    
    console.log('Push subscription created:', subscription)
    return subscription
  } catch (error) {
    console.error('Push subscription failed:', error)
    return null
  }
}

// App Shortcuts (for supported browsers)
export function updateAppShortcuts(shortcuts: Array<{
  name: string
  short_name?: string
  description?: string
  url: string
  icons?: Array<{
    src: string
    sizes: string
    type: string
  }>
}>) {
  if ('navigator' in window && 'setAppBadge' in navigator) {
    // Update app shortcuts if supported
    console.log('Updating app shortcuts:', shortcuts)
  }
}

// App Badge (for supported browsers)
export function setAppBadge(count?: number) {
  if ('navigator' in window && 'setAppBadge' in navigator) {
    if (count !== undefined) {
      (navigator as any).setAppBadge(count)
    } else {
      (navigator as any).setAppBadge()
    }
  }
}

export function clearAppBadge() {
  if ('navigator' in window && 'clearAppBadge' in navigator) {
    (navigator as any).clearAppBadge()
  }
}

// Share API
export async function shareContent(data: {
  title?: string
  text?: string
  url?: string
  files?: File[]
}): Promise<boolean> {
  if (!('share' in navigator)) {
    // Fallback to clipboard or other sharing methods
    if (data.url && 'clipboard' in navigator) {
      try {
        await navigator.clipboard.writeText(data.url)
        return true
      } catch (error) {
        console.error('Clipboard write failed:', error)
      }
    }
    return false
  }
  
  try {
    await navigator.share(data)
    return true
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Share failed:', error)
    }
    return false
  }
}

// Screen Wake Lock (for long deck building sessions)
export function useWakeLock() {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  
  useEffect(() => {
    setIsSupported('wakeLock' in navigator)
  }, [])
  
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return false
    
    try {
      const lock = await (navigator as any).wakeLock.request('screen')
      setWakeLock(lock)
      
      lock.addEventListener('release', () => {
        console.log('Wake lock released')
        setWakeLock(null)
      })
      
      return true
    } catch (error) {
      console.error('Wake lock request failed:', error)
      return false
    }
  }, [isSupported])
  
  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release()
      setWakeLock(null)
    }
  }, [wakeLock])
  
  // Auto-release on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && wakeLock) {
        releaseWakeLock()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLock) {
        releaseWakeLock()
      }
    }
  }, [wakeLock, releaseWakeLock])
  
  return {
    isSupported,
    isActive: !!wakeLock,
    requestWakeLock,
    releaseWakeLock
  }
}

// Device Orientation
export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<{
    angle: number
    type: string
  }>({
    angle: 0,
    type: 'portrait-primary'
  })
  
  useEffect(() => {
    const updateOrientation = () => {
      if ('screen' in window && 'orientation' in window.screen) {
        setOrientation({
          angle: window.screen.orientation.angle,
          type: window.screen.orientation.type
        })
      }
    }
    
    updateOrientation()
    
    if ('screen' in window && 'orientation' in window.screen) {
      window.screen.orientation.addEventListener('change', updateOrientation)
      
      return () => {
        window.screen.orientation.removeEventListener('change', updateOrientation)
      }
    }
  }, [])
  
  return orientation
}

// Fullscreen API
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  
  useEffect(() => {
    setIsSupported(
      'requestFullscreen' in document.documentElement ||
      'webkitRequestFullscreen' in document.documentElement ||
      'mozRequestFullScreen' in document.documentElement ||
      'msRequestFullscreen' in document.documentElement
    )
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])
  
  const enterFullscreen = useCallback(async () => {
    if (!isSupported) return false
    
    try {
      const element = document.documentElement
      
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      }
      
      return true
    } catch (error) {
      console.error('Fullscreen request failed:', error)
      return false
    }
  }, [isSupported])
  
  const exitFullscreen = useCallback(async () => {
    if (!isFullscreen) return
    
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen()
      }
    } catch (error) {
      console.error('Exit fullscreen failed:', error)
    }
  }, [isFullscreen])
  
  return {
    isSupported,
    isFullscreen,
    enterFullscreen,
    exitFullscreen
  }
}

// PWA Utilities
export const pwaUtils = {
  // Check if running as PWA
  isPWA: () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true
  },
  
  // Check if on mobile device
  isMobile: () => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  },
  
  // Get install source
  getInstallSource: () => {
    if (typeof window === 'undefined') return 'unknown'
    
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get('utm_source') || 'direct'
  },
  
  // Track PWA usage
  trackPWAEvent: (event: string, data?: any) => {
    console.log('PWA Event:', event, data)
    
    // Send to analytics if available
    if ('gtag' in window) {
      (window as any).gtag('event', event, {
        event_category: 'PWA',
        ...data
      })
    }
  }
}

export default {
  usePWAInstall,
  useOfflineDetection,
  registerServiceWorker,
  requestBackgroundSync,
  requestNotificationPermission,
  subscribeToPushNotifications,
  updateAppShortcuts,
  setAppBadge,
  clearAppBadge,
  shareContent,
  useWakeLock,
  useDeviceOrientation,
  useFullscreen,
  pwaUtils
}