import { test, expect } from "./fixtures/auth";

const isCI = process.env.CI === "true";
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : "e2e@test.local");
const adminPassword =
	process.env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : "e2e-test-password");

if (!adminEmail) throw new Error("Missing credential: E2E_ADMIN_EMAIL is required on CI");
if (!adminPassword)
	throw new Error("Missing credential: E2E_ADMIN_PASSWORD is required on CI");

test.describe("auth flow", { tag: ["@auth", "@smoke"] }, () => {
	// These tests need a fresh browser context — no pre-loaded storageState
	test.describe("unauthenticated", () => {
		test.use({ storageState: { cookies: [], origins: [] } });

		test("login round-trip: seeded credentials → redirect and session cookie set", async ({
			page,
		}) => {
			await page.goto("/login");
			await page.getByLabel("Email").fill(adminEmail);
			await page.getByLabel("Senha").fill(adminPassword);
			await page.getByRole("button", { name: /Entrar/i }).click();
			await page.waitForURL((url) => !url.pathname.startsWith("/login"));

			const cookies = await page.context().cookies();
			const sessionCookie = cookies.find(
				(c) => c.name === "better-auth.session_token",
			);
			expect(sessionCookie, "session cookie must be set after login").toBeTruthy();

			const response = await page.goto("/admin");
			expect(response?.status()).toBe(200);
			await expect(
				page.getByRole("heading", { name: /Admin Dashboard/i }),
			).toBeVisible();
		});

		test("wrong password → error alert visible and URL stays at /login", async ({
			page,
		}) => {
			await page.goto("/login");
			await page.getByLabel("Email").fill(adminEmail);
			await page.getByLabel("Senha").fill("wrong-password-xyz");
			await page.getByRole("button", { name: /Entrar/i }).click();

			await expect(page.getByRole("alert")).toBeVisible();
			expect(page.url()).toContain("/login");
		});
	});

	test("session presence: storageState → /admin dashboard renders", async ({
		authedPage,
	}) => {
		await authedPage.goto("/admin");
		await authedPage.waitForLoadState("load");
		await expect(
			authedPage.getByRole("heading", { name: /Admin Dashboard/i }),
		).toBeVisible();
	});

	test("logout: sign-out clears session → /admin redirects to /login", async ({
		authedPage,
	}) => {
		await authedPage.goto("/admin");
		await expect(
			authedPage.getByRole("heading", { name: /Admin Dashboard/i }),
		).toBeVisible();

		// No logout button in the header UI; invoke Better Auth sign-out endpoint
		await authedPage.request.post("/api/auth/sign-out");

		await authedPage.goto("/admin");
		await authedPage.waitForURL(/\/login/);
		expect(authedPage.url()).toContain("/login");
	});
});
