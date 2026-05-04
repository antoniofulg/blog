import { execSync } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { seedAdmin } from "../../scripts/seed";

const root = join(import.meta.dirname, "../..");
const DB_URL = "postgres://blog:blog@localhost:5432/blog";
const TEST_EMAIL = `seed-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "Test1234!";

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

// ─── Mock db helpers ────────────────────────────────────────────────────────

function createMockDb(existingUsers: unknown[] = []) {
	return {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue(existingUsers),
				}),
			}),
		}),
		transaction: vi
			.fn()
			// biome-ignore lint/suspicious/noExplicitAny: mock type
			.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
				await fn({
					insert: vi.fn().mockReturnValue({
						values: vi.fn().mockResolvedValue(undefined),
					}),
				});
			}),
	};
}

// ─── Unit tests ─────────────────────────────────────────────────────────────

describe("unit: seedAdmin env validation", () => {
	it("returns error when ADMIN_EMAIL is not set", async () => {
		const db = createMockDb();
		const result = await seedAdmin(db, { ADMIN_PASSWORD: "secret" });
		expect(result.status).toBe("error");
		expect(result.message).toMatch(/ADMIN_EMAIL/);
	});

	it("returns error when ADMIN_PASSWORD is not set", async () => {
		const db = createMockDb();
		const result = await seedAdmin(db, { ADMIN_EMAIL: "admin@example.com" });
		expect(result.status).toBe("error");
		expect(result.message).toMatch(/ADMIN_PASSWORD/);
	});

	it("reads ADMIN_EMAIL and ADMIN_PASSWORD from env", async () => {
		const db = createMockDb([]);
		const result = await seedAdmin(db, {
			ADMIN_EMAIL: "admin@example.com",
			ADMIN_PASSWORD: "secure-pass",
		});
		expect(result.status).toBe("created");
		expect(result.message).toContain("admin@example.com");
	});

	it("returns skipped when admin user already exists", async () => {
		const db = createMockDb([{ id: "1", email: "admin@example.com" }]);
		const result = await seedAdmin(db, {
			ADMIN_EMAIL: "admin@example.com",
			ADMIN_PASSWORD: "secure-pass",
		});
		expect(result.status).toBe("skipped");
		expect(result.message).toContain("already exists");
	});

	it("does not call transaction insert when user already exists", async () => {
		const db = createMockDb([{ id: "1", email: "admin@example.com" }]);
		await seedAdmin(db, {
			ADMIN_EMAIL: "admin@example.com",
			ADMIN_PASSWORD: "secure-pass",
		});
		expect(db.transaction).not.toHaveBeenCalled();
	});
});

describe("unit: script exit codes", () => {
	it("exits 1 when ADMIN_EMAIL is not set", () => {
		expect(() =>
			execSync("bun run scripts/seed.ts", {
				cwd: root,
				env: { ...process.env, ADMIN_EMAIL: undefined, ADMIN_PASSWORD: "x" },
				stdio: "pipe",
			}),
		).toThrow();
	});

	it("exits 1 when ADMIN_PASSWORD is not set", () => {
		expect(() =>
			execSync("bun run scripts/seed.ts", {
				cwd: root,
				env: {
					...process.env,
					ADMIN_EMAIL: "admin@example.com",
					ADMIN_PASSWORD: undefined,
				},
				stdio: "pipe",
			}),
		).toThrow();
	});
});

// ─── Integration tests ───────────────────────────────────────────────────────

describe.skipIf(port5432Free)("integration: seed script", () => {
	let sql: import("postgres").Sql | undefined;

	beforeAll(async () => {
		const pg = await import("postgres");
		sql = pg.default(DB_URL);
		// clean up any leftovers from prior failed runs
		await sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE email = ${TEST_EMAIL})`;
		await sql`DELETE FROM "user" WHERE email = ${TEST_EMAIL}`;
	});

	afterAll(async () => {
		if (sql) {
			await sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE email = ${TEST_EMAIL})`;
			await sql`DELETE FROM "user" WHERE email = ${TEST_EMAIL}`;
			await sql.end();
		}
	});

	it("bun run db:seed exits 0 and creates exactly one user row", () => {
		execSync("bun run db:seed", {
			cwd: root,
			env: {
				...process.env,
				DATABASE_URL: DB_URL,
				ADMIN_EMAIL: TEST_EMAIL,
				ADMIN_PASSWORD: TEST_PASSWORD,
			},
			stdio: "pipe",
		});
	});

	it("seeded user email matches ADMIN_EMAIL", async () => {
		// biome-ignore lint/style/noNonNullAssertion: set in beforeAll
		const rows = await sql!<{ email: string }[]>`
      SELECT email FROM "user" WHERE email = ${TEST_EMAIL}
    `;
		expect(rows).toHaveLength(1);
		expect(rows[0].email).toBe(TEST_EMAIL);
	});

	it("seeded user password is hashed, not plaintext", async () => {
		// biome-ignore lint/style/noNonNullAssertion: set in beforeAll
		const rows = await sql!<{ password: string }[]>`
      SELECT a.password FROM account a
      JOIN "user" u ON u.id = a.user_id
      WHERE u.email = ${TEST_EMAIL}
        AND a.provider_id = 'credential'
    `;
		expect(rows).toHaveLength(1);
		expect(rows[0].password).not.toBe(TEST_PASSWORD);
		expect(rows[0].password.length).toBeGreaterThan(20);
	});

	it("running db:seed a second time does not insert a duplicate (row count stays at 1)", () => {
		execSync("bun run db:seed", {
			cwd: root,
			env: {
				...process.env,
				DATABASE_URL: DB_URL,
				ADMIN_EMAIL: TEST_EMAIL,
				ADMIN_PASSWORD: TEST_PASSWORD,
			},
			stdio: "pipe",
		});
	});

	it("user row count is still exactly 1 after second run", async () => {
		// biome-ignore lint/style/noNonNullAssertion: set in beforeAll
		const rows = await sql!<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM "user" WHERE email = ${TEST_EMAIL}
    `;
		expect(Number(rows[0].count)).toBe(1);
	});
});
