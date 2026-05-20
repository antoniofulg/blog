import "@tanstack/react-start/server-only";
import {
	appendFile,
	mkdir,
	readFile,
	rename,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type { AppAuditFinding } from "#/lib/app-audit/browser-sweep.server";
import { escapeMarkdownCell } from "#/lib/content-audit/reporter.server";
import { formatFingerprint } from "../../../tests/e2e/audit-fingerprint";

const REPORTS_DIR = "docs/_reports";
const SUMMARY_PATH = "docs/audits/SUMMARY.md";

const NEW_HEADER_ROW =
	"| Date       | Type    | Run trigger      | Blocker | Major | Minor | Top finding                                  |\n";
const NEW_SEP_ROW =
	"| ---------- | ------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |\n";

const PREFLIGHT_CATEGORY = "preflight-error" as const;

const ROUTE_INSPECTION_CATEGORIES = [
	"console-error",
	"hydration-mismatch",
	"network-fail",
	"broken-image",
	"missing-meta",
	"mixed-content",
	"slow-response",
	"a11y-violation",
	"seo-score-drop",
	"perf-budget-breach",
	"best-practices-fail",
	"sweep-error",
] as const;

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

const SEV_RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2 };

function sortedByseverity(findings: AppAuditFinding[]): AppAuditFinding[] {
	return [...findings].sort(
		(a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
	);
}

function formatCategorySection(
	category: string,
	group: AppAuditFinding[],
	aborted = false,
): string {
	const lines: string[] = [`## ${category}`, ""];
	if (group.length === 0) {
		lines.push(aborted ? "(not checked — audit aborted)" : "(none)");
	} else {
		for (const f of group) {
			lines.push(`- **${f.category}** (\`${f.filePath}\`)`);
			lines.push(`  - ${f.message}`);
		}
	}
	lines.push("");
	return lines.join("\n");
}

function formatReport(
	findings: AppAuditFinding[],
	triggerLabel: string,
): string {
	const date = today();
	const sorted = sortedByseverity(findings);
	const blockers = sorted.filter((f) => f.severity === "blocker").length;
	const majors = sorted.filter((f) => f.severity === "major").length;
	const minors = sorted.filter((f) => f.severity === "minor").length;
	const fingerprint = formatFingerprint("app", {
		blocker: blockers,
		major: majors,
	});

	const isAborted = findings.some((f) => f.category === PREFLIGHT_CATEGORY);
	const statusLine = isAborted
		? "**Status**: ABORTED AT PREFLIGHT — no route inspections performed"
		: "**Status**: pending  <!-- pending | resolved | acknowledged -->";

	const lines: string[] = [
		`# App Audit — ${date}`,
		"",
		`**Trigger**: ${escapeMarkdownCell(triggerLabel)}`,
		statusLine,
		`**Findings**: ${findings.length} (${blockers} blocker / ${majors} major / ${minors} minor)`,
		fingerprint,
		"",
	];

	const preflightGroup = findings.filter(
		(f) => f.category === PREFLIGHT_CATEGORY,
	);
	lines.push(formatCategorySection(PREFLIGHT_CATEGORY, preflightGroup));

	for (const category of ROUTE_INSPECTION_CATEGORIES) {
		const group = findings.filter((f) => f.category === category);
		lines.push(formatCategorySection(category, group, isAborted));
	}

	return lines.join("\n");
}

function formatSummaryRow(
	findings: AppAuditFinding[],
	triggerLabel: string,
): string {
	const date = today();
	const sorted = sortedByseverity(findings);
	const blockers = sorted.filter((f) => f.severity === "blocker").length;
	const majors = sorted.filter((f) => f.severity === "major").length;
	const minors = sorted.filter((f) => f.severity === "minor").length;

	const topFinding = sorted[0] ?? null;
	const top = topFinding
		? `${topFinding.category}: ${topFinding.message.slice(0, 40)}`
		: "no findings";

	const pad = (s: string, n: number) => s.padEnd(n);
	return (
		`| ${pad(date, 10)} | ${pad("app", 7)} | ${pad(escapeMarkdownCell(triggerLabel), 16)} | ` +
		`${pad(String(blockers), 7)} | ${pad(String(majors), 5)} | ${pad(String(minors), 5)} | ${pad(top, 44)} |\n`
	);
}

export async function initSummary(): Promise<void> {
	const cwd = process.cwd();
	const summaryFile = join(cwd, SUMMARY_PATH);

	await mkdir(join(cwd, "docs", "audits"), { recursive: true });

	let content: string;
	try {
		content = await readFile(summaryFile, "utf-8");
	} catch {
		await writeFile(summaryFile, NEW_HEADER_ROW + NEW_SEP_ROW, "utf-8");
		return;
	}

	// Idempotency check — Type column already present
	if (content.includes("| Type")) {
		return;
	}

	// Migrate pre-Phase-4 format: insert Type column
	let migrated = content;

	migrated = migrated.replace(
		"| Date       | Run trigger      |",
		"| Date       | Type    | Run trigger      |",
	);
	migrated = migrated.replace(
		"| ---------- | ---------------- |",
		"| ---------- | ------- | ---------------- |",
	);
	// Insert `| content |` after date cell in every data row
	migrated = migrated.replace(/^(\| \d{4}-\d{2}-\d{2} \|)/gm, "$1 content |");

	const tmpFile = `${summaryFile}.tmp`;
	await writeFile(tmpFile, migrated, "utf-8");
	await rename(tmpFile, summaryFile);
}

export async function writeReport(
	findings: AppAuditFinding[],
	triggerLabel: string,
): Promise<void> {
	const cwd = process.cwd();
	const date = today();
	const reportFile = join(cwd, REPORTS_DIR, `app-audit-${date}.md`);

	await mkdir(join(cwd, REPORTS_DIR), { recursive: true });
	await writeFile(reportFile, formatReport(findings, triggerLabel), "utf-8");

	await initSummary();
	await appendFile(
		join(cwd, SUMMARY_PATH),
		formatSummaryRow(findings, triggerLabel),
		"utf-8",
	);
}
