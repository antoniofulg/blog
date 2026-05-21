import { resolve } from "node:path";
import { closeDb } from "#/db/client";
import { syncAll } from "#/db/indexer";

export interface SyncResult {
	status: "success" | "error";
	message: string;
	contentDir: string;
}

export function parseDir(args: string[]): string {
	const idx = args.indexOf("--dir");
	if (idx !== -1 && args[idx + 1]) {
		return resolve(args[idx + 1] as string);
	}
	return resolve("app/content/posts");
}

export async function runSync(
	args: string[] = process.argv.slice(2),
): Promise<SyncResult> {
	const contentDir = parseDir(args);
	try {
		await syncAll(contentDir);
		return { status: "success", message: `Sync complete: ${contentDir}`, contentDir };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { status: "error", message, contentDir };
	}
}

if (import.meta.main) {
	const result = await runSync();
	await closeDb();
	if (result.status === "error") {
		console.error(`[sync] Error: ${result.message}`);
		process.exit(1);
	}
	console.log(`[sync] ${result.message}`);
	process.exit(0);
}
