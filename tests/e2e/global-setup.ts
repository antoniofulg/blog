import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as authSchema from "#/db/auth-schema";
import * as schema from "#/db/schema";
import {
	seedAdminUser,
	seedFixturePost,
	seedPublishedFixturePosts,
	seedEnOnlyFixturePost,
} from "./seed";

// Path written by scripts/e2e-server.ts before Playwright runs global setup.
// Playwright starts webServer BEFORE globalSetup, so we poll until the file
// appears (written by e2e-server.ts once the PGLite proxy is ready).
export const E2E_STATE_FILE = join(tmpdir(), "pglite-e2e-state.json");

export type E2EState = {
	connectionString: string;
	adminUserId: string;
	fixturePostId: number;
	fixturePostSlug: string;
	fixturePostTitle: string;
	publicFixtureEnId: number;
	publicFixturePtBrId: number;
	enOnlyPostSlug: string;
};

async function waitForStateFile(timeoutMs = 30_000): Promise<E2EState> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const raw = await readFile(E2E_STATE_FILE, "utf-8");
			const state = JSON.parse(raw) as E2EState;
			if (state.connectionString) return state;
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(
		`E2E state file not available after ${timeoutMs}ms — is scripts/e2e-server.ts running?`,
	);
}

export default async function globalSetup(): Promise<void> {
	// Poll until e2e-server.ts has written the proxy connection string
	const state = await waitForStateFile();

	const sql = postgres(state.connectionString, { max: 1 });
	const db = drizzle(sql, { schema: { ...schema, ...authSchema } });

	const adminUserId = await seedAdminUser(db);

	const fixtureFilePath = join(tmpdir(), "e2e-fixture-post.mdx");
	await writeFile(fixtureFilePath, "This is a fixture post for E2E tests.\n", "utf-8");
	const fixture = await seedFixturePost(db, fixtureFilePath);

	const publicFixture = await seedPublishedFixturePosts(db);
	const enOnlyPost = await seedEnOnlyFixturePost(db);

	// Persist env vars for the test worker process
	process.env.E2E_ADMIN_USER_ID = adminUserId;

	// Write the full state so specs can verify DB state directly
	const fullState: E2EState = {
		connectionString: state.connectionString,
		adminUserId,
		fixturePostId: fixture.id,
		fixturePostSlug: fixture.slug,
		fixturePostTitle: fixture.title,
		publicFixtureEnId: publicFixture.enId,
		publicFixturePtBrId: publicFixture.ptBrId,
		enOnlyPostSlug: enOnlyPost.slug,
	};
	await writeFile(E2E_STATE_FILE, JSON.stringify(fullState), "utf-8");

	await sql.end();
}
