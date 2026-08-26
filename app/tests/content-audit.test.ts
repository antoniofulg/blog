import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const siteModelMocks = (() => ({
	getPostInventory: jest.fn().mockResolvedValue([]),
	getRouteInventory: jest.fn().mockResolvedValue([]),
}))();

mock.module("#/lib/site-model.server", () => ({
	getPostInventory: siteModelMocks.getPostInventory,
	getRouteInventory: siteModelMocks.getRouteInventory,
}));

import {
	checkBrokenLinks,
	checkFrontmatter,
	checkMissingAltText,
	checkSeriesGaps,
	checkTranslationGaps,
	type Finding,
	runContentAudit,
} from "#/lib/content-audit/checks.server";

const { writeReport } = await import("#/lib/content-audit/reporter.server");

import type { PostEntry } from "#/lib/site-model.server";
import type { PostFrontmatter } from "#/types/content";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIXTURES = join(process.cwd(), "app/tests/fixtures/content-audit");

function fix(name: string) {
	return join(FIXTURES, name);
}

function makePost(overrides: Partial<PostEntry> = {}): PostEntry {
	const frontmatter: PostFrontmatter = {
		title: "Test Post",
		description: "A test post",
		...overrides.frontmatter,
	};
	return {
		slug: "test-post",
		lang: "en",
		filePath: fix("valid.mdx"),
		frontmatter,
		hasTwin: true,
		...overrides,
	};
}

async function fileExists(path: string): Promise<boolean> {
	return readFile(path)
		.then(() => true)
		.catch(() => false);
}

// ─── checkFrontmatter ─────────────────────────────────────────────────────────

describe("checkFrontmatter", () => {
	test("fixture missing title → blocker finding", async () => {
		const findings = await checkFrontmatter([fix("no-title.mdx")]);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("frontmatter-invalid");
		expect(findings[0].severity).toBe("blocker");
		expect(findings[0].message).toMatch(/title/i);
	});

	test("valid fixture → no finding", async () => {
		const findings = await checkFrontmatter([fix("valid.mdx")]);
		expect(findings).toHaveLength(0);
	});

	test("multiple files → one finding per bad file", async () => {
		const findings = await checkFrontmatter([
			fix("no-title.mdx"),
			fix("valid.mdx"),
		]);
		expect(findings).toHaveLength(1);
		expect(findings[0].filePath).toBe(fix("no-title.mdx"));
	});

	test("nonexistent file → blocker finding (parse error)", async () => {
		const findings = await checkFrontmatter(["/nonexistent/path/file.mdx"]);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("frontmatter-invalid");
		expect(findings[0].severity).toBe("blocker");
	});

	test("severity is always blocker for frontmatter-invalid", async () => {
		const findings = await checkFrontmatter([fix("no-title.mdx")]);
		expect(findings[0].severity).toBe("blocker");
	});
});

// ─── checkTranslationGaps ─────────────────────────────────────────────────────

describe("checkTranslationGaps", () => {
	test("post with hasTwin=false → major finding", () => {
		const posts = [makePost({ hasTwin: false })];
		const findings = checkTranslationGaps(posts);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("translation-gap");
		expect(findings[0].severity).toBe("major");
	});

	test("post with hasTwin=false and noTranslation=true → no finding", () => {
		const posts = [
			makePost({
				hasTwin: false,
				frontmatter: { title: "No Translation", noTranslation: true },
			}),
		];
		const findings = checkTranslationGaps(posts);
		expect(findings).toHaveLength(0);
	});

	test("post with hasTwin=true → no finding", () => {
		const posts = [makePost({ hasTwin: true })];
		const findings = checkTranslationGaps(posts);
		expect(findings).toHaveLength(0);
	});

	test("finding includes filePath and message", () => {
		const posts = [makePost({ hasTwin: false, filePath: fix("valid.mdx") })];
		const findings = checkTranslationGaps(posts);
		expect(findings[0].filePath).toBe(fix("valid.mdx"));
		expect(findings[0].message).toBeTruthy();
	});

	test("multiple posts: only the untwinned one produces a finding", () => {
		const posts = [
			makePost({ slug: "no-twin", hasTwin: false }),
			makePost({ slug: "has-twin", hasTwin: true }),
		];
		const findings = checkTranslationGaps(posts);
		expect(findings).toHaveLength(1);
		expect(findings[0].message).toContain("no-twin");
	});
});

// ─── checkBrokenLinks ─────────────────────────────────────────────────────────

