'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Download, 
  Share2,
  Menu,
  X,
  Settings,
  HelpCircle
} from 'lucide-react'
import { MobileConsultationWizard, ConsultationMode, ConsultationData } from '../../../components/tutor/MobileConsultationWizard'
import { MobileStatistics } from '../../../components/tutor/MobileStatistics'
import { MobileCardManager } from '../../../components/tutor/MobileCardManager'
import { 
  MobileButton, 
  MobileCard, 
  MobileNav, 
  MobileSheet,
  MobileTabs
} from '../../../components/ui/mobile-optimized'
import { LoadingSpinner } from '../../../components/ui/loading-states'
import { ErrorBoundary } from '../../../components/error-boundaries/ErrorBoundary'
import { 
  usePWAInstall, 
  useOfflineDetection, 
  shareContent,
  pwaUtils 
} from '../../../lib/mobile/pwa'
import { mobileUtils, preloadCriticalResources } from '../../../lib/mobile/performance'
import { AccessibleHeading, LiveRegion } from '../../../components/ui/accessibility'

// Mock data for demonstration
const mockCards = [
  {
    id: '1',
    name: 'Sol Ring',
    manaCost: '{1}',
    cmc: 1,
    types: ['Artifact'],
    colors: [],
    price: 1.50,
    category: 'ramp' as const,
    isFavorite: true
  },
  {
    id: '2',
    name: 'Lightning Bolt',
    manaCost: '{R}',
    cmc: 1,
    types: ['Instant'],
    colors: ['R'],
    price: 0.25,
    category: 'removal' as const
  },
  {
    id: '3',
    name: 'Counterspell',
    manaCost: '{U}{U}',
    cmc: 2,
    types: ['Instant'],
    colors: ['U'],
    price: 0.50,
    category: 'removal' as const
  }
]

