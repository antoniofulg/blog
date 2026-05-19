import { test as base, type Page } from "@playwright/test";

export type AuthedFixture = {
	authedPage: Page;
	userId: string;
};

export const test = base.extend<AuthedFixture>({
	authedPage: async ({ page }, use) => {
		// storageState is applied at the project level in playwright.config.ts;
		// this fixture simply surfaces the pre-authenticated page.
		await use(page);
	},
	userId: async ({}, use) => {
		await use(process.env.E2E_ADMIN_USER_ID ?? "");
	},
});

export { expect } from "@playwright/test";

export async function freshLogin(page: Page): Promise<void> {
	const isCI = process.env.CI === "true";
	const email = process.env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : "e2e@test.local");
	const password =
		process.env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : "e2e-test-password");

	if (!email) throw new Error("Missing credential: E2E_ADMIN_EMAIL is required on CI");
	if (!password)
		throw new Error("Missing credential: E2E_ADMIN_PASSWORD is required on CI");

	await page.goto("/login");
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Senha").fill(password);
	await page.getByRole("button", { name: /Entrar/i }).click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
