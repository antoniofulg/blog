#!/usr/bin/env bun
// One-shot orchestrator for `make audit-fe`.
//
// Spawns the Nitro preview server (.output/server/index.mjs) on PORT=4173,
// polls until it responds, runs the app audit, then reaps the server on
// success / failure / signal. Replaces the prior manual two-terminal pattern
// (run `bun preview` separately, then `make audit-fe`) which was racy and
// also pointed operators at the wrong command — `vite preview` does not
// serve the TanStack Start Nitro bundle.
//
// Honors:
//   - AUDIT_PREVIEW_PORT (default "4173")
//   - DATABASE_URL (passed through to the spawned server; required)
//   - All `audit:fe` CLI flags forwarded after orchestration setup.
import { spawn, type ChildProcess } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { join } from "node:path";
import { runAppAuditCli } from "./audit-fe";

const PORT = process.env.AUDIT_PREVIEW_PORT ?? "4173";
const BASE_URL = `http://localhost:${PORT}`;
const NITRO_BUNDLE = join(process.cwd(), ".output/server/index.mjs");
const READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const SHUTDOWN_GRACE_MS = 5_000;

async function nitroBundleExists(): Promise<boolean> {
	try {
		await access(NITRO_BUNDLE);
		return true;
	} catch {
		return false;
	}
}

function spawnPreview(): ChildProcess {
	const child = spawn("bun", ["run", NITRO_BUNDLE], {
		env: { ...process.env, PORT },
		stdio: ["ignore", "inherit", "inherit"],
	});
	child.on("error", (err) => {
		process.stderr.write(
			`[audit-fe] failed to spawn preview server: ${err.message}\n`,
		);
	});
	return child;
}

async function waitForReady(child: ChildProcess): Promise<void> {
	let spawnErr: Error | undefined;
	const onError = (err: Error) => {
		spawnErr = new Error(
			`[audit-fe] failed to spawn preview server: ${err.message}`,
		);
	};
	child.once("error", onError);

	try {
		const deadline = Date.now() + READY_TIMEOUT_MS;
		while (Date.now() < deadline) {
			if (spawnErr) throw spawnErr;
			if (child.exitCode !== null) {
				throw new Error(
					`preview server exited before becoming ready (code=${child.exitCode})`,
				);
			}
			try {
				// Any HTTP response (200, 302, 401) proves the server bound the port
				// and is processing requests — that's all we need for the preflight
				// fetch in runAppAudit to succeed.
				await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
				return;
			} catch {
				// not ready yet — retry until deadline
			}
			await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
		}
		if (spawnErr) throw spawnErr;
		throw new Error(
			`preview server did not become ready on ${BASE_URL} within ${READY_TIMEOUT_MS}ms`,
		);
	} finally {
		child.removeListener("error", onError);
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

	if (!(await nitroBundleExists())) {
		process.stderr.write(
			`[audit-fe] ${NITRO_BUNDLE} not found — run \`bun run build\` first.\n`,
		);
		process.exit(1);
	}

	const child = spawnPreview();

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
		await waitForReady(child);
	} catch (err) {
		await cleanup();
		throw err;
	}

	// Inject --baseUrl unless caller already pinned one (lets test fixtures
	// or alt-port runs override).
	const forwarded = args.some((a) => a.startsWith("--baseUrl="))
		? args
		: [...args, `--baseUrl=${BASE_URL}`];

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
