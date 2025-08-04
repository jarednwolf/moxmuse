/**
 * Platform Adapters Index
 * 
 * Central export point for all platform adapters and registry functionality.
 */

// Base classes
export { BasePlatformAdapter } from './base-adapter'
export { AdapterRegistry, adapterRegistry } from './adapter-registry'

// Platform adapters
export { MoxfieldAdapter } from './moxfield-adapter'
export { ArchidektAdapter } from './archidekt-adapter'
export { TappedOutAdapter } from './tappedout-adapter'
export { EDHRECAdapter } from './edhrec-adapter'
export { MTGGoldfishAdapter } from './mtggoldfish-adapter'
export { CSVAdapter } from './csv-adapter'
export { TextAdapter } from './text-adapter'
export { 
  CustomFormatBuilder, 
  CustomFormatFactory, 
  CustomFormatDefinitionBuilder 
} from './custom-format-builder'

// Import the registry and adapters for initialization
import { adapterRegistry, AdapterRegistry } from './adapter-registry'
import { MoxfieldAdapter } from './moxfield-adapter'
import { ArchidektAdapter } from './archidekt-adapter'
import { TappedOutAdapter } from './tappedout-adapter'
import { EDHRECAdapter } from './edhrec-adapter'
import { MTGGoldfishAdapter } from './mtggoldfish-adapter'
import { CSVAdapter } from './csv-adapter'
import { TextAdapter } from './text-adapter'

/**
 * Initialize all default adapters in the given registry
 */
export function initializeAdapters(registry?: AdapterRegistry): void {
  const targetRegistry = registry || adapterRegistry
  
  // Clear existing adapters first
  targetRegistry.clear()
  
  // Register all built-in adapters
  targetRegistry.register(new MoxfieldAdapter())
  targetRegistry.register(new ArchidektAdapter())
  targetRegistry.register(new TappedOutAdapter())
  targetRegistry.register(new EDHRECAdapter())
  targetRegistry.register(new MTGGoldfishAdapter())
  targetRegistry.register(new CSVAdapter())
  targetRegistry.register(new TextAdapter())
}

/**
 * Get adapter registry statistics
 */
export function getAdapterStats() {
  return adapterRegistry.getStatistics()
}

/**
 * Find the best adapter for given input
 */
export async function findAdapterForInput(input: string | File) {
  return adapterRegistry.findAdapterForInput(input)
}

/**
 * Get all available adapters
 */
export function getAllAdapters() {
  return adapterRegistry.getAllAdapters()
}

/**
 * Get adapters that support import
 */
export function getImportAdapters() {
  return adapterRegistry.getImportAdapters()
}

/**
 * Get adapters that support export
 */
export function getExportAdapters() {
  return adapterRegistry.getExportAdapters()
}

/**
 * Get supported formats
 */
export function getSupportedFormats() {
  return adapterRegistry.getSupportedFormats()
}