describe("checkBrokenLinks", () => {
	const knownSlugs = new Set(["existing-post"]);
	const knownPaths = new Set(["/", "/about", "/login"]);

	test("published post with broken internal link → blocker", async () => {
		const posts = [makePost({ filePath: fix("broken-link.mdx") })];
		const findings = await checkBrokenLinks(posts, knownSlugs, knownPaths);
		const blocker = findings.find((f) => f.severity === "blocker");
		expect(blocker).toBeDefined();
		expect(blocker?.category).toBe("broken-link");
		expect(blocker?.message).toContain("/non-existent");
	});

	test("draft post with broken internal link → minor", async () => {
		const posts = [
			makePost({
				filePath: fix("broken-link.mdx"),
				frontmatter: {
					title: "Test Post",
					description: "A test post",
					draft: true,
				},
			}),
		];
		const findings = await checkBrokenLinks(posts, knownSlugs, knownPaths);
		const minor = findings.find((f) => f.category === "broken-link");
		expect(minor).toBeDefined();
		expect(minor?.severity).toBe("minor");
	});

	test("post with valid route link → no finding", async () => {
		const posts = [makePost({ filePath: fix("good-link.mdx") })];
		const findings = await checkBrokenLinks(posts, knownSlugs, knownPaths);
		expect(findings).toHaveLength(0);
	});

	test("finding includes line number from link source", async () => {
		const posts = [makePost({ filePath: fix("broken-link.mdx") })];
		const findings = await checkBrokenLinks(posts, knownSlugs, knownPaths);
		const broken = findings.find((f) => f.category === "broken-link");
		expect(broken?.line).toBeGreaterThan(0);
	});

	test("links with locale prefixes resolve via slug extraction → no finding", async () => {
		const posts = [makePost({ filePath: fix("locale-link.mdx") })];
		const findings = await checkBrokenLinks(
			posts,
			new Set(["existing-post"]),
			new Set(["/"]),
		);
		expect(findings).toHaveLength(0);
	});

	test("dynamic href in JSX → minor finding (not silently dropped)", async () => {
		const dynamicPosts = [
			makePost({
				filePath: fix("../link-parser/expression-attr.mdx"),
			}),
		];
		const findings = await checkBrokenLinks(
			dynamicPosts,
			new Set<string>(),
			new Set<string>(),
		);
		const skippedFinding = findings.find((f) =>
			f.message.includes("Dynamic href"),
		);
		expect(skippedFinding).toBeDefined();
		expect(skippedFinding?.severity).toBe("minor");
	});
});

// ─── checkMissingAltText ──────────────────────────────────────────────────────

describe("checkMissingAltText", () => {
	test("image with no alt text → major finding", async () => {
		const posts = [makePost({ filePath: fix("missing-alt.mdx") })];
		const findings = await checkMissingAltText(posts);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("missing-alt-text");
		expect(findings[0].severity).toBe("major");
		expect(findings[0].message).toContain("image.png");
	});

	test("image with alt text → no finding", async () => {
		const posts = [makePost({ filePath: fix("has-alt.mdx") })];
		const findings = await checkMissingAltText(posts);
		expect(findings).toHaveLength(0);
	});

	test("post with no images → no finding", async () => {
		const posts = [makePost({ filePath: fix("valid.mdx") })];
		const findings = await checkMissingAltText(posts);
		expect(findings).toHaveLength(0);
	});

	test("finding includes line number", async () => {
		const posts = [makePost({ filePath: fix("missing-alt.mdx") })];
		const findings = await checkMissingAltText(posts);
		expect(findings[0].line).toBeGreaterThan(0);
	});
});

// ─── checkSeriesGaps ──────────────────────────────────────────────────────────

