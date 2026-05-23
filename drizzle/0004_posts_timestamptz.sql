-- Migrate posts.published_at and posts.indexed_at from timestamp to timestamptz.
-- USING clause interprets existing stored values as UTC (backfill assumption per ADR-002).
ALTER TABLE "posts" ALTER COLUMN "published_at" TYPE timestamp with time zone USING "published_at" AT TIME ZONE 'UTC';
ALTER TABLE "posts" ALTER COLUMN "indexed_at" TYPE timestamp with time zone USING "indexed_at" AT TIME ZONE 'UTC';