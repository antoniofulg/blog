/**
 * E2E spec: ux-polish-v1 acceptance smoke (task_08).
 *
 * Covers three features bundled in the ux-polish-v1 PR:
 *   F6  /about social row            — scenarios 1 + 2  (@public @smoke)
 *   F3+F4 post share row             — scenarios 3 + 4  (@public @smoke)
 *   F1+F2 admin lang switcher + i18n — scenarios 5 + 6  (@admin  @smoke)
 *
 * Two test instances keep auth isolation explicit:
 *   publicTest — base Playwright test; anonymous storageState (no cookies).
 *   authedTest — fixture/auth extension; admin.json storageState.
 *
 * Selector hierarchy: getByRole → getByLabel → getByText → data-testid.
 * No waitForTimeout. No CSS selectors. No test.only.
 */
import { readFile } from "node:fs/promises";
import { test as base, expect } from "@playwright/test";
import { freshLogin, test as authedTest } from "./fixtures/auth";
import { E2E_STATE_FILE } from "./global-setup";
import type { E2EState } from "./global-setup";

// Anonymous storageState for all public-route tests in this file.
// Using base (not the auth-fixture extension) avoids storageState leak to
// sibling describes that need the admin session.
const publicTest = base;
publicTest.use({ storageState: { cookies: [], origins: [] } });

// Explicit admin storageState for all authenticated tests in this file.
// Re-stated here so sibling describe order never causes a leak in either
// direction (defensive — project-level default should also work).
authedTest.use({ storageState: "tests/e2e/.auth/admin.json" });

// ── State helper (shared pattern across admin specs) ──────────────────────────

let cachedState: E2EState | undefined;
async function getState(): Promise<E2EState> {
	if (!cachedState) {
		const raw = await readFile(E2E_STATE_FILE, "utf-8");
		cachedState = JSON.parse(raw) as E2EState;
	}
	return cachedState;
}

// ── /about social row ─────────────────────────────────────────────────────────
// Public pages — run without admin session cookies.

publicTest.describe("/about social row", { tag: ["@public", "@smoke"] }, () => {
	publicTest(
		"en /about: avatar img + ≥ 2 social links visible",
		async ({ page }) => {
			await page.goto("/about");
			await page.waitForLoadState("load");

			// Avatar rendered via frontmatter.avatar; alt = frontmatter.title = "About"
			await expect(page.getByRole("img", { name: "About" })).toBeVisible();

			// Social links from about.mdx frontmatter links.github + links.linkedin.
			// exact: true prevents partial match against body links like
			// "github.com/antoniofulg/blog" that also contain "github".
			await expect(
				page.getByRole("link", { name: "GitHub", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "LinkedIn", exact: true }),
			).toBeVisible();
		},
	);

	publicTest(
		"pt-br /about: avatar img + ≥ 2 social links visible",
		async ({ page }) => {
			await page.goto("/pt-br/about");
			await page.waitForLoadState("load");

			// Alt = frontmatter.title for pt-br about = "Sobre"
			await expect(page.getByRole("img", { name: "Sobre" })).toBeVisible();

			// Platform names are locale-neutral (GitHub, LinkedIn in both locales)
			await expect(
				page.getByRole("link", { name: "GitHub", exact: true }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "LinkedIn", exact: true }),
			).toBeVisible();
		},
	);
});

// ── Post share row ────────────────────────────────────────────────────────────
// Public page — run without admin session cookies.

