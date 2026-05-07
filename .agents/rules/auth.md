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
