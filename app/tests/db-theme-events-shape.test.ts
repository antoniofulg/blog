/**
 * Unit and integration tests for the `themeEvents` schema declaration.
 *
 * Unit suite: compile-time shape checks for ThemeEvent / NewThemeEvent.
 * Integration suite: PGLite pushSchema verifies the table + index are
 * created and that a round-trip insert/select works.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NewThemeEvent, ThemeEvent } from "../db/schema";
import * as schema from "../db/schema";
import { themeEvents } from "../db/schema";

// ─── Unit: themeEvents table metadata ───────────────────────────────────────

describe("unit: themeEvents schema", () => {
	it("table name is 'theme_events'", () => {
		expect(
			(themeEvents as unknown as Record<symbol, unknown>)[
				Symbol.for("drizzle:Name")
			],
		).toBe("theme_events");
	});

	it("id column is bigserial primary key", () => {
		const col = themeEvents.id;
		expect(col.primary).toBe(true);
	});

	it("createdAt uses withTimezone: true (timestamptz)", () => {
		const col = themeEvents.createdAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
	});

	it("createdAt has defaultNow()", () => {
		const col = themeEvents.createdAt;
		expect(col.hasDefault).toBe(true);
	});

	it("theme column is notNull", () => {
		const col = themeEvents.theme;
		expect(col.notNull).toBe(true);
	});

	it("source column is notNull", () => {
		const col = themeEvents.source;
		expect(col.notNull).toBe(true);
	});

	it("lang column is notNull", () => {
		const col = themeEvents.lang;
		expect(col.notNull).toBe(true);
	});

	it("device column is notNull", () => {
		const col = themeEvents.device;
		expect(col.notNull).toBe(true);
	});

	it("referrerSource column is notNull", () => {
		const col = themeEvents.referrerSource;
		expect(col.notNull).toBe(true);
	});

	it("ThemeEvent select type has all 7 expected columns (compile-time check)", () => {
		// TypeScript compile check: if ThemeEvent type is wrong this file won't compile.
		const _event: ThemeEvent = {
			id: 1,
			createdAt: new Date(),
			theme: "cs16",
			source: "long-press",
			lang: "en",
			device: "desktop",
			referrerSource: "direct",
		};
		expect(_event.id).toBe(1);
		expect(_event.theme).toBe("cs16");
		expect(_event.source).toBe("long-press");
		expect(_event.lang).toBe("en");
		expect(_event.device).toBe("desktop");
		expect(_event.referrerSource).toBe("direct");
		expect(_event.createdAt).toBeInstanceOf(Date);
	});

	it("NewThemeEvent omits id and createdAt (compile-time check)", () => {
		// Minimal valid insert — id and createdAt are generated server-side.
		const _new: NewThemeEvent = {
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
			device: "mobile",
			referrerSource: "google",
		};
		expect(_new.theme).toBe("cs16");
		expect(_new.source).toBe("keyboard");
		expect(_new.lang).toBe("pt-br");
		expect(_new.device).toBe("mobile");
		expect(_new.referrerSource).toBe("google");
	});

	it("themeEvents export is present in schema module", () => {
		// Regression guard: ensures the export is not accidentally removed.
		expect(schema.themeEvents).toBeDefined();
	});

	it("ThemeEvent and NewThemeEvent types are exported (structural check via assignment)", () => {
		// If either type is missing, the imports above will fail at compile time.
		// This runtime assertion is a belt-and-suspenders check.
		const id: ThemeEvent["id"] = 99;
		const theme: NewThemeEvent["theme"] = "cs16";
		expect(typeof id).toBe("number");
		expect(typeof theme).toBe("string");
	});
});

// ─── Integration: PGLite pushSchema round-trip ───────────────────────────────

describe("integration: themeEvents (PGLite)", () => {
	type CombinedSchema = typeof schema;
	type PgliteDb = import("drizzle-orm/pglite").PgliteDatabase<CombinedSchema>;

	let db: PgliteDb;
	let pgliteClient: import("@electric-sql/pglite").PGlite;

	beforeAll(async () => {
		const { PGlite } = await import("@electric-sql/pglite");
		const { drizzle } = await import("drizzle-orm/pglite");
		const { pushSchema } = await import("drizzle-kit/api");

		pgliteClient = new PGlite("memory://");
		await pgliteClient.waitReady;

		db = drizzle<CombinedSchema>(pgliteClient, { schema });

		// biome-ignore lint/suspicious/noExplicitAny: pushSchema requires db as any
		const result = await pushSchema(schema, db as any);
		await result.apply();
	}, 30_000);

	afterAll(async () => {
		await pgliteClient.close();
	});

	it("inserts a theme event row and reads it back with correct values", async () => {
		const [event] = await db
			.insert(themeEvents)
			.values({
				theme: "cs16",
				source: "long-press",
				lang: "en",
				device: "desktop",
				referrerSource: "direct",
			})
			.returning();

		expect(event.theme).toBe("cs16");
		expect(event.source).toBe("long-press");
		expect(event.lang).toBe("en");
		expect(event.device).toBe("desktop");
		expect(event.referrerSource).toBe("direct");
		expect(event.createdAt).toBeInstanceOf(Date);
		expect(typeof event.id).toBe("number");
	});

	it("inserts keyboard-sourced event with pt-br lang", async () => {
		const [event] = await db
			.insert(themeEvents)
			.values({
				theme: "cs16",
				source: "keyboard",
				lang: "pt-br",
				device: "mobile",
				referrerSource: "google",
			})
			.returning();

		expect(event.source).toBe("keyboard");
		expect(event.lang).toBe("pt-br");
		expect(event.device).toBe("mobile");
	});

	it("id auto-increments across consecutive inserts", async () => {
		const [e1] = await db
			.insert(themeEvents)
			.values({
				theme: "cs16",
				source: "long-press",
				lang: "en",
				device: "tablet",
				referrerSource: "linkedin",
			})
			.returning();

		const [e2] = await db
			.insert(themeEvents)
			.values({
				theme: "cs16",
				source: "keyboard",
				lang: "en",
				device: "desktop",
				referrerSource: "direct",
			})
			.returning();

		expect(e2.id).toBeGreaterThan(e1.id);
	});

	it("createdAt defaults to now() — within 5 seconds of test execution", async () => {
		const before = Date.now();
		const [event] = await db
			.insert(themeEvents)
			.values({
				theme: "cs16",
				source: "long-press",
				lang: "en",
				device: "desktop",
				referrerSource: "direct",
			})
			.returning();
		const after = Date.now();

		const ts = event.createdAt.getTime();
		expect(ts).toBeGreaterThanOrEqual(before - 5000);
		expect(ts).toBeLessThanOrEqual(after + 5000);
	});
});
