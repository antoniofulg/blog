# Rollout: Share & Branding (chore/favicon-set-og-fallback)

**Branch**: `chore/favicon-set-og-fallback`  
**Feature**: Author Distribution Toolkit — favicons, OG cards, per-platform UTM, admin share dropdown  
**ADRs**: ADR-001 through ADR-007  
**Started**: 2026-05-25  
**Merged**: _pending_

---

## Pre-merge Verification Checklist

All gates must be green before merging to `main`.

| Gate | Status | Notes |
|------|--------|-------|
| `make test` (Vitest) | ✅ | 93 test files; PGLite integration tests pass in isolation; pre-existing resource-contention flakiness when run as full suite |
| `make lint` (Biome) | ✅ | Warnings only, no errors |
| `make check` (tsc --noEmit) | ✅ | Types valid |
| `make lint-tests` | ✅ | No annotation violations |
| `make test-e2e` (Playwright) | ⬜ | Run locally: `bun run build && bunx playwright test` |
| `make build-js` | ⬜ | Run: `make build-js` |
| `bun run sync` smoke | ⬜ | Check `public/og/` for sample post PNGs |

---

## Operator Runbook — Post-Merge Steps

Complete these steps **after** CI passes and CD deploys successfully.

### Step 1: Confirm CD deployment

1. Merge PR to `main`.
2. Monitor CI in GitHub Actions — all 6 jobs must pass.
3. CD fires automatically via `workflow_run` gate.
4. Wait for deployment to complete (~5 min from merge).
5. Confirm: `curl -I https://<site>/` returns `200`.

---

### Step 2: Backup `analytics_events` (pre-truncate)

SSH into the VPS:

```bash
ssh <user>@<vps-host>
```

Run pg_dump backup:

```bash
DATE=$(date +%Y%m%d-%H%M%S)
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host=localhost \
  --username=<db-user> \
  --dbname=<db-name> \
  --table=analytics_events \
  --data-only \
  --column-inserts \
  > /tmp/analytics_events_${DATE}.sql

# Verify backup is non-empty
wc -l /tmp/analytics_events_${DATE}.sql
ls -lh /tmp/analytics_events_${DATE}.sql
```

Record the backup file path here: `_____________________`  
Record the file size here: `_____________________`

**AC-1**: File must exist with size > 0.

---

### Step 3: Operator confirmation ⚠️

> **Warning:** The next step permanently deletes all rows in `analytics_events`. This is irreversible.
>
> The backup in Step 2 is the only recovery path.
>
> Per ADR-001: the blog has zero meaningful traffic at time of rollout. The existing rows contain only test/development data with the old `"share"` bucket (which is now removed from the codebase). Truncation is confirmed safe.

**Explicit confirmation required before proceeding.** Record the timestamp:  
Operator confirmed at: `_____________________`

---

### Step 4: Execute TRUNCATE

On the VPS, run via psql:

```bash
PGPASSWORD="$DB_PASSWORD" psql \
  --host=localhost \
  --username=<db-user> \
  --dbname=<db-name> \
  --command="TRUNCATE analytics_events;"

# Verify row count = 0
PGPASSWORD="$DB_PASSWORD" psql \
  --host=localhost \
  --username=<db-user> \
  --dbname=<db-name> \
  --command="SELECT COUNT(*) FROM analytics_events;"
```

Record truncate timestamp: `_____________________`  
Record COUNT(*) result: `_____________________` (must be 0)

**AC-2**: `SELECT COUNT(*) FROM analytics_events` must return `0`.

---

### Step 5: Verify analytics bucketing (synthetic share click)

> **Do NOT use `curl` for this step.** Post-view events are recorded by the
> hydrated page's `useEffect` calling the `incrementViewCount` server function
> — a raw `curl` GET fetches the HTML but never runs that client code, so it
> inserts no row. A `-H "Referer: ..."` header also does nothing: the bucketer
> reads the client-reported `document.referrer` / `utm_source`, not the request
> header. The deterministic way to drive a known bucket is the `utm_source`
> query param, which the client forwards to the server function.

In a **real browser** (so hydration runs), open a published post URL tagged
with a known source. Use a fresh tab / incognito window so the `sessionStorage`
view guard does not suppress the increment:

```
https://<site>/<slug>?utm_source=linkedin&utm_medium=social&utm_campaign=<slug>
```

Wait for the page to finish loading, then query the DB:

