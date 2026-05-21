import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildPRCommentBody,
	escapeMarkdownCell,
} from "#/lib/content-audit/reporter.server";
import {
	type AuditType,
	FINGERPRINT_GREP_LITERAL,
	formatFingerprint,
} from "../../tests/e2e/audit-fingerprint";

const root = join(import.meta.dirname, "../..");

describe("unit: audit-fingerprint module", () => {
	describe("formatFingerprint", () => {
		it('formatFingerprint("content", {blocker:0, major:3}) returns exact literal', () => {
			expect(formatFingerprint("content", { blocker: 0, major: 3 })).toBe(
				"<!-- audit-fingerprint:content:blocker=0 major=3 -->",
			);
		});

		it('formatFingerprint("app", {blocker:1, major:5}) returns exact literal', () => {
			expect(formatFingerprint("app", { blocker: 1, major: 5 })).toBe(
				"<!-- audit-fingerprint:app:blocker=1 major=5 -->",
			);
		});

		it("formatFingerprint with zero counts", () => {
			expect(formatFingerprint("content", { blocker: 0, major: 0 })).toBe(
				"<!-- audit-fingerprint:content:blocker=0 major=0 -->",
			);
		});

		it("formatFingerprint with large counts", () => {
			expect(formatFingerprint("app", { blocker: 99, major: 100 })).toBe(
				"<!-- audit-fingerprint:app:blocker=99 major=100 -->",
			);
		});
	});

	describe("FINGERPRINT_GREP_LITERAL", () => {
		it("equals '<!-- audit-fingerprint:' exactly", () => {
			expect(FINGERPRINT_GREP_LITERAL).toBe("<!-- audit-fingerprint:");
		});

		it("is a prefix of any content-type formatFingerprint output", () => {
			const fp = formatFingerprint("content", { blocker: 2, major: 3 });
			expect(fp.startsWith(FINGERPRINT_GREP_LITERAL)).toBe(true);
		});

		it("is a prefix of any app-type formatFingerprint output", () => {
			const fp = formatFingerprint("app", { blocker: 0, major: 1 });
			expect(fp.startsWith(FINGERPRINT_GREP_LITERAL)).toBe(true);
		});
	});

	describe("AuditType TypeScript union", () => {
		it("AuditType accepts 'content'", () => {
			const t: AuditType = "content";
			expect(t).toBe("content");
		});

		it("AuditType accepts 'app'", () => {
			const t: AuditType = "app";
			expect(t).toBe("app");
		});
	});
});

describe("integration: reporter buildPRCommentBody uses formatFingerprint", () => {
	const sampleFindings = [
		{
			category: "translation-gap" as const,
			severity: "major" as const,
			filePath: "app/content/posts/en/foo.mdx",
			message: "English post has no pt-br twin.",
		},
		{
			category: "broken-link" as const,
			severity: "blocker" as const,
			filePath: "app/content/posts/en/bar.mdx",
			message: "Broken link: /missing-post",
		},
	];

	it("embeds content fingerprint in PR comment body", () => {
		const body = buildPRCommentBody(sampleFindings, "manual");
		expect(body).toContain(
			"<!-- audit-fingerprint:content:blocker=1 major=1 -->",
		);
	});

	it("PR comment body starts with FINGERPRINT_GREP_LITERAL in fingerprint line", () => {
		const body = buildPRCommentBody(sampleFindings, "manual");
		expect(body).toContain(FINGERPRINT_GREP_LITERAL);
	});

	it("PR comment body snapshot: zero findings", () => {
		const body = buildPRCommentBody([], "manual");
		expect(body).toContain(
			"<!-- audit-fingerprint:content:blocker=0 major=0 -->",
		);
		expect(body).toContain("| Blocker | 0 |");
		expect(body).toContain("| Major | 0 |");
		expect(body).toContain("| Minor | 0 |");
	});

	it("PR comment body snapshot: mixed severity findings", () => {
		const body = buildPRCommentBody(sampleFindings, "ci-pr-42");
		expect(body).toContain("## Content Audit Results");
		expect(body).toContain("**Trigger**: ci-pr-42");
		expect(body).toContain("| Blocker | 1 |");
		expect(body).toContain("| Major | 1 |");
		expect(body).toContain("| Minor | 0 |");
		expect(body).toContain(
			"<!-- audit-fingerprint:content:blocker=1 major=1 -->",
		);
	});

	it("buildPRCommentBody escapes pipe in trigger label", () => {
		const body = buildPRCommentBody([], "ci|manual");
		expect(body).toContain("ci\\|manual");
	});
});

describe("integration: content-audit workflow uses literal fingerprint prefix", () => {
	const yml = readFileSync(
		join(root, ".github/workflows/content-audit.yml"),
		"utf8",
	);

	it("body-includes starts with '<!-- audit-fingerprint:'", () => {
		const match = yml.match(/body-includes:\s+"([^"]+)"/);
		expect(match).not.toBeNull();
		const bodyIncludes = match?.[1] ?? "";
		expect(bodyIncludes.startsWith("<!-- audit-fingerprint:")).toBe(true);
	});

	it("fingerprint in workflow body uses :content: type segment", () => {
		expect(yml).toContain("<!-- audit-fingerprint:content:blocker=");
	});

	it("delta detection regex matches :content: fingerprint format", () => {
		expect(yml).toContain("audit-fingerprint:content:blocker=");
	});
});

describe("unit: escapeMarkdownCell export", () => {
	it("escapes pipe characters", () => {
		expect(escapeMarkdownCell("foo|bar")).toBe("foo\\|bar");
	});

	it("replaces newlines with spaces", () => {
		expect(escapeMarkdownCell("foo\nbar")).toBe("foo bar");
	});

	it("trims whitespace", () => {
		expect(escapeMarkdownCell("  hello  ")).toBe("hello");
	});
});
