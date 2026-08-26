import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const dockerignorePath = join(root, ".dockerignore");

describe("unit: .dockerignore", () => {
	let content: string;

	test(".dockerignore exists at project root", () => {
		expect(existsSync(dockerignorePath)).toBe(true);
		content = readFileSync(dockerignorePath, "utf8");
	});

	test("excludes node_modules", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^node_modules$/m);
	});

	test("excludes .env and .env.*", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.env$/m);
		expect(content).toMatch(/^\.env\.\*$/m);
	});

	test("preserves .env.example via negation rule", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^!\.env\.example$/m);
	});

	test("excludes .output", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.output$/m);
	});

	test("excludes .nitro", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.nitro$/m);
	});

	test("excludes .tanstack", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.tanstack$/m);
	});

	test("excludes .git", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.git$/m);
	});

	test("excludes local benchmark and test artifacts", () => {
		content = readFileSync(dockerignorePath, "utf8");
		expect(content).toMatch(/^\.bench$/m);
		expect(content).toMatch(/^docs\/_reports$/m);
		expect(content).toMatch(/^playwright-report$/m);
		expect(content).toMatch(/^test-results$/m);
	});

	test("negation rule !.env.example appears after .env.* exclusion", () => {
		content = readFileSync(dockerignorePath, "utf8");
		const envStarIdx = content.indexOf(".env.*");
		const negationIdx = content.indexOf("!.env.example");
		expect(envStarIdx).toBeGreaterThan(-1);
		expect(negationIdx).toBeGreaterThan(envStarIdx);
	});
});
