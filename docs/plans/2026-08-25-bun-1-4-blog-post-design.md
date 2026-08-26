# Bun 1.4 test setup post design

## Decision

Revise the existing bilingual post in place. Keep the canonical slug
`migrating-tests-to-bun-1-4` and the original publication date. Do not split the
WebView experiment into a second post and do not create another benchmark
report.

The post's primary archetype becomes a performance case study. The migration is
the absorbed archetype. The story starts with the practical cost of multiple
worktrees competing for memory, follows the measurements that changed the
decision, and ends with the test stack that now runs locally.

## Titles

- Portuguese: `O que o Bun 1.4 melhorou no meu setup de testes`
- English: `What Bun 1.4 improved in my test setup`

## Audience and depth

- Audience: engineer-adopter.
- Depth tuple: `(R1, R3-R5 with R3 re-measurement, R1, Spiral)`.
- Voice: first-person, practical, precise about uncertainty.
- Productivity claims remain qualitative. We measured runtime and memory, not
  feature lead time.

## Narrative spine

1. Multiple worktrees turned tests and installs into competing memory events.
2. The laptop stalled, resource-sensitive tests timed out, and feedback arrived
   late enough to interrupt feature work.
3. Early measurements produced attractive but invalid conclusions because the
   compared inventories and lifecycles differed.
4. Matched experiments separated four decisions: package installation, runtime
   hosting, native test runner, and browser automation.
5. The final stack keeps each winner only inside the boundary it proved.

## Evidence contract

| Claim | Evidence | Required reading |
| --- | --- | --- |
| Bun install reduced repeated setup cost | `docs/benchmarks/node-vs-bun/README.md` | Small local sample; not a general package-manager promise. |
| Bun Test won the matched isolated-2 runner comparison | `docs/benchmarks/bun-test-revalidation/README.md` | 21.64% faster, 3.24% higher peak RSS, 19.10% lower RSS x time. |
| Bun-hosted Playwright won the complete 49-test runtime comparison | `docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.md` | 12.63% faster and 54.62% lower peak RSS than Node-hosted Playwright on this host. |
| WebView WebKit won only the matched five-smoke cross-engine comparison | `docs/benchmarks/playwright-webview-hybrid/README.md` | 34.48% faster cold and 46.91% faster warm; about 66% lower peak RSS. |
| WebView Chrome lost the same-engine comparison | `docs/benchmarks/playwright-webview-hybrid/README.md` | 62.56% slower cold and 42.07% slower warm than Playwright Page on the same Chromium. |
| Current suite remains complete | `.specs/features/playwright-webview-hybrid/validation.md` | Bun 2272/101/0, canonical E2E 49/49, hybrid 15/15. |

Every percentage in the post must sit next to its baseline, sample scope, host,
and source report. WebKit numbers must always say `five smokes` and
`cross-engine`. No WebView number may be presented as a result for the complete
49-test suite.

## Final stack stated in the post

- Dependency installation: Bun 1.4.
- Unit, component, integration, and infrastructure tests: native Bun Test with
  two isolated workers.
- Complete E2E suite: Playwright Test hosted by Bun, one worker, 49 tests, with
  Chromium as the blocking local reference and Firefox/WebKit available through
  the browser matrix.
- Node: explicit Playwright fallback.
- Bun.WebView WebKit: optional local five-route smoke only.
- Bun.WebView Chrome: retained as negative benchmark evidence, not an adopted
  path.

## Files

- Update `app/content/posts/en/migrating-tests-to-bun-1-4.mdx`.
- Update `app/content/posts/pt-br/migrating-tests-to-bun-1-4.mdx` with the same
  structure and claims.
- Strengthen the scope summary in
  `docs/benchmarks/playwright-webview-hybrid/README.md`.
- Add a supersession pointer to `docs/benchmarks/e2e-webview/README.md` without
  changing its historical numbers.

Remove `draft: true` from both posts because file presence is the publish signal
and the field has no effect. Keep `publishedAt: 2026-08-23`; the body carries a
dated status snapshot for 2026-08-25.

## Validation

1. Query current official Bun, Playwright, and Vitest documentation. Context7
   supplied Playwright/Vitest; Bun uses the vendored official Bun 1.4 docs after
   Context7 quota exhaustion.
2. Apply the humanizer pass to both locales without flattening the first-person
   voice.
3. Run the writing-tech-post lint script on both MDX files.
4. Run `bun run audit:content` and inspect translation, links, frontmatter, and
   alt-text findings.
5. Run the focused MDX/content tests, TypeScript, and Biome.
6. Generate no OG asset unless the revision adds a fenced code block or
   `ogList`; the planned revision uses prose and tables only.
