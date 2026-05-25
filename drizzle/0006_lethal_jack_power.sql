CREATE TABLE "theme_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"theme" text NOT NULL,
	"source" text NOT NULL,
	"lang" text NOT NULL,
	"device" text NOT NULL,
	"referrer_source" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_theme_events_created" ON "theme_events" USING btree ("created_at" DESC NULLS LAST);