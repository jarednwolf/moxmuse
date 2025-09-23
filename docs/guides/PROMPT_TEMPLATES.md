# Prompt Templates & AI Code Review Checklist

## Prompt Templates

### Change Implementation
```
Context:
- (files/modules)
- (problem/goal)

Target:
- (specific edits)

Constraints:
- (types, style, privacy)

Done:
- (validation commands)
```

### Refactor (Chunked)
```
Plan:
- Steps 1..N

Start with Step 1 only. After finishing, validate, then proceed to Step 2.
```

### Bug Reproduction → Fix
```
Repro:
- Steps
- Expected vs actual

Fix target:
- (files, functions)

Validation:
- (tests/type-check/lint)
```

## AI Code Review Checklist
- Minimal diff; no unrelated formatting changes
- Types respected; no `any`; exported APIs annotated
- Input validation present where user input crosses boundaries (Zod)
- Error handling meaningful; no empty catch; logs sanitized
- Performance considered (memoization, batching where relevant)
- Security: no secrets; safe headers; rate limiting where needed
- UI: accessible components; keyboard/focus semantics, proper aria
- Tests: updated or added when behavior changes
- Docs: updated links, guides, or READMEs as needed