export default function MobileTutorPage() {
  const router = useRouter()
  const [currentMode, setCurrentMode] = useState<ConsultationMode>('welcome')
  const [consultationData, setConsultationData] = useState<ConsultationData>({})
  const [activeTab, setActiveTab] = useState('wizard')
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedDeck, setGeneratedDeck] = useState(mockCards)
  
  // PWA and mobile features
  const { isInstallable, isInstalled, install } = usePWAInstall()
  const { isOnline, isOffline } = useOfflineDetection()
  
  // Initialize mobile optimizations
  useEffect(() => {
    // Preload critical resources
    preloadCriticalResources()
    
    // Set up mobile viewport
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
      )
    }
    
    // Add mobile-specific classes
    document.documentElement.classList.add('mobile-optimized')
    
    // Track PWA usage
    if (pwaUtils.isPWA()) {
      pwaUtils.trackPWAEvent('pwa_tutor_opened')
    }
    
    return () => {
      document.documentElement.classList.remove('mobile-optimized')
    }
  }, [])
  
  const handleDataChange = (data: Partial<ConsultationData>) => {
    setConsultationData(prev => ({ ...prev, ...data }))
  }
  
  const handleComplete = async () => {
    setIsGenerating(true)
    
    try {
      // Simulate deck generation
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Navigate to results
      setActiveTab('deck')
      setCurrentMode('summary')
      
      // Haptic feedback
      mobileUtils.vibrate([100, 50, 100])
      
      pwaUtils.trackPWAEvent('deck_generated', {
        commander: consultationData.commander,
        theme: consultationData.theme,
        budget: consultationData.budget
      })
    } catch (error) {
      console.error('Deck generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }
  
  const handleShare = async () => {
    const shareData = {
      title: 'My Commander Deck',
      text: `Check out my ${consultationData.commander || 'Commander'} deck built with MoxMuse!`,
      url: window.location.href
    }
    
    const shared = await shareContent(shareData)
    if (shared) {
      pwaUtils.trackPWAEvent('deck_shared')
    }
  }
  
  const handleInstallPWA = async () => {
    const installed = await install()
    if (installed) {
      pwaUtils.trackPWAEvent('pwa_installed', { source: 'tutor_page' })
    }
  }
  
  const navigationItems = [
    {
      id: 'wizard',
      label: 'Wizard',
      icon: <Smartphone className="w-5 h-5" />,
      onClick: () => setActiveTab('wizard')
    },
    {
      id: 'deck',
      label: 'Deck',
      icon: <div className="w-5 h-5 text-center">🃏</div>,
      onClick: () => setActiveTab('deck'),
      badge: generatedDeck.length > 0 ? generatedDeck.length.toString() : undefined
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: <div className="w-5 h-5 text-center">📊</div>,
      onClick: () => setActiveTab('stats')
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: <Menu className="w-5 h-5" />,
      onClick: () => setShowMenu(true)
    }
  ]
  
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
        <div className="text-center space-y-6">
          <div className="text-8xl animate-bounce">🧙‍♂️</div>
          <AccessibleHeading level={2} className="text-2xl font-bold text-white">
            Generating Your Deck
          </AccessibleHeading>
          <p className="text-zinc-400 max-w-md">
            Our AI is carefully selecting the perfect cards for your {consultationData.theme || 'strategy'}...
          </p>
          <LoadingSpinner size="lg" />
          <div className="w-full max-w-xs bg-zinc-800 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
        
        <LiveRegion>
          Generating deck with AI assistance...
        </LiveRegion>
      </div>
    )
  }
  
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-zinc-900 overflow-hidden">
        {/* Status bar for offline/online */}
        {isOffline && (
          <div className="bg-yellow-600 text-white text-center py-2 text-sm">
            <WifiOff className="w-4 h-4 inline mr-2" />
            You're offline - some features may be limited
          </div>
        )}
        
        {/* PWA install prompt */}
        {isInstallable && !isInstalled && (
          <div className="bg-blue-600 text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="text-sm">Install MoxMuse for the best experience</span>
            </div>
            <MobileButton
              variant="ghost"
              onClick={handleInstallPWA}
              className="text-white border-white"
            >
              Install
            </MobileButton>
          </div>
        )}
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'wizard' && (
            <Suspense fallback={<LoadingSpinner />}>
              <MobileConsultationWizard
                mode={currentMode}
                consultationData={consultationData}
                onModeChange={setCurrentMode}
                onDataChange={handleDataChange}
                onComplete={handleComplete}
                isFirstTime={!consultationData.commander && !consultationData.theme}
              />
            </Suspense>
          )}
          
          {activeTab === 'deck' && (
            <div className="h-full">
              <MobileCardManager
                cards={generatedDeck}
                onCardUpdate={(cardId, updates) => {
                  setGeneratedDeck(prev => 
                    prev.map(card => 
                      card.id === cardId ? { ...card, ...updates } : card
                    )
                  )
                }}
                onCardRemove={(cardId) => {
                  setGeneratedDeck(prev => prev.filter(card => card.id !== cardId))
                }}
                onCardAdd={(card) => {
                  setGeneratedDeck(prev => [...prev, card])
                }}
                onRefresh={async () => {
                  // Simulate refresh
                  await new Promise(resolve => setTimeout(resolve, 1000))
                }}
                viewMode="list"
              />
            </div>
          )}
          
          {activeTab === 'stats' && (
            <div className="h-full overflow-auto p-4">
              <MobileStatistics cards={generatedDeck} />
            </div>
          )}
        </div>
        
        {/* Bottom navigation */}
        <MobileNav
          items={navigationItems}
          activeItem={activeTab}
        />
        
        {/* Menu sheet */}
        <MobileSheet
          isOpen={showMenu}
          onClose={() => setShowMenu(false)}
          title="Menu"
          position="bottom"
          size="md"
        >
          <div className="p-4 space-y-4">
            <MobileCard
              interactive
              onClick={() => {
                setShowSettings(true)
                setShowMenu(false)
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-100">Settings</span>
              </div>
            </MobileCard>
            
            <MobileCard
              interactive
              onClick={handleShare}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Share2 className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-100">Share Deck</span>
              </div>
            </MobileCard>
            
            <MobileCard
              interactive
              onClick={() => router.push('/help')}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-zinc-400" />
                <span className="text-zinc-100">Help & Support</span>
              </div>
            </MobileCard>
            
            {isOnline && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Wifi className="w-4 h-4" />
                <span>Connected</span>
              </div>
            )}
          </div>
        </MobileSheet>
        
        {/* Settings sheet */}
        <MobileSheet
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          title="Settings"
          position="bottom"
          size="lg"
        >
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-3">Display</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Dark Mode</span>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Reduce Motion</span>
                  <div className="w-12 h-6 bg-zinc-600 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5" />
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-3">Notifications</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">Deck Updates</span>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300">New Features</span>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative">
                    <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5" />
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-3">About</h3>
              <div className="text-sm text-zinc-400 space-y-1">
                <p>MoxMuse v1.0.0</p>
                <p>PWA: {pwaUtils.isPWA() ? 'Yes' : 'No'}</p>
                <p>Mobile: {mobileUtils.isMobile() ? 'Yes' : 'No'}</p>
                <p>Online: {isOnline ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </MobileSheet>
        
        <LiveRegion>
          {isOffline && 'Application is offline'}
          {isGenerating && 'Generating deck...'}
        </LiveRegion>
      </div>
    </ErrorBoundary>
  )
}