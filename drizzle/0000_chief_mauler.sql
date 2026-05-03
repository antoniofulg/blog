CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp,
	"is_published" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posts_file_path_unique" UNIQUE("file_path"),
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
