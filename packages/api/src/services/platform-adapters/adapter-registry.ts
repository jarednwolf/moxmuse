/**
 * Platform Adapter Registry
 * 
 * Central registry for managing platform adapters and routing import/export requests.
 */

import {
  PlatformAdapter,
  AdapterRegistry as IAdapterRegistry
} from '@repo/shared/platform-adapter-types'

export class AdapterRegistry implements IAdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>()

  /**
   * Unregister a platform adapter
   */
  unregister(adapterId: string): void {
    this.adapters.delete(adapterId)
  }

  /**
   * Get a specific adapter by ID
   */
  getAdapter(adapterId: string): PlatformAdapter | null {
    return this.adapters.get(adapterId) || null
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Find the best adapter for given input
   */
  async findAdapterForInput(input: string | File): Promise<PlatformAdapter | null> {
    const adapters = this.getAllAdapters()
    const candidates: { adapter: PlatformAdapter; confidence: number }[] = []

    // Test each adapter's ability to handle the input
    for (const adapter of adapters) {
      try {
        const canHandle = await adapter.canHandle(input)
        if (canHandle) {
          // Get validation result for confidence scoring
          const validation = await adapter.validateInput(input)
          candidates.push({
            adapter,
            confidence: validation.confidence
          })
        }
      } catch (error) {
        // Adapter failed to handle input, skip it
        continue
      }
    }

    // Return the adapter with highest confidence
    if (candidates.length === 0) {
      return null
    }

    candidates.sort((a, b) => b.confidence - a.confidence)
    return candidates[0].adapter
  }

  /**
   * Get all supported formats across all adapters
   */
  getSupportedFormats(): string[] {
    const formats = new Set<string>()
    
    for (const adapter of this.adapters.values()) {
      adapter.supportedFormats.forEach(format => formats.add(format))
    }

    return Array.from(formats).sort()
  }

  /**
   * Get adapters that support a specific format
   */
  getAdaptersForFormat(format: string): PlatformAdapter[] {
    return this.getAllAdapters().filter(adapter => 
      adapter.supportedFormats.includes(format)
    )
  }

  /**
   * Get adapters that support import
   */
  getImportAdapters(): PlatformAdapter[] {
    return this.getAllAdapters().filter(adapter => 
      adapter.capabilities.canImport
    )
  }

  /**
   * Get adapters that support export
   */
  getExportAdapters(): PlatformAdapter[] {
    return this.getAllAdapters().filter(adapter => 
      adapter.capabilities.canExport
    )
  }

  /**
   * Get adapters that support bulk operations
   */
  getBulkAdapters(): PlatformAdapter[] {
    return this.getAllAdapters().filter(adapter => 
      adapter.capabilities.supportsBulkOperations
    )
  }

  /**
   * Check if a format is supported
   */
  isFormatSupported(format: string): boolean {
    return this.getSupportedFormats().includes(format)
  }

  /**
   * Get adapter statistics
   */
  getStatistics() {
    const adapters = this.getAllAdapters()
    const formats = this.getSupportedFormats()

    return {
      totalAdapters: adapters.length,
      importAdapters: this.getImportAdapters().length,
      exportAdapters: this.getExportAdapters().length,
      bulkAdapters: this.getBulkAdapters().length,
      supportedFormats: formats.length,
      formats: formats
    }
  }

  /**
   * Validate adapter compatibility
   */
  validateAdapter(adapter: PlatformAdapter): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required properties
    if (!adapter.id || adapter.id.trim().length === 0) {
      errors.push('Adapter ID is required')
    }

    if (!adapter.name || adapter.name.trim().length === 0) {
      errors.push('Adapter name is required')
    }

    if (!adapter.version || adapter.version.trim().length === 0) {
      errors.push('Adapter version is required')
    }

    if (!adapter.supportedFormats || adapter.supportedFormats.length === 0) {
      errors.push('Adapter must support at least one format')
    }

    // Check capabilities consistency
    if (!adapter.capabilities.canImport && !adapter.capabilities.canExport) {
      errors.push('Adapter must support either import or export')
    }

    // Check for duplicate ID
    if (this.adapters.has(adapter.id)) {
      errors.push(`Adapter ID "${adapter.id}" is already registered`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Register adapter with validation
   */
  register(adapter: PlatformAdapter): void {
    const validation = this.validateAdapter(adapter)
    if (!validation.isValid) {
      throw new Error(`Invalid adapter: ${validation.errors.join(', ')}`)
    }

    this.adapters.set(adapter.id, adapter)
  }

  /**
   * Clear all adapters (useful for testing)
   */
  clear(): void {
    this.adapters.clear()
  }
}

// Global registry instance
export const adapterRegistry = new AdapterRegistry()