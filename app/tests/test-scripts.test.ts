import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function scriptsOf(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null || !("scripts" in value))
		return {};
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
const viteConfig = readFileSync(
	new URL("../../vite.config.ts", import.meta.url),
	"utf8",
);
const vitestConfig = readFileSync(
	new URL("../../vitest.config.ts", import.meta.url),
	"utf8",
);

describe("A/B/C test scripts", () => {
	it("keeps test mapped to the Node 24 Vitest reference", () => {
		expect(scripts.test).toBe("bun run test:vitest:node");
	});

	it("pins Node 24 before starting Vitest", () => {
		expect(scripts["test:vitest:node"]).toContain(
			"node scripts/check-test-runtime.ts --runtime=node --version=24 --runner=vitest",
		);
	});

	it("runs Vitest through Bun for the control arm", () => {
		expect(scripts["test:vitest:bun"]).toContain(
			"bun --bun scripts/check-test-runtime.ts --runtime=bun --version=1.4.0 --runner=vitest",
		);
	});

	it("runs only the Bun Test candidate tree", () => {
		expect(scripts["test:bun"]).toContain(
			"bun test --timeout 60000 app/tests-bun",
		);
		expect(scripts["test:bun"]).toContain("--isolate");
	});

	it("includes both TypeScript reference test extensions", () => {
		expect(vitestConfig).toContain('"app/tests/**/*.test.ts"');
		expect(vitestConfig).toContain('"app/tests/**/*.test.tsx"');
	});

	it("isolates Bun-only dependency transforms from the Vite app config", () => {
		expect(vitestConfig).toContain("process.versions.bun");
		expect(vitestConfig).toContain("deps: { inline:");
		expect(viteConfig).not.toContain("deps: { inline:");
	});

	it("pins Bun 1.4 provenance for the candidate", () => {
		expect(scripts["test:bun"]).toContain(
			"--runtime=bun --version=1.4.0 --runner=bun:test --runner-version=1.4.0",
		);
	});

	it("keeps Bun and Node Playwright routes", () => {
		expect(scripts["test:e2e"]).toBe("bun run test:e2e:bun");
		expect(scripts["test:e2e:bun"]).toBe("bunx --bun playwright test");
		expect(scripts["test:e2e:node"]).toBe(
			"node node_modules/@playwright/test/cli.js test",
		);
		expect(scripts["test:e2e:webview"]).toBeUndefined();
		expect(scripts["bench:e2e:webview"]).toBeUndefined();
	});
});
