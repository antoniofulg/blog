# DB Rules

## File responsibilities
- app/db/schema.ts       — pgTable definitions ONLY; no query logic, no business logic
- app/db/queries.ts      — exported query functions for public (reader) data access
- app/db/indexer.ts      — file-to-DB pipeline: reads file, parses frontmatter, upserts post
- app/db/client.ts       — drizzle client singleton; imports DATABASE_URL from env
- app/db/auth-schema.ts  — Better Auth table definitions (managed by better-auth)

## Type placement
Shared TypeScript types for DB-related shapes belong in app/types/, not in schema.ts
or queries.ts. Exception: Drizzle inferred types ($inferSelect, $inferInsert) are
defined inline where the schema is declared.

## Query function rules
- All public query functions go in queries.ts
- Admin/write operations go in the co-located *.server.ts file (not in queries.ts)
- No raw SQL strings — use Drizzle query builder or sql`` tagged template

## Anti-patterns
- Business logic inside schema.ts (hooks, computed fields)
- Direct db.* calls inside React components or layout files
- Exporting db client from anywhere other than #/db/client
- Duplicate type definitions (PostFrontmatter was duplicated — resolved in ADR-003)
