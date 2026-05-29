# Component Rules

## Layer boundary
Components in app/components/ MUST NOT import from:
- app/routes/ (any route file)
- app/db/ (any DB file)

Allowed imports: #/lib/theme, #/types/*, external packages, other #/components/*.

## TypeScript
- Prop types: use `type Props = { ... }` — never `interface Props`
- Export prop types only if consumed by a parent component or test
- Prefer inline prop types for simple components (<=3 props)

## Structure
- app/components/layout/ — page shells (header, footer); one component per file
- app/components/ui/     — reusable UI elements; pure presentational
- No CSS modules — use Tailwind utility classes only

## Anti-patterns
- Components that call createServerFn() directly
- Components with useEffect that fetches data (use loader + Route.useLoaderData())
- Components importing auth client (#/lib/auth.client) for session checks
- Barrel index.ts files in components/ directories
- Components embedding theme-specific styling (`bg-[#4c5844]` literals, `cs16:` Tailwind variant overrides, inline `.cs16` selectors). Theme styling lives in the theme's CSS block under `app/styles/global.css`; the `cs16:` variant is reserved for documented exceptions noted in the relevant ADR.
