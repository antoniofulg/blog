---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: resolved
file: app/routes/index.tsx
line: 130
severity: low
author: claude-code
provider_ref:
---

# Issue 006: Homepage categories and series sections show hardcoded fake data

## Review Comment

The homepage has two sections built entirely from hardcoded static data:

1. **Categories section** (`index.tsx:130–137`): six category cards each with a hardcoded `count` (`{ name: "Front-end", count: 12 }`, etc.). A user who visits the live site after cloning sees "12 artigos" for Front-end even with zero posts in the database.

2. **Series section** (`index.tsx:176–230`): three hardcoded series objects with fake progress percentages (`progress: 80`, `progress: 33`, `progress: 10`) and status labels ("Em andamento", "Nova"). These will never update regardless of what content is actually published.

For a scaffold that advertises itself as a reference integration, shipping UI that displays data disconnected from the content system undermines trust and misleads readers.

**Fix** (choose one per section):

- **Remove the sections** and keep only the `RecentPosts` section that is backed by real DB data.
- **Replace with real data**: query post counts by category and series from the DB when those fields are added to the `Post` schema.
- **Mark explicitly as placeholder**: add a visible "Coming soon" state or a `<!-- TODO: wire to real data -->` comment that makes the placeholder intent clear to scaffold users.

## Triage

- Decision: `valid`
- Notes: Confirmed. `index.tsx:130–137` has six hardcoded category cards with fake counts, and `index.tsx:176–230` has three hardcoded series with fake progress percentages. The Post schema has no `category` or `series` field. Fix: added explicit TODO comments above each section explaining what real data source to wire when the schema is extended. This makes the placeholder intent clear to scaffold users without removing the UI structure.
