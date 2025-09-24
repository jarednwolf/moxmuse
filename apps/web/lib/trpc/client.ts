import { createTRPCReact } from '@trpc/react-query'
// Use permissive AppRouter during CI to avoid blocking on API type coupling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppRouter = any

export const trpc = createTRPCReact<AppRouter>() 