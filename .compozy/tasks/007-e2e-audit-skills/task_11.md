---
status: pending
title: MDX link-parser (remark AST)
type: backend
complexity: medium
dependencies:
  - task_01
feature: audit/mdx-link-parser
---

# Task 11: MDX link-parser (remark AST)

## Overview

Build the AST-based MDX link extractor that the content-audit checks consume. Uses `unified` + `remark-parse` + `remark-mdx` + `unist-util-visit` to walk every MDX file under `app/content/posts/**` and collect both markdown `link` nodes and JSX `<a>` / `<Link>` element href props per ADR-004.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST expose `extractLinks(filePath: string): Promise<Link[]>` from `app/lib/content-audit/link-parser.server.ts` where `Link = { href: string; line: number; column: number; kind: 'markdown' | 'jsx' }`.
- MUST parse MDX via `unified().use(remarkParse).use(remarkMdx).parse(content)`.
- MUST detect `link` nodes (markdown `[text](url)`) and `mdxJsxFlowElement` / `mdxJsxTextElement` nodes whose `name` is `a` or `Link`.
- MUST extract the `href` attribute value from JSX nodes (handle both string literals and expression attributes).
- MUST classify links: external (`http://`, `https://`, `mailto:`, `tel:`) are returned with `kind` but the audit checker will skip them; fragment-only (`#anchor`) are returned but skipped; internal (starting with `/` or relative) are returned and validated by `checks.server.ts` in task_12.
- MUST be a server-only module; add to `vite.config.ts:serverOnlyStubPlugin` list.
- SHOULD complete a full content-tree parse in <2 seconds at the V1 scale (~50 posts).
</requirements>

## Subtasks

- [ ] 11.1 Create `app/lib/content-audit/link-parser.server.ts` exporting `extractLinks()` and the `Link` type.
- [ ] 11.2 Implement the `unified` pipeline + `unist-util-visit` walker.
- [ ] 11.3 Add `#/lib/content-audit/link-parser.server` to `vite.config.ts:serverOnlyStubPlugin`.
- [ ] 11.4 Create `app/tests/link-parser.test.ts` with fixture MDX covering markdown links, JSX `<Link>`, JSX `<a>`, expression-attribute hrefs, external/internal/fragment classifications.

## Implementation Details

See TechSpec "Build Order step 28" and "Core Interfaces". Note that `@mdx-js/mdx` is already a transitive dependency (rendered side); `remark-mdx` is a separate concern (parsing only, no compilation). The `unified` API returns an `mdast` AST; JSX element nodes are `mdxJsxFlowElement` (block-level) and `mdxJsxTextElement` (inline) per `remark-mdx`'s contract.

### Relevant Files

- `app/lib/mdx/parser.server.ts` — existing gray-matter-based parser; reference for module pattern (server-only, throws on read errors).
- `app/lib/mdx/renderer.server.ts` — existing MDX compile/run + shiki; reference for `unified` usage shape.
- `app/content/posts/**/*.mdx` — fixture source; pick 1-2 representative files to inspect for actual JSX usage patterns.
- `vite.config.ts:serverOnlyStubPlugin` — id list to extend.

### Dependent Files

- `app/lib/content-audit/checks.server.ts` (task_12) — primary consumer of `extractLinks()`.
- `scripts/audit-content.ts` (task_13) — entry point that transitively invokes `extractLinks()`.

### Related ADRs

- [ADR-002: Pivot audit skill from browser-sweep to content-audit](../adrs/adr-002.md) — establishes broken-link as a category.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — locks mdast/remark over regex.

## Acceptance Criteria

1. **AC-1**: `extractLinks()` on a fixture MDX with `[text](/foo)` returns one Link with `href: '/foo'`, `kind: 'markdown'`, and a non-zero `line` / `column`.
2. **AC-2**: `extractLinks()` on a fixture MDX with `<Link href="/bar">text</Link>` returns one Link with `href: '/bar'`, `kind: 'jsx'`.
3. **AC-3**: `extractLinks()` on a fixture MDX with `<a href="https://example.com">x</a>` returns the external link with `kind: 'jsx'` (classification deferred to checks).
4. **AC-4**: `extractLinks()` correctly handles JSX expression-attribute hrefs (`<Link href={`/foo`}>`); SHOULD extract literal template strings, MAY skip dynamic expressions with a warning.
5. **AC-5**: Whole-tree parse of `app/content/posts/**` (V1 scale) completes in <2 seconds on a developer laptop.
6. **AC-6**: Client bundle build (`bun run build`) does NOT include any string matching `extractLinks` (server-only stub working).

## Deliverables

- New file `app/lib/content-audit/link-parser.server.ts`.
- Modified `vite.config.ts` (one-line addition to stub plugin list).
- New file `app/tests/link-parser.test.ts`.
- New fixture directory `app/tests/fixtures/link-parser/` with at least 5 fixture MDX files (markdown links, JSX Link, JSX a, expression-attr, mixed).
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for whole-tree parsing **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] Markdown link extraction returns correct href + line/column.
  - [ ] JSX `<Link href="...">` extraction returns correct href + line/column.
  - [ ] JSX `<a href="...">` extraction works the same.
  - [ ] JSX expression-attribute `href={"/foo"}`: literal-string-attribute returns the href.
  - [ ] JSX dynamic expression `href={someVar}` either returns null href or emits a documented warning.
  - [ ] Fragment-only `[anchor](#section)` returns the link with `href: '#section'`.
  - [ ] External `[example](https://example.com)` returns the link.
  - [ ] Empty MDX file returns `[]`.
- Integration tests:
  - [ ] Walk all of `app/content/posts/**` and assert `extractLinks()` returns an array; no exceptions.
  - [ ] Client bundle build succeeds with `link-parser.server.ts` present.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `app/lib/content-audit/link-parser.server.ts`.
- Whole-tree parse <2 seconds at V1 scale.
- Client bundle stub plugin correctly excludes the module.
