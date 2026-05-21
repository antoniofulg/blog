---
provider: manual
pr:
round: 2
round_created_at: 2026-05-21T16:47:22Z
status: resolved
file: app/lib/content-audit/checks.server.ts
line: 282
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Static-page frontmatter is never audited

## Review Comment

`runContentAudit` (lines 281-308) collects MDX file paths from a single directory — `dir = contentDir ?? join(process.cwd(), "app", "content", "posts")` — and only that list is passed to `checkFrontmatter`. Static pages live under `app/content/pages/<locale>/` and are surfaced only through `enumerateStaticPages`, which silently `continue`s past any page missing `title` (`pages.server.ts:103`) and silently swallows read errors (`pages.server.ts:115`):

```ts
if (!data.title) continue;
...
} catch {
  // skip unreadable or malformed files
}
```

Net effect: a static page with invalid or missing frontmatter is invisible to both the audit pipeline (no `frontmatter-invalid` finding) and the runtime (the page silently drops from the sitemap, content-audit, and `loadStaticPage` returns null on `/` 404). Authors lose the early-warning signal that catches the same class of error for posts.

Fix — extend the audit to walk both content roots and check page frontmatter:

```ts
const postPaths = await findMdxFiles(join(process.cwd(), "app", "content", "posts"));
const pagePaths = await findMdxFiles(join(process.cwd(), "app", "content", "pages"));
const allFilePaths = [...postPaths, ...pagePaths];
// pass allFilePaths to checkFrontmatter as before
```

If the page frontmatter shape diverges from posts beyond just `title` (per `PageFrontmatter`'s minimal `title` + optional `description`), introduce a `checkPageFrontmatter` variant that validates only the page-required fields and is invoked alongside `checkFrontmatter` for posts.

Also align `pages.server.ts`: either `loadStaticPage` should surface (not swallow) malformed-frontmatter cases as a typed error the audit can pick up, or `enumerateStaticPages` should expose its skip events through a side-channel the audit consumes — pick one. The current "throw in load, swallow in enumerate" asymmetry is the seam where this bug hides.

Add a Vitest fixture with a page MDX that lacks `title` and assert the audit emits a `frontmatter-invalid` finding for it.

## Triage

- Decision: `valid`
- Notes: `runContentAudit` uses `const dir = contentDir ?? join(..., "posts")` and passes only that dir to `checkFrontmatter`. Pages under `app/content/pages/` are never walked. `enumerateStaticPages` silently skips pages missing `title` (`continue`) and swallows read errors (`catch {}`), so a malformed page is invisible to both audit and runtime. Fix: also walk `app/content/pages` with `findMdxFiles` and append to `allFilePaths`. `checkFrontmatter` only validates `title`, which is the required field for pages too — no need for a separate `checkPageFrontmatter`. Add test with mocked readdir returning a page MDX file and readFile returning frontmatter without title.
