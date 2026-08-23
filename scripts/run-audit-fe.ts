#!/usr/bin/env bun
// One-shot orchestrator for `make audit-fe`.
//
// Spawns the Nitro preview server (.output/server/index.mjs) on PORT=4173,
// waits for that child to announce readiness, runs the app audit, then reaps it on
// success / failure / signal. Replaces the prior manual two-terminal pattern
// (run `bun preview` separately, then `make audit-fe`) which was racy and
// also pointed operators at the wrong command — `vite preview` does not
// serve the TanStack Start Nitro bundle.
//
// Honors:
//   - AUDIT_PREVIEW_PORT (default "4173")
//   - DATABASE_URL (passed through to the spawned server; required)
//   - SITE_URL is forced to the audit preview origin so SSR and hydration agree.
//   - All `audit:fe` CLI flags forwarded after orchestration setup.
import { spawn, type ChildProcess } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseBaseUrl, runAppAuditCli } from "./audit-fe";

const PORT = process.env.AUDIT_PREVIEW_PORT ?? "4173";
const BASE_URL = `http://localhost:${PORT}`;
const NITRO_BUNDLE = join(process.cwd(), ".output/server/index.mjs");
const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;

async function nitroBundleExists(): Promise<boolean> {
	try {
		await access(NITRO_BUNDLE);
		return true;
	} catch {
		return false;
	}
}

export function buildPreviewEnv(
	env: NodeJS.ProcessEnv = process.env,
	siteUrl = BASE_URL,
): NodeJS.ProcessEnv {
	return {
		...env,
		PORT,
		SITE_URL: siteUrl,
	};
}

export function resolveAuditBaseUrl(
	args: string[],
	env: NodeJS.ProcessEnv = process.env,
): string {
	return parseBaseUrl(args) ?? env.AUDIT_BASE_URL ?? BASE_URL;
}

function spawnPreview(siteUrl: string): ChildProcess {
	const child = spawn("bun", ["run", NITRO_BUNDLE], {
		// Never inherit SITE_URL from .env: a different SSR origin makes
		// hydration duplicate canonical and Open Graph tags in the browser.
		env: buildPreviewEnv(process.env, siteUrl),
		stdio: ["ignore", "pipe", "inherit"],
	});
	child.on("error", (err) => {
		process.stderr.write(
			`[audit-fe] failed to spawn preview server: ${err.message}\n`,
		);
	});
	return child;
}

export async function waitForReady(
	child: ChildProcess,
	options: {
		baseUrl?: string;
		fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
		output?: NodeJS.WritableStream;
		timeoutMs?: number;
	} = {},
): Promise<void> {
	const baseUrl = options.baseUrl ?? BASE_URL;
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? READY_TIMEOUT_MS;
	const stdout = child.stdout;
	if (!stdout) {
		throw new Error("preview server stdout is not piped");
	}

	await new Promise<void>((resolve, reject) => {
		let output = "";
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			stdout.removeListener("data", onData);
			child.removeListener("error", onError);
			child.removeListener("exit", onExit);
			if (error) reject(error);
			else resolve();
		};
		const onData = (chunk: Buffer | string) => {
			options.output?.write(chunk);
			output = `${output}${chunk.toString()}`.slice(-1_024);
			if (output.includes("Listening on:")) finish();
		};
		const onError = (error: Error) =>
			finish(
				new Error(`[audit-fe] failed to spawn preview server: ${error.message}`),
			);
		const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
			finish(
				new Error(
					`preview server exited before becoming ready (code=${code ?? signal ?? "unknown"})`,
				),
			);
		const timer = setTimeout(
			() =>
				finish(
					new Error(
						`preview server did not become ready on ${baseUrl} within ${timeoutMs}ms`,
					),
				),
			timeoutMs,
		);

		stdout.on("data", onData);
		child.once("error", onError);
		child.once("exit", onExit);
	});

	try {
		await fetchImpl(baseUrl, { signal: AbortSignal.timeout(2_000) });
	} catch (error) {
		throw new Error(
			`preview server announced readiness but ${baseUrl} is unreachable: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

// lhci writes flags-<uuid>.json (and per-run artifacts) under .lighthouseci/
// for every Lighthouse spawn. Transient; not committed (.gitignored). Sweep
// after each audit so the repo working tree stays clean. Best-effort — never
// surface a removal failure to the caller because cleanup must not gate exit.
async function rmLighthouseArtifacts(): Promise<void> {
	try {
		await rm(join(process.cwd(), ".lighthouseci"), {
			recursive: true,
			force: true,
		});
	} catch {
		// ignore — operator can rm manually if needed
	}
}

async function reap(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.killed) return;
	child.kill("SIGTERM");
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			if (child.exitCode === null) child.kill("SIGKILL");
			resolve();
		}, SHUTDOWN_GRACE_MS);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

export type OrchestratorResult = {
	exitCode: number;
	summaryLine: string;
	countsLine: string;
	reportPath: string;
};

// Map convenience CLI flags (--headed, --slowmo=N) into the env vars that
// app/lib/app-audit/checks.server.ts reads when launching Chromium. Mutating
// process.env keeps the rest of the audit pipeline unchanged and lets env
// vars and CLI flags coexist without precedence surprises.
function applyDebugFlags(args: string[]): void {
	if (args.includes("--headed")) {
		process.env.AUDIT_HEADED = "1";
	}
	const slowmoFlag = args.find((a) => a.startsWith("--slowmo="));
	if (slowmoFlag) {
		process.env.AUDIT_SLOWMO = slowmoFlag.slice("--slowmo=".length);
	}
}

export async function runAuditWithPreview(
	args: string[],
): Promise<OrchestratorResult> {
	applyDebugFlags(args);
	const auditBaseUrl = resolveAuditBaseUrl(args);

	if (!(await nitroBundleExists())) {
		process.stderr.write(
			`[audit-fe] ${NITRO_BUNDLE} not found — run \`bun run build\` first.\n`,
		);
		process.exit(1);
	}

	const child = spawnPreview(auditBaseUrl);

	const cleanup = async () => {
		await reap(child);
		await rmLighthouseArtifacts();
	};
	process.on("SIGTERM", async () => {
		await cleanup();
		process.exit(143);
	});
	process.on("SIGINT", async () => {
		await cleanup();
		process.exit(130);
	});

	try {
		await waitForReady(child, { output: process.stdout });
		child.stdout?.pipe(process.stdout);
	} catch (err) {
		await cleanup();
		throw err;
	}

	// Inject --baseUrl unless caller already pinned one (lets test fixtures
	// or alt-port runs override).
	const forwarded = args.some((a) => a.startsWith("--baseUrl="))
		? args
		: [...args, `--baseUrl=${auditBaseUrl}`];

	try {
		const result = await runAppAuditCli(forwarded);
		return result;
	} finally {
		await cleanup();
	}
}

if (import.meta.main) {
	try {
		const result = await runAuditWithPreview(process.argv.slice(2));
		console.log(result.summaryLine);
		console.log(result.countsLine);
		process.exit(result.exitCode);
	} catch (err) {
		process.stderr.write(
			`[audit-fe] orchestration failed: ${(err as Error).message}\n`,
		);
		process.exit(1);
	}
}
