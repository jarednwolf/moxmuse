// This is a shim to re-export the DeckContext from its actual location
// to satisfy alias imports like '@/contexts/DeckContext' which might not resolve
// correctly in some build environments (e.g., Vercel's default build process).
export * from '../src/contexts/DeckContext'
export { useDeck } from '../src/contexts/DeckContext'
