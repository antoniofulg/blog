import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const contributingPath = join(root, "CONTRIBUTING.md");

describe("unit: CONTRIBUTING.md", () => {
	it("exists at project root", () => {
		expect(existsSync(contributingPath)).toBe(true);
	});

	it("contains make setup and make dev in the quick-start section", () => {
		const content = readFileSync(contributingPath, "utf8");
		expect(content).toContain("make setup");
		expect(content).toContain("make dev");
	});

	it("references make help for the full command list", () => {
		const content = readFileSync(contributingPath, "utf8");
		expect(content).toContain("make help");
	});

	it("mentions both dev paths", () => {
		const content = readFileSync(contributingPath, "utf8");
		expect(content).toContain("make dev");
		expect(content).toContain("make dev-docker");
	});

	it("is 80 lines or fewer", () => {
		const content = readFileSync(contributingPath, "utf8");
		const lines = content.split("\n").length;
		expect(lines).toBeLessThanOrEqual(80);
	});
});