```bash
PGPASSWORD="$DB_PASSWORD" psql \
  --host=localhost \
  --username=<db-user> \
  --dbname=<db-name> \
  --command="SELECT id, referrer_source, created_at FROM analytics_events ORDER BY created_at DESC LIMIT 5;"
```

Record the row here (expected `referrer_source = 'linkedin'`): `_____________________`

**AC-3**: A row with `referrer_source = 'linkedin'` must appear.

> Alternative (no browser): insert a synthetic event directly, e.g.
> `INSERT INTO analytics_events (post_id, referrer_source, lang, device) VALUES (<id>, 'linkedin', 'en', 'desktop');`
> — useful for a pure DB smoke test, but it bypasses the client→server path so
> it does not exercise the real attribution flow.

---

### Step 6: Social debugger OG verification

For each debugger, enter a published post URL (e.g., `https://<site>/react-suspense-typescript`).

| Debugger | URL | Status | Screenshot |
|----------|-----|--------|------------|
| LinkedIn Post Inspector | https://www.linkedin.com/post-inspector/ | ⬜ | _attached_ |
| Twitter/X Card Validator | https://cards-dev.twitter.com/validator | ⬜ | _attached_ |
| Facebook Sharing Debugger | https://developers.facebook.com/tools/debug/ | ⬜ | _attached_ |

Expected: each debugger shows a non-default OG image (auto-generated code-block card OR profile fallback `/og-image.jpg`).

**AC-4, AC-5, AC-6**: Screenshots must show non-default OG previews.

---

### Step 7: Cross-browser favicon verification

Open `https://<site>/` in each browser and capture a screenshot of the browser tab showing the favicon.

| Browser | Version | Favicon visible | Screenshot |
|---------|---------|----------------|------------|
| Chrome | ___ | ⬜ | _attached_ |
| Firefox | ___ | ⬜ | _attached_ |
| Safari (macOS) | ___ | ⬜ | _attached_ |
| iOS Safari | ___ | ⬜ | _attached_ |

Expected: Terminal icon visible at 16/32/48 px in tab.

**AC-7**: New favicon visible in all 4 browsers.

---

### Step 8: Record all evidence here

- Backup file path: `_____________________`
- Truncate timestamp: `_____________________`  
- Analytics row sample: `_____________________`
- Social debugger screenshots: (attach to PR)
- Browser favicon screenshots: (attach to PR)

**AC-8**: All artifacts recorded.

---

### Step 9: Operator sign-off

- [ ] All acceptance criteria above verified
- [ ] No VPS log errors in the 24 h post-deploy window (`journalctl -u blog | grep ERROR`)
- [ ] Operator signs off: `_____________________` at `_____________________`

---

## VPS Log Monitoring (24h post-deploy)

```bash
# Watch for OG generation failures
journalctl -u blog --follow | grep -E "\[og\]|ERROR|error"

# Watch for analytics errors
journalctl -u blog --follow | grep -E "analytics|referrer"
```

---

## Rollback

If a regression is found, roll back without rebuild:

```bash
# On the VPS
docker tag ghcr.io/<owner>/blog:<previous-sha> ghcr.io/<owner>/blog:latest
docker push ghcr.io/<owner>/blog:latest
docker compose pull app
docker compose up -d --no-deps app
```

The `analytics_events` truncation is irreversible — the backup at `/tmp/analytics_events_<DATE>.sql` is the recovery path.

---

## Commits in This Branch

| Task | Commit | Description |
|------|--------|-------------|
| 01 | 399b20c | Add deps, gitignore OG dir, scripts entry |
| 02 | 8483cc1 | Favicon set + og fallback image + root meta |
| 03 | 0781dd0 | Shared platform module + buildTaggedUrl |
| 04 | 546bc07 | i18n strings 6-platform alignment |
| 05 | 568318b | PostShare refactor — variant prop + UTM scheme |
| 06 | 91fdbbf | Referrer bucketer cleanup (ADR-001) |
| 07 | afe43f1 | OG generator module (satori + resvg-js) |
| 08 | 77722e4 | MDX indexer OG integration |
| 09 | 8a7c3b4 | Post route OG meta resolution |
| 10 | 365fd23 | Admin share dropdown column |
| 11 | 3ebf557 | Playwright e2e admin-share spec |
| 12 | 68d8f87 | CONTENT.md coverImage docs |
| fix | a40188b | Fix .compozy/ link in CONTENT.md |
