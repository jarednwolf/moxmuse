'use client'

import { useState } from 'react'
import { Upload, Download, Database, CheckCircle, AlertCircle, Import, FileText, Globe } from 'lucide-react'
import Link from 'next/link'

export default function SolSyncPage() {
  const [importSource, setImportSource] = useState<'moxfield' | 'archidekt' | 'csv' | null>(null)

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl font-light mb-4">SolSync</h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Import your collection from Moxfield, Archidekt, or CSV in seconds. Track ownership, 
            conditions, and languages across all your cards.
          </p>
        </div>

        {/* Import Options */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div 
            className={`bg-zinc-800/50 rounded-xl p-6 border transition-all cursor-pointer hover:scale-105 ${
              importSource === 'moxfield' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-zinc-700/50 hover:border-zinc-600'
            }`}
            onClick={() => setImportSource('moxfield')}
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="text-xl font-medium mb-3">Moxfield</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Import your entire collection from Moxfield with one click. Preserves all metadata including conditions and languages.
            </p>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Full metadata support</span>
            </div>
          </div>

          <div 
            className={`bg-zinc-800/50 rounded-xl p-6 border transition-all cursor-pointer hover:scale-105 ${
              importSource === 'archidekt' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-zinc-700/50 hover:border-zinc-600'
            }`}
            onClick={() => setImportSource('archidekt')}
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-medium mb-3">Archidekt</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Seamlessly import from Archidekt. Automatically maps card data and preserves your organization.
            </p>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Auto-mapping included</span>
            </div>
          </div>

          <div 
            className={`bg-zinc-800/50 rounded-xl p-6 border transition-all cursor-pointer hover:scale-105 ${
              importSource === 'csv' 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-zinc-700/50 hover:border-zinc-600'
            }`}
            onClick={() => setImportSource('csv')}
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-medium mb-3">CSV Upload</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Upload a CSV file with your collection. Supports custom formats and bulk imports from any source.
            </p>
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>Flexible format support</span>
            </div>
          </div>
        </div>

        {/* Coming Soon Message */}
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Import className="w-12 h-12 text-blue-400" />
            </div>
            <h2 className="text-2xl font-medium mb-4">SolSync Coming Soon</h2>
            <p className="text-zinc-400 mb-8">
              The collection import system is currently in development. We're building the most comprehensive 
              import tool for Magic: The Gathering collections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/tutor"
                className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                Try TolarianTutor
              </Link>
              <Link
                href="/decks"
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg font-medium transition-colors"
              >
                Browse Decks
              </Link>
            </div>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-medium mb-3">One-Click Import</h3>
            <p className="text-zinc-400 text-sm">
              Connect your Moxfield or Archidekt account and import your entire collection instantly.
            </p>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-medium mb-3">Automatic Deduplication</h3>
            <p className="text-zinc-400 text-sm">
              Smart detection of duplicate cards across different sources and formats.
            </p>
          </div>
          
          <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-medium mb-3">Real-Time Value Tracking</h3>
            <p className="text-zinc-400 text-sm">
              Track your collection's value with real-time price updates from multiple sources.
            </p>
          </div>
        </div>

        {/* Supported Formats */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-medium mb-6">Supported Import Formats</h3>
          <div className="flex flex-wrap justify-center gap-4">
            {['Moxfield', 'Archidekt', 'TappedOut', 'EDHREC', 'MTGGoldfish', 'CSV', 'Text Lists'].map((format) => (
              <div key={format} className="px-4 py-2 bg-zinc-800 rounded-lg border border-zinc-700">
                <span className="text-sm text-zinc-300">{format}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}