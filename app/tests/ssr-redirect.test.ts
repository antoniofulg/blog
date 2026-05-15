import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, detectLocaleFromRequest } from "#/lib/locale";

// ─── helpers ─────────────────────────────────────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

function makeReq(cookie?: string, acceptLang?: string): Request {
	const h: Record<string, string> = {};
	if (cookie) h.Cookie = cookie;
	if (acceptLang) h["Accept-Language"] = acceptLang;
	return new Request("http://localhost/", { headers: h });
}

/** Mirror of beforeLoad redirect decision — pure, no SSR context needed. */
function localeRedirectHref(req: Request): string | null {
	const detected = detectLocaleFromRequest(req);
	return detected !== DEFAULT_LOCALE ? `/${detected}/` : null;
}

// ─── unit: beforeLoad redirect decision (ADR-005) ────────────────────────────
//
// These cover the five cases ADR-005 mandates:
//   (a) cookie=en → no redirect
//   (b) cookie=pt-br → 302 to /pt-br/
//   (c) no cookie + Accept-Language: pt → 302
//   (d) no cookie + Accept-Language: en → no redirect
//   (e) no cookie + no Accept-Language → no redirect
//
// What is NOT covered here (requires a live server):
//   - HTTP status codes (302 vs 200)
//   - Vary: Cookie, Accept-Language header on both 200 and 302 responses
//   Those are covered by the integration block below.

describe("unit: beforeLoad redirect decision (ADR-005)", () => {
	it("(a) cookie=en → no redirect", () => {
		expect(localeRedirectHref(makeReq("locale=en"))).toBeNull();
	});

	it("(b) cookie=pt-br → redirect to /pt-br/", () => {
		expect(localeRedirectHref(makeReq("locale=pt-br"))).toBe("/pt-br/");
	});

	it("(c) no cookie + Accept-Language: pt → redirect to /pt-br/", () => {
		expect(localeRedirectHref(makeReq(undefined, "pt"))).toBe("/pt-br/");
	});

	it("(d) no cookie + Accept-Language: en → no redirect", () => {
		expect(localeRedirectHref(makeReq(undefined, "en-US,en;q=0.9"))).toBeNull();
	});

	it("(e) no cookie + no Accept-Language → no redirect", () => {
		expect(localeRedirectHref(makeReq())).toBeNull();
	});

	it("cookie=en overrides Accept-Language: pt-BR (cookie wins)", () => {
		expect(
			localeRedirectHref(makeReq("locale=en", "pt-BR,pt;q=0.9")),
		).toBeNull();
	});
});

// ─── integration: cookie-first SSR redirect on `/` ───────────────────────────
//
// Requires a running dev/prod server on port 3000.
// Skip when the server is not running (port 3000 is free).

describe.skipIf(port3000Free)("integration: SSR redirect on /", () => {
	const BASE_URL = "http://localhost:3000";

	it("Cookie: locale=pt-br → 302 to /pt-br/", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { Cookie: "locale=pt-br" },
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/pt-br/");
	});

	it("Cookie: locale=en + Accept-Language: pt-BR → 200 (cookie wins)", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { Cookie: "locale=en", "Accept-Language": "pt-BR,pt;q=0.9" },
		});
		expect(res.status).toBe(200);
	});

	it("Accept-Language: pt (no cookie) → 302 to /pt-br/", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { "Accept-Language": "pt" },
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("/pt-br/");
	});

	it("no Cookie + no Accept-Language → 200 (no redirect)", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
		});
		expect(res.status).toBe(200);
	});

	it("/ response includes Vary: Cookie, Accept-Language", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
		});
		const vary = res.headers.get("vary") ?? "";
		expect(vary).toContain("Cookie");
		expect(vary).toContain("Accept-Language");
	});

	it("302 redirect response includes Vary: Cookie, Accept-Language", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { Cookie: "locale=pt-br" },
		});
		expect(res.status).toBe(302);
		const vary = res.headers.get("vary") ?? "";
		expect(vary).toContain("Cookie");
		expect(vary).toContain("Accept-Language");
	});
});
