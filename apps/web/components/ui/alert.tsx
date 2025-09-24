// This is a shim to re-export the alert component from its actual location
// to satisfy relative imports like '../ui/alert' which might not resolve
// correctly in some build environments (e.g., Vercel's default build process).
export * from '../../src/components/ui/alert'
