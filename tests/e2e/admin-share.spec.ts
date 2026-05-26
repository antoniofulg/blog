import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/auth";
import { E2E_STATE_FILE } from "./global-setup";
import type { E2EState } from "./global-setup";

// Cached across tests in this worker to avoid repeated disk reads.
let cachedState: E2EState | undefined;

async function getState(): Promise<E2EState> {
	if (!cachedState) {
		const raw = await readFile(E2E_STATE_FILE, "utf-8");
		cachedState = JSON.parse(raw) as E2EState;
	}
	return cachedState;
}

/**
 * Opens the share dropdown for the fixture post row and waits for it to be
 * visible. Returns the row locator for further assertions if needed.
 */
async function openShareDropdown(authedPage: Page, fixturePostTitle: string) {
	const row = authedPage
		.getByRole("row")
		.filter({ hasText: fixturePostTitle });
	await row.getByRole("button", { name: "Share post" }).click();
	// Wait until at least one chip is visible — Radix Popover is open.
	await expect(authedPage.getByRole("menuitem").first()).toBeVisible();
	return row;
}

test.describe("admin share dropdown", { tag: ["@admin", "@smoke"] }, () => {
	test(
		"opens on trigger click → 6 chips present",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			// Exactly 6 chips (twitter, linkedin, reddit, whatsapp, email, copy).
			await expect(authedPage.getByRole("menuitem")).toHaveCount(6);
		},
	);

	test(
		"LinkedIn chip href contains correct UTM params",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			const linkedinChip = authedPage.getByRole("menuitem", {
				name: "Share on LinkedIn",
			});
			await expect(linkedinChip).toBeVisible();

			const href = await linkedinChip.getAttribute("href");
			expect(href).toBeTruthy();
			// The LinkedIn share-intent URL encodes the tagged URL in its `url` param.
			// Decoding the full href surfaces the embedded UTM params.
			const decodedHref = decodeURIComponent(href ?? "");
			expect(decodedHref).toContain("utm_source=linkedin");
			expect(decodedHref).toContain("utm_medium=social");
			expect(decodedHref).toContain(`utm_campaign=${state.fixturePostSlug}`);
		},
	);

	test(
		"Twitter chip href contains correct UTM params",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			// The Twitter chip label is "X" (i18n); aria-label becomes "Share on X".
			const twitterChip = authedPage.getByRole("menuitem", {
				name: "Share on X",
			});
			await expect(twitterChip).toBeVisible();

			const href = await twitterChip.getAttribute("href");
			expect(href).toBeTruthy();
			const decodedHref = decodeURIComponent(href ?? "");
			expect(decodedHref).toContain("utm_source=twitter");
			expect(decodedHref).toContain("utm_medium=social");
			expect(decodedHref).toContain(`utm_campaign=${state.fixturePostSlug}`);
		},
	);

	test(
		"Copy Link writes canonical URL (no UTM) to clipboard",
		async ({ authedPage }) => {
			const state = await getState();

			// Grant clipboard permissions before navigation so they apply to the full
			// context. clipboard-write is needed for navigator.clipboard.writeText()
			// in Playwright's Chromium headless environment; clipboard-read for readText().
			await authedPage
				.context()
				.grantPermissions(["clipboard-read", "clipboard-write"]);

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			// Bring the page to the front so the Clipboard API sees a focused document.
			await authedPage.bringToFront();
			await authedPage.getByRole("menuitem", { name: "Copy link" }).click();

			// Wait for the "Copied!" feedback in the aria-live output region — this
			// confirms navigator.clipboard.writeText() resolved successfully before we
			// attempt the read. The <output> element has implicit role="status".
			await expect(authedPage.getByRole("status")).toHaveText("Copied!");

			const clipboardText = await authedPage.evaluate(() =>
				navigator.clipboard.readText(),
			);

			// Canonical URL — contains the slug but NO UTM params (ADR-001 amendment:
			// clipboard copies do not receive UTM tagging).
			expect(clipboardText).toContain(state.fixturePostSlug);
			expect(clipboardText).not.toContain("utm_source");
			expect(clipboardText).not.toContain("utm_medium");
			expect(clipboardText).not.toContain("utm_campaign");
		},
	);

	test(
		"popover closes on Esc",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			// Popover is open — at least one menuitem visible.
			await expect(authedPage.getByRole("menuitem").first()).toBeVisible();

			await authedPage.keyboard.press("Escape");

			// Radix Popover unmounts its Content portal on close.
			await expect(authedPage.getByRole("menuitem")).toHaveCount(0);
		},
	);

	test(
		"popover closes on outside click",
		async ({ authedPage }) => {
			const state = await getState();

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");

			await openShareDropdown(authedPage, state.fixturePostTitle);

			// Popover is open — at least one menuitem visible.
			await expect(authedPage.getByRole("menuitem").first()).toBeVisible();

			// Click outside the popover (on the page heading — no interaction target).
			await authedPage
				.getByRole("heading", { name: /Admin Dashboard/i })
				.click();

			// Radix Popover unmounts its Content portal on outside click.
			await expect(authedPage.getByRole("menuitem")).toHaveCount(0);
		},
	);
});
