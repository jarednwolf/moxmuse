/**
 * Platform Adapters Test Suite
 * 
 * Comprehensive tests for all platform adapters and registry functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  AdapterRegistry,
  MoxfieldAdapter,
  ArchidektAdapter,
  TappedOutAdapter,
  EDHRECAdapter,
  MTGGoldfishAdapter,
  CSVAdapter,
  TextAdapter,
  CustomFormatBuilder,
  CustomFormatFactory,
  initializeAdapters,
  findAdapterForInput
} from '../index'

describe('Platform Adapters', () => {
  let registry: AdapterRegistry

  beforeEach(() => {
    registry = new AdapterRegistry()
  })

  afterEach(() => {
    registry.clear()
  })

  describe('AdapterRegistry', () => {
    it('should register and retrieve adapters', () => {
      const adapter = new MoxfieldAdapter()
      registry.register(adapter)

      expect(registry.getAdapter('moxfield')).toBe(adapter)
      expect(registry.getAllAdapters()).toHaveLength(1)
    })

    it('should prevent duplicate adapter registration', () => {
      const adapter1 = new MoxfieldAdapter()
      const adapter2 = new MoxfieldAdapter()

      registry.register(adapter1)
      expect(() => registry.register(adapter2)).toThrow()
    })

    it('should unregister adapters', () => {
      const adapter = new MoxfieldAdapter()
      registry.register(adapter)

      registry.unregister('moxfield')
      expect(registry.getAdapter('moxfield')).toBeNull()
    })

    it('should get supported formats', () => {
      registry.register(new MoxfieldAdapter())
      registry.register(new CSVAdapter())

      const formats = registry.getSupportedFormats()
      expect(formats).toContain('moxfield')
      expect(formats).toContain('csv')
    })

    it('should filter adapters by capability', () => {
      registry.register(new MoxfieldAdapter())
      registry.register(new CSVAdapter())

      const importAdapters = registry.getImportAdapters()
      const exportAdapters = registry.getExportAdapters()

      expect(importAdapters.length).toBeGreaterThan(0)
      expect(exportAdapters.length).toBeGreaterThan(0)
    })
  })

  describe('MoxfieldAdapter', () => {
    let adapter: MoxfieldAdapter

    beforeEach(() => {
      adapter = new MoxfieldAdapter()
    })

    it('should identify Moxfield URLs', async () => {
      const url = 'https://www.moxfield.com/decks/abc123'
      expect(await adapter.canHandle(url)).toBe(true)
    })

    it('should identify Moxfield JSON format', async () => {
      const json = JSON.stringify({
        id: 'test-deck',
        name: 'Test Deck',
        format: 'commander',
        mainboard: [],
        commanders: [],
        sideboard: [],
        maybeboard: [],
        createdByUser: { userName: 'testuser' },
        createdAtUtc: new Date().toISOString(),
        lastUpdatedAtUtc: new Date().toISOString()
      })

      expect(await adapter.canHandle(json)).toBe(true)
    })

    it('should reject invalid formats', async () => {
      expect(await adapter.canHandle('invalid content')).toBe(false)
      expect(await adapter.canHandle('{"invalid": "json"}')).toBe(false)
    })

    it('should export deck to Moxfield format', async () => {
      const deck = {
        name: 'Test Deck',
        format: 'commander',
        cards: [
          { name: 'Lightning Bolt', quantity: 4 },
          { name: 'Mountain', quantity: 20 }
        ],
        metadata: { source: 'test' }
      }

      const result = await adapter.exportDeck(deck, 'moxfield')
      expect(result.success).toBe(true)
      expect(result.mimeType).toBe('application/json')
      
      const exported = JSON.parse(result.data as string)
      expect(exported.name).toBe('Test Deck')
      expect(exported.format).toBe('commander')
    })
  })

  describe('CSVAdapter', () => {
    let adapter: CSVAdapter

    beforeEach(() => {
      adapter = new CSVAdapter()
    })

    it('should identify CSV content', async () => {
      const csv = 'Name,Quantity\nLightning Bolt,4\nMountain,20'
      expect(await adapter.canHandle(csv)).toBe(true)
    })

    it('should parse CSV with headers', async () => {
      const csv = 'Name,Quantity,Set\nLightning Bolt,4,M21\nMountain,20,M21'
      const result = await adapter.parseDecks(csv)

      expect(result.success).toBe(true)
      expect(result.decks).toHaveLength(1)
      expect(result.decks[0].cards).toHaveLength(2)
      expect(result.decks[0].cards[0].name).toBe('Lightning Bolt')
      expect(result.decks[0].cards[0].quantity).toBe(4)
    })

    it('should export deck to CSV format', async () => {
      const deck = {
        name: 'Test Deck',
        format: 'commander',
        cards: [
          { name: 'Lightning Bolt', quantity: 4, set: 'M21' },
          { name: 'Mountain', quantity: 20 }
        ],
        metadata: { source: 'test' }
      }

      const result = await adapter.exportDeck(deck, 'csv')
      expect(result.success).toBe(true)
      expect(result.mimeType).toBe('text/csv')
      expect(result.data).toContain('Lightning Bolt')
      expect(result.data).toContain('Mountain')
    })
  })

  describe('TextAdapter', () => {
    let adapter: TextAdapter

    beforeEach(() => {
      adapter = new TextAdapter()
    })

    it('should identify text deck format', async () => {
      const text = `4 Lightning Bolt
20 Mountain
1 Goblin Guide`
      expect(await adapter.canHandle(text)).toBe(true)
    })

    it('should parse text deck format', async () => {
      const text = `Name: Test Deck
Format: commander

// Main Deck
4 Lightning Bolt
20 Mountain
1 Goblin Guide`

      const result = await adapter.parseDecks(text)
      expect(result.success).toBe(true)
      expect(result.decks[0].name).toBe('Test Deck')
      expect(result.decks[0].format).toBe('commander')
      expect(result.decks[0].cards).toHaveLength(3)
    })

    it('should handle different quantity formats', async () => {
      const text = `4x Lightning Bolt
20 Mountain
1x Goblin Guide`

      const result = await adapter.parseDecks(text)
      expect(result.success).toBe(true)
      expect(result.decks[0].cards[0].quantity).toBe(4)
      expect(result.decks[0].cards[1].quantity).toBe(20)
      expect(result.decks[0].cards[2].quantity).toBe(1)
    })
  })

  describe('CustomFormatBuilder', () => {
    it('should create custom format definition', () => {
      const definition = CustomFormatFactory.createFormatBuilder()
        .setId('test-format')
        .setName('Test Format')
        .setFileExtension('test')
        .setMimeType('text/plain')
        .setTemplate('{{name}}\n{{cards}}')
        .addVariable({
          name: 'name',
          type: 'string',
          description: 'Deck name',
          required: true
        })
        .addVariable({
          name: 'cards',
          type: 'string',
          description: 'Card list',
          required: true
        })
        .build()

      expect(definition.id).toBe('test-format')
      expect(definition.name).toBe('Test Format')
      expect(definition.variables).toHaveLength(2)
    })

    it('should register and create custom adapters', () => {
      const definition = CustomFormatFactory.createFormatBuilder()
        .setId('test-format')
        .setName('Test Format')
        .setFileExtension('test')
        .setMimeType('text/plain')
        .setTemplate('{{name}}\n{{cards}}')
        .build()

      CustomFormatFactory.registerFormat(definition)
      const adapter = CustomFormatFactory.createAdapter('test-format')

      expect(adapter).toBeInstanceOf(CustomFormatBuilder)
    })
  })

  describe('Integration Tests', () => {
    beforeEach(() => {
      initializeAdapters()
    })

    it('should find appropriate adapter for Moxfield URL', async () => {
      const url = 'https://www.moxfield.com/decks/abc123'
      const adapter = await findAdapterForInput(url)

      expect(adapter).toBeInstanceOf(MoxfieldAdapter)
    })

    it('should find appropriate adapter for CSV content', async () => {
      const csv = 'Name,Quantity\nLightning Bolt,4\nMountain,20'
      const adapter = await findAdapterForInput(csv)

      expect(adapter).toBeInstanceOf(CSVAdapter)
    })

    it('should find appropriate adapter for text content', async () => {
      const text = `4 Lightning Bolt
20 Mountain
1 Goblin Guide`
      const adapter = await findAdapterForInput(text)

      expect(adapter).toBeInstanceOf(TextAdapter)
    })

    it('should handle file inputs', async () => {
      const file = new File(['Name,Quantity\nLightning Bolt,4'], 'deck.csv', {
        type: 'text/csv'
      })
      const adapter = await findAdapterForInput(file)

      expect(adapter).toBeInstanceOf(CSVAdapter)
    })
  })

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const adapter = new MoxfieldAdapter()
      const result = await adapter.parseDecks('invalid json content')

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe('parsing_error')
    })

    it('should handle export errors gracefully', async () => {
      const adapter = new MoxfieldAdapter()
      const invalidDeck = null as any

      const result = await adapter.exportDeck(invalidDeck, 'moxfield')
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
    })

    it('should validate adapter registration', () => {
      const registry = new AdapterRegistry()
      const invalidAdapter = {
        id: '',
        name: 'Invalid',
        version: '1.0.0',
        supportedFormats: [],
        capabilities: {
          canImport: false,
          canExport: false,
          supportsMultipleDecks: false,
          supportsBulkOperations: false,
          supportsMetadata: false,
          supportsCategories: false,
          supportsCustomFields: false,
          requiresAuthentication: false
        }
      } as any

      expect(() => registry.register(invalidAdapter)).toThrow()
    })
  })

  describe('Performance Tests', () => {
    it('should handle large CSV files efficiently', async () => {
      const adapter = new CSVAdapter()
      
      // Generate large CSV content
      const lines = ['Name,Quantity']
      for (let i = 0; i < 1000; i++) {
        lines.push(`Card ${i},${Math.floor(Math.random() * 4) + 1}`)
      }
      const largeCsv = lines.join('\n')

      const startTime = Date.now()
      const result = await adapter.parseDecks(largeCsv)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.decks[0].cards).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle large text files efficiently', async () => {
      const adapter = new TextAdapter()
      
      // Generate large text content
      const lines = ['Name: Test Deck', 'Format: commander', '']
      for (let i = 0; i < 1000; i++) {
        lines.push(`${Math.floor(Math.random() * 4) + 1} Card ${i}`)
      }
      const largeText = lines.join('\n')

      const startTime = Date.now()
      const result = await adapter.parseDecks(largeText)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(result.decks[0].cards).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})