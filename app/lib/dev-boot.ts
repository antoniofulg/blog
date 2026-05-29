import { execFileSync, spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { syncAll } from "#/db/indexer";

// PID file for the detached content-watcher subprocess.
//
// The watcher is spawned with unref() so it does not keep Vite's event loop
// alive — but that also means a watcher orphaned by a Vite server that exited
// without cleanup (crash, SIGKILL, or simply the unref'd child outliving its
// parent) keeps running forever, holding a recursive fs.watch (file
// descriptors) and a Postgres connection. Across repeated dev restarts these
// accumulate and exhaust fds / memory.
//
// This pidfile lets each new boot reap the previous watcher before spawning a
// fresh one, guaranteeing at most one watcher per checkout. Repo-local and
// gitignored (.tanstack/) so concurrent worktrees do not collide on it.
const WATCHER_PID_FILE = join(
	process.cwd(),
	".tanstack",
	"content-watcher.pid",
);

function isAlive(pid: number): boolean {
	try {
		// Signal 0 performs existence/permission checks without delivering a signal.
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// Kill a watcher left over from a prior dev server, if its recorded PID is
// still alive. Always clears the pidfile afterward so a stale entry never
// causes a false "already running" on the next boot.
function reapStaleWatcher(): void {
	if (!existsSync(WATCHER_PID_FILE)) return;
	try {
		const pid = Number.parseInt(
			readFileSync(WATCHER_PID_FILE, "utf8").trim(),
			10,
		);
		if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
			process.kill(pid, "SIGTERM");
		}
	} catch {
		// Unreadable or already-dead — fall through to pidfile cleanup.
	}
	try {
		rmSync(WATCHER_PID_FILE, { force: true });
	} catch {
		// Non-fatal: a stale pidfile only risks one redundant SIGTERM next boot.
	}
}

export async function runDevBoot(
	contentDir = "./app/content/posts",
): Promise<void> {
	execFileSync("bun", ["run", "db:migrate"], { stdio: "inherit" });
	execFileSync("bun", ["run", "db:seed"], { stdio: "inherit" });

	console.log(
		`[sync] ${JSON.stringify({ event: "sync_started", contentDir, source: "dev" })}`,
	);
	try {
		await syncAll(contentDir);
		console.log(
			`[sync] ${JSON.stringify({ event: "sync_completed", contentDir })}`,
		);
	} catch (err) {
		console.error(
			`[sync] ${JSON.stringify({
				event: "sync_failed",
				contentDir,
				error: err instanceof Error ? err.message : String(err),
			})}`,
		);
		throw err;
	}

	// Reap any watcher orphaned by a previous dev server before spawning a new
	// one — prevents one immortal `bun scripts/watcher.ts` accumulating per boot.
	reapStaleWatcher();

	const proc = spawn("bun", ["scripts/watcher.ts"], {
		stdio: "inherit",
		cwd: process.cwd(),
	});

	// Record the new watcher's PID so the next boot can reap it. The watcher
	// also self-exits when this parent dies (ppid poll in scripts/watcher.ts),
	// which covers SIGKILL/crash where no clean reap ever runs.
	if (proc.pid !== undefined) {
		try {
			mkdirSync(dirname(WATCHER_PID_FILE), { recursive: true });
			writeFileSync(WATCHER_PID_FILE, String(proc.pid), "utf8");
		} catch {
			// Non-fatal: without the pidfile the ppid self-exit is the backstop.
		}
	}

	proc.unref();
}
