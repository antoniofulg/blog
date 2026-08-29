import { describe, expect, mock, test } from "bun:test";
import { getHealthHandler, getHealthResponse } from "#/routes/healthz.server";

mock.module("@tanstack/react-router", () => ({
	createFileRoute: () => (config: unknown) => config,
}));

const { Route } = await import("#/routes/healthz");

describe("health endpoint", () => {
	test("healthy database: returns a non-cacheable 200 response", async () => {
		const response = await getHealthResponse(async () => undefined);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({ status: "ok" });
	});

	test("unavailable database: returns 503 without internal details", async () => {
		const response = await getHealthResponse(async () => {
			throw new Error("database credentials must stay private");
		});

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: "unavailable" });
	});

	test("route contract: wires GET to the health handler", () => {
		// biome-ignore lint/suspicious/noExplicitAny: mocked route exposes raw options.
		expect((Route as any).server.handlers.GET).toBe(getHealthHandler);
	});
});
