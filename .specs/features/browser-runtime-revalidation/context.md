# Browser Runtime Revalidation Context

## Existing evidence

- Current Playwright benchmark: Node 12.998 s / 796.6 MiB; Bun 11.356 s /
  361.5 MiB, 49/49 outcomes, one worker.
- Historical WebView cold smoke: Playwright 1.820 s vs WebView 3.109 s.
- Historical warm smoke: Playwright 0.514 s vs WebView 1.476 s.
- Historical WebView used a five-route public subset and was retired because it
  was slower and lacked Playwright fixtures, locators, auth storage, traces,
  reporters and request inspection.

These are prior evidence, not assumptions about the new result.

## Current official WebView behavior

Official Bun 1.4 documentation: <https://bun.com/docs/runtime/webview>.

- API is experimental.
- macOS defaults to WebKit; Chrome/CDP can be requested explicitly.
- Chrome is spawned once per Bun process and each view is a new tab.
- WebKit uses one shared host subprocess with independent renderer views.
- Operations on different views can run in parallel.
- A second same-slot operation on one view throws instead of queueing.
- `await using`/`close()` provide deterministic cleanup; `closeAll()` is the emergency cleanup.
- Only headless mode is implemented.

## Shared-machine hazards

- Playwright server port: 4173.
- Global PGLite state: `/tmp/pglite-e2e-state.json`.
- Global fixture: `/tmp/e2e-fixture-post.mdx`.
- Per-worktree auth/report/result paths.
- CRM lock: `/tmp/praxis-playwright.lock`.
- Antclips lock: `.../T/creatista-test.lock`.

Every measured run is serialized and external runner activity invalidates it.

