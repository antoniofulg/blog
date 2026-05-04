import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

vi.mock("#/db/client", () => ({
	db: {},
	closeDb: vi.fn(),
}));

// Prevent TanStack Start plugin from stripping server fn handlers.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
	}),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: vi.fn(() => new Request("http://localhost/")),
}));

import { auth } from "#/lib/auth";
import { Route } from "#/routes/api/auth/$";

// ─── Unit: auth config ────────────────────────────────────────────────────────

describe("unit: auth config", () => {
	it("emailAndPassword is enabled", () => {
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
	});

	it("reactStartCookies is the last plugin in the plugins array", () => {
		const plugins =
			(auth.options.plugins as Array<{ id?: string }> | undefined) ?? [];
		expect(plugins.length).toBeGreaterThan(0);
		const last = plugins[plugins.length - 1];
		expect(last?.id).toBe("react-start-cookies");
	});

	it("plugins array is non-empty", () => {
		const plugins = auth.options.plugins ?? [];
		expect(plugins.length).toBeGreaterThan(0);
	});
});

// ─── Unit: route handler exports ─────────────────────────────────────────────

describe("unit: api/auth/$ handler exports", () => {
	it("Route has GET handler in server.handlers", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(typeof handlers?.GET).toBe("function");
	});

	it("Route has POST handler in server.handlers", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(typeof handlers?.POST).toBe("function");
	});

	it("GET handler is async (returns a Promise)", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		// Minimal smoke: handler is callable and returns a thenable
		// (we do not invoke it to avoid DB calls in unit context)
		expect(handlers?.GET.constructor.name).toBe("AsyncFunction");
	});

	it("POST handler is async (returns a Promise)", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(handlers?.POST.constructor.name).toBe("AsyncFunction");
	});
});

// ─── Unit: client bundle exclusion ───────────────────────────────────────────

describe("unit: client bundle exclusion", () => {
	const configPath = join(import.meta.dirname, "../../vite.config.ts");
	const viteConfig = readFileSync(configPath, "utf-8");

	it("vite.config.ts has server-only stub plugin protecting client bundle", () => {
		expect(viteConfig).toContain("serverOnlyStubPlugin");
	});

	it("auth module is in the server-only stub list", () => {
		expect(viteConfig).toContain("#/lib/auth");
	});
});

// ─── Unit: auth client export ─────────────────────────────────────────────────

describe("unit: authClient export", () => {
	it("auth.client.ts exports authClient", async () => {
		const mod = await import("#/lib/auth.client");
		expect(mod.authClient).toBeDefined();
	});
});
