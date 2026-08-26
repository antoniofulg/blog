#!/usr/bin/env bun
// E2E preview server for Playwright tests.
// Creates the PGLite test DB + proxy, writes connection state for global-setup
// to consume, then starts the Nitro preview server on PORT=4173.
//
// Playwright starts webServer BEFORE globalSetup, so this script owns the
// PGLite lifecycle instead of global-setup.ts.
import { writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { type ChildProcess, spawn } from "node:child_process";
import { createTestDb } from "../tests/e2e/db";

const NITRO_BUNDLE = join(process.cwd(), ".output/server/index.mjs");
try {
	await access(NITRO_BUNDLE);
} catch {
	process.stderr.write(
		"[e2e-server] .output/server/index.mjs not found — run `bun run build` first.\n",
	);
	process.exit(1);
}

export const E2E_SERVER_STATE_FILE = join(
	tmpdir(),
	"pglite-e2e-state.json",
);

const testDb = await createTestDb();

// Write proxy URL so global-setup can connect and seed data.
// State file starts with empty seeded fields; global-setup fills them in.
await writeFile(
	E2E_SERVER_STATE_FILE,
	JSON.stringify({
		connectionString: testDb.connectionString,
		adminUserId: "",
		fixturePostId: 0,
		fixturePostSlug: "",
		fixturePostTitle: "",
		publicFixtureEnId: 0,
		publicFixturePtBrId: 0,
	}),
	"utf-8",
);

const port = process.env.PORT ?? "4173";
const baseUrl = `http://localhost:${port}`;
const child = spawn("bun", ["run", ".output/server/index.mjs"], {
	env: {
		...process.env,
		DATABASE_URL: testDb.connectionString,
		PORT: port,
		SITE_URL: baseUrl,
		BETTER_AUTH_URL: baseUrl,
		// Signal to server fns that this is the Playwright preview server, so
		// e.g. admin/index.server.ts can keep fixture posts visible to admin
		// E2E specs that assert against them.
		E2E_TEST: "true",
	},
	stdio: "inherit",
});

async function stopChild(childProcess: ChildProcess): Promise<void> {
	if (childProcess.exitCode !== null || childProcess.signalCode !== null) return;

	childProcess.kill("SIGTERM");
	await new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			if (childProcess.exitCode === null && childProcess.signalCode === null) {
				childProcess.kill("SIGKILL");
			}
			resolve();
		}, 5_000);
		childProcess.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

let cleanupPromise: Promise<void> | undefined;
function cleanup(): Promise<void> {
	cleanupPromise ??= (async () => {
		await stopChild(child);
		await testDb.close();
		await unlink(E2E_SERVER_STATE_FILE).catch(() => {});
	})();
	return cleanupPromise;
}

function exitAfterCleanup(code: number): void {
	void cleanup().then(
		() => process.exit(code),
		(error) => {
			process.stderr.write(`[e2e-server] cleanup failed: ${String(error)}\n`);
			process.exit(1);
		},
	);
}

process.once("SIGTERM", () => exitAfterCleanup(0));
process.once("SIGINT", () => exitAfterCleanup(130));
child.once("exit", (code) => {
	if (!cleanupPromise) exitAfterCleanup(code ?? 1);
});
