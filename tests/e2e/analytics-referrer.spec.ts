/**
 * E2E spec: end-to-end referrer-source bucketing.
 *
 * Verifies that a visit arriving from a known social referrer (LinkedIn,
 * X/Twitter, GitHub) or with no referrer at all is recorded in
 * `analytics_events.referrer_source` with the correct bucket.
 *
 * Why this needs to be e2e: the post-view increment runs in a `useEffect`
 * on the client, then POSTs to the `incrementViewCount` server function.
 * That POST is same-origin, so the browser's `Referer` header on the fetch
 * is always the post URL itself — not the upstream page the user came from.
 * To capture the real source, the client forwards `document.referrer` as an
 * explicit input. This spec exercises that contract through the real
 * browser navigation flow and reads the analytics row back from the test
 * database to confirm the bucketer mapped it correctly.
 *
 * Tagged @public @smoke — runs in the CI E2E gate.
 */
import { readFile } from "node:fs/promises";
import { and, desc, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { test as publicTest, expect } from "@playwright/test";
import * as schema from "#/db/schema";
import { E2E_STATE_FILE } from "./global-setup";
import type { E2EState } from "./global-setup";

// ── State + DB helpers ────────────────────────────────────────────────────────

let cachedState: E2EState | undefined;

async function getState(): Promise<E2EState> {
	if (!cachedState) {
		const raw = await readFile(E2E_STATE_FILE, "utf-8");
		cachedState = JSON.parse(raw) as E2EState;
	}
	return cachedState;
}

type TestDb = {
	db: PostgresJsDatabase<typeof schema>;
	close: () => Promise<void>;
};

async function openTestDb(connectionString: string): Promise<TestDb> {
	const sql = postgres(connectionString, { max: 1 });
	const db = drizzle(sql, { schema });
	return { db, close: () => sql.end() };
}

async function latestEventForPost(
	db: PostgresJsDatabase<typeof schema>,
	postId: number,
) {
	const rows = await db
		.select({
			id: schema.analyticsEvents.id,
			postId: schema.analyticsEvents.postId,
			referrerSource: schema.analyticsEvents.referrerSource,
			lang: schema.analyticsEvents.lang,
			device: schema.analyticsEvents.device,
		})
		.from(schema.analyticsEvents)
		.where(eq(schema.analyticsEvents.postId, postId))
		.orderBy(desc(schema.analyticsEvents.id))
		.limit(1);
	return rows[0];
}

async function countEventsBySource(
	db: PostgresJsDatabase<typeof schema>,
	postId: number,
	source: string,
) {
	const rows = await db
		.select({ id: schema.analyticsEvents.id })
		.from(schema.analyticsEvents)
		.where(
			and(
				eq(schema.analyticsEvents.postId, postId),
				eq(schema.analyticsEvents.referrerSource, source),
			),
		);
	return rows.length;
}

// ── Spec ──────────────────────────────────────────────────────────────────────

const SCENARIOS = [
	{
		label: "LinkedIn feed → linkedin bucket",
		referer: "https://www.linkedin.com/feed/",
		expectedSource: "linkedin",
	},
	{
		label: "X.com timeline → twitter bucket (x.com aliased)",
		referer: "https://x.com/some/path",
		expectedSource: "twitter",
	},
	{
		label: "GitHub repo → github bucket",
		referer: "https://github.com/some/repo",
		expectedSource: "github",
	},
] as const;

publicTest.describe(
	"analytics referrer bucketing",
	{ tag: ["@public", "@smoke"] },
	() => {
		// Each scenario runs in its own fresh page context, so the
		// `sessionStorage` viewed guard inside PostView starts empty and the
		// increment server function actually fires.
		for (const scenario of SCENARIOS) {
			publicTest(scenario.label, async ({ page }) => {
				const state = await getState();
				const { db, close } = await openTestDb(state.connectionString);

				try {
					const before = await countEventsBySource(
						db,
						state.fixturePostId,
						scenario.expectedSource,
					);

					// `page.goto` with an explicit `referer` sets the navigation
					// request's `Referer` header, which the browser then exposes as
					// `document.referrer` to the document. The `useEffect` in
					// PostView reads `document.referrer` and forwards it to the
					// increment server function.
					// Arm the response promise BEFORE goto so the increment POST
					// fired by the PostView `useEffect` cannot race past the
					// listener. The TanStack server-fn URL is hashed per build,
					// so match on verb alone — no other mutation runs during
					// the public-read path, so any POST that reaches a 2xx is
					// the increment fetch.
					const incrementResponse = page.waitForResponse(
						(res) => res.request().method() === "POST" && res.status() < 400,
					);

					await page.goto(`/${state.fixturePostSlug}`, {
						referer: scenario.referer,
					});
					await page.waitForLoadState("load");
					await incrementResponse;

					// `recordPostView` writes inside `db.transaction`; the client
					// sees the response slightly before the row is durable. Poll
					// briefly so the read does not race the commit.
					await expect
						.poll(
							async () =>
								countEventsBySource(
									db,
									state.fixturePostId,
									scenario.expectedSource,
								),
							{ timeout: 5_000 },
						)
						.toBe(before + 1);

					const last = await latestEventForPost(db, state.fixturePostId);
					expect(last).toBeDefined();
					expect(last?.referrerSource).toBe(scenario.expectedSource);
					expect(last?.lang).toBe("en");
				} finally {
					await close();
				}
			});
		}

		// ── utm_source scenarios ──────────────────────────────────────────────
		// Click on a share-intent link (wa.me, twitter intent, etc.) strips
		// document.referrer in the redirect chain, leaving the post URL
		// with `?utm_source=<platform>` as the only attribution signal. The
		// server should prefer the UTM over the (missing) referrer.
		const UTM_SCENARIOS = [
			{
				label: "?utm_source=whatsapp with no referrer → whatsapp bucket",
				utmSource: "whatsapp",
				expectedSource: "whatsapp",
			},
			{
				label: "?utm_source=email with no referrer → email bucket",
				utmSource: "email",
				expectedSource: "email",
			},
			{
				label: "?utm_source=linkedin overrides a Google referer",
				utmSource: "linkedin",
				expectedSource: "linkedin",
				referer: "https://www.google.com/search?q=foo",
			},
		] as const;

		for (const scenario of UTM_SCENARIOS) {
			publicTest(scenario.label, async ({ page }) => {
				const state = await getState();
				const { db, close } = await openTestDb(state.connectionString);

				try {
					const lastIdBefore =
						(await latestEventForPost(db, state.fixturePostId))?.id ?? 0;

					const url = `/${state.fixturePostSlug}?utm_source=${scenario.utmSource}&utm_medium=social&utm_campaign=${state.fixturePostSlug}`;
					await page.goto(url, {
						referer: "referer" in scenario ? scenario.referer : undefined,
					});
					await page.waitForLoadState("load");

					await expect
						.poll(
							async () =>
								(await latestEventForPost(db, state.fixturePostId))?.id ?? 0,
							{ timeout: 7_000 },
						)
						.toBeGreaterThan(lastIdBefore);

					const last = await latestEventForPost(db, state.fixturePostId);
					expect(last?.referrerSource).toBe(scenario.expectedSource);
				} finally {
					await close();
				}
			});
		}

		publicTest(
			"no upstream referrer → direct bucket",
			async ({ page }) => {
				const state = await getState();
				const { db, close } = await openTestDb(state.connectionString);

				try {
					const lastIdBefore =
						(await latestEventForPost(db, state.fixturePostId))?.id ?? 0;

					const posts: { url: string; body: string | null }[] = [];
					page.on("request", (req) => {
						if (req.method() === "POST") {
							posts.push({ url: req.url(), body: req.postData() });
						}
					});

					// No `referer` option → navigation has no Referer header →
					// `document.referrer` is the empty string → client forwards
					// `null`, which the bucketer maps to "direct".
					await page.goto(`/${state.fixturePostSlug}`);
					await page.waitForLoadState("load");

					// Poll for the new row instead of awaiting a single
					// response: there's no other mutation on the public-read
					// path, but TanStack server-fn URLs are hashed so the
					// matcher cannot be more precise without coupling to the
					// build hash.
					try {
						await expect
							.poll(
								async () =>
									(await latestEventForPost(db, state.fixturePostId))?.id ?? 0,
								{ timeout: 7_000 },
							)
							.toBeGreaterThan(lastIdBefore);
					} catch (err) {
						const diag = posts
							.map((p, i) => `  [${i}] ${p.url} body=${p.body ?? "<none>"}`)
							.join("\n");
						throw new Error(
							`No new analytics_events row was inserted for fixturePostId=${state.fixturePostId} ` +
								`(lastIdBefore=${lastIdBefore}). Captured POSTs:\n${diag}\n\nOriginal: ${
									err instanceof Error ? err.message : String(err)
								}`,
						);
					}

					const last = await latestEventForPost(db, state.fixturePostId);
					expect(last?.referrerSource).toBe("direct");
				} finally {
					await close();
				}
			},
		);
	},
);
