/**
 * Runtime site origin (scheme + host) used to render absolute URLs in
 * `<link rel="canonical">`, `hreflang` alternates, `og:url`, RSS, and the
 * sitemap.
 *
 * Lighthouse SEO scores `hreflang` / `canonical` as `0` when the values are
 * relative paths, costing ~7 points on locale-paired pages. Reading the value
 * from `process.env.SITE_URL` at request time (instead of inlining
 * `import.meta.env.VITE_SITE_URL` at build time, which was never wired into
 * the deploy env) makes the value correct in both the production container
 * and the audit preview server (`scripts/run-audit-fe.ts` sets
 * `SITE_URL=http://localhost:4173`).
 *
 * The `import.meta.env.SSR` guard prevents `process.env` access on the
 * client bundle — Vite leaves the lookup intact, so it would `ReferenceError`
 * in the browser. The client never re-renders `head()` for crawlers, so the
 * SSR-rendered HTML is the only surface that matters for SEO.
 */
export function getSiteOrigin(): string {
	if (!import.meta.env.SSR) return "";
	const raw = process.env.SITE_URL ?? "";
	return raw.replace(/\/+$/, "");
}
