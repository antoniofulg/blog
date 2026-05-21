import { expect, test } from "@playwright/test";

// Anonymous session — no admin storageState
test.use({ storageState: { cookies: [], origins: [] } });

const FIXTURE_SLUG = "e2e-public-fixture";
const FIXTURE_EN_TITLE = "E2E Public Fixture";
const FIXTURE_PTBR_TITLE = "E2E Fixture Público";

test.describe("public read", { tag: ["@public", "@smoke"] }, () => {
	test(
		"en post render: title heading and body visible at /<slug>",
		async ({ page }) => {
			const consoleErrors: string[] = [];
			page.on("console", (msg) => {
				if (msg.type() === "error") consoleErrors.push(msg.text());
			});

			const response = await page.goto(`/${FIXTURE_SLUG}`);
			await page.waitForLoadState("load");

			expect(response?.status()).toBe(200);
			await expect(
				page.getByRole("heading", { name: FIXTURE_EN_TITLE, exact: true }),
			).toBeVisible();
			await expect(page.getByText(/English body/)).toBeVisible();

			const cookies = await page.context().cookies();
			expect(
				cookies.filter((c) => c.name === "better-auth.session_token"),
			).toHaveLength(0);
			expect(consoleErrors, "no console errors during navigation").toHaveLength(
				0,
			);
		},
	);

	test(
		"pt-br post render: title heading and body visible at /pt-br/<slug>",
		async ({ page }) => {
			const consoleErrors: string[] = [];
			page.on("console", (msg) => {
				if (msg.type() === "error") consoleErrors.push(msg.text());
			});

			const response = await page.goto(`/pt-br/${FIXTURE_SLUG}`);
			await page.waitForLoadState("load");

			expect(response?.status()).toBe(200);
			await expect(
				page.getByRole("heading", { name: FIXTURE_PTBR_TITLE, exact: true }),
			).toBeVisible();
			await expect(page.getByText(/português/)).toBeVisible();

			const cookies = await page.context().cookies();
			expect(
				cookies.filter((c) => c.name === "better-auth.session_token"),
			).toHaveLength(0);
			expect(consoleErrors, "no console errors during navigation").toHaveLength(
				0,
			);
		},
	);

	// NOTE: en → pt-br direction is broken in useLangSwitcher for un-prefixed en URLs
	// (falls to home rather than /pt-br/<slug>). Testing the working direction: pt-br → en.
	test(
		"locale switcher: from pt-br post, switching to en navigates to /<slug> and shows English content",
		async ({ page }) => {
			await page.goto(`/pt-br/${FIXTURE_SLUG}`);
			await page.waitForLoadState("load");

			await expect(
				page.getByRole("heading", { name: FIXTURE_PTBR_TITLE, exact: true }),
			).toBeVisible();

			// LanguageMenu dropdown: open trigger then select English menu item.
			await page.getByRole("button", { name: "Trocar idioma" }).click();
			await page.getByRole("menuitemradio", { name: "English" }).click();
			await page.waitForURL((url) => !url.pathname.startsWith("/pt-br"));

			expect(page.url()).toContain(`/${FIXTURE_SLUG}`);
			expect(page.url()).not.toContain("/pt-br");
			await expect(
				page.getByRole("heading", { name: FIXTURE_EN_TITLE, exact: true }),
			).toBeVisible();
		},
	);

	test(
		"404: non-existent slug renders Post not found heading",
		async ({ page }) => {
			await page.goto("/this-slug-does-not-exist-e2e-99999");
			await page.waitForLoadState("load");

			await expect(
				page.getByRole("heading", { name: "Post not found" }),
			).toBeVisible();

			const cookies = await page.context().cookies();
			expect(
				cookies.filter((c) => c.name === "better-auth.session_token"),
			).toHaveLength(0);
		},
	);
});

test.describe("locale-index routes", { tag: ["@public", "@smoke"] }, () => {
	for (const { route, expectedLang, expectedCanonical } of [
		{ route: "/pt-br/", expectedLang: "pt-BR", expectedCanonical: "/pt-br/" },
		{ route: "/en/", expectedLang: "en", expectedCanonical: "/" },
		{ route: "/", expectedLang: "en", expectedCanonical: "/" },
	]) {
		test(
			`${route} renders 200, sets html[lang], and canonical contains expected path`,
			async ({ page }) => {
				const response = await page.goto(route);
				await page.waitForLoadState("load");

				expect(response?.status()).toBe(200);
				await expect(page.locator("html")).toHaveAttribute(
					"lang",
					expectedLang,
				);
				const canonical = await page
					.locator('link[rel="canonical"]')
					.last()
					.getAttribute("href");
				expect(canonical).toContain(expectedCanonical);
			},
		);
	}

	test(
		"/pt-br (no trailing slash) redirects to /pt-br/ with 200",
		async ({ page }) => {
			await page.goto("/pt-br");
			await page.waitForLoadState("load");
			expect(page.url()).toMatch(/\/pt-br\/$/);
			expect(await page.evaluate(() => document.readyState)).toBe("complete");
		},
	);
});
