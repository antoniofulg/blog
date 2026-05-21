# Blog — Agent Context

Personal blog. TanStack Start + TanStack Router + Better Auth + Drizzle ORM
+ PostgreSQL + Tailwind CSS v4. Deployed via Docker on VPS. CI/CD: GitHub Actions.

## Stack
- Runtime: Bun
- Framework: TanStack Start (React, SSR)
- Routing: TanStack Router (file-based)
- Auth: Better Auth (email+password, reactStartCookies plugin)
- DB: Drizzle ORM + PostgreSQL (drizzle-kit migrations)
- Styling: Tailwind CSS v4
- MDX: @mdx-js/mdx + gray-matter + Shiki

## File Structure
app/
  components/layout/  — header, footer shells
  components/ui/      — pure presentational, no route/DB imports
  db/                 — schema.ts (definitions only), queries.ts, indexer.ts, client.ts
  lib/                — auth.ts, auth.client.ts, session.ts, mdx/, watcher.server.ts
  lib/mdx/            — parser.server.ts (frontmatter), renderer.server.ts (compile)
  routes/             — file-based routes; admin/ and api/ subdirs
  routes/admin/       — *.tsx (UI only) + *.server.ts (server fns)
                        Note: $slug.tsx exceeds 80 lines with inline server fns —
                        extraction deferred to V2 (PRD-0004 non-goal)
  types/              — content.ts, auth.ts (shared TypeScript types)
  styles/             — global.css
  tests/              — unit + integration tests
tests/e2e/            — Playwright E2E specs (fixtures/, .auth/, *.spec.ts)
docs/_reports/        — per-run content audit reports (gitignored)
docs/audits/          — committed audit history (SUMMARY.md)

## Key Conventions
- Branch: TASK-XXXX/slug or hotfix/slug
- Commits: Conventional Commits (feat/fix/chore/docs/test/refactor/ci)
- TypeScript: use `type` for all shapes; `interface` only for class implements
  or module augmentation (e.g., TanStack Router Register)
- Server fns: extract to *.server.ts co-located with route file
- Auth: always call requireSession() from #/lib/session at top of server fn handlers
- Types: shared types live in app/types/ — never define exported types in route files

## Skill Map
| Task type | Skills to activate |
|---|---|
| New route | tanstack-router, tanstack-start-best-practices, find-rules |
| Auth change | better-auth-best-practices, better-auth-security-best-practices, find-rules |
| DB schema/query | drizzle-postgres, drizzle-orm, find-rules |
| UI component | react, shadcn, tailwindcss, building-components |
| Refactor | no-workarounds, refactoring-analysis, find-rules |
| Security | better-auth-security-best-practices, no-workarounds |
| CI/CD | find-rules (see .agents/rules for cicd.md and git-workflow.md) |
| E2E test write/run | e2e-coverage |
| App content audit | content-audit (filesystem-only; no browser) |
| App FE runtime audit | app-audit (fuzzer; browser sweep + a11y + Lighthouse) |

## Rules
- Auth: .agents/rules/auth.md
- Routes: .agents/rules/routes.md
- DB: .agents/rules/db.md
- Components: .agents/rules/components.md
- Git workflow: .agents/rules/git-workflow.md
- CI/CD: .agents/rules/cicd.md
- Content authoring: CONTENT.md
- Testing: .agents/rules/testing.md
- Content audit: .agents/rules/audit.md
- Audit (FE runtime): .agents/rules/fe-audit.md

## Design Context
- Strategic (register, users, principles, anti-references): PRODUCT.md
- Visual system (palette, typography, components): DESIGN.md (when present)
- Loader: `node .agents/skills/impeccable/scripts/load-context.mjs`
