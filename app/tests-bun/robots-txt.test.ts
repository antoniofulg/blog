import { describe, expect, mock, test } from "bun:test";
import { createServer } from "node:net";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

mock.module("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => config,
}));

const { getRobotsResponse, ROBOTS_BODY } = await import(
	"#/routes/robots[.]txt"
);

// ─── Unit: response contract ──────────────────────────────────────────────────

describe("unit: robots.txt handler — response contract", () => {
	test("returns HTTP 200", () => {
		expect(getRobotsResponse().status).toBe(200);
	});

	test("sets content-type: text/plain", () => {
		const contentType = getRobotsResponse().headers.get("content-type");
		expect(contentType).toBe("text/plain");
	});

	test("body contains 'User-agent: *'", async () => {
		expect(await getRobotsResponse().text()).toContain("User-agent: *");
	});

	test("body contains 'Allow: /'", async () => {
		expect(await getRobotsResponse().text()).toContain("Allow: /");
	});

	test("body contains 'Disallow: /admin/'", async () => {
		expect(await getRobotsResponse().text()).toContain("Disallow: /admin/");
	});

	test("body contains 'Disallow: /api/'", async () => {
		expect(await getRobotsResponse().text()).toContain("Disallow: /api/");
	});

	test("body contains 'Disallow: /login'", async () => {
		expect(await getRobotsResponse().text()).toContain("Disallow: /login");
	});

	test("body does NOT contain a Sitemap: directive (V1 baseline)", async () => {
		expect(await getRobotsResponse().text()).not.toContain("Sitemap:");
	});
});

// ─── Unit: ROBOTS_BODY constant ──────────────────────────────────────────────

describe("unit: ROBOTS_BODY — literal content", () => {
	test("matches the V1 baseline exactly", () => {
		expect(ROBOTS_BODY).toBe(
			"User-agent: *\nAllow: /\n\nDisallow: /admin/\nDisallow: /api/\nDisallow: /login\n",
		);
	});

	test("has a blank line between Allow and Disallow blocks", () => {
		const lines = ROBOTS_BODY.split("\n");
		const allowIdx = lines.indexOf("Allow: /");
		expect(lines[allowIdx + 1]).toBe("");
	});
});

// ─── Integration: GET /robots.txt (skipped when dev server not running) ──────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

describe.skipIf(port3000Free)("integration: GET /robots.txt", () => {
	const BASE_URL = "http://localhost:3000";

	test("returns 200", async () => {
		const res = await fetch(`${BASE_URL}/robots.txt`);
		expect(res.status).toBe(200);
	});

	test("content-type is text/plain", async () => {
		const res = await fetch(`${BASE_URL}/robots.txt`);
		expect(res.headers.get("content-type")).toContain("text/plain");
	});

	test("body matches V1 baseline end-to-end", async () => {
		const res = await fetch(`${BASE_URL}/robots.txt`);
		const body = await res.text();
		expect(body).toContain("User-agent: *");
		expect(body).toContain("Allow: /");
		expect(body).toContain("Disallow: /admin/");
		expect(body).toContain("Disallow: /api/");
		expect(body).toContain("Disallow: /login");
		expect(body).not.toContain("Sitemap:");
	});
});
