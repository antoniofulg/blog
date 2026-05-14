import { execFileSync, spawn } from "node:child_process";
import { syncAll } from "#/db/indexer";

export async function runDevBoot(contentDir = "./content"): Promise<void> {
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

	const proc = spawn("bun", ["scripts/watcher.ts"], {
		stdio: "inherit",
		cwd: process.cwd(),
	});
	proc.unref();
}
