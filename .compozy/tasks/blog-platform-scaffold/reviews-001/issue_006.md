---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: pending
file: app/routes/login.tsx
line: 31
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Login redirect parameter accepts external URLs (open redirect)

## Review Comment

The login page reads `redirectTo` from the `redirect` search param and navigates there after successful sign-in:

```typescript
await navigate({ to: redirectTo ?? "/" });
```

The `validateSearch` function (line 6–9) only checks that `redirect` is a `string` — it does not validate that the value is a relative path on the same origin. An attacker can craft a phishing link such as:

```
http://localhost:3000/login?redirect=https://evil.com
```

After the victim logs in, `navigate({ to: "https://evil.com" })` would attempt navigation to the external URL. TanStack Router's client-side `navigate` would interpret this as a route path and likely fail or navigate to `/https://evil.com` on the same origin, but the behavior depends on the router version and is not guaranteed. The risk is low in a personal single-user context, but the pattern is a well-known CWE-601 vulnerability that should not exist in a scaffold used as a reference.

**Fix**: Validate that `redirectTo` is a path on the same origin before using it:

```typescript
function isSafeRedirect(url: string | undefined): url is string {
    if (!url) return false;
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.origin === window.location.origin;
    } catch {
        return url.startsWith("/");
    }
}

// In handleSubmit:
await navigate({ to: isSafeRedirect(redirectTo) ? redirectTo : "/" });
```

## Triage

- Decision: `UNREVIEWED`
- Notes:
