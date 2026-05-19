import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";
import { seedAdminUser } from "../../tests/e2e/seed";

// ── Unit: createTestDb() structure ─────────────────────────────────────────

describe("createTestDb()", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();
	}, 15_000);

	afterAll(async () => {
		await testDb.close();
	});

	it("returns all 4 required properties", () => {
		expect(testDb).toHaveProperty("db");
		expect(testDb).toHaveProperty("client");
		expect(testDb).toHaveProperty("connectionString");
		expect(testDb).toHaveProperty("close");
		expect(typeof testDb.close).toBe("function");
	});

	it("connectionString matches postgres:// shape (AC-5)", () => {
		expect(testDb.connectionString).toMatch(
			/^postgres:\/\/localhost:\d+\/postgres$/,
		);
	});

	it("connectionString is connectable via postgres-js (TCP proxy smoke)", async () => {
		const { default: postgres } = await import("postgres");
		const sql = postgres(testDb.connectionString, { max: 1, idle_timeout: 1 });
		try {
			const result = await sql`SELECT 1 AS val`;
			expect(result[0].val).toBe(1);
		} finally {
			await sql.end();
		}
	});

	it("TCP proxy responds 'N' to SSLRequest", async () => {
		const { createConnection } = await import("node:net");
		const port = Number(testDb.connectionString.match(/:(\d+)\//)?.[1]);
		const response = await new Promise<Buffer>((resolve, reject) => {
			const socket = createConnection(port, "127.0.0.1", () => {
				// 8-byte SSLRequest: length=8, code=80877103
				const msg = Buffer.alloc(8);
				msg.writeInt32BE(8, 0);
				msg.writeInt32BE(80877103, 4);
				socket.write(msg);
			});
			socket.once("data", (data) => {
				socket.destroy();
				resolve(data);
			});
			socket.once("error", reject);
		});
		expect(response.toString()).toBe("N");
	});

	it("posts table is queryable and empty on fresh instance (AC-1)", async () => {
		const { posts } = await import("#/db/schema");
		const rows = await testDb.db.select().from(posts);
		expect(rows).toHaveLength(0);
	});

	it("user table is queryable (schema push includes auth tables)", async () => {
		const { user } = await import("#/db/auth-schema");
		const rows = await testDb.db.select().from(user);
		expect(rows).toHaveLength(0);
	});

	it("session table is queryable", async () => {
		const { session } = await import("#/db/auth-schema");
		const rows = await testDb.db.select().from(session);
		expect(rows).toHaveLength(0);
	});

	it("account table is queryable", async () => {
		const { account } = await import("#/db/auth-schema");
		const rows = await testDb.db.select().from(account);
		expect(rows).toHaveLength(0);
	});

	it("verification table is queryable", async () => {
		const { verification } = await import("#/db/auth-schema");
		const rows = await testDb.db.select().from(verification);
		expect(rows).toHaveLength(0);
	});
});

// ── Unit: TestDb.close() idempotency ──────────────────────────────────────

describe("TestDb.close()", () => {
	it("second call is a no-op (AC-3)", async () => {
		const testDb = await createTestDb();
		await testDb.close();
		await expect(testDb.close()).resolves.toBeUndefined();
	}, 15_000);
});

// ── Unit: seedAdminUser() ──────────────────────────────────────────────────

describe("seedAdminUser()", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();
	}, 15_000);

	afterAll(async () => {
		await testDb.close();
	});

	it("creates admin user with local default credentials", async () => {
		const userId = await seedAdminUser(testDb.db, {});
		expect(typeof userId).toBe("string");
		expect(userId.length).toBeGreaterThan(0);

		const { user } = await import("#/db/auth-schema");
		const rows = await testDb.db.select({ email: user.email }).from(user);
		expect(rows.some((r) => r.email === "e2e@test.local")).toBe(true);
	});

	it("is idempotent — second call returns same userId (AC-3 seed variant)", async () => {
		const env = {
			E2E_ADMIN_EMAIL: "idem@e2e.test",
			E2E_ADMIN_PASSWORD: "idem-pass-123",
		};
		const firstId = await seedAdminUser(testDb.db, env);
		const secondId = await seedAdminUser(testDb.db, env);
		expect(secondId).toBe(firstId);

		const { user } = await import("#/db/auth-schema");
		const { eq } = await import("drizzle-orm");
		const rows = await testDb.db
			.select()
			.from(user)
			.where(eq(user.email, "idem@e2e.test"));
		expect(rows).toHaveLength(1);
	});

	it("throws on CI when E2E_ADMIN_EMAIL is missing (AC-4)", async () => {
		const env = {
			CI: "true",
			E2E_ADMIN_EMAIL: undefined,
			E2E_ADMIN_PASSWORD: "test-pass-123",
		};
		await expect(seedAdminUser(testDb.db, env)).rejects.toThrow(
			/missing credential/i,
		);
	});

	it("throws on CI when E2E_ADMIN_PASSWORD is missing (AC-4)", async () => {
		const env = {
			CI: "true",
			E2E_ADMIN_EMAIL: "ci-test@e2e.test",
			E2E_ADMIN_PASSWORD: undefined,
		};
		await expect(seedAdminUser(testDb.db, env)).rejects.toThrow(
			/missing credential/i,
		);
	});

	it("returns userId matching user table row (AC-2)", async () => {
		const env = {
			E2E_ADMIN_EMAIL: "verify@e2e.test",
			E2E_ADMIN_PASSWORD: "verify-pass-123",
		};
		const userId = await seedAdminUser(testDb.db, env);

		const { user } = await import("#/db/auth-schema");
		const { eq } = await import("drizzle-orm");
		const rows = await testDb.db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(eq(user.email, "verify@e2e.test"));
		expect(rows).toHaveLength(1);
		expect(rows[0].id).toBe(userId);
		expect(rows[0].email).toBe("verify@e2e.test");
	});
});

