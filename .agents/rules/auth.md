# Auth Rules

## Required pattern
Every server function handler that accesses protected data MUST call requireSession()
as its first statement:

    import { requireSession } from "#/lib/session";
    const handler = createServerFn(...).handler(async () => {
      await requireSession();
      // data access here
    });

## Prohibited
- Client-side auth checks as the only guard (context.auth.user check in beforeLoad
  is UI-only; server must re-verify)
- Inline requireSession definitions in route files — always import from #/lib/session
- Hardcoded credentials in any file (including fallback strings in env access)
- Storing secrets in Docker image or workflow files — use GitHub Secrets / .env

## Better Auth conventions
- auth instance: app/lib/auth.ts (server only)
- auth client: app/lib/auth.client.ts (client only)
- reactStartCookies plugin MUST be last in the plugins array — it mutates response
  cookies and must run after all other plugins have processed the response
- Auth API route: app/routes/api/auth/$.ts — do not add custom logic here

## DAL pattern
Authentication is enforced at the data access layer (inside server fns), NOT only
at the route boundary. beforeLoad redirects are UX; requireSession() is the security gate.

## E2E anti-patterns
- E2E tests MUST authenticate as the seeded test user via `E2E_ADMIN_EMAIL` /
  `E2E_ADMIN_PASSWORD` environment variables — never hardcode credentials.
- Never commit `storageState.json` or any file under `tests/e2e/.auth/` — these
  contain live session tokens and are gitignored for this reason.
- Never create a separate user account in tests at runtime — use the seeded user
  created by `tests/e2e/seed.ts` in `global-setup.ts`.
