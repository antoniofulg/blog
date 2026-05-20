import { runAppAudit } from "#/lib/app-audit/checks.server";
import { writeReport } from "#/lib/app-audit/reporter.server";

export function parseTrigger(args: string[]): string {
	const flag = args.find((a) => a.startsWith("--trigger="));
	return flag ? flag.slice("--trigger=".length) : "manual";
}

export function parseRoutes(args: string[]): string[] | undefined {
	const flag = args.find((a) => a.startsWith("--routes="));
	if (!flag) return undefined;
	return flag.slice("--routes=".length).split(",");
}

export function parseLighthouse(
	args: string[],
	ciEnv = process.env.CI,
): boolean {
	if (args.includes("--lighthouse")) return true;
	if (args.includes("--no-lighthouse")) return false;
	return ciEnv !== "true";
}

export type AppAuditCliResult = {
	exitCode: number;
	summaryLine: string;
	countsLine: string;
	reportPath: string;
};

export async function runAppAuditCli(
	args: string[],
	env = process.env,
): Promise<AppAuditCliResult> {
	const trigger = parseTrigger(args);
	const lighthouse = parseLighthouse(args, env.CI);
	const findings = await runAppAudit({ lighthouse });
	await writeReport(findings, trigger);

	const blockers = findings.filter((f) => f.severity === "blocker").length;
	const majors = findings.filter((f) => f.severity === "major").length;
	const minors = findings.filter((f) => f.severity === "minor").length;
	const date = new Date().toISOString().slice(0, 10);
	const reportPath = `docs/_reports/app-audit-${date}.md`;
	const summaryLine = `[audit] ${blockers} blocker / ${majors} major / ${minors} minor → ${reportPath}`;
	const countsLine = `[audit-counts] blockers=${blockers} majors=${majors} minors=${minors}`;

	return { exitCode: blockers > 0 ? 1 : 0, summaryLine, countsLine, reportPath };
}

if (import.meta.main) {
	const { exitCode, summaryLine, countsLine } = await runAppAuditCli(
		process.argv.slice(2),
	);
	console.log(summaryLine);
	console.log(countsLine);
	process.exit(exitCode);
}
