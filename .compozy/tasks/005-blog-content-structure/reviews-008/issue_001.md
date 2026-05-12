---
provider: manual
pr:
round: 8
round_created_at: 2026-05-12T00:07:00Z
status: resolved
file: app/db/indexer.ts
line: 128
severity: low
author: claude-code
provider_ref:
---

# Issue 001: index_error log entry missing lang field (TechSpec gap)

## Review Comment

The TechSpec (Monitoring and Observability section) requires `lang` in every log entry:

> Two new log fields required:
> - `lang` — added to every `indexed` and `index_error` log entry
> - `category` — added to `indexed` log entry (null when not set)

The `indexed` log at line 117 correctly includes `lang`:

```typescript
console.log(
  JSON.stringify({ level: "INFO", action: "indexed", filePath, slug, lang, category: fm.category ?? null }),
);
```

But the `index_error` log at lines 129–134 omits it:

```typescript
console.error(
  JSON.stringify({ level: "ERROR", action: "index_error", filePath, error: String(err) }),
);
```

The gap matters for observability: when an index failure occurs, `lang` helps identify whether the affected file was in `content/en/` or `content/pt-br/` without parsing `filePath` manually in a log aggregator.

The root cause is scope: `lang` is declared with `const lang = deriveLang(filePath)` inside the `try` block and is inaccessible in `catch`. If `deriveLang` itself throws (unsupported locale directory), `lang` is never assigned.

Fix: declare `lang` as `null` before the `try` block, assign it inside, and include it in the error log even when `null` (indicating the error occurred before `lang` was derived):

```typescript
export async function upsertPost(filePath: string): Promise<void> {
  let lang: string | null = null;
  try {
    const source = await readFile(filePath, "utf8");
    const fm = parseFrontmatterBlock(source, filePath);
    const slug = deriveSlug(filePath, fm.slug);
    lang = deriveLang(filePath);
    // ... insert ...
    console.log(JSON.stringify({ level: "INFO", action: "indexed", filePath, slug, lang, category: fm.category ?? null }));
  } catch (err) {
    console.error(JSON.stringify({ level: "ERROR", action: "index_error", filePath, lang, error: String(err) }));
    throw err;
  }
}
```

When `deriveLang` throws (invalid locale dir), `lang` is `null` in the error log — which still provides useful context (the error is locale-related). When the DB insert fails after `lang` is assigned, the log includes the correct locale value.

## Triage

- Decision: `valid`
- Notes: `lang` was declared with `const` inside `try` at line 84, making it inaccessible in `catch`. TechSpec requires `lang` in every `index_error` log entry. Fixed by hoisting `let lang: string | null = null` before the `try` block and assigning inside. `null` value correctly signals that the error occurred before locale derivation (e.g., `deriveLang` itself threw). Added `lang` field to the `index_error` JSON log object.
