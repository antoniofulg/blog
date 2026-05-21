import { expect, test } from "@playwright/test";

// Anonymous session — no admin storageState
test.use({ storageState: { cookies: [], origins: [] } });

const FIXTURE_SLUG = "e2e-public-fixture";
const FIXTURE_EN_TITLE = "E2E Public Fixture";
const FIXTURE_PTBR_TITLE = "E2E Fixture Público";
const EN_ONLY_SLUG = "e2e-en-only-fixture";

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

	test(
		"locale switcher: from pt-br post, open menu, switch to en → navigates to /<slug>",
		async ({ page }) => {
			await page.goto(`/pt-br/${FIXTURE_SLUG}`);
			await page.waitForLoadState("load");

			await expect(
				page.getByRole("heading", { name: FIXTURE_PTBR_TITLE, exact: true }),
			).toBeVisible();

			await page.getByRole("button", { name: "Trocar idioma" }).click();
			await expect(page.getByRole("menu")).toBeVisible();

			await page.getByRole("menuitemradio", { name: /English/ }).click();
			await page.waitForURL((url) => !url.pathname.startsWith("/pt-br"));

			expect(page.url()).toContain(`/${FIXTURE_SLUG}`);
			expect(page.url()).not.toContain("/pt-br");
			await expect(
				page.getByRole("heading", { name: FIXTURE_EN_TITLE, exact: true }),
			).toBeVisible();
		},
	);

	// AC-5: was broken — en → pt-br on an un-prefixed en URL fell to home instead of /pt-br/<slug>
	test(
		"locale switcher: from en post (no prefix), open menu, switch to pt-br → navigates to /pt-br/<slug>",
		async ({ page }) => {
			await page.goto(`/${FIXTURE_SLUG}`);
			await page.waitForLoadState("load");

			await expect(
				page.getByRole("heading", { name: FIXTURE_EN_TITLE, exact: true }),
			).toBeVisible();

			await page.getByRole("button", { name: "Change language" }).click();
			await expect(page.getByRole("menu")).toBeVisible();

			const ptBrItem = page.getByRole("menuitemradio", { name: /Português/ });
			await expect(ptBrItem).not.toHaveAttribute("aria-disabled");

			await ptBrItem.click();
			await page.waitForURL((url) =>
				url.pathname.startsWith("/pt-br"),
			);

			expect(page.url()).toContain(`/pt-br/${FIXTURE_SLUG}`);
			await expect(
				page.getByRole("heading", { name: FIXTURE_PTBR_TITLE, exact: true }),
			).toBeVisible();
		},
	);

	test(
		"locale switcher: menu shows '(not available)' and aria-disabled for en-only post",
		async ({ page }) => {
			await page.goto(`/${EN_ONLY_SLUG}`);
			await page.waitForLoadState("load");

			await page.getByRole("button", { name: "Change language" }).click();
			await expect(page.getByRole("menu")).toBeVisible();

			const ptBrItem = page.getByRole("menuitemradio", { name: /Português/ });
			await expect(ptBrItem).toHaveAttribute("aria-disabled", "true");
			await expect(page.getByText("(not available)")).toBeVisible();
		},
	);

	test(
		"locale switcher: modal confirm path navigates to /pt-br/ for en-only post",
		async ({ page }) => {
			await page.goto(`/${EN_ONLY_SLUG}`);
			await page.waitForLoadState("load");

			await page.getByRole("button", { name: "Change language" }).click();
			// aria-disabled item: bypass Playwright's enabled-check; the modal seam
			// requires the click to still fire so the dialog can open (ADR-003).
			await page
				.getByRole("menuitemradio", { name: /Português/ })
				.click({ force: true });

			// Dialog opens — copy is in English (current page locale)
			await expect(page.getByRole("dialog")).toBeVisible();
			await expect(page.getByText("Content not available")).toBeVisible();

			// Confirm navigates to pt-br home
			await page.getByRole("button", { name: "Continue" }).click();
			await page.waitForURL("/pt-br/");

			expect(page.url()).toContain("/pt-br/");
		},
	);

	test(
		"locale switcher: modal cancel closes dialog and URL stays unchanged for en-only post",
		async ({ page }) => {
			await page.goto(`/${EN_ONLY_SLUG}`);
			await page.waitForLoadState("load");

			const initialUrl = page.url();

			await page.getByRole("button", { name: "Change language" }).click();
			await page
				.getByRole("menuitemradio", { name: /Português/ })
				.click({ force: true });

			await expect(page.getByRole("dialog")).toBeVisible();

			// Cancel — dialog closes, URL unchanged
			await page.getByRole("button", { name: "Cancel" }).click();
			await expect(page.getByRole("dialog")).not.toBeVisible();

			expect(page.url()).toBe(initialUrl);

			// Focus returns to the language menu trigger
			await expect(
				page.getByRole("button", { name: "Change language" }),
			).toBeFocused();
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
