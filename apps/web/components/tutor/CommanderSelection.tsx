'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Star, DollarSign, Crown, Zap } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import type { ConsultationData } from '@moxmuse/shared'

interface CommanderSelectionProps {
  consultationData: ConsultationData
  onCommanderSelect: (commanderId: string, commanderName: string) => void
  onBack: () => void
}

interface CommanderSuggestion {
  cardId: string
  name: string
  imageUrl?: string
  manaCost?: string
  colorIdentity?: string[]
  typeLine?: string
  oracleText?: string
  price?: string
  reason: string
  confidence: number
}

/**
 * Commander Selection Component
 * 
 * Provides AI-powered commander suggestions based on consultation data,
 * with search functionality and detailed commander information display.
 * Integrates with the new modular AI services for intelligent recommendations.
 */
export default function CommanderSelection({
  consultationData,
  onCommanderSelect,
  onBack
}: CommanderSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommander, setSelectedCommander] = useState<CommanderSuggestion | null>(null)
  const [suggestions, setSuggestions] = useState<CommanderSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true)

  // Get AI-powered commander suggestions
  const commanderSuggestionsMutation = trpc.tutor.recommendAndLink.useMutation({
    onSuccess: (data: any) => {
      console.log('Commander suggestions received:', data)
      setSuggestions(data.map((suggestion: any) => ({
        cardId: suggestion.cardId,
        name: suggestion.cardData?.name || 'Unknown Commander',
        imageUrl: suggestion.cardData?.image_uris?.normal || suggestion.cardData?.image_uris?.large,
        manaCost: suggestion.cardData?.mana_cost,
        colorIdentity: suggestion.cardData?.color_identity,
        typeLine: suggestion.cardData?.type_line,
        oracleText: suggestion.cardData?.oracle_text,
        price: suggestion.cardData?.prices?.usd,
        reason: suggestion.reason,
        confidence: suggestion.confidence
      })))
      setIsLoadingSuggestions(false)
    },
    onError: (error: any) => {
      console.error('Failed to get commander suggestions:', error)
      setIsLoadingSuggestions(false)
    }
  })

  // Search for commanders
  const commanderSearchMutation = trpc.tutor.recommendAndLink.useMutation({
    onSuccess: (data: any) => {
      console.log('Commander search results:', data)
      const searchResults = data.map((result: any) => ({
        cardId: result.cardId,
        name: result.cardData?.name || 'Unknown Commander',
        imageUrl: result.cardData?.image_uris?.normal || result.cardData?.image_uris?.large,
        manaCost: result.cardData?.mana_cost,
        colorIdentity: result.cardData?.color_identity,
        typeLine: result.cardData?.type_line,
        oracleText: result.cardData?.oracle_text,
        price: result.cardData?.prices?.usd,
        reason: result.reason,
        confidence: result.confidence
      }))
      setSuggestions(searchResults)
    },
    onError: (error: any) => {
      console.error('Commander search failed:', error)
    }
  })

  // Load initial AI suggestions on mount
  useEffect(() => {
    const prompt = buildCommanderPrompt(consultationData)
    commanderSuggestionsMutation.mutate({
      sessionId: 'commander-selection',
      prompt
    })
  }, [consultationData])

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) return

    const searchPrompt = `Find legendary creatures that can be commanders matching: ${searchQuery}`
    commanderSearchMutation.mutate({
      sessionId: 'commander-search',
      prompt: searchPrompt
    })
  }

  // Handle commander selection
  const handleCommanderSelect = (commander: CommanderSuggestion) => {
    setSelectedCommander(commander)
  }

  // Confirm commander selection
  const handleConfirmSelection = () => {
    if (selectedCommander) {
      onCommanderSelect(selectedCommander.cardId, selectedCommander.name)
    }
  }

  // Build commander prompt from consultation data
  function buildCommanderPrompt(data: ConsultationData): string {
    let prompt = 'Suggest legendary creatures that can be commanders for a deck with these preferences:\n'
    
    if (data.themes?.length) {
      prompt += `- Themes: ${data.themes.join(', ')}\n`
    }
    
    if (data.specificColors?.length) {
      prompt += `- Colors: ${data.specificColors.join(', ')}\n`
    }
    
    if (data.winConditions?.primary) {
      prompt += `- Win condition: ${data.winConditions.primary}\n`
    }
    
    if (data.powerLevel) {
      prompt += `- Power level: Bracket ${data.powerLevel}\n`
    }
    
    if (data.budget) {
      prompt += `- Budget: $${data.budget}\n`
    }
    
    if (data.complexityLevel) {
      prompt += `- Complexity: ${data.complexityLevel}\n`
    }

    if (data.petCards?.length) {
      prompt += `- Include synergy with: ${data.petCards.join(', ')}\n`
    }

    if (data.avoidStrategies?.length) {
      prompt += `- Avoid: ${data.avoidStrategies.join(', ')}\n`
    }

    return prompt
  }

  // Get color identity display
  const getColorIdentityDisplay = (colors?: string[]) => {
    if (!colors || colors.length === 0) return 'Colorless'
    const colorMap: Record<string, string> = {
      W: 'White',
      U: 'Blue', 
      B: 'Black',
      R: 'Red',
      G: 'Green'
    }
    return colors.map(c => colorMap[c] || c).join(', ')
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-green-100 text-green-800'
    if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Choose Your Commander</h2>
          <p className="text-gray-600 mt-1">
            Select a legendary creature to lead your deck based on your preferences
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to Consultation
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search for Commanders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search for specific commanders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button 
              onClick={handleSearch}
              disabled={!searchQuery.trim() || commanderSearchMutation.isLoading}
            >
              {commanderSearchMutation.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commander List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            AI Recommendations
          </h3>
          
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Finding perfect commanders...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No commanders found. Try adjusting your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {suggestions.map((commander) => (
                <Card 
                  key={commander.cardId}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedCommander?.cardId === commander.cardId 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : ''
                  }`}
                  onClick={() => handleCommanderSelect(commander)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {commander.imageUrl && (
                        <img
                          src={commander.imageUrl}
                          alt={commander.name}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">
                            {commander.name}
                          </h4>
                          <Badge className={getConfidenceColor(commander.confidence)}>
                            {Math.round(commander.confidence * 100)}% match
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>{getColorIdentityDisplay(commander.colorIdentity)}</span>
                          {commander.price && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${commander.price}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                          {commander.reason}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Commander Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Commander Details
          </h3>
          
          {selectedCommander ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {selectedCommander.imageUrl && (
                    <div className="flex justify-center">
                      <img
                        src={selectedCommander.imageUrl}
                        alt={selectedCommander.name}
                        className="w-48 h-auto rounded-lg shadow-lg"
                      />
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h4 className="text-xl font-bold text-gray-900">
                      {selectedCommander.name}
                    </h4>
                    <p className="text-gray-600 mt-1">
                      {selectedCommander.typeLine}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Colors:</span>
                      <p className="text-gray-600">
                        {getColorIdentityDisplay(selectedCommander.colorIdentity)}
                      </p>
                    </div>
                    {selectedCommander.price && (
                      <div>
                        <span className="font-medium text-gray-700">Price:</span>
                        <p className="text-gray-600">${selectedCommander.price}</p>
                      </div>
                    )}
                    {selectedCommander.manaCost && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700">Mana Cost:</span>
                        <p className="text-gray-600">{selectedCommander.manaCost}</p>
                      </div>
                    )}
                  </div>

                  {selectedCommander.oracleText && (
                    <div>
                      <span className="font-medium text-gray-700">Abilities:</span>
                      <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                        {selectedCommander.oracleText}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="font-medium text-gray-700">Why this commander:</span>
                    <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                      {selectedCommander.reason}
                    </p>
                  </div>

                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleConfirmSelection}
                      className="w-full"
                      size="lg"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Choose {selectedCommander.name} as Commander
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Crown className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Select a commander from the recommendations to see details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}