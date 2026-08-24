import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { isPostgresAvailable } from "#/lib/test-bench/database";

// ─── DB availability check ─────────────────────────────────────────────────────

const databaseUnavailable = !(await isPostgresAvailable());

// ─── Integration: auth round trip via auth.handler ────────────────────────────

describe.skipIf(databaseUnavailable)("integration: auth round trip", () => {
	let sql!: import("postgres").Sql;
	const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
	const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "changeme";

	// auth is imported lazily to avoid DB connections at module load time
	let authHandler!: (request: Request) => Promise<Response>;
	let getSession!: (opts: {
		headers: Headers;
	}) => Promise<{ user?: { email: string } | null } | null>;

	beforeAll(async () => {
		const pg = await import("postgres");
		sql = pg.default(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);
		const { auth } = await import("#/lib/auth");
		authHandler = (req) => auth.handler(req) as Promise<Response>;
		getSession = (opts) =>
			auth.api.getSession(opts) as Promise<unknown> as Promise<{
				user?: { email: string } | null;
			} | null>;
	});

	afterAll(async () => {
		await sql.end();
	});

	// ── Sign-in ────────────────────────────────────────────────────────────────

	test("POST /api/auth/sign-in/email returns 200 and Set-Cookie for valid credentials", async () => {
		const resp = await authHandler(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
			}),
		);
		expect(resp.status).toBe(200);
		const setCookie = resp.headers.get("set-cookie");
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain("better-auth.session_token");
		expect(setCookie).toContain("HttpOnly");
	});

	test("POST /api/auth/sign-in/email returns 401 for wrong password", async () => {
		const resp = await authHandler(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: "wrongpass" }),
			}),
		);
		expect(resp.status).toBe(401);
	});

	// ── Get-session ────────────────────────────────────────────────────────────

	test("GET /api/auth/get-session with valid cookie returns user object", async () => {
		// Sign in to get cookie
		const signInResp = await authHandler(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
			}),
		);
		const setCookie = signInResp.headers.get("set-cookie") ?? "";
		const cookieValue = setCookie.split(";")[0]; // 'better-auth.session_token=...'

		const resp = await authHandler(
			new Request("http://localhost/api/auth/get-session", {
				method: "GET",
				headers: { Cookie: cookieValue },
			}),
		);
		expect(resp.status).toBe(200);
		const data = (await resp.json()) as { user?: { email: string } } | null;
		expect(data?.user?.email).toBe(ADMIN_EMAIL);
	});

	test("GET /api/auth/get-session without cookie returns null", async () => {
		const resp = await authHandler(
			new Request("http://localhost/api/auth/get-session", {
				method: "GET",
			}),
		);
		expect(resp.status).toBe(200);
		const data = await resp.json();
		expect(data).toBeNull();
	});

	// ── Sign-out ────────────────────────────────────────────────────────────────

	test("POST /api/auth/sign-out invalidates session; subsequent get-session returns no user", async () => {
		// Sign in
		const signInResp = await authHandler(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
			}),
		);
		const setCookie = signInResp.headers.get("set-cookie") ?? "";
		const cookieValue = setCookie.split(";")[0];

		// Sign out
		const signOutResp = await authHandler(
			new Request("http://localhost/api/auth/sign-out", {
				method: "POST",
				headers: {
					Cookie: cookieValue,
					"Content-Type": "application/json",
				},
				body: "{}",
			}),
		);
		expect(signOutResp.status).toBe(200);

		// Session should be invalidated
		const afterResp = await authHandler(
			new Request("http://localhost/api/auth/get-session", {
				method: "GET",
				headers: { Cookie: cookieValue },
			}),
		);
		const afterData = (await afterResp.json()) as {
			user?: { email: string } | null;
		} | null;
		expect(afterData?.user).toBeFalsy();
	});

	// ── beforeLoad session loading (auth.api.getSession) ──────────────────────

	test("auth.api.getSession returns user for authenticated request (beforeLoad simulation)", async () => {
		// Sign in to get a valid session token
		const signInResp = await authHandler(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
			}),
		);
		const setCookie = signInResp.headers.get("set-cookie") ?? "";
		const cookieValue = setCookie.split(";")[0];

		const headers = new Headers({ Cookie: cookieValue });
		const session = await getSession({ headers });
		expect(session?.user?.email).toBe(ADMIN_EMAIL);
	});

	test("auth.api.getSession returns null for unauthenticated request (beforeLoad simulation)", async () => {
		const headers = new Headers();
		const session = await getSession({ headers });
		expect(session?.user ?? null).toBeNull();
	});
});
