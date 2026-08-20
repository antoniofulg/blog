import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { generateLoad } from "#/lib/bench/runtime.server";

let server: Server | undefined;
const hits: string[] = [];

async function startStub(
	handler: (path: string) => { status: number; delayMs?: number },
): Promise<string> {
	hits.length = 0;
	server = createServer((req, res) => {
		const path = req.url ?? "/";
		hits.push(path);
		const { status, delayMs = 0 } = handler(path);
		setTimeout(() => {
			res.writeHead(status, { "content-type": "text/plain" });
			res.end("ok");
		}, delayMs);
	});
	await new Promise<void>((resolve) => server?.listen(0, resolve));
	const { port } = server?.address() as AddressInfo;
	return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
	await new Promise<void>((resolve) => {
		if (!server) return resolve();
		server.close(() => resolve());
	});
	server = undefined;
});

describe("bench load generator", () => {
	it("issues requests round-robin across every route", async () => {
		const base = await startStub(() => ({ status: 200 }));
		await generateLoad(base, ["/", "/blog", "/post", "/pt-br/post"], {
			concurrency: 4,
			durationMs: 300,
		});
		for (const route of ["/", "/blog", "/post", "/pt-br/post"]) {
			expect(hits).toContain(route);
		}
	});

	it("stops on the duration rather than on a request count", async () => {
		const base = await startStub(() => ({ status: 200, delayMs: 40 }));
		const started = Date.now();
		const result = await generateLoad(base, ["/"], {
			concurrency: 2,
			durationMs: 400,
		});
		const elapsed = Date.now() - started;
		expect(elapsed).toBeGreaterThanOrEqual(400);
		expect(elapsed).toBeLessThan(2_000);
		expect(result.totalRequests).toBeGreaterThan(0);
	});

	it("reports latency percentiles in non-decreasing order", async () => {
		const base = await startStub(() => ({ status: 200, delayMs: 5 }));
		const result = await generateLoad(base, ["/"], {
			concurrency: 4,
			durationMs: 400,
		});
		expect(result.latency.p50).toBeGreaterThan(0);
		expect(result.latency.p95).toBeGreaterThanOrEqual(result.latency.p50);
		expect(result.latency.p99).toBeGreaterThanOrEqual(result.latency.p95);
	});

	it("counts every request the server actually received", async () => {
		const base = await startStub(() => ({ status: 200 }));
		const result = await generateLoad(base, ["/"], {
			concurrency: 2,
			durationMs: 300,
		});
		expect(result.totalRequests).toBe(hits.length);
	});

	it("records a failing route with its status instead of discarding it", async () => {
		const base = await startStub((path) => ({
			status: path === "/boom" ? 500 : 200,
		}));
		const result = await generateLoad(base, ["/", "/boom"], {
			concurrency: 2,
			durationMs: 300,
		});
		const failure = result.nonOk.find((n) => n.route === "/boom");
		expect(failure?.status).toBe(500);
		expect(failure?.count).toBeGreaterThan(0);
		expect(result.nonOk.some((n) => n.route === "/")).toBe(false);
	});

	it("keeps failed responses inside the total request count", async () => {
		const base = await startStub(() => ({ status: 500 }));
		const result = await generateLoad(base, ["/"], {
			concurrency: 2,
			durationMs: 300,
		});
		const failed = result.nonOk.reduce((sum, n) => sum + n.count, 0);
		expect(failed).toBe(result.totalRequests);
	});

	it("does more work at higher concurrency for the same duration", async () => {
		const base = await startStub(() => ({ status: 200, delayMs: 20 }));
		const single = await generateLoad(base, ["/"], {
			concurrency: 1,
			durationMs: 400,
		});
		const many = await generateLoad(base, ["/"], {
			concurrency: 8,
			durationMs: 400,
		});
		expect(many.totalRequests).toBeGreaterThan(single.totalRequests);
	});

	it("returns zeroed results rather than dividing by nothing when no route is given", async () => {
		const result = await generateLoad("http://127.0.0.1:1", [], {
			concurrency: 4,
			durationMs: 100,
		});
		expect(result).toEqual({
			latency: { p50: 0, p95: 0, p99: 0 },
			totalRequests: 0,
			nonOk: [],
		});
	});
});