describe("checkSeriesGaps", () => {
	test("published posts with gap in parts → minor finding", () => {
		const posts = [
			makePost({
				slug: "part1",
				frontmatter: { title: "Part 1", series: "foo", seriesPart: 1 },
			}),
			makePost({
				slug: "part3",
				frontmatter: { title: "Part 3", series: "foo", seriesPart: 3 },
			}),
		];
		const findings = checkSeriesGaps(posts);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("series-gap");
		expect(findings[0].severity).toBe("minor");
		expect(findings[0].message).toContain("foo");
		expect(findings[0].message).toContain("2");
	});

	test("published posts with contiguous parts → no finding", () => {
		const posts = [
			makePost({
				slug: "part1",
				frontmatter: { title: "Part 1", series: "bar", seriesPart: 1 },
			}),
			makePost({
				slug: "part2",
				frontmatter: { title: "Part 2", series: "bar", seriesPart: 2 },
			}),
		];
		const findings = checkSeriesGaps(posts);
		expect(findings).toHaveLength(0);
	});

	test("draft post creates gap among published — still a finding", () => {
		const posts = [
			makePost({
				slug: "p1",
				frontmatter: { title: "Part 1", series: "baz", seriesPart: 1 },
			}),
			makePost({
				slug: "p2",
				frontmatter: {
					title: "Part 2 (draft)",
					series: "baz",
					seriesPart: 2,
					draft: true,
				},
			}),
			makePost({
				slug: "p3",
				frontmatter: { title: "Part 3", series: "baz", seriesPart: 3 },
			}),
		];
		// Only parts 1 and 3 are non-draft → gap at 2
		const findings = checkSeriesGaps(posts);
		expect(findings).toHaveLength(1);
		expect(findings[0].message).toContain("2");
	});

	test("posts without series field → no finding", () => {
		const posts = [makePost()];
		const findings = checkSeriesGaps(posts);
		expect(findings).toHaveLength(0);
	});

	test("series detail record includes series name and expected part", () => {
		const posts = [
			makePost({
				slug: "p1",
				frontmatter: { title: "P1", series: "myser", seriesPart: 1 },
			}),
			makePost({
				slug: "p3",
				frontmatter: { title: "P3", series: "myser", seriesPart: 3 },
			}),
		];
		const findings = checkSeriesGaps(posts);
		expect(findings[0].detail?.series).toBe("myser");
		expect(findings[0].detail?.expectedPart).toBe(2);
	});

	test("multiple gaps in same series — all reported, not just the first", () => {
		const posts = [
			makePost({
				slug: "p1",
				frontmatter: { title: "P1", series: "multi", seriesPart: 1 },
			}),
			makePost({
				slug: "p3",
				frontmatter: { title: "P3", series: "multi", seriesPart: 3 },
			}),
			makePost({
				slug: "p5",
				frontmatter: { title: "P5", series: "multi", seriesPart: 5 },
			}),
		];
		const findings = checkSeriesGaps(posts);
		expect(findings).toHaveLength(2);
		const missingParts = findings.map((f) => f.detail?.expectedPart).sort();
		expect(missingParts).toEqual([2, 4]);
	});
});

// ─── writeReport ──────────────────────────────────────────────────────────────

describe("writeReport", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "content-audit-test-"));
		jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("creates per-run report at expected path", async () => {
		await writeReport([], "manual");
		const date = new Date().toISOString().slice(0, 10);
		const reportPath = join(
			tmpDir,
			"docs/_reports",
			`content-audit-${date}.md`,
		);
		expect(await fileExists(reportPath)).toBe(true);
	});

	test("report contains documented sections", async () => {
		const findings: Finding[] = [
			{
				category: "broken-link",
				severity: "blocker",
				filePath: "app/content/posts/en/post.mdx",
				message: "Broken internal link: /bad",
			},
			{
				category: "translation-gap",
				severity: "major",
				filePath: "app/content/posts/en/post.mdx",
				message: "Post 'post' (en) has no translation twin.",
			},
			{
				category: "series-gap",
				severity: "minor",
				filePath: "app/content/posts/en/part3.mdx",
				message: "Series 'foo' has parts [1, 3]; part 2 missing.",
			},
		];
		await writeReport(findings, "PR #42 (push)");

		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/_reports", `content-audit-${date}.md`),
			"utf-8",
		);
		expect(content).toContain(`# Content Audit — ${date}`);
		expect(content).toContain("**Trigger**: PR #42 (push)");
		expect(content).toContain("**Status**: pending");
		expect(content).toContain("## Blocker");
		expect(content).toContain("## Major");
		expect(content).toContain("## Minor");
		expect(content).toContain("broken-link");
		expect(content).toContain("translation-gap");
		expect(content).toContain("series-gap");
	});

	test("empty findings → all sections show (none)", async () => {
		await writeReport([], "manual");
		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/_reports", `content-audit-${date}.md`),
			"utf-8",
		);
		expect(content.match(/\(none\)/g)?.length).toBe(3);
	});

	test("initializes SUMMARY.md with header if missing", async () => {
		await writeReport([], "manual");
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(content).toContain("| Date");
		expect(content).toContain("| ----------");
	});

	test("appends a row to SUMMARY.md", async () => {
		const findings: Finding[] = [
			{
				category: "translation-gap",
				severity: "major",
				filePath: "foo.mdx",
				message: "Post 'x' (en) has no translation twin.",
			},
		];
		await writeReport(findings, "ci-push");

		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		const date = new Date().toISOString().slice(0, 10);
		expect(content).toContain(date);
		expect(content).toContain("ci-push");
		expect(content).toContain("translation-gap");
	});

	test("second call same day overwrites report and appends a second SUMMARY row", async () => {
		await writeReport([], "first");
		await writeReport([], "second");

		const date = new Date().toISOString().slice(0, 10);
		const reportContent = await readFile(
			join(tmpDir, "docs/_reports", `content-audit-${date}.md`),
			"utf-8",
		);
		expect(reportContent).toContain("second");

		const summaryContent = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		const rows = summaryContent
			.split("\n")
			.filter((l) => l.startsWith("|") && l.includes(date));
		expect(rows.length).toBe(2);
	});

	test("finding counts in SUMMARY row match findings array", async () => {
		const findings: Finding[] = [
			{
				category: "broken-link",
				severity: "blocker",
				filePath: "f.mdx",
				message: "b",
			},
			{
				category: "translation-gap",
				severity: "major",
				filePath: "f.mdx",
				message: "m",
			},
			{
				category: "series-gap",
				severity: "minor",
				filePath: "f.mdx",
				message: "s",
			},
		];
		await writeReport(findings, "test-run");

		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(content).toMatch(/\|\s*1\s*\|\s*1\s*\|\s*1\s*\|/);
	});

	test("pipe in triggerLabel is escaped in SUMMARY row (issue 004)", async () => {
		await writeReport([], "ci|pipe");
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		const dataRow = content
			.split("\n")
			.find((l) => l.startsWith("|") && l.includes("ci"));
		expect(dataRow).toBeDefined();
		// Row must not split into extra columns from an unescaped pipe
		// Use negative lookbehind to not split on escaped \| sequences
		const cols = dataRow?.split(/(?<!\\)\|/).filter((c) => c.trim() !== "");
		expect(cols).toHaveLength(6);
	});

	test("newline in triggerLabel does not break SUMMARY row (issue 004)", async () => {
		await writeReport([], "line1\nline2");
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		const rows = content
			.split("\n")
			.filter((l) => l.startsWith("|") && l.includes("line1"));
		expect(rows).toHaveLength(1);
	});

	test("SUMMARY top-finding reflects highest severity, not insertion order (issue 005)", async () => {
		const findings: Finding[] = [
			{
				category: "translation-gap",
				severity: "major",
				filePath: "f.mdx",
				message: "major finding first in array",
			},
			{
				category: "broken-link",
				severity: "blocker",
				filePath: "f.mdx",
				message: "blocker inserted second",
			},
		];
		await writeReport(findings, "severity-order-test");
		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		const dataRow = content
			.split("\n")
			.find((l) => l.startsWith("|") && l.includes(date));
		expect(dataRow).toBeDefined();
		// Top finding column should reference the blocker, not the major
		expect(dataRow).toContain("broken-link");
	});
});

