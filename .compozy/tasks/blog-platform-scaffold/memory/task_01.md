# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Scaffold TanStack Start project + BiomeJS + Lefthook + Tailwind + .env.example + .vscode. Status: completed.

## Important Decisions

- **`vite.config.ts` not `app.config.ts`**: New TanStack Start API (v1.x via `create-tanstack@latest`) uses `vite.config.ts` instead of the old Vinxi-era `app.config.ts`. Bun preset is set via `nitro({ preset: "bun" })` in vite plugins.
- **`src/` renamed to `app/`**: Scaffold defaulted to `src/`, renamed to match TechSpec. Required updating `tanstackStart({ srcDirectory: "app" })` in vite.config.ts, tsconfig paths, biome.json includes.
- **`lefthook.yml` not `.lefthook.yml` as main config**: Lefthook v2.1.6 reads `lefthook.yml` as the main config; `.lefthook.yml` is for local overrides. Both exist in repo.
- **`biome check --write` not `--apply`**: BiomeJS v2.x uses `--write` (or `--fix`); `--apply` flag no longer exists.
- **Tailwind v4 CSS plugin syntax**: Typography plugin added via `@plugin "@tailwindcss/typography"` in `global.css`, not via JS config import alone.
- **Biome schema migration**: Scaffold generated biome.json with schema 2.2.4; ran `biome migrate --write` to upgrade to 2.4.5.
- **Vitest hang warning**: "close timed out" is cosmetic — tests exit 0. Caused by Vite server not fully closing; does not affect results.

## Learnings

- `create-tanstack@latest` scaffolds into existing directory with `--force` flag; leaves `blog.pen` and `skills-lock.json` untouched.
- TanStack Start v1 Vite plugin: `srcDirectory` option controls where `router.tsx` is found.
- Lefthook v2 verbose install output shows which hooks were synced: `sync hooks: ✔️ (pre-commit)`.
- Biome `includes` pattern `!**/app/styles/**` triggers `useBiomeIgnoreFolder` lint; correct form is `!**/app/styles`.

## Files / Surfaces

- `vite.config.ts` — Vite/Nitro/TanStack Start config; `srcDirectory: "app"`, `preset: "bun"`, vitest test config
- `app/` — renamed from `src/`; contains `routes/`, `styles/`, `router.tsx`, `tests/`
- `app/styles/global.css` — Tailwind v4 import + `@plugin "@tailwindcss/typography"`
- `app/tests/task-01-tooling.test.ts` — 17 Vitest tests covering all tooling deliverables
- `tailwind.config.ts` — content paths `app/**/*.{ts,tsx}`, typography plugin
- `biome.json` — schema 2.4.5, includes `app/**`, `.vscode/**`, `vite.config.ts`, `tailwind.config.ts`
- `lefthook.yml` — main Lefthook config (pre-commit → biome check --write)
- `.lefthook.yml` — local override (same content)
- `.env.example` — DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
- `.vscode/settings.json` — BiomeJS default formatter + formatOnSave
- `package.json` — all deps pinned (no ^ or ~), `biome:check` and `biome:fix` scripts

## Errors / Corrections

- Initial scaffold created `src/` dir; renamed to `app/` for TechSpec alignment
- Lefthook install silently succeeded but created no hooks until `lefthook.yml` (no dot) was created
- `biome.json` schema mismatch (2.2.4 vs 2.4.5) fixed via `biome migrate --write`

## Ready for Next Run

Task 01 complete. Task 02 (Docker Compose) can now proceed — depends on this task only.
