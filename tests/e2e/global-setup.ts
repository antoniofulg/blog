import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestDb } from "./db";
import { createTestDb } from "./db";
import { seedAdminUser } from "./seed";

export const E2E_STATE_FILE = join(tmpdir(), "pglite-e2e-state.json");

type E2EState = {
	connectionString: string;
	adminUserId: string;
};

// Module-level handle shared with global-teardown (same process, same module cache)
let activeTestDb: TestDb | undefined;

export function getActiveTestDb(): TestDb | undefined {
	return activeTestDb;
}

export function clearActiveTestDb(): void {
	activeTestDb = undefined;
}

export default async function globalSetup(): Promise<void> {
	const testDb = await createTestDb();
	const adminUserId = await seedAdminUser(testDb.db);

	activeTestDb = testDb;

	const state: E2EState = {
		connectionString: testDb.connectionString,
		adminUserId,
	};

	// Expose connection string for the Playwright webServer subprocess (inherits env)
	process.env.DATABASE_URL = testDb.connectionString;
	process.env.E2E_ADMIN_USER_ID = adminUserId;

	// Write state file for explicit reads (e.g., tests that verify channel)
	await writeFile(E2E_STATE_FILE, JSON.stringify(state), "utf-8");
}
