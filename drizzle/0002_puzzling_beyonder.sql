ALTER TABLE "posts" DROP CONSTRAINT "posts_slug_unique";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "lang" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series_part" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "draft" boolean;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_slug_lang_unique" UNIQUE("slug","lang");