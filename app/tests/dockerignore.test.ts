import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const dockerignorePath = join(root, ".dockerignore");

describe("unit: .dockerignore", () => {
	let content: string;

	it(".dockerignore exists at project root", () => {
		expect(existsSync(dockerignorePath)).toBe(true);
		content = readFileSync(dockerignorePath, "utf8");
	});

	it("excludes node_modules", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^node_modules$/m);
	});

	it("excludes .env and .env.*", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.env$/m);
		expect(content).toMatch(/^\.env\.\*$/m);
	});

	it("preserves .env.example via negation rule", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^!\.env\.example$/m);
	});

	it("excludes .output", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.output$/m);
	});

	it("excludes .nitro", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.nitro$/m);
	});

	it("excludes .tanstack", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.tanstack$/m);
	});

	it("excludes .git", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.git$/m);
	});

	it("negation rule !.env.example appears after .env.* exclusion", () => {
		content = readFileSync(dockerignorePath, "utf8");
		const envStarIdx = content.indexOf(".env.*");
		const negationIdx = content.indexOf("!.env.example");
		expect(envStarIdx).toBeGreaterThan(-1);
		expect(negationIdx).toBeGreaterThan(envStarIdx);
	});
});
