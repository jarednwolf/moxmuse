'use client'

import React, { useState } from 'react'
import { CardSearchQuery } from '@moxmuse/shared'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Card } from '../ui/card'

// Extended search query for the form
interface ExtendedSearchQuery extends Partial<CardSearchQuery> {
  // Additional UI-only fields
  cmcMin?: number
  cmcMax?: number
  powerMin?: string
  powerMax?: string
  toughnessMin?: string
  toughnessMax?: string
}

interface AdvancedSearchFormProps {
  initialQuery: CardSearchQuery
  onSearch: (query: Partial<CardSearchQuery>) => void
  onCancel: () => void
}

const COLORS = [
  { symbol: 'W', name: 'White', color: 'bg-yellow-100 text-yellow-800' },
  { symbol: 'U', name: 'Blue', color: 'bg-blue-100 text-blue-800' },
  { symbol: 'B', name: 'Black', color: 'bg-gray-100 text-gray-800' },
  { symbol: 'R', name: 'Red', color: 'bg-red-100 text-red-800' },
  { symbol: 'G', name: 'Green', color: 'bg-green-100 text-green-800' }
]

const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const

const FORMATS = [
  'commander', 'standard', 'modern', 'legacy', 'vintage', 'pauper', 'pioneer'
]

const CARD_TYPES = [
  'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker',
  'Land', 'Tribal', 'Battle'
]

const KEYWORDS = [
  'Flying', 'Trample', 'Haste', 'Vigilance', 'Deathtouch', 'Lifelink',
  'First Strike', 'Double Strike', 'Hexproof', 'Indestructible', 'Menace',
  'Flash', 'Defender', 'Reach'
]

