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

describe("test scripts", () => {
	it("maps local tests to the reliable serialized Bun+Vitest profile", () => {
		expect(scripts.test).toBe("bun run test:vitest:bun");
		expect(scripts["test:local"]).toBe(
			"bun run test:vitest:bun -- --maxWorkers=1",
		);
	});

	it("pins Node 24 before starting Vitest", () => {
		expect(scripts["test:vitest:node"]).toContain(
			"DATABASE_URL=postgres://blog:blog@127.0.0.1:5432/blog",
		);
		expect(scripts["test:vitest:node"]).toContain(
			"node scripts/check-test-runtime.ts --runtime=node --version=24 --runner=vitest",
		);
	});

	it("runs Vitest through Bun for the control arm", () => {
		expect(scripts["test:vitest:bun"]).toContain(
			"DATABASE_URL=postgres://blog:blog@127.0.0.1:5432/blog",
		);
		expect(scripts["test:vitest:bun"]).toContain(
			"bun --bun scripts/check-test-runtime.ts --runtime=bun --version=1.4.0 --runner=vitest",
		);
		expect(scripts["test:vitest:bun"]).not.toContain("--exclude");
	});

	it("exposes bounded matched Vitest and Bun Test profiles", () => {
		expect(scripts["test:parity"]).toBe(
			"TZ=UTC bun run scripts/check-test-parity.ts",
		);
		expect(scripts["test:vitest:bun:1"]).toContain("--maxWorkers=1");
		expect(scripts["test:vitest:bun:2"]).toContain("--maxWorkers=2");
		expect(scripts["test:vitest:bun:4"]).toContain("--maxWorkers=4");
		expect(scripts["test:bun:parity"]).toContain(
			"--runner=bun:test --runner-version=1.4.0",
		);
		expect(scripts["test:bun:parity"]).toContain(
			"bun test app/tests-bun --isolate",
		);
		expect(scripts["test:bun:parallel:2"]).toContain("--parallel=2");
		expect(scripts["test:bun:parallel:2"]).toContain("--isolate");
		expect(scripts["test:bun:parallel:4"]).toContain("--parallel=4");
		expect(scripts["test:bun:parallel:4"]).toContain("--isolate");
	});

	it("keeps shared-state and smol profiles opt-in", () => {
		expect(scripts["test:bun:shared:2"]).toContain("--parallel=2 --no-isolate");
		expect(scripts["test:bun:shared:4"]).toContain("--parallel=4 --no-isolate");
		expect(scripts["test:bun:smol:2"]).toContain(
			"bun --smol test app/tests-bun",
		);
		expect(scripts["test:bun:smol:2"]).toContain("--isolate");
		expect(scripts.test).toBe("bun run test:vitest:bun");
		for (const name of [
			"test:vitest:bun:1",
			"test:vitest:bun:2",
			"test:vitest:bun:4",
			"test:bun:parity",
			"test:bun:parallel:2",
			"test:bun:parallel:4",
			"test:bun:shared:2",
			"test:bun:shared:4",
			"test:bun:smol:2",
		]) {
			expect(scripts[name]).toMatch(
				/^DATABASE_URL=postgres:\/\/blog:blog@127\.0\.0\.1:5432\/blog TZ=UTC /,
			);
			expect(scripts[name]).toContain(
				"DATABASE_URL=postgres://blog:blog@127.0.0.1:5432/blog",
			);
		}
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

	it("exposes the Vitest worker benchmark alias", () => {
		expect(scripts["bench:vitest:workers"]).toBe(
			"bun run scripts/bench-vitest-workers.ts",
		);
	});

	it("exposes the Bun Test revalidation benchmark alias", () => {
		expect(scripts["bench:test:revalidation"]).toBe(
			"bun run scripts/bench-bun-test-revalidation.ts",
		);
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
		expect(scripts["bench:e2e:webview"]).toBeUndefined();
	});
});
