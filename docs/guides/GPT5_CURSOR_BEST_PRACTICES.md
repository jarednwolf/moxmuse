# GPT‑5 Best Practices for Cursor (MoxMuse)

This guide distills best practices (informed by the GPT‑5 coding cheat sheet) for working effectively with GPT‑5 inside Cursor on the MoxMuse repo.

## Objectives
- Ship correct, type‑safe code with minimal diff surface.
- Keep the repo fast and healthy (lint/type/test pass where targeted).
- Maintain high signal communication and reliable automation.

## Default Response Style
- Be concise and high‑signal by default; expand only when asked.
- Use bullet points and short sections for skimmability.
- Use code references for existing code, and fenced blocks only for new code.
- Prefer imperative edits over long explanations; summarize at end.

## Cursor Tooling (when to use what)
- codebase_search: primary for semantic discovery across the repo.
- grep: exact string/symbol search (fast for known terms).
- read_file: open specific files before editing; re‑read if stale.
- apply_patch: make edits; keep diffs minimal and scoped.
- run_terminal_cmd: non‑interactive commands; pipe through `| cat` if paged.
- read_lints: after edits in TS/TSX files to catch regressions early.
- todo_write: track multi‑step work; mark states in real time.

## Task Flow
1) Discovery
   - Briefly scan related docs and code paths (parallel searches where possible).
   - Identify risks, owners, and acceptance criteria.
2) Plan → Todos
   - Create atomic todos (≤14 words) for each meaningful change.
   - Set the first todo to in_progress.
3) Implement
   - Apply minimal, targeted edits per the code_style and type safety rules.
   - Keep unrelated formatting untouched.
4) Validate
   - Type‑check and/or lint the edited package(s); run narrow tests when relevant.
   - Fix linter/type errors immediately if edits caused them.
5) Summarize
   - Short summary of changes and impact. Link to docs/entry points.

## Prompt Patterns
- “Context + Target + Constraints + Done criteria”
  - Context: what/why; files/modules involved.
  - Target: concrete change(s) to make.
  - Constraints: types, style, performance limits, privacy.
  - Done: what validation we’ll run.
- For large changes, chunk: “Plan → Part 1 → Validate → Part 2 → Validate …”.
- Prefer examples from repo over abstract examples.

## Editing Practices
- Keep edits small; avoid sweeping refactors unless explicitly requested.
- Preserve indentation and formatting style of touched files.
- Adhere to code_style guidelines (naming, annotations, guards, comments).
- Avoid catching without handling; validate inputs with Zod where applicable.
- Prefer explicit types for exported/public APIs; avoid `any`.
- Don’t reformat unrelated code or reorder imports unless necessary.

## Repo‑specific Conventions
- Next.js App Router: keep server/client boundaries clear.
- tRPC: use Zod schemas for input/output; respect protectedProcedure.
- Prisma: re‑generate client on schema changes; avoid ad‑hoc SQL.
- UI: Tailwind + Radix; prefer composable components and memoization for heavy elements.
- Testing: Vitest (unit), Playwright (E2E). Avoid mixing Jest types.

## Status Updates & Summaries
- Before tool calls: 1‑2 sentence “what I’m about to do”.
- After each step or todo change: micro‑update and keep todos synchronized.
- Final summary: brief, high‑signal; no process narrative.

## Performance & Ergonomics in Cursor
- `.cursorignore` excludes heavy outputs (reports, artifacts); keep it updated.
- Parallelize read‑only searches (semantic + grep) to reduce latency.
- Use targeted `--filter` when running scripts in the monorepo.

## Privacy & Security
- Never commit secrets. Keep `.env.local` out of VCS.
- Sanitize logs/errors; avoid dumping sensitive envs.
- Follow security docs and rate‑limit guidelines.

## Validation Commands (common)
```bash
# Web app only
pnpm --filter @moxmuse/web type-check
pnpm --filter @moxmuse/web lint
pnpm --filter @moxmuse/web test:comprehensive

# Monorepo (can surface pre‑existing debt)
pnpm type-check
pnpm lint
pnpm test:comprehensive
```

## References
- Cursor setup: docs/guides/CURSOR_SETUP.md
- GPT‑5 cheat sheet: docs/gpt-5-for-coding-cheatsheet.pdf
- Architecture: docs/ARCHITECTURE.md
- API reference: docs/API_REFERENCE.md
- Style guide: docs/STYLE_GUIDE.md