publicTest.describe("post share row", { tag: ["@public", "@smoke"] }, () => {
	publicTest(
		"desktop: 7 chips visible; Copy Link writes UTM-tagged URL to clipboard",
		async ({ page }) => {
			const state = await getState();

			// Mock navigator.clipboard.writeText to capture writes without requiring
			// the clipboard-read permission (headless Chromium may deny real grants).
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "clipboard", {
					value: {
						writeText: async (text: string) => {
							(window as unknown as Record<string, unknown>).__clipboardCapture =
								text;
						},
						readText: async () =>
							(
								window as unknown as Record<string, unknown>
							).__clipboardCapture ?? "",
					},
					configurable: true,
				});
			});

			await page.goto(`/${state.fixturePostSlug}`);
			await page.waitForLoadState("load");

			// 6 social share links — PostShare chips (a elements).
			// aria-labels: "Share on {platform}" (strings.en.postShare.ariaShareOn)
			await expect(
				page.getByRole("link", { name: "Share on X" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Share on LinkedIn" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Share on Bluesky" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Share on Hacker News" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Share on Reddit" }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: "Share on Email" }),
			).toBeVisible();

			// 1 Copy Link button — aria-label = strings.en.postShare.chips.copyLink
			const copyBtn = page.getByRole("button", { name: "Copy link" });
			await expect(copyBtn).toBeVisible();

			// Click Copy Link → triggers navigator.clipboard.writeText(utmUrl)
			await copyBtn.click();

			// Clipboard content must include UTM attribution params (ADR-002)
			const clipboardText = (await page.evaluate(
				() =>
					(window as unknown as Record<string, unknown>).__clipboardCapture ??
					"",
			)) as string;
			expect(clipboardText).toContain("utm_source=blog");
			expect(clipboardText).toContain("utm_medium=share");
		},
	);

	publicTest(
		"mobile native: single Share button visible; chip row absent when navigator.share mocked",
		async ({ page }) => {
			const state = await getState();

			// Simulate a device with Web Share API (ADR-003, Decision 2).
			// addInitScript runs before every navigation in this page context.
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "share", {
					value: () => Promise.resolve(),
					configurable: true,
					writable: true,
				});
			});

			await page.goto(`/${state.fixturePostSlug}`);
			await page.waitForLoadState("load");

			// PostShare useEffect post-mount: detects navigator.share → swaps chip row
			// for a single Share button. Auto-wait handles the brief React re-render.
			const shareBtn = page.getByRole("button", {
				name: "Share",
				exact: true,
			});
			await expect(shareBtn).toBeVisible();

			// Chip row section must not be present — component renders one branch or
			// the other (never both). section[aria-label="Share"] is the chip container.
			await expect(page.locator("section[aria-label='Share']")).not.toBeVisible();
		},
	);
});

// ── Admin lang switcher ───────────────────────────────────────────────────────
// Authenticated admin scenarios — use authedTest fixture.
//
// auth-flow.spec.ts logout test runs before this file alphabetically and
// invalidates the admin.json session token. freshLogin() creates a new session
// so these tests are independent of execution order.

authedTest.describe("admin lang switcher", { tag: ["@admin", "@smoke"] }, () => {
	authedTest(
		"column headers swap on locale toggle and persist on page reload",
		async ({ authedPage }) => {
			// Re-authenticate — admin.json token may be invalidated by the logout
			// test in auth-flow.spec.ts which runs before this file.
			await freshLogin(authedPage);
			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			// Fresh context has no locale in localStorage → default locale is "en".
			// EN column headers: Title, Slug, Language, Actions.
			await expect(
				authedPage.getByRole("columnheader", { name: "Title", exact: true }),
			).toBeVisible();

			// LanguagePair is visible at lg+ breakpoint (Desktop Chrome = 1280px).
			// Inactive locale button aria-label = "Read in Português" when locale = en.
			const ptBtn = authedPage.getByRole("button", {
				name: /read in português/i,
			});
			await expect(ptBtn).toBeVisible();
			await ptBtn.click();

			// After setLocale("pt-br"), React re-renders with PT-BR strings.
			// PT-BR column headers: Título, Slug, Idioma, Ações.
			await expect(
				authedPage.getByRole("columnheader", { name: "Título", exact: true }),
			).toBeVisible();

			// Reload — locale persists via localStorage cookie written by setLocale().
			await authedPage.reload();
			await authedPage.waitForLoadState("load");

			await expect(
				authedPage.getByRole("columnheader", { name: "Título", exact: true }),
			).toBeVisible();
		},
	);
});

// ── Admin translations — no orphan pt-br strings in en mode ──────────────────

authedTest.describe("admin translations", { tag: ["@admin", "@smoke"] }, () => {
	authedTest(
		"en mode contains zero pt-br-specific strings in visible DOM",
		async ({ authedPage }) => {
			// Re-authenticate for same reason as lang switcher (post-logout ordering).
			await freshLogin(authedPage);
			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			// These strings only appear when admin is in pt-br mode.
			// Fresh context has no locale in localStorage → default is "en", so none
			// of these should be present.
			const ptBrOnlyStrings = [
				"Filtrar por idioma",
				"Gerencie",
				"Título",
				"Ações",
			];

			for (const str of ptBrOnlyStrings) {
				await expect(authedPage.getByText(str, { exact: true })).toHaveCount(0);
			}
		},
	);
});
