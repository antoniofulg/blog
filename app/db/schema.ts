import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
	id: serial("id").primaryKey(),
	filePath: text("file_path").notNull().unique(),
	slug: text("slug").notNull().unique(),
	title: text("title").notNull(),
	description: text("description"),
	publishedAt: timestamp("published_at"),
	isPublished: boolean("is_published").notNull().default(false),
	viewCount: integer("view_count").notNull().default(0),
	indexedAt: timestamp("indexed_at").notNull().defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
