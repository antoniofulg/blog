import "@tanstack/react-start/server-only";
import { readdir, readFile } from "node:fs/promises";
import {
	basename,
	dirname,
	extname,
	isAbsolute,
	join,
	normalize,
	relative,
} from "node:path";
import { eq, or } from "drizzle-orm";
import matter from "gray-matter";
import { LOCALES, type Locale } from "#/lib/locale";
import { findFirstCodeBlock } from "#/lib/mdx/code-blocks.server";
import { generateOgImage } from "#/lib/og/generate";
import { db } from "./client";
import { posts } from "./schema";

function parseFrontmatterBlock(
	source: string,
	filePath: string,
): {
	title: string;
	description?: string;
	publishedAt?: Date;
	slug?: string;
	category?: string;
	series?: string;
	seriesPart?: number;
	draft?: boolean;
} {
	const { data } = matter(source);
	if (!data.title)
		throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
	const publishedAtRaw = data.publishedAt;
	const publishedAt: Date | undefined =
		publishedAtRaw instanceof Date
			? publishedAtRaw
			: publishedAtRaw != null
				? new Date(String(publishedAtRaw))
				: undefined;
	const seriesPartRaw = data.seriesPart;
	const seriesPart: number | undefined =
		seriesPartRaw != null ? parseInt(String(seriesPartRaw), 10) : undefined;
	return {
		title: data.title as string,
		description: data.description as string | undefined,
		publishedAt,
		slug: data.slug as string | undefined,
		category: data.category as string | undefined,
		series: data.series as string | undefined,
		seriesPart: Number.isNaN(seriesPart) ? undefined : seriesPart,
		draft: data.draft as boolean | undefined,
	};
}

function deriveSlug(filePath: string, frontmatterSlug?: string): string {
	if (frontmatterSlug) return frontmatterSlug;
	return basename(filePath, extname(filePath));
}

// Normalize any incoming path (absolute or relative) to cwd-relative form so
// rows are stored consistently regardless of caller (watcher = absolute via
// `join(process.cwd(), ...)`, sync.ts = absolute via `resolve()`, dev-boot =
// "./content" → relative). Without this the unique(file_path) constraint
// matches one caller's format but not another's, breaking upsert-on-conflict.
function toRelativePath(filePath: string): string {
	const normalized = normalize(filePath);
	if (!isAbsolute(normalized)) return normalized;
	const rel = relative(process.cwd(), normalized);
	// Only collapse to cwd-relative when the path is INSIDE the repo. Paths
	// under system tmp dirs (integration tests) produce `../../...` which is
	// brittle for DB rows — keep those absolute so each caller stays consistent.
	if (rel.startsWith("..")) return normalized;
	return rel;
}

function deriveLang(filePath: string): Locale {
	const dir = basename(dirname(filePath));
	if (!(LOCALES as readonly string[]).includes(dir)) {
		throw new Error(
			`Unsupported locale directory "${dir}" in path ${filePath}. Expected one of: ${LOCALES.join(", ")}`,
		);
	}
	return dir as Locale;
}

async function findMdxFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	async function walk(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.name.endsWith(".mdx")) {
				results.push(full);
			}
		}
	}
	await walk(dir);
	return results;
}

export async function upsertPost(filePath: string): Promise<void> {
	let lang: string | null = null;
	try {
		const source = await readFile(filePath, "utf8");
		const fm = parseFrontmatterBlock(source, filePath);
		// Normalize to cwd-relative for DB storage — keeps rows portable and
		// lets repeat upserts hit the same unique(file_path) row regardless of
		// whether the caller passed an absolute or a relative path.
		filePath = toRelativePath(filePath);
		const slug = deriveSlug(filePath, fm.slug);
		lang = deriveLang(filePath);

		// Generate OG image only when the post has at least one fenced code block.
		// Posts with no code block rely on the site-wide og-image.jpg fallback (ADR-002).
		// generateOgImage already wraps its internals in try/catch and returns null;
		// the outer try/catch here is a defensive belt-and-suspenders guard.
		const firstCodeBlock = findFirstCodeBlock(source);
		if (firstCodeBlock !== null) {
			try {
				await generateOgImage({
					locale: lang as Locale,
					slug,
					title: fm.title,
					firstCodeBlock,
				});
			} catch (err) {
				console.warn(
					`[og] generation failed for ${slug}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		const now = new Date();
		await db
			.insert(posts)
			.values({
				filePath,
				slug,
				lang,
				title: fm.title,
				description: fm.description ?? null,
				publishedAt: fm.publishedAt ?? null,
				indexedAt: now,
				category: fm.category ?? null,
				series: fm.series ?? null,
				seriesPart: fm.seriesPart ?? null,
				draft: fm.draft ?? null,
			})
			.onConflictDoUpdate({
				target: posts.filePath,
				set: {
					slug,
					lang,
					title: fm.title,
					description: fm.description ?? null,
					publishedAt: fm.publishedAt ?? null,
					indexedAt: now,
					category: fm.category ?? null,
					series: fm.series ?? null,
					seriesPart: fm.seriesPart ?? null,
					draft: fm.draft ?? null,
				},
			});
		console.log(
			JSON.stringify({
				level: "INFO",
				action: "indexed",
				filePath,
				slug,
				lang,
				category: fm.category ?? null,
			}),
		);
	} catch (err) {
		console.error(
			JSON.stringify({
				level: "ERROR",
				action: "index_error",
				filePath,
				lang,
				error: String(err),
			}),
		);
		throw err;
	}
}

export async function removePost(filePath: string): Promise<void> {
	try {
		// Delete by both the original input AND the cwd-relative normalization.
		// Legacy rows (pre-toRelativePath) stored absolute paths; new rows store
		// relative. Matching both forms lets cleanup catch either kind without a
		// separate migration.
		const normalized = toRelativePath(filePath);
		await db
			.delete(posts)
			.where(or(eq(posts.filePath, filePath), eq(posts.filePath, normalized)));
		console.log(
			JSON.stringify({
				level: "INFO",
				action: "removed",
				filePath: normalized,
			}),
		);
	} catch (err) {
		console.error(
			JSON.stringify({
				level: "ERROR",
				action: "remove_error",
				filePath,
				error: String(err),
			}),
		);
		throw err;
	}
}

export async function syncAll(contentDir: string): Promise<void> {
	const files = await findMdxFiles(contentDir);
	// Normalize walked files to the same cwd-relative form upsertPost stores
	// so the cleanup `fileSet.has()` check below compares apples-to-apples.
	const fileSet = new Set(files.map((p) => toRelativePath(p)));

	// Scan ALL rows (no LIKE filter). A scoped LIKE would orphan rows whose
	// filePath sits outside the current contentDir — e.g. when the content
	// root moves from `content/` → `app/content/posts/`, the old paths would
	// never be cleaned by a syncAll rooted at the new dir. For this blog's
	// scale (single-author, <100 posts) a full table scan is cheap.
	// `.where(undefined)` is a no-op filter — keeps the call shape uniform for
	// mocks that expect the full select→from→where chain.
	const rows = await db
		.select({ filePath: posts.filePath })
		.from(posts)
		.where(undefined);
	for (const row of rows) {
		// Stored rows are cwd-relative post-fix, but legacy DBs and test mocks
		// may still carry absolute paths — normalize before comparing.
		if (!fileSet.has(toRelativePath(row.filePath))) {
			await removePost(row.filePath);
		}
	}

	for (const filePath of files) {
		await upsertPost(filePath);
	}
}
