#!/usr/bin/env bun
// E2E preview server for Playwright tests.
// Creates the PGLite test DB + proxy, writes connection state for global-setup
// to consume, then starts the Nitro preview server on PORT=4173.
//
// Playwright starts webServer BEFORE globalSetup, so this script owns the
// PGLite lifecycle instead of global-setup.ts.
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createTestDb } from "../tests/e2e/db";

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

const child = spawn("bun", ["run", ".output/server/index.mjs"], {
	env: { ...process.env, DATABASE_URL: testDb.connectionString, PORT: "4173" },
	stdio: "inherit",
});

async function cleanup() {
	child.kill("SIGTERM");
	await testDb.close().catch(() => {});
	await unlink(E2E_SERVER_STATE_FILE).catch(() => {});
}

process.on("SIGTERM", async () => {
	await cleanup();
	process.exit(0);
});
process.on("SIGINT", async () => {
	await cleanup();
	process.exit(0);
});
child.on("exit", async (code) => {
	await testDb.close().catch(() => {});
	process.exit(code ?? 0);
});
