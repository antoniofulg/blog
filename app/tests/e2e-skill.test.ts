import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");

function parseFrontmatter(content: string): Record<string, string | string[]> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};
	const fm: Record<string, string | string[]> = {};
	for (const line of match[1].split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const raw = line.slice(colonIdx + 1).trim();
		// Simple inline array: [a, b, c]
		const arrMatch = raw.match(/^\[(.*)\]$/);
		if (arrMatch) {
			fm[key] = arrMatch[1].split(",").map((s) => s.trim());
		} else if (raw) {
			fm[key] = raw;
		}
	}
	return fm;
}

describe("e2e-coverage SKILL", () => {
	const skillPath = join(root, ".agents/skills/e2e-coverage/SKILL.md");

	it("SKILL.md exists", () => {
		expect(() => lstatSync(skillPath)).not.toThrow();
	});

	it("SKILL.md has valid YAML frontmatter with required fields", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toMatch(/^---\n[\s\S]*?\n---/);

		const fm = parseFrontmatter(content);
		expect(fm.name).toBe("e2e-coverage");
		expect(typeof fm.description).toBe("string");
		expect(fm.description).toBeTruthy();
		const tools = fm["allowed-tools"];
		expect(Array.isArray(tools)).toBe(true);
		expect((tools as string[]).length).toBeGreaterThan(0);
	});
});

describe("e2e-coverage symlink", () => {
	const symlinkPath = join(root, ".claude/skills/e2e-coverage");

	it("exists as a symbolic link", () => {
		const stat = lstatSync(symlinkPath);
		expect(stat.isSymbolicLink()).toBe(true);
	});
});

describe(".agents/rules/testing.md", () => {
	const testingPath = join(root, ".agents/rules/testing.md");

	it("exists", () => {
		expect(() => lstatSync(testingPath)).not.toThrow();
	});

	it("contains selector hierarchy marker getByRole", () => {
		const content = readFileSync(testingPath, "utf8");
		expect(content).toContain("getByRole");
	});

	it("contains waitForTimeout ban", () => {
		const content = readFileSync(testingPath, "utf8");
		expect(content).toContain("waitForTimeout");
	});

	it("contains @smoke tag", () => {
		const content = readFileSync(testingPath, "utf8");
		expect(content).toContain("@smoke");
	});

	it("contains 48h SLA rule", () => {
		const content = readFileSync(testingPath, "utf8");
		expect(content).toContain("48");
	});
});

describe(".agents/rules/auth.md e2e anti-patterns", () => {
	const authPath = join(root, ".agents/rules/auth.md");

	it("mentions seeded test user", () => {
		const content = readFileSync(authPath, "utf8");
		expect(content).toContain("seeded test user");
	});

	it("mentions storageState.json", () => {
		const content = readFileSync(authPath, "utf8");
		expect(content).toContain("storageState.json");
	});
});

describe("AGENTS.md updates", () => {
	const agentsPath = join(root, "AGENTS.md");

	it("lists tests/e2e/ in File Structure", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("tests/e2e/");
	});

	it("has e2e-coverage in Skill Map", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("e2e-coverage");
	});

	it("links to .agents/rules/testing.md in Rules list", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain(".agents/rules/testing.md");
	});
});
