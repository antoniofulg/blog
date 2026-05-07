---
provider: manual
pr:
round: 3
round_created_at: 2026-05-05T17:23:50Z
status: resolved
file: app/routes/search.tsx
line: 33
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Search page shows "Resultados para" label but returns no results

## Review Comment

`search.tsx` renders a query input that updates local state. When the user types, this label appears:

```tsx
{query && (
  <p className="text-sm text-foreground-secondary">
    Resultados para &ldquo;{query}&rdquo;
  </p>
)}
```

No server function is called, no results list is rendered, and no empty-state message explains why. A user who types "React" sees:

> Resultados para "React"

…followed by blank space. The empty space looks like a failed search rather than an unimplemented feature. This is more misleading than the newsletter, which round 2 issue_004 fixed by replacing the submit button with a disabled "Em breve" button.

The PRD explicitly excludes search ("Non-Goals: Search — no full-text or fuzzy search on the public site"). The search route is in the nav, so visitors reach it. The current half-rendered state is inconsistent with the newsletter's explicit placeholder treatment.

**Fix**: Apply the same placeholder pattern used for the newsletter. Remove the `query`-conditional label and replace the input with a non-interactive "Em breve" state:

```tsx
function SearchPage() {
  return (
    <div className="px-5 py-12 lg:px-20">
      <div className="mx-auto max-w-3xl flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">
          Buscar
        </h1>
        <p className="text-sm text-foreground-secondary">
          {/* TODO: Wire to a full-text search provider (e.g. Meilisearch, Algolia) */}
          A busca estará disponível em breve.
        </p>
      </div>
    </div>
  );
}
```

Alternatively, keep the input but remove the "Resultados para" label and add an explicit "coming soon" note below the input so the placeholder intent is clear.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed. `SearchPage` rendered `useState`-driven input and showed a "Resultados para" label when the query was non-empty, but no results list or empty-state ever appeared — the PRD explicitly excludes full-text search. This is inconsistent with the newsletter placeholder pattern applied in round 2. Fix applied: replaced `SearchPage` with a static placeholder showing "A busca estará disponível em breve." with a TODO comment pointing to future search provider integration. Removed now-unused `SearchIcon` and `useState` imports. Added trailing newline for Biome format compliance. Lint, tsc, and `biome.test.ts` all pass after the fix.
