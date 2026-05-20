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
		const arrMatch = raw.match(/^\[(.*)\]$/);
		if (arrMatch) {
			fm[key] = arrMatch[1].split(",").map((s) => s.trim());
		} else if (raw) {
			fm[key] = raw;
		}
	}
	return fm;
}

describe("app-audit SKILL.md", () => {
	const skillPath = join(root, ".agents/skills/app-audit/SKILL.md");

	it("file exists", () => {
		expect(() => lstatSync(skillPath)).not.toThrow();
	});

	it("has valid YAML frontmatter", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toMatch(/^---\n[\s\S]*?\n---/);
	});

	it("frontmatter name is app-audit", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		expect(fm.name).toBe("app-audit");
	});

	it("frontmatter description is non-empty", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		const desc = fm.description ?? "";
		expect(typeof desc).toBe("string");
		expect((desc as string).trim().length).toBeGreaterThan(0);
	});

	it("frontmatter allowed-tools is non-empty array", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		expect(Array.isArray(fm["allowed-tools"])).toBe(true);
		expect((fm["allowed-tools"] as string[]).length).toBeGreaterThan(0);
	});
});

describe("app-audit symlink", () => {
	const symlinkPath = join(root, ".claude/skills/app-audit");

	it("exists as symbolic link", () => {
		const stat = lstatSync(symlinkPath);
		expect(stat.isSymbolicLink()).toBe(true);
	});
});

describe(".claude/commands/app-audit.md", () => {
	const cmdPath = join(root, ".claude/commands/app-audit.md");

	it("file exists", () => {
		expect(() => lstatSync(cmdPath)).not.toThrow();
	});

	it("references SKILL.md", () => {
		const content = readFileSync(cmdPath, "utf8");
		expect(content).toContain("SKILL.md");
	});

	it("references app-audit skill", () => {
		const content = readFileSync(cmdPath, "utf8");
		expect(content).toContain("app-audit");
	});
});

describe(".agents/rules/fe-audit.md", () => {
	const rulePath = join(root, ".agents/rules/fe-audit.md");

	it("file exists", () => {
		expect(() => lstatSync(rulePath)).not.toThrow();
	});

	it("contains all 12 category names", () => {
		const content = readFileSync(rulePath, "utf8");
		const categories = [
			"console-error",
			"hydration-mismatch",
			"network-fail",
			"missing-meta",
			"broken-image",
			"mixed-content",
			"a11y-violation",
			"slow-response",
			"seo-score-drop",
			"perf-budget-breach",
			"best-practices-fail",
			"sweep-error",
		];
		for (const cat of categories) {
			expect(content, `missing category: ${cat}`).toContain(cat);
		}
	});

	it("contains severity keywords", () => {
		const content = readFileSync(rulePath, "utf8");
		expect(content).toContain("blocker");
		expect(content).toContain("major");
		expect(content).toContain("minor");
	});

	it("documents 3 consecutive runs abort condition", () => {
		const content = readFileSync(rulePath, "utf8");
		expect(content).toContain("3 consecutive");
	});

	it("documents triage workflow", () => {
		const content = readFileSync(rulePath, "utf8");
		expect(content).toContain("Triage Workflow");
	});

	it("references Lighthouse", () => {
		const content = readFileSync(rulePath, "utf8");
		expect(content).toContain("Lighthouse");
	});
});

describe("AGENTS.md updates", () => {
	const agentsPath = join(root, "AGENTS.md");

	it("Skill Map contains app-audit row", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("app-audit");
	});

	it("Rules list contains fe-audit.md pointer", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain(".agents/rules/fe-audit.md");
	});
});

describe(".agents/rules/cicd.md app-audit updates", () => {
	const cicdPath = join(root, ".agents/rules/cicd.md");

	it("references app-audit.yml", () => {
		const content = readFileSync(cicdPath, "utf8");
		expect(content).toContain("app-audit.yml");
	});

	it("documents lighthouse input", () => {
		const content = readFileSync(cicdPath, "utf8");
		expect(content).toContain("lighthouse");
	});

	it("documents pull_request.paths trigger", () => {
		const content = readFileSync(cicdPath, "utf8");
		expect(content).toContain("pull_request.paths");
	});
});
