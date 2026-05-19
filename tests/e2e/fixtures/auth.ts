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
	const email = process.env.E2E_ADMIN_EMAIL ?? "e2e@test.local";
	const password = process.env.E2E_ADMIN_PASSWORD ?? "e2e-test-password";

	await page.goto("/login");
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
