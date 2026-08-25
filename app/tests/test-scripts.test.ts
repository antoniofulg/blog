import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

function scriptsOf(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || !("scripts" in value)) {
		return {};
	}
	const scripts = value.scripts;
	if (typeof scripts !== "object" || scripts === null) return {};
	return Object.fromEntries(
		Object.entries(scripts).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

const scripts = scriptsOf(
	JSON.parse(
		readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
	),
);
const bunfig = readFileSync(
	new URL("../../bunfig.toml", import.meta.url),
	"utf8",
);

describe("test scripts", () => {
	it("maps default and local tests to native Bun Test", () => {
		expect(scripts.test).toBe("bun run test:bun");
		expect(scripts["test:local"]).toBe("bun run test:bun");
	});

	it("pins Bun 1.4 and the native runner before the suite", () => {
		expect(scripts["test:bun"]).toContain(
			"--runtime=bun --version=1.4.0 --runner=bun:test --runner-version=1.4.0",
		);
		expect(scripts["test:bun"]).toContain("bun test --parallel=2 --isolate");
		expect(scripts["test:bun"]).not.toContain("DATABASE_URL=");
	});

	it("uses the canonical test root", () => {
		expect(bunfig).toContain('root = "app/tests"');
		expect(bunfig).not.toContain("app/tests-bun");
	});

	it("removes runner-comparison routes", () => {
		for (const name of Object.keys(scripts)) {
			expect(name.startsWith("test:vitest")).toBe(false);
		}
		expect(scripts["test:parity"]).toBeUndefined();
		expect(scripts["bench:vitest:workers"]).toBeUndefined();
		expect(scripts["bench:test:revalidation"]).toBeUndefined();
	});

	it("exposes the Playwright runtime benchmark alias", () => {
		expect(scripts["bench:e2e:runtimes"]).toBe(
			"bun run scripts/bench-e2e-runtimes.ts",
		);
	});

	it("keeps Bun and Node Playwright routes", () => {
		expect(scripts["test:e2e"]).toBe("bun run test:e2e:bun");
		expect(scripts["test:e2e:bun"]).toBe(
			"bunx --bun playwright test --project=chromium",
		);
		expect(scripts["test:e2e:node"]).toBe(
			"node node_modules/@playwright/test/cli.js test --project=chromium",
		);
		expect(scripts["test:e2e:all"]).toBe("bunx --bun playwright test");
		expect(scripts["test:e2e:webview"]).toBeUndefined();
		expect(scripts["test:e2e:webview:harness"]).toBe(
			"bunx --bun playwright test --config=playwright.webview.config.ts --project=bun-webview-webkit --workers=1",
		);
		expect(scripts["bench:e2e:webview"]).toBeUndefined();
	});
});
