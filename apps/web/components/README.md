# Component Shims

This directory contains shim files that re-export components from the `src` directory.
These shims are necessary for Vercel builds where the `@/` alias doesn't resolve correctly
to the `src` directory in some contexts.

## Why These Exist

Next.js and Vercel's build process sometimes have issues resolving imports that use the `@/` alias
when components are in a `src` directory but imported from files in the root `app` directory.
These shim files act as a bridge to ensure components can be found during the build process.

## Components with Shims

- `auth-prompt.tsx` → `src/components/auth-prompt.tsx`
- `ui/alert.tsx` → `src/components/ui/alert.tsx`
- `ui/card.tsx` → `src/components/ui/card.tsx`
- `ui/error-boundary.tsx` → `src/components/error-boundaries/ErrorBoundary.tsx`
- `ui/toaster.ts` → `src/components/ui/toaster.ts`
- `tutor/EntryPointSelector.tsx` → `src/components/tutor/EntryPointSelector.tsx`
- `tutor/NaturalLanguageVision.tsx` → `src/components/tutor/NaturalLanguageVision.tsx`
- `contexts/DeckContext.tsx` → `src/contexts/DeckContext.tsx`

## Long-term Solution

The ideal solution would be to:
1. Move all components from `src/components` to `components` (root level)
2. Or update the build configuration to properly resolve the `@/` alias
3. Or use a different import strategy that doesn't require these shims

For now, these shims ensure the application builds and deploys correctly.
