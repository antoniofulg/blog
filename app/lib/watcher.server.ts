import { watch } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { removePost, upsertPost } from "#/db/indexer";

// Monitors contentDir for .mdx changes and syncs them to the posts index.
// Server-only — listed in vite-env-only denyImports to prevent client bundling.
export function startContentWatcher(contentDir: string): void {
	const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();
	let eventFired = false;

	console.log(
		JSON.stringify({ level: "INFO", event: "watcher_started", contentDir }),
	);

	// Warn after 5s if no .mdx events have been received. Indicates either an empty
	// content/ directory or a silent fs.watch failure (e.g. file descriptor limit).
	// unref() prevents this timer from keeping the process alive.
	const startupTimer = setTimeout(() => {
		if (!eventFired) {
			console.warn(
				JSON.stringify({
					level: "WARN",
					event: "watcher_no_events",
					message:
						"[watcher] No files indexed on startup — check content/ directory",
				}),
			);
		}
	}, 5000);
	startupTimer.unref?.();

	try {
		watch(contentDir, { recursive: true }, (_event, filename) => {
			if (!filename?.endsWith(".mdx")) return;
			eventFired = true;

			const filePath = join(contentDir, filename);
			const pending = debounceMap.get(filePath);
			if (pending !== undefined) clearTimeout(pending);

			debounceMap.set(
				filePath,
				setTimeout(async () => {
					debounceMap.delete(filePath);
					let fileExists: boolean;
					try {
						await stat(filePath);
						fileExists = true;
					} catch {
						fileExists = false;
					}
					if (fileExists) {
						try {
							await upsertPost(filePath);
						} catch (err) {
							console.error(
								JSON.stringify({
									level: "ERROR",
									event: "upsert_failed",
									filePath,
									error: String(err),
								}),
							);
						}
					} else {
						await removePost(filePath);
					}
				}, 100),
			);
		});
	} catch (err) {
		console.error(
			JSON.stringify({
				level: "ERROR",
				event: "watcher_start_failed",
				contentDir,
				error: String(err),
			}),
		);
	}
}
