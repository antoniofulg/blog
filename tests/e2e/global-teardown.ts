import { unlink } from "node:fs/promises";
import {
	E2E_STATE_FILE,
	clearActiveTestDb,
	getActiveTestDb,
} from "./global-setup";

// Closes the PGLite client and removes the state file. Idempotent.
export default async function globalTeardown(): Promise<void> {
	const testDb = getActiveTestDb();
	if (testDb) {
		await testDb.close();
		clearActiveTestDb();
	}
	try {
		await unlink(E2E_STATE_FILE);
	} catch {
		// File may not exist if setup never ran — idempotent
	}
}