export const AdvancedSearchForm: React.FC<AdvancedSearchFormProps> = ({
  initialQuery,
  onSearch,
  onCancel
}) => {
  const [formData, setFormData] = useState<ExtendedSearchQuery>({
    ...initialQuery
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Convert form data to CardSearchQuery format
    const searchQuery: Partial<CardSearchQuery> = {
      name: formData.name,
      text: formData.text,
      types: formData.types,
      colors: formData.colors,
      colorIdentity: formData.colorIdentity,
      cmc: formData.cmc,
      power: formData.power,
      toughness: formData.toughness,
      keywords: formData.keywords,
      set: formData.set,
      rarity: formData.rarity,
      format: formData.format,
      orderBy: formData.orderBy,
      direction: formData.direction,
    }
    
    // Remove undefined values
    Object.keys(searchQuery).forEach(key => {
      if (searchQuery[key as keyof CardSearchQuery] === undefined) {
        delete searchQuery[key as keyof CardSearchQuery]
      }
    })
    
    onSearch(searchQuery)
  }

  const handleReset = () => {
    setFormData({
      text: initialQuery.text
    })
  }

  const toggleColor = (color: string) => {
    const colors = formData.colors || []
    const newColors = colors.includes(color)
      ? colors.filter(c => c !== color)
      : [...colors, color]
    
    setFormData(prev => ({
      ...prev,
      colors: newColors.length > 0 ? newColors : undefined
    }))
  }

  const toggleColorIdentity = (color: string) => {
    const colorIdentity = formData.colorIdentity || []
    const newColorIdentity = colorIdentity.includes(color)
      ? colorIdentity.filter(c => c !== color)
      : [...colorIdentity, color]
    
    setFormData(prev => ({
      ...prev,
      colorIdentity: newColorIdentity.length > 0 ? newColorIdentity : undefined
    }))
  }

  const toggleRarity = (rarity: string) => {
    const rarities = formData.rarity || []
    const newRarities = rarities.includes(rarity)
      ? rarities.filter(r => r !== rarity)
      : [...rarities, rarity]
    
    setFormData(prev => ({
      ...prev,
      rarity: newRarities.length > 0 ? newRarities : undefined
    }))
  }

  const toggleKeyword = (keyword: string) => {
    const keywords = formData.keywords || []
    const newKeywords = keywords.includes(keyword)
      ? keywords.filter(k => k !== keyword)
      : [...keywords, keyword]
    
    setFormData(prev => ({
      ...prev,
      keywords: newKeywords.length > 0 ? newKeywords : undefined
    }))
  }

  const toggleType = (type: string) => {
    const types = formData.types || []
    const newTypes = types.includes(type)
      ? types.filter(t => t !== type)
      : [...types, type]
    
    setFormData(prev => ({
      ...prev,
      types: newTypes.length > 0 ? newTypes : undefined
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Text Searches */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Text Search</h3>
          
          <div>
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value || undefined }))}
              placeholder="Lightning Bolt"
            />
          </div>

          <div>
            <Label htmlFor="text">Oracle Text</Label>
            <Input
              id="text"
              value={formData.text || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value || undefined }))}
              placeholder="deals 3 damage"
            />
          </div>

          <div>
            <Label htmlFor="set">Set</Label>
            <Input
              id="set"
              value={formData.set || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, set: e.target.value || undefined }))}
              placeholder="Set code or name"
            />
          </div>
        </div>

        {/* Numeric Filters */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Numeric Filters</h3>
          
          <div>
            <Label htmlFor="cmc">Converted Mana Cost</Label>
            <Input
              id="cmc"
              type="number"
              min="0"
              max="20"
              value={formData.cmc || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                cmc: e.target.value ? parseInt(e.target.value) : undefined 
              }))}
              placeholder="Exact CMC"
            />
          </div>

          <div>
            <Label htmlFor="power">Power</Label>
            <Input
              id="power"
              value={formData.power || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, power: e.target.value || undefined }))}
              placeholder="e.g., 3 or *"
            />
          </div>

          <div>
            <Label htmlFor="toughness">Toughness</Label>
            <Input
              id="toughness"
              value={formData.toughness || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, toughness: e.target.value || undefined }))}
              placeholder="e.g., 3 or *"
            />
          </div>
        </div>
      </div>

      {/* Card Types */}
      <div>
        <Label>Card Types</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {CARD_TYPES.map((type) => (
            <Badge
              key={type}
              variant={formData.types?.includes(type) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleType(type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4">
        <div>
          <Label>Colors</Label>
          <div className="flex gap-2 mt-2">
            {COLORS.map((color) => (
              <Badge
                key={color.symbol}
                variant={formData.colors?.includes(color.symbol) ? "default" : "outline"}
                className={`cursor-pointer ${color.color}`}
                onClick={() => toggleColor(color.symbol)}
              >
                {color.symbol} {color.name}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>Color Identity</Label>
          <div className="flex gap-2 mt-2">
            {COLORS.map((color) => (
              <Badge
                key={`id-${color.symbol}`}
                variant={formData.colorIdentity?.includes(color.symbol) ? "default" : "outline"}
                className={`cursor-pointer ${color.color}`}
                onClick={() => toggleColorIdentity(color.symbol)}
              >
                {color.symbol} {color.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Rarities */}
      <div>
        <Label>Rarities</Label>
        <div className="flex gap-2 mt-2">
          {RARITIES.map((rarity) => (
            <Badge
              key={rarity}
              variant={formData.rarity?.includes(rarity) ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => toggleRarity(rarity)}
            >
              {rarity}
            </Badge>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <Label>Keywords</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {KEYWORDS.map((keyword) => (
            <Badge
              key={keyword}
              variant={formData.keywords?.includes(keyword) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleKeyword(keyword)}
            >
              {keyword}
            </Badge>
          ))}
        </div>
      </div>

      {/* Format */}
      <div>
        <Label htmlFor="format">Format Legality</Label>
        <select
          id="format"
          value={formData.format || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value || undefined }))}
          className="w-full p-2 border rounded-md mt-2"
        >
          <option value="">Any Format</option>
          {FORMATS.map((format) => (
            <option key={format} value={format}>
              {format.charAt(0).toUpperCase() + format.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Sorting */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="orderBy">Sort By</Label>
          <select
            id="orderBy"
            value={formData.orderBy || 'name'}
            onChange={(e) => setFormData(prev => ({ ...prev, orderBy: e.target.value }))}
            className="w-full p-2 border rounded-md"
          >
            <option value="name">Name</option>
            <option value="cmc">Mana Cost</option>
            <option value="power">Power</option>
            <option value="toughness">Toughness</option>
            <option value="set">Set</option>
            <option value="rarity">Rarity</option>
          </select>
        </div>

        <div>
          <Label htmlFor="direction">Sort Order</Label>
          <select
            id="direction"
            value={formData.direction || 'asc'}
            onChange={(e) => setFormData(prev => ({ ...prev, direction: e.target.value as 'asc' | 'desc' }))}
            className="w-full p-2 border rounded-md"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <Button type="submit">
          Search
        </Button>
      </div>
    </form>
  )
}
