---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/content-audit/link-parser.server.ts
line: 48
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Dynamic JSX href expressions only warn to console

## Review Comment

`extractHrefFromJsxNode` (`app/lib/content-audit/link-parser.server.ts:40-51`) handles three JSX href shapes: literal string attributes, single-literal `mdxJsxAttributeValueExpression` (e.g. `<Link href={"/foo"}>`), and dynamic expressions (e.g. `<Link href={someVar}>`, template literals with interpolations, function calls). The dynamic-expression branch logs `console.warn(...)` and returns `null`. The caller `collectJsxLink` then silently drops the link.

Two problems follow:

1. **Caller visibility.** `extractLinks` returns only successfully-resolved links. `checkBrokenLinks` has no way to know that N links were skipped due to dynamic expressions, so it cannot include those skips in its findings or warn the developer that a class of links is invisible to the audit.
2. **CI invisibility.** `console.warn` lands in the workflow stdout, which is captured by `set +e` / `output=$(…)` in `content-audit.yml:58`. The output is then re-emitted via `echo "$output"`, but the PR comment only renders severity counts (L120-122); the warnings never reach the artifact in a structured form, and developers reading SUMMARY.md see nothing about them.

**Suggested fix:** extend the `Link` type with `kind: "markdown" | "jsx" | "skipped-dynamic"` (or add `skipped: true` and an optional `reason` field). Return a `Link` with the skip marker instead of `null`. Update `checkBrokenLinks` to emit a low-severity finding (or a dedicated `unresolved-link` category) so the report and SUMMARY surface "5 dynamic hrefs not validated" as a tracked datapoint. Add a unit test with a fixture MDX containing `<Link href={someVar}>` and assert the skipped link appears in the audit output.

## Triage

- Decision: `valid`
- Notes: Confirmed at `link-parser.server.ts:48-50`. Dynamic hrefs return null + console.warn; the null causes `collectJsxLink` to silently drop the link. Fix: extend `Link.kind` with `"skipped-dynamic"`, change `extractHrefFromJsxNode` to return the sentinel string `"dynamic"` instead of null for dynamic expressions (remove console.warn), and have `collectJsxLink` push a `{ href: "", kind: "skipped-dynamic" }` Link. Update `checkBrokenLinks` to emit a minor `broken-link` finding for skipped-dynamic links. Update `link-parser.test.ts` to assert `kind === "skipped-dynamic"` instead of `console.warn`.
