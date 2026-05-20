---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: resolved
file: app/lib/app-audit/reporter.server.ts
line: 170
severity: low
author: claude-code
provider_ref:
---

# Issue 005: SUMMARY.md append is not atomic across concurrent audit runs

## Review Comment

`app/lib/app-audit/reporter.server.ts:170-174`:

```ts
await appendFile(
  join(cwd, SUMMARY_PATH),
  formatSummaryRow(findings, triggerLabel),
  "utf-8",
);
```

`fs.appendFile` is atomic within a single call (one `O_APPEND` write), but not across multiple processes appending to the same file. Concurrent invocations can interleave row writes: if `make audit` is run twice in parallel (or if the GH Action workflow + a developer's local run happen within the same second), the appended row strings can corrupt mid-cell (e.g., one process writes `| 2026-05-20 | app   |` while another writes `| 2026-05-20 | conte`, producing a garbled `| 2026-05-20 | conteapp   |` row that breaks the markdown table parser).

Probability is low in solo-dev workflow (manual + CI rarely simultaneous), but the failure mode is silent: the row appears garbled in `git diff`, the next audit run's idempotency check (`if (content.includes("| Type"))`) still passes, and the corrupted row persists in the committed history.

Same risk exists for `app/lib/content-audit/reporter.server.ts` for the same reason.

**Suggested fix:** introduce a lightweight file-lock pattern. Two options:

1. **Lockfile**: open a `.lock` sidecar (`docs/audits/SUMMARY.md.lock`) with `O_CREAT | O_EXCL`; if it exists, wait + retry with backoff (timeout after ~5s, abort with clear error); delete on completion. Use `proper-lockfile` npm package for cross-platform correctness.
2. **Read-modify-write**: read SUMMARY.md, append row in-memory, write to `.tmp`, atomic rename. Adds a race between read and write but converts row-corruption into a last-writer-wins overwrite (data loss instead of garbled rows — debatable improvement).

Or — simplest for solo dev — document in `.agents/rules/fe-audit.md`: "Do not run `audit-fe` and `audit-content` concurrently; sequential via `make audit` is the supported path." Defer file-lock to V2.

## Triage

- Decision: `valid`
- Notes: Confirmed. `appendFile` at reporter.server.ts:170 is not atomic across concurrent processes. However, the issue itself identifies the simplest correct fix for this solo-dev setup: document the "no concurrent audit runs" constraint in `.agents/rules/fe-audit.md`. Adding `proper-lockfile` is over-engineering for a personal blog. No code change to reporter.server.ts — doc-only fix.
