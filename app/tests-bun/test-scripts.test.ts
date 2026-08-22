import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

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

describe("A/B/C test scripts", () => {
	test("keeps test mapped to the Node 24 Vitest reference", () => {
		expect(scripts.test).toBe("bun run test:vitest:node");
	});

	test("pins Node 24 before starting Vitest", () => {
		expect(scripts["test:vitest:node"]).toContain(
			"node scripts/check-test-runtime.ts --runtime=node --version=24 --runner=vitest",
		);
	});

	test("runs Vitest through Bun for the control arm", () => {
		expect(scripts["test:vitest:bun"]).toContain(
			"bun --bun scripts/check-test-runtime.ts --runtime=bun --version=1.4.0 --runner=vitest",
		);
	});

	test("runs only the Bun Test candidate tree", () => {
		expect(scripts["test:bun"]).toContain(
			"bun test --timeout 60000 app/tests-bun",
		);
	});

	test("pins Bun 1.4 provenance for the candidate", () => {
		expect(scripts["test:bun"]).toContain(
			"--runtime=bun --version=1.4.0 --runner=bun:test --runner-version=1.4.0",
		);
	});
});
