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
 * The SSR vs client branches MUST return the same string for any given
 * request, otherwise TanStack head reconciles the SSR-rendered absolute
 * link against the client's hydrated relative link as two distinct entries
 * — both `<link rel="canonical">` and `<meta property="og:image">` end up
 * duplicated in the DOM, which trips Playwright's strict-mode locator and
 * breaks Lighthouse's canonical/hreflang audits. On the client we mirror
 * `window.location.origin` so the value matches whatever SITE_URL the
 * server used (the audit preview, the prod host, etc.).
 */
export function getSiteOrigin(): string {
	if (import.meta.env.SSR) {
		const raw = process.env.SITE_URL ?? "";
		return raw.replace(/\/+$/, "");
	}
	if (typeof window !== "undefined") return window.location.origin;
	return "";
}
