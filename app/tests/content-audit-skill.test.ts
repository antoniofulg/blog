import { lstatSync, readFileSync, readlinkSync } from "node:fs";
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

describe("content-audit SKILL.md", () => {
	const skillPath = join(root, ".agents/skills/content-audit/SKILL.md");

	it("file exists", () => {
		expect(() => lstatSync(skillPath)).not.toThrow();
	});

	it("has valid YAML frontmatter", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toMatch(/^---\n[\s\S]*?\n---/);
	});

	it("frontmatter name is content-audit", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		expect(fm.name).toBe("content-audit");
	});

	it("frontmatter description is non-empty", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		expect(typeof fm.description).toBe("string");
		expect((fm.description as string).trim().length).toBeGreaterThan(0);
	});

	it("frontmatter has allowed-tools list", () => {
		const content = readFileSync(skillPath, "utf8");
		const fm = parseFrontmatter(content);
		const tools = fm["allowed-tools"];
		expect(Array.isArray(tools)).toBe(true);
		expect((tools as string[]).length).toBeGreaterThan(0);
	});

	it("body mentions all 5 categories", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("frontmatter-invalid");
		expect(content).toContain("translation-gap");
		expect(content).toContain("broken-link");
		expect(content).toContain("missing-alt-text");
		expect(content).toContain("series-gap");
	});

	it("body mentions output paths", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("docs/_reports/");
		expect(content).toContain("docs/audits/SUMMARY.md");
	});

	it("body mentions noTranslation opt-out", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("noTranslation");
	});

	it("body mentions abort condition", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("abort");
	});

	it("body mentions app-audit as V2 pivot", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("app-audit");
	});

	it("body references a11y-testing as non-overlapping", () => {
		const content = readFileSync(skillPath, "utf8");
		expect(content).toContain("a11y-testing");
	});
});

describe("content-audit symlink", () => {
	const symlinkPath = join(root, ".claude/skills/content-audit");

	it("exists as a symbolic link", () => {
		const stat = lstatSync(symlinkPath);
		expect(stat.isSymbolicLink()).toBe(true);
	});

	it("resolves to ../../.agents/skills/content-audit", () => {
		const target = readlinkSync(symlinkPath);
		expect(target).toBe("../../.agents/skills/content-audit");
	});
});

describe(".claude/commands/content-audit.md", () => {
	const cmdPath = join(root, ".claude/commands/content-audit.md");

	it("exists", () => {
		expect(() => lstatSync(cmdPath)).not.toThrow();
	});

	it("references the SKILL.md", () => {
		const content = readFileSync(cmdPath, "utf8");
		expect(content).toContain("content-audit");
		expect(content).toContain("SKILL.md");
	});
});

describe(".agents/rules/audit.md", () => {
	const auditPath = join(root, ".agents/rules/audit.md");

	it("exists", () => {
		expect(() => lstatSync(auditPath)).not.toThrow();
	});

	it("contains all 5 category names", () => {
		const content = readFileSync(auditPath, "utf8");
		expect(content).toContain("translation-gap");
		expect(content).toContain("broken-link");
		expect(content).toContain("missing-alt-text");
		expect(content).toContain("series-gap");
		expect(content).toContain("frontmatter-invalid");
	});

	it("contains abort condition", () => {
		const content = readFileSync(auditPath, "utf8");
		expect(content).toContain("abort condition");
	});

	it("mentions a11y-testing is not replaced", () => {
		const content = readFileSync(auditPath, "utf8");
		expect(content).toContain("a11y-testing");
	});

	it("mentions output paths", () => {
		const content = readFileSync(auditPath, "utf8");
		expect(content).toContain("docs/_reports/");
		expect(content).toContain("docs/audits/SUMMARY.md");
	});
});

describe("AGENTS.md content-audit updates", () => {
	const agentsPath = join(root, "AGENTS.md");

	it("lists docs/_reports/ in File Structure", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("docs/_reports/");
	});

	it("lists docs/audits/ in File Structure", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("docs/audits/");
	});

	it("has content-audit in Skill Map", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain("content-audit");
	});

	it("links to .agents/rules/audit.md in Rules list", () => {
		const content = readFileSync(agentsPath, "utf8");
		expect(content).toContain(".agents/rules/audit.md");
	});
});
