---
provider: manual
pr:
round: 1
round_created_at: 2026-05-05T15:55:14Z
status: resolved
file: Dockerfile
line: 17
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Runner CMD path unverified — Nitro bun preset may output different entry

## Review Comment

The runner stage uses:

```dockerfile
CMD ["bun", ".output/server/index.mjs"]
```

The TechSpec explicitly flags this as unresolved: "Verify `.output/server/index.mjs` is the correct entry path after first `make build`. Nitro bun preset may output `index.ts` or a different path — update CMD if needed."

Tasks 01–05 are marked completed, but no task notes record the verified output path. If the Nitro bun preset writes a different entry (e.g., `.output/server/index.ts`, `.output/server/index.js`, or a versioned bundle file), the runner CMD silently starts a process that immediately throws `error: Cannot find module '.output/server/index.mjs'`, causing `make preview` to exit without serving anything.

The breakage is silent at `make build` time (build succeeds regardless of CMD correctness) and only appears at `make preview` runtime — which is exactly the manual smoke test gate PRD F8 intends.

**Fix**: Run `make build` and then inspect the output directory before finalizing the CMD:

```sh
make build
docker run --rm blog find .output/server -type f | head -20
```

Update the CMD to match the actual entry file name. If `index.mjs` is confirmed correct, document the verification in a code comment:

```dockerfile
# Entry path verified against Nitro bun preset output on 2026-05-05
CMD ["bun", ".output/server/index.mjs"]
```

## Triage

- Decision: `VALID`
- Root cause: CMD path was unverified at the time of implementation. The TechSpec explicitly flagged this as a required verification step before shipping.
- Verification: Ran `bun run build` locally on 2026-05-05. Build output confirms `.output/server/index.mjs` is the correct entry file for the Nitro bun preset.
- Fix: Add a verification comment to the Dockerfile CMD line documenting the confirmed path.
