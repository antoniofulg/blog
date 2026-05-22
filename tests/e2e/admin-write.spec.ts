import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures/auth";
import { E2E_STATE_FILE } from "./global-setup";
import type { E2EState } from "./global-setup";

let cachedState: E2EState | undefined;

async function getState(): Promise<E2EState> {
	if (!cachedState) {
		const raw = await readFile(E2E_STATE_FILE, "utf-8");
		cachedState = JSON.parse(raw) as E2EState;
	}
	return cachedState;
}

// Admin is read-only post-task_13: list + locale filter + view-in-new-tab.
// Publish toggle and /admin/preview/$slug route were removed.

test.describe("admin write", { tag: ["@admin"] }, () => {
	test.describe("guard", () => {
		test.use({ storageState: { cookies: [], origins: [] } });

		test("unauthenticated /admin → redirect to /login", async ({ page }) => {
			await page.goto("/admin");
			await page.waitForURL(/\/login/);
			expect(page.url()).toContain("/login");
		});
	});

	test(
		"/admin renders Admin Dashboard heading + post-list table",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await expect(
				authedPage.getByRole("heading", { name: /Admin Dashboard/i }),
			).toBeVisible();
			await expect(
				authedPage
					.getByRole("row")
					.filter({ hasText: state.fixturePostTitle }),
			).toBeVisible();
		},
	);

	test(
		"locale filter ?locale=pt-br shows only pt-br rows",
		async ({ authedPage }) => {
			await authedPage.goto("/admin/?locale=pt-br");
			await authedPage.waitForLoadState("load");

			// Filter chip for PT-BR carries aria-current="page".
			await expect(
				authedPage.getByRole("link", { name: "PT-BR" }),
			).toHaveAttribute("aria-current", "page");

			// Every visible body row's language column reads pt-br.
			const langCells = authedPage.locator("tbody tr td:nth-child(3)");
			const count = await langCells.count();
			expect(count).toBeGreaterThan(0);
			for (let i = 0; i < count; i++) {
				await expect(langCells.nth(i)).toHaveText("pt-br");
			}
		},
	);

	test(
		"View button opens public URL in a new tab (target=_blank + rel=noopener)",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			const row = authedPage
				.getByRole("row")
				.filter({ hasText: state.fixturePostTitle });
			const viewLink = row.getByRole("link", { name: /View/i });

			await expect(viewLink).toHaveAttribute("target", "_blank");
			await expect(viewLink).toHaveAttribute("rel", /noopener/);
			const href = await viewLink.getAttribute("href");
			expect(href).toMatch(new RegExp(`/${state.fixturePostSlug}$`));
		},
	);

	test(
		"/admin/preview/<slug> returns 404 (deleted route)",
		async ({ authedPage }) => {
			const state = await getState();

			const response = await authedPage.goto(
				`/admin/preview/${state.fixturePostSlug}`,
			);
			expect(response?.status()).toBe(404);
		},
	);
});
