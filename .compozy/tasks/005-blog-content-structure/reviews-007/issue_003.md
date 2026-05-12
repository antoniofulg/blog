---
provider: manual
pr:
round: 7
round_created_at: 2026-05-11T23:48:11Z
status: resolved
file: app/lib/locale.tsx
line: 11
severity: low
author: claude-code
provider_ref:
---

# Issue 003: LOCALES exported as mutable Locale[], should be readonly

## Review Comment

`LOCALES` is declared as a mutable array:

```typescript
export const LOCALES: Locale[] = ["en", "pt-br"];
```

Because the type is `Locale[]` (not `readonly Locale[]`), any consumer that imports `LOCALES` could mutate it via `.push()`, `.splice()`, etc. Mutations would affect all other modules sharing the same instance, since ES modules are singletons.

The current workaround is visible in `app/db/indexer.ts:54`:

```typescript
if (!(LOCALES as readonly string[]).includes(dir)) {
```

This cast exists to widen `Locale[]` so that `string` can be passed to `.includes()`. With a readonly declaration, the cast would become `(LOCALES as readonly string[])` — still valid — or the code could use `LOCALES.includes(dir as Locale)` if LOCALES were `readonly Locale[]`.

Fix: declare `LOCALES` as readonly at the source:

```typescript
export const LOCALES: readonly Locale[] = ["en", "pt-br"];
```

No call sites require changes: `LOCALES.find()`, `LOCALES.includes()`, and `(LOCALES as readonly string[]).includes()` all work identically on `readonly Locale[]`. The mutation risk is eliminated and the type communicates intent (this is a fixed registry, not a collection that grows at runtime).

## Triage

- Decision: `valid`
- Notes: Confirmed. `LOCALES: Locale[]` is mutable — any consumer can `.push()` or `.splice()` the singleton. Call sites that pass `string` to `.includes()` already cast to `readonly string[]` explicitly (indexer.ts:54), which is valid and unchanged with `readonly Locale[]`. Fix is one-word: `readonly Locale[]`. No downstream changes required.
