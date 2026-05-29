import { sql } from "drizzle-orm";
import {
	bigserial,
	boolean,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

export const posts = pgTable(
	"posts",
	{
		id: serial("id").primaryKey(),
		filePath: text("file_path").notNull().unique(),
		slug: text("slug").notNull(),
		lang: text("lang").notNull().default("en"),
		title: text("title").notNull(),
		description: text("description"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		viewCount: integer("view_count").notNull().default(0),
		indexedAt: timestamp("indexed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		category: text("category"),
		series: text("series"),
		seriesPart: integer("series_part"),
		draft: boolean("draft"),
	},
	(t) => [unique().on(t.slug, t.lang)],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export const analyticsEvents = pgTable(
	"analytics_events",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		postId: integer("post_id")
			.notNull()
			.references(() => posts.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		referrerSource: text("referrer_source").notNull(),
		lang: text("lang").notNull(),
		device: text("device").notNull(),
		countryCode: text("country_code"),
		isBot: boolean("is_bot").notNull().default(false),
	},
	(t) => [
		index("idx_events_post_created").on(t.postId, t.createdAt.desc()),
		index("idx_events_created").on(t.createdAt.desc()),
		index("idx_events_nonbot_created")
			.on(t.createdAt.desc())
			.where(sql`is_bot = false`),
	],
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export const themeEvents = pgTable(
	"theme_events",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		theme: text("theme").notNull(),
		source: text("source").notNull(),
		lang: text("lang").notNull(),
		device: text("device").notNull(),
		referrerSource: text("referrer_source").notNull(),
	},
	(t) => [index("idx_theme_events_created").on(t.createdAt.desc())],
);

export type ThemeEvent = typeof themeEvents.$inferSelect;
export type NewThemeEvent = typeof themeEvents.$inferInsert;