// ─── runContentAudit (integration) ───────────────────────────────────────────

describe("runContentAudit integration", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test("returns Finding[] with expected categories when given fixture posts", async () => {
		const mockPosts = [
			makePost({
				slug: "broken-link",
				filePath: fix("broken-link.mdx"),
				hasTwin: false,
			}),
			makePost({
				slug: "missing-alt",
				filePath: fix("missing-alt.mdx"),
				hasTwin: true,
			}),
		];
		siteModelMocks.getPostInventory.mockResolvedValue(mockPosts);
		siteModelMocks.getRouteInventory.mockResolvedValue([
			{
				path: "/",
				locale: "en",
				auth: "public",
				expectedStatus: 200,
				intent: "home",
			},
			{
				path: "/about",
				locale: "en",
				auth: "public",
				expectedStatus: 200,
				intent: "about",
			},
			{
				path: "/login",
				locale: null,
				auth: "public",
				expectedStatus: 200,
				intent: "login",
			},
		]);

		const findings = await runContentAudit(FIXTURES);
		const categories = findings.map((f) => f.category);

		expect(categories).toContain("frontmatter-invalid");
		expect(categories).toContain("translation-gap");
		expect(categories).toContain("broken-link");
		expect(categories).toContain("missing-alt-text");
	});

	test("returns an array even with no posts", async () => {
		siteModelMocks.getPostInventory.mockResolvedValue([]);
		siteModelMocks.getRouteInventory.mockResolvedValue([]);

		const findings = await runContentAudit(FIXTURES);
		expect(Array.isArray(findings)).toBe(true);
		expect(findings.some((f) => f.category === "frontmatter-invalid")).toBe(
			true,
		);
	});

	test("full runContentAudit + writeReport produces readable markdown", async () => {
		siteModelMocks.getPostInventory.mockResolvedValue([]);
		siteModelMocks.getRouteInventory.mockResolvedValue([]);

		const tmpDir = await mkdtemp(join(tmpdir(), "audit-report-test-"));
		jest.spyOn(process, "cwd").mockReturnValue(tmpDir);

		try {
			const findings = await runContentAudit(FIXTURES);
			await writeReport(findings, "integration-test");

			const date = new Date().toISOString().slice(0, 10);
			const content = await readFile(
				join(tmpDir, "docs/_reports", `content-audit-${date}.md`),
				"utf-8",
			);
			expect(content).toContain("# Content Audit");
			expect(content).toContain("## Blocker");
			expect(content).toContain("## Major");
			expect(content).toContain("## Minor");
			expect(content.length).toBeGreaterThan(100);
		} finally {
			jest.restoreAllMocks();
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});
