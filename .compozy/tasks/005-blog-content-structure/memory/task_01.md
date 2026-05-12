---
task: task_01
title: DB Schema & Migration
status: completed
---

# Task Memory: task_01.md

## Objective Snapshot

Add 5 columns to `posts` table, replace standalone `slug UNIQUE` with composite `UNIQUE(slug, lang)`, generate and apply Drizzle migration.

## Important Decisions

- Used `unique().on(t.slug, t.lang)` in pgTable's second arg (table config), not on the column itself — Drizzle composite unique syntax
- `slug` column `.unique()` call removed entirely; `isUnique` on the column object is now `false`

## Learnings

- `app/tests/drizzle-schema.test.ts` had tests for `slug` standalone unique (`col.isUnique`, `col.uniqueName`) — these break when unique moves to composite; must update alongside schema changes
- DB column count test was hardcoded to 9 — updated to 14
- Post type compile-time fixture must include all non-optional fields — adding 5 columns required updating the fixture object
- Added bilingual insert test: same slug + different lang must succeed (new behavior the old test couldn't cover)
- Actual DB had 2 posts (task spec estimated 3) — both got `lang='en'` via DEFAULT

## Files / Surfaces

- `app/db/schema.ts` — schema updated (5 new columns, composite unique)
- `drizzle/0002_puzzling_beyonder.sql` — new migration file
- `app/tests/drizzle-schema.test.ts` — updated: slug unique unit test, Post fixture, column count (9→14), duplicate-slug integration test, added bilingual insert test

## Errors / Corrections

- `tsc --noEmit` failed initially: `Post` type fixture in test missing `lang, category, series, seriesPart, draft` — fixed by adding all 5 fields to the fixture object

## Ready for Next Run

Task complete. task_02 (Content Folder Restructure) can proceed — no blockers from this task.
