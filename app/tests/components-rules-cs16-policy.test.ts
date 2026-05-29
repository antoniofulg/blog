import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RULES_FILE = join(
	import.meta.dirname,
	"../../.agents/rules/components.md",
);

describe("components.md cs16 forward boundary rule", () => {
	const content = readFileSync(RULES_FILE, "utf-8");

	it("contains the cs16 variant mention", () => {
		expect(content).toContain("cs16:");
	});

	it("contains the app/styles/global.css policy reference", () => {
		expect(content).toContain("app/styles/global.css");
	});

	it("regression: prior last bullet (Barrel index.ts) still present and unmodified", () => {
		expect(content).toContain(
			"Barrel index.ts files in components/ directories",
		);
	});

	it("new rule appears after the barrel-index bullet", () => {
		const barrelIdx = content.indexOf(
			"Barrel index.ts files in components/ directories",
		);
		const cs16Idx = content.indexOf("cs16:");
		expect(barrelIdx).toBeGreaterThan(-1);
		expect(cs16Idx).toBeGreaterThan(barrelIdx);
	});
});
