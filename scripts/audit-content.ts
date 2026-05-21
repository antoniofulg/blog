import { runContentAudit } from "#/lib/content-audit/checks.server";
import { writeReport } from "#/lib/content-audit/reporter.server";

export function parseTrigger(args: string[]): string {
	const flag = args.find((a) => a.startsWith("--trigger="));
	return flag ? flag.slice("--trigger=".length) : "manual";
}

export function parseContentDir(args: string[]): string | undefined {
	const flag = args.find((a) => a.startsWith("--content-dir="));
	return flag ? flag.slice("--content-dir=".length) : undefined;
}

export type AuditResult = {
	exitCode: number;
	summaryLine: string;
	countsLine: string;
	reportPath: string;
};

export async function runAuditCli(args: string[]): Promise<AuditResult> {
	const trigger = parseTrigger(args);
	const contentDir = parseContentDir(args);
	const findings = await runContentAudit(contentDir);
	await writeReport(findings, trigger);

	const blockers = findings.filter((f) => f.severity === "blocker").length;
	const majors = findings.filter((f) => f.severity === "major").length;
	const minors = findings.filter((f) => f.severity === "minor").length;
	const date = new Date().toISOString().slice(0, 10);
	const reportPath = `docs/_reports/content-audit-${date}.md`;
	const summaryLine = `[audit] ${blockers} blocker / ${majors} major / ${minors} minor → ${reportPath}`;
	const countsLine = `[audit-counts] blockers=${blockers} majors=${majors} minors=${minors}`;

	return { exitCode: blockers > 0 ? 1 : 0, summaryLine, countsLine, reportPath };
}

if (import.meta.main) {
	const { exitCode, summaryLine, countsLine } = await runAuditCli(
		process.argv.slice(2),
	);
	console.log(summaryLine);
	console.log(countsLine);
	process.exit(exitCode);
}
