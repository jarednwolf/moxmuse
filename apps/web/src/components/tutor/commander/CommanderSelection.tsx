'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { CommanderRecommendation, ConsultationData } from '@moxmuse/shared'
import { trpc } from '@/lib/trpc/client'
import { CommanderGrid } from './CommanderGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { LoadingState } from '@/components/ui/loading-state'
import { RetryHandler } from '@/components/ui/retry-handler'
import { useErrorToast, useSuccessToast } from '@/components/ui/toaster'

interface CommanderSelectionProps {
  consultationData: ConsultationData
  onCommanderSelect: (commander: string, colorIdentity?: string[]) => void
  sessionId: string
}

export const CommanderSelection: React.FC<CommanderSelectionProps> = ({
  consultationData,
  onCommanderSelect,
  sessionId
}) => {
  const [commanders, setCommanders] = useState<CommanderRecommendation[]>([])
  const [selectedCommanderId, setSelectedCommanderId] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualCommanderName, setManualCommanderName] = useState('')
  const [manualCommanderError, setManualCommanderError] = useState('')
  const [excludedCommanders, setExcludedCommanders] = useState<string[]>([])

  const errorToast = useErrorToast()
  const successToast = useSuccessToast()

  // tRPC mutations
  const getCommanderSuggestions = trpc.tutor.getCommanderSuggestions.useMutation({
    onSuccess: (data) => {
      console.log('🎯 Commander suggestions received:', data)
      console.log('🎯 Data length:', data.length)
      console.log('🎯 Data type:', typeof data)
      console.log('🎯 Is array:', Array.isArray(data))
      if (data.length > 0) {
        console.log('🎯 First commander:', data[0])
        console.log('🎯 First commander keys:', Object.keys(data[0]))
      }
      
      setCommanders(data as CommanderRecommendation[])
      setIsLoading(false)
      
      console.log('🎯 State updated, commanders length:', data.length)
      
      if (data.length === 0) {
        errorToast(
          'No Commanders Found',
          'No commanders match your criteria. Try adjusting your preferences.',
          {
            label: 'Try Again',
            onClick: () => loadCommanderSuggestions()
          }
        )
      } else {
        successToast(
          'Commanders Loaded',
          `Found ${data.length} commander recommendations for you`
        )
      }
    },
    onError: (error) => {
      console.error('Failed to get commander suggestions:', error)
      setIsLoading(false)
      
      errorToast(
        'Failed to Load Commanders',
        'Unable to get commander suggestions. Please try again.',
        {
          label: 'Retry',
          onClick: () => loadCommanderSuggestions()
        }
      )
    }
  })

  // Generate prompt based on consultation data
  const generatePrompt = useCallback(() => {
    const parts = []
    
    if (consultationData.strategy) {
      parts.push(`I want to build a ${consultationData.strategy} deck`)
    }
    
    if (consultationData.themes && consultationData.themes.length > 0) {
      parts.push(`with themes: ${consultationData.themes.join(', ')}`)
    }
    
    if (consultationData.customTheme) {
      parts.push(`focusing on ${consultationData.customTheme}`)
    }
    
    if (consultationData.colorPreferences && consultationData.colorPreferences.length > 0) {
      parts.push(`in ${consultationData.colorPreferences.join('/')} colors`)
    }
    
    if (consultationData.winConditions?.primary) {
      parts.push(`that wins through ${consultationData.winConditions.primary}`)
    }
    
    if (consultationData.powerLevel) {
      const powerLevels: Record<number, string> = {
        1: 'casual/precon level',
        2: 'focused/upgraded level', 
        3: 'optimized/competitive level',
        4: 'high-power/cEDH level'
      }
      parts.push(`at ${powerLevels[consultationData.powerLevel]} power`)
    }
    
    if (consultationData.budget) {
      parts.push(`with a budget around $${consultationData.budget}`)
    }

    return parts.length > 0 
      ? parts.join(' ')
      : 'I need commander suggestions for a new deck'
  }, [consultationData])

  // Load initial commander suggestions
  const loadCommanderSuggestions = useCallback(() => {
    setIsLoading(true)
    
    const prompt = generatePrompt()
    const constraints = {
      budget: consultationData.budget,
      powerLevel: consultationData.powerLevel,
      ownedOnly: consultationData.useCollection,
    }

    getCommanderSuggestions.mutate({
      sessionId,
      prompt,
      constraints
    })
  }, [sessionId, consultationData, generatePrompt, getCommanderSuggestions, excludedCommanders])

  // Load suggestions on mount
  useEffect(() => {
    loadCommanderSuggestions()
  }, [loadCommanderSuggestions])

  // Handle commander selection from grid
  const handleCommanderSelect = useCallback((commander: CommanderRecommendation) => {
    try {
      setSelectedCommanderId(commander.cardId)
      successToast('Commander Selected', `${commander.name} has been selected as your commander`)
      onCommanderSelect(commander.name, commander.colorIdentity)
    } catch (error) {
      console.error('Error selecting commander:', error)
      errorToast('Selection Failed', 'Failed to select commander. Please try again.')
    }
  }, [onCommanderSelect, successToast, errorToast])

  // Handle manual commander entry
  const handleManualCommanderSubmit = useCallback(() => {
    try {
      if (!manualCommanderName.trim()) {
        setManualCommanderError('Please enter a commander name')
        return
      }

      // Basic validation - check if it looks like a card name
      if (manualCommanderName.trim().length < 3) {
        setManualCommanderError('Commander name seems too short')
        return
      }

      // Additional validation for common issues
      const name = manualCommanderName.trim()
      if (!/^[a-zA-Z\s',.-]+$/.test(name)) {
        setManualCommanderError('Commander name contains invalid characters')
        return
      }

      setManualCommanderError('')
      successToast('Commander Entered', `${name} has been set as your commander`)
      onCommanderSelect(name)
    } catch (error) {
      console.error('Error with manual commander entry:', error)
      setManualCommanderError('Failed to set commander. Please try again.')
    }
  }, [manualCommanderName, onCommanderSelect, successToast])

  // Request more options (exclude current commanders)
  const handleRequestMoreOptions = useCallback(() => {
    const currentCommanderIds = commanders.map(c => c.cardId)
    setExcludedCommanders(prev => [...prev, ...currentCommanderIds])
    loadCommanderSuggestions()
  }, [commanders, loadCommanderSuggestions])

  return (
    <ErrorBoundary context="Commander Selection">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">
            Choose Your Commander
          </h2>
          <p className="text-zinc-400">
            Based on your preferences, here are some great commander options
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <LoadingState
            message="Finding Commanders..."
          />
        )}

        {/* Error State with Retry */}
        {getCommanderSuggestions.error && !isLoading && (
          <RetryHandler
            error={new Error(getCommanderSuggestions.error.message)}
            onRetry={loadCommanderSuggestions}
            config={{
              maxAttempts: 3,
              baseDelay: 1500,
              retryCondition: (error) => {
                // Retry on network errors and AI service issues
                return (
                  error.message.includes('Network Error') ||
                  error.message.includes('timeout') ||
                  error.message.includes('fetch') ||
                  error.message.includes('AI service')
                )
              }
            }}
          />
        )}

        {/* Commander Grid */}
        {!isLoading && !getCommanderSuggestions.error && (
          <CommanderGrid
            commanders={commanders}
            onSelect={handleCommanderSelect}
            selectedCommanderId={selectedCommanderId}
            isLoading={isLoading}
          />
        )}
        


      {/* Action Buttons */}
      {!isLoading && commanders.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleRequestMoreOptions}
            disabled={getCommanderSuggestions.isLoading}
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
          >
            {getCommanderSuggestions.isLoading ? 'Loading...' : 'Request More Options'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
          >
            {showManualEntry ? 'Hide Manual Entry' : 'Enter Commander Manually'}
          </Button>
        </div>
      )}

      {/* Manual Commander Entry */}
      {showManualEntry && (
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100">
              Enter Commander Manually
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                placeholder="e.g., Atraxa, Praetors' Voice"
                value={manualCommanderName}
                onChange={(e) => {
                  setManualCommanderName(e.target.value)
                  setManualCommanderError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleManualCommanderSubmit()
                  }
                }}
                className="bg-zinc-700/50 border-zinc-600 text-zinc-100 placeholder-zinc-400"
              />
              {manualCommanderError && (
                <p className="text-red-400 text-sm mt-2">{manualCommanderError}</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleManualCommanderSubmit}
                disabled={!manualCommanderName.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Use This Commander
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowManualEntry(false)
                  setManualCommanderName('')
                  setManualCommanderError('')
                }}
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
              >
                Cancel
              </Button>
            </div>
            
            <div className="text-xs text-zinc-500">
              <p>Enter the full name of your commander as it appears on the card.</p>
              <p>Make sure the spelling is exact for best results.</p>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Selected Commander Display */}
        {selectedCommanderId && (
          <div className="text-center">
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              Commander Selected
            </Badge>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
