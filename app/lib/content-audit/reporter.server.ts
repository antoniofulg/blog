import "@tanstack/react-start/server-only";
import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Finding } from "#/lib/content-audit/checks.server";
import { formatFingerprint } from "../../../tests/e2e/audit-fingerprint";

const REPORTS_DIR = process.env.AUDIT_REPORTS_DIR ?? "docs/_reports";
const SUMMARY_PATH = process.env.AUDIT_SUMMARY_PATH ?? "docs/audits/SUMMARY.md";

function resolveReportsDir(cwd: string): string {
	return isAbsolute(REPORTS_DIR) ? REPORTS_DIR : join(cwd, REPORTS_DIR);
}

function resolveSummaryFile(cwd: string): string {
	return isAbsolute(SUMMARY_PATH) ? SUMMARY_PATH : join(cwd, SUMMARY_PATH);
}
const SUMMARY_HEADER =
	"| Date       | Run trigger      | Blocker | Major | Minor | Top finding                                  |\n" +
	"| ---------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |\n";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function escapeMarkdownCell(s: string): string {
	return s
		.replace(/\|/g, "\\|")
		.replace(/[\n\r]/g, " ")
		.trim();
}

function formatSection(label: string, group: Finding[]): string {
	const lines: string[] = [`## ${label}`, ""];
	if (group.length === 0) {
		lines.push("(none)");
	} else {
		for (const f of group) {
			lines.push(`- **${f.category}** (\`${f.filePath}\`)`);
			lines.push(`  - ${f.message}`);
		}
	}
	lines.push("");
	return lines.join("\n");
}

function formatReport(findings: Finding[], triggerLabel: string): string {
	const date = today();
	const blockers = findings.filter((f) => f.severity === "blocker");
	const majors = findings.filter((f) => f.severity === "major");
	const minors = findings.filter((f) => f.severity === "minor");

	const lines: string[] = [
		`# Content Audit — ${date}`,
		"",
		`**Trigger**: ${escapeMarkdownCell(triggerLabel)}`,
		`**Status**: pending  <!-- pending | resolved | acknowledged -->`,
		`**Findings**: ${findings.length} (${blockers.length} blocker / ${majors.length} major / ${minors.length} minor)`,
		"",
		formatSection("Blocker", blockers),
		formatSection("Major", majors),
		formatSection("Minor", minors),
	];

	return lines.join("\n");
}

function formatSummaryRow(findings: Finding[], triggerLabel: string): string {
	const date = today();
	const blockers = findings.filter((f) => f.severity === "blocker").length;
	const majors = findings.filter((f) => f.severity === "major").length;
	const minors = findings.filter((f) => f.severity === "minor").length;

	const sevRank: Record<string, number> = { blocker: 0, major: 1, minor: 2 };
	const topFinding =
		findings.length > 0
			? [...findings].sort(
					(a, b) => sevRank[a.severity] - sevRank[b.severity],
				)[0]
			: null;
	const top = topFinding
		? `${topFinding.category}: ${topFinding.message.slice(0, 40)}`
		: "no findings";

	const pad = (s: string, n: number) => s.padEnd(n);
	return `| ${pad(date, 10)} | ${pad(escapeMarkdownCell(triggerLabel), 16)} | ${pad(String(blockers), 7)} | ${pad(String(majors), 5)} | ${pad(String(minors), 5)} | ${pad(top, 44)} |\n`;
}

export function buildPRCommentBody(
	findings: Finding[],
	triggerLabel: string,
): string {
	const blockers = findings.filter((f) => f.severity === "blocker").length;
	const majors = findings.filter((f) => f.severity === "major").length;
	const minors = findings.filter((f) => f.severity === "minor").length;
	const fingerprint = formatFingerprint("content", {
		blocker: blockers,
		major: majors,
	});

	const lines: string[] = [
		"## Content Audit Results",
		"",
		`**Trigger**: ${escapeMarkdownCell(triggerLabel)}`,
		"",
		"| Severity | Count |",
		"|----------|-------|",
		`| Blocker | ${blockers} |`,
		`| Major | ${majors} |`,
		`| Minor | ${minors} |`,
		"",
		fingerprint,
	];
	return lines.join("\n");
}

export async function writeReport(
	findings: Finding[],
	triggerLabel: string,
): Promise<void> {
	const cwd = process.cwd();
	const date = today();
	const reportsDir = resolveReportsDir(cwd);
	const reportFile = join(reportsDir, `content-audit-${date}.md`);
	const summaryFile = resolveSummaryFile(cwd);

	await mkdir(reportsDir, { recursive: true });
	await mkdir(dirname(summaryFile), { recursive: true });

	await writeFile(reportFile, formatReport(findings, triggerLabel), "utf-8");

	let summaryExists = true;
	try {
		await access(summaryFile);
	} catch {
		summaryExists = false;
	}

	if (!summaryExists) {
		await writeFile(summaryFile, SUMMARY_HEADER, "utf-8");
	}

	await appendFile(
		summaryFile,
		formatSummaryRow(findings, triggerLabel),
		"utf-8",
	);
}
