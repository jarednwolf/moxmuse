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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ToastProvider>
            <DeckProvider>
              <div className="min-h-screen bg-zinc-900 text-zinc-100">
                <Header />
                {children}
              </div>
              <Toaster />
              {/*  */}
            </DeckProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
