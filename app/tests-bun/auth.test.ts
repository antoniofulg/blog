import { describe, expect, jest, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

mock.module("#/db/client", () => ({
	db: {},
	closeDb: jest.fn(),
}));

// Prevent TanStack Start plugin from stripping server fn handlers.
mock.module("@tanstack/react-start", () => ({
	createServerFn: () => ({
		handler: (fn: unknown) => fn,
	}),
}));

mock.module("@tanstack/react-start/server", () => ({
	getRequest: jest.fn(() => new Request("http://localhost/")),
}));

const { auth, resolveAuthBaseURL } = await import("#/lib/auth");
const { Route } = await import("#/routes/api/auth/$");

// ─── Unit: auth config ────────────────────────────────────────────────────────

describe("unit: auth config", () => {
	test("emailAndPassword is enabled", () => {
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
	});

	test("reactStartCookies is the last plugin in the plugins array", () => {
		const plugins =
			(auth.options.plugins as Array<{ id?: string }> | undefined) ?? [];
		expect(plugins.length).toBeGreaterThan(0);
		const last = plugins[plugins.length - 1];
		expect(last?.id).toBe("react-start-cookies");
	});

	test("plugins array is non-empty", () => {
		const plugins = auth.options.plugins ?? [];
		expect(plugins.length).toBeGreaterThan(0);
	});

	test("resolveAuthBaseURL prefers BETTER_AUTH_URL over SITE_URL", () => {
		expect(
			resolveAuthBaseURL({
				BETTER_AUTH_URL: "https://auth.example",
				SITE_URL: "https://site.example",
			}),
		).toBe("https://auth.example");
	});

	test("resolveAuthBaseURL falls back to SITE_URL and strips trailing slash", () => {
		expect(resolveAuthBaseURL({ SITE_URL: "https://antoniofulg.tech/" })).toBe(
			"https://antoniofulg.tech",
		);
	});

	test("resolveAuthBaseURL is undefined when both auth and site URLs are missing", () => {
		expect(resolveAuthBaseURL({})).toBeUndefined();
	});
});

// ─── Unit: route handler exports ─────────────────────────────────────────────

describe("unit: api/auth/$ handler exports", () => {
	test("Route has GET handler in server.handlers", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(typeof handlers?.GET).toBe("function");
	});

	test("Route has POST handler in server.handlers", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(typeof handlers?.POST).toBe("function");
	});

	test("GET handler is async (returns a Promise)", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		// Minimal smoke: handler is callable and returns a thenable
		// (we do not invoke it to avoid DB calls in unit context)
		expect(handlers?.GET.constructor.name).toBe("AsyncFunction");
	});

	test("POST handler is async (returns a Promise)", () => {
		// biome-ignore lint/suspicious/noExplicitAny: server.handlers is not typed on RouteOptions
		const handlers = (Route.options as any).server?.handlers;
		expect(handlers?.POST.constructor.name).toBe("AsyncFunction");
	});
});

// ─── Unit: client bundle exclusion ───────────────────────────────────────────

describe("unit: client bundle exclusion", () => {
	const configPath = join(import.meta.dirname, "../../vite.config.ts");
	const viteConfig = readFileSync(configPath, "utf-8");

	test("vite.config.ts has server-only stub plugin protecting client bundle", () => {
		expect(viteConfig).toContain("serverOnlyStubPlugin");
	});

	test("TanStack Start import protection is not disabled", () => {
		expect(viteConfig).not.toMatch(
			/importProtection\s*:\s*\{[^}]*enabled\s*:\s*false/,
		);
	});

	test("auth module is in the server-only stub list", () => {
		expect(viteConfig).toContain("#/lib/auth");
	});
});

// ─── Unit: auth client export ─────────────────────────────────────────────────

describe("unit: authClient export", () => {
	test("auth.client.ts exports authClient", async () => {
		const mod = await import("#/lib/auth.client");
		expect(mod.authClient).toBeDefined();
	});
});
