import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { posts } from "#/db/schema";
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

// Each call creates a fresh connection to avoid postgres-js connection-level
// caching that can return stale results when shared across PGLite proxy queries.
async function queryIsPublished(
	connectionString: string,
	id: number,
): Promise<boolean> {
	const sql = postgres(connectionString, { max: 1, idle_timeout: 0 });
	const db = drizzle(sql, { schema: { posts } });
	try {
		const [row] = await db
			.select({ isPublished: posts.isPublished })
			.from(posts)
			.where(eq(posts.id, id));
		return row.isPublished;
	} finally {
		await sql.end();
	}
}

async function resetIsPublished(
	connectionString: string,
	id: number,
): Promise<void> {
	const sql = postgres(connectionString, { max: 1, idle_timeout: 0 });
	const db = drizzle(sql, { schema: { posts } });
	try {
		await db.update(posts).set({ isPublished: false }).where(eq(posts.id, id));
	} finally {
		await sql.end();
	}
}

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
		"publish toggle: isPublished flips in UI and DB (round-trip)",
		async ({ authedPage }) => {
			const state = await getState();
			await resetIsPublished(state.connectionString, state.fixturePostId);

			await authedPage.goto("/admin");
			await authedPage.waitForLoadState("load");
			await expect(
				authedPage.getByRole("heading", { name: /Admin Dashboard/i }),
			).toBeVisible();

			const row = authedPage
				.getByRole("row")
				.filter({ hasText: state.fixturePostTitle });

			// Publish
			await row.getByRole("button", { name: /Publicar/i }).click();
			await expect(
				row.getByRole("button", { name: /Despublicar/i }),
			).toBeVisible();

			expect(
				await queryIsPublished(state.connectionString, state.fixturePostId),
				"DB must reflect published=true",
			).toBe(true);

			// Unpublish — verifies double-toggle leaves DB in original state
			await row.getByRole("button", { name: /Despublicar/i }).click();
			await expect(
				row.getByRole("button", { name: /Publicar/i }),
			).toBeVisible();

			expect(
				await queryIsPublished(state.connectionString, state.fixturePostId),
				"DB must revert to published=false",
			).toBe(false);
		},
	);

	test(
		"preview: unpublished post renders fixture title",
		async ({ authedPage }) => {
			const state = await getState();
			await resetIsPublished(state.connectionString, state.fixturePostId);

			await authedPage.goto(`/admin/preview/${state.fixturePostSlug}`);
			await authedPage.waitForLoadState("load");
			await expect(
				authedPage.getByRole("heading", { name: state.fixturePostTitle }),
			).toBeVisible();
		},
	);
});
