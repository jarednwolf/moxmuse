# Developing MoxMuse in Cursor

## Prereqs
- Node.js 20+
- pnpm 8+
- PostgreSQL URL in `apps/web/.env.local` (see ENV_SETUP_INSTRUCTIONS.md)
- OPENAI_API_KEY in `apps/web/.env.local`

## One-time
```bash
pnpm install
pnpm db:generate
pnpm db:push
```

## Run locally
```bash
pnpm dev --filter @moxmuse/web
```

## Recommended Cursor settings
- Enable “Auto-save on focus change”
- Turn on TypeScript validation
- Use integrated terminal with project root
- Install Cursor plugins: Prisma, Tailwind CSS IntelliSense

## Useful scripts
```bash
pnpm type-check            # monorepo type-check
pnpm --filter @moxmuse/web type-check
pnpm --filter @moxmuse/web test:comprehensive
pnpm --filter @moxmuse/web test:e2e
```

## Common issues
- Type errors in `packages/api` tests are known tech-debt; web can run independently.
- If DB schema changes, re-run `pnpm db:generate && pnpm db:push`.
- Clear Next cache: remove `apps/web/.next`.

## Best practices & references
- GPT‑5 best practices for Cursor: `docs/guides/GPT5_CURSOR_BEST_PRACTICES.md`
- GPT‑5 coding cheat sheet (attached): `docs/gpt-5-for-coding-cheatsheet.pdf`
