import { mkdirSync } from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";

const AUTH_DIR = path.resolve("tests/e2e/.auth");
const STORAGE_STATE = path.join(AUTH_DIR, "admin.json");

setup("authenticate as admin", async ({ page }) => {
	const isCI = process.env.CI === "true";
	const email = process.env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : "e2e@test.local");
	const password =
		process.env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : "e2e-test-password");

	if (!email) throw new Error("Missing credential: E2E_ADMIN_EMAIL is required on CI");
	if (!password)
		throw new Error("Missing credential: E2E_ADMIN_PASSWORD is required on CI");

	mkdirSync(AUTH_DIR, { recursive: true });

	await page.goto("/login");
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));

	await page.context().storageState({ path: STORAGE_STATE });
});