// ── Integration: full lifecycle ────────────────────────────────────────────

describe("integration: full lifecycle", () => {
	it("createTestDb → seed → signIn via Better Auth API succeeds", async () => {
		const testDb = await createTestDb();

		const env = {
			E2E_ADMIN_EMAIL: "lifecycle@e2e.test",
			E2E_ADMIN_PASSWORD: "lifecycle-pass-123",
		};
		await seedAdminUser(testDb.db, env);

		// Build a local auth instance (not the production singleton)
		const { betterAuth } = await import("better-auth");
		const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
		const auth = betterAuth({
			database: drizzleAdapter(testDb.db, { provider: "pg" }),
			emailAndPassword: { enabled: true },
		});

		// No session before sign-in
		const sessionBefore = await auth.api.getSession({
			headers: new Headers(),
		});
		expect(sessionBefore).toBeNull();

		// Sign in with the seeded user
		const signInResult = await auth.api.signInEmail({
			body: {
				email: env.E2E_ADMIN_EMAIL,
				password: env.E2E_ADMIN_PASSWORD,
			},
		});
		expect(signInResult?.user?.email).toBe(env.E2E_ADMIN_EMAIL);
		expect(signInResult?.token).toBeTruthy();

		await testDb.close();
	}, 20_000);
});

// ── Integration: global-setup/teardown channel ────────────────────────────
// New architecture: scripts/e2e-server.ts creates the PGLite proxy and writes
// the initial state file; globalSetup reads that file, seeds data, and updates
// it with full state; globalTeardown is now a no-op (e2e-server.ts owns cleanup).

describe("integration: global-setup/teardown channel", () => {
	it("globalSetup seeds data from existing state file; globalTeardown is no-op", async () => {
		const savedUserId = process.env.E2E_ADMIN_USER_ID;

		const { E2E_STATE_FILE, default: globalSetup } = await import(
			"../../tests/e2e/global-setup"
		);
		const { default: globalTeardown } = await import(
			"../../tests/e2e/global-teardown"
		);

		// Simulate what scripts/e2e-server.ts does: create PGLite + write initial state
		const testDb = await createTestDb();
		const { join } = await import("node:path");
		const { tmpdir } = await import("node:os");
		const { writeFile, unlink } = await import("node:fs/promises");
		const fixtureFilePath = join(tmpdir(), "e2e-fixture-post.mdx");
		await writeFile(fixtureFilePath, "# Test fixture", "utf-8");
		await writeFile(
			E2E_STATE_FILE,
			JSON.stringify({
				connectionString: testDb.connectionString,
				adminUserId: "",
				fixturePostId: 0,
				fixturePostSlug: "",
				fixturePostTitle: "",
			}),
			"utf-8",
		);

		try {
			// globalSetup finds the file, connects to PGLite via postgres-js, seeds
			await globalSetup();

			expect(existsSync(E2E_STATE_FILE)).toBe(true);
			const raw = readFileSync(E2E_STATE_FILE, "utf-8");
			const state = JSON.parse(raw) as {
				connectionString: string;
				adminUserId: string;
				fixturePostId: number;
			};
			expect(state.connectionString).toMatch(/^postgres:\/\//);
			expect(state.adminUserId).toBeTruthy();
			expect(state.fixturePostId).toBeGreaterThan(0);
			expect(process.env.E2E_ADMIN_USER_ID).toBeTruthy();

			// globalTeardown is a no-op; state file remains (e2e-server.ts deletes it)
			await expect(globalTeardown()).resolves.toBeUndefined();
			expect(existsSync(E2E_STATE_FILE)).toBe(true);
		} finally {
			await testDb.close();
			await unlink(E2E_STATE_FILE).catch(() => {});
			process.env.E2E_ADMIN_USER_ID = savedUserId;
		}
	}, 25_000);

	it("globalTeardown() is always a no-op (idempotent)", async () => {
		const { default: globalTeardown } = await import(
			"../../tests/e2e/global-teardown"
		);
		await expect(globalTeardown()).resolves.toBeUndefined();
	});
});
