# App audit preview ownership

## Problem

The app audit can accept an HTTP response from an older process on port 4173
as proof that the preview process it just spawned is ready. It can then inspect
a stale bundle while the new Nitro process exits with `EADDRINUSE`, producing a
valid-looking but obsolete report.

The reported missing `canonical` and `og:image` tags are not reproducible in the
current application. SSR, a hydrated Playwright page, and a direct targeted app
audit each find exactly one of both tags.

## Decision

Keep the application metadata unchanged. Make the preview orchestrator prove
that readiness came from its own child process before starting the audit.

`scripts/run-audit-fe.ts` will pipe the child stdout, mirror it to the parent
terminal, and treat Nitro's listening message as the readiness signal. Child
`error` or `exit` before that signal rejects immediately. After the child
announces readiness, the existing HTTP probe still verifies that the server can
serve requests.

## Alternatives

- Reject a preoccupied fixed port: smaller, but retains a check-to-bind race.
- Allocate an ephemeral port: strongest isolation, but expands configuration and
  reporting changes beyond the observed defect.
- Add metadata again: rejected because it would duplicate correct application
  tags and hide the audit orchestration defect.

## Validation

- Unit-test readiness against child stdout, early exit, and spawn errors.
- Keep preview output visible to operators.
- Run focused orchestrator tests.
- Run the full app audit against a fresh local database and require zero stale
  metadata findings.
- Run the repository quality gates before merging the follow-up branch.
