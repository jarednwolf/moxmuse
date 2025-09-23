import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster, ToastProvider } from '../src/components/ui/toaster'
import { Header } from '../src/components/header'
import { DeckProvider } from '../src/contexts/DeckContext'
// 
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MoxMuse - AI-Powered Commander Deck Assistant',
  description: 'Build better Commander decks with AI recommendations, collection tracking, and smart affiliate links',
  manifest: '/manifest.json',
  themeColor: '#3b82f6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MoxMuse'
  },
  formatDetection: {
    telephone: false
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'MoxMuse',
    'application-name': 'MoxMuse',
    'msapplication-TileColor': '#3b82f6'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        
        {/* Apple Splash Screens */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2048-2732.png" sizes="2048x2732" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1668-2224.png" sizes="1668x2224" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1536-2048.png" sizes="1536x2048" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1125-2436.png" sizes="1125x2436" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1242-2208.png" sizes="1242x2208" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-750-1334.png" sizes="750x1334" />
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-640-1136.png" sizes="640x1136" />
        
        {/* Preload Critical Resources */}
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="//cards.scryfall.io" />
        <link rel="dns-prefetch" href="//c1.scryfall.com" />
        
        {/* Preconnect */}
        <link rel="preconnect" href="https://cards.scryfall.io" />
        <link rel="preconnect" href="https://c1.scryfall.com" />
      </head>
      <body className={inter.className}>
        <Providers>
          <ToastProvider>
            <DeckProvider>
              <div className="min-h-screen bg-zinc-900 text-zinc-100">
                <Header />
                {children}
              </div>
              <Toaster />
            </DeckProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
