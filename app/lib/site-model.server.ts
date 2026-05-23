import "@tanstack/react-start/server-only";
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { desc } from "drizzle-orm";
import matter from "gray-matter";
import { db } from "#/db/client";
import { posts } from "#/db/schema";
import { LOCALES, type Locale } from "#/lib/locale";
import type { PostFrontmatter } from "#/types/content";

export type RouteAuthLevel = "public" | "admin";

export type RouteEntry = {
	path: string;
	locale: Locale | null;
	auth: RouteAuthLevel;
	expectedStatus: 200 | 302 | 401 | 404;
	intent: string;
	sampleSlug?: string;
};

export type PostEntry = {
	slug: string;
	lang: Locale;
	filePath: string;
	frontmatter: PostFrontmatter;
	hasTwin: boolean;
};

type RouteMetadataEntry = {
	path: string;
	locale: Locale | null;
	auth: RouteAuthLevel;
	expectedStatus: 200 | 302 | 401 | 404 | null;
	intent: string;
	sampleSlug?: string;
};

// Static metadata map: route file key (relative to app/routes/) → metadata.
// Excludes __root.tsx and routeTree.gen.ts.
// Use expectedStatus: null to opt a route out of inventory (e.g. layout routes).
// DRIFT TEST: adding a new app/routes/**/*.tsx without an entry here fails CI.
export const ROUTE_METADATA: Record<string, RouteMetadataEntry> = {
	"{-$locale}.tsx": {
		path: "/",
		locale: null,
		auth: "public",
		expectedStatus: null,
		intent: "locale layout",
	},
	"{-$locale}/index.tsx": {
		path: "/",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "blog home",
	},
	"{-$locale}/$slug.tsx": {
		path: "/:slug",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "post detail",
	},
	"admin.tsx": {
		path: "/admin",
		locale: null,
		auth: "admin",
		expectedStatus: null,
		intent: "admin layout shell with sidebar",
	},
	"admin/index.tsx": {
		path: "/admin",
		locale: null,
		auth: "admin",
		expectedStatus: 200,
		intent: "admin dashboard",
	},
	"login.tsx": {
		path: "/login",
		locale: null,
		auth: "public",
		expectedStatus: 200,
		intent: "login",
	},
	"pt-br.index.tsx": {
		path: "/pt-br/",
		locale: "pt-br",
		auth: "public",
		expectedStatus: 200,
		intent: "pt-br locale root shim",
	},
	"en.index.tsx": {
		path: "/en/",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "en locale root shim",
	},
};

async function getLatestPostSlug(): Promise<string | null> {
	const [row] = await db
		.select({ slug: posts.slug })
		.from(posts)
		.orderBy(desc(posts.publishedAt))
		.limit(1);
	return row?.slug ?? null;
}

export async function getRouteInventory(): Promise<RouteEntry[]> {
	const liveSlug = await getLatestPostSlug();
	return Object.entries(ROUTE_METADATA)
		.filter(([, meta]) => meta.expectedStatus !== null)
		.flatMap(([, meta]): RouteEntry[] => {
			const isSlugRoute = meta.path.includes(":slug");
			if (isSlugRoute) {
				if (!liveSlug) return [];
				return [
					{
						path: meta.path,
						locale: meta.locale,
						auth: meta.auth,
						expectedStatus: meta.expectedStatus as 200 | 302 | 401 | 404,
						intent: meta.intent,
						sampleSlug: liveSlug,
					},
				];
			}
			return [
				{
					path: meta.path,
					locale: meta.locale,
					auth: meta.auth,
					expectedStatus: meta.expectedStatus as 200 | 302 | 401 | 404,
					intent: meta.intent,
					...(meta.sampleSlug !== undefined
						? { sampleSlug: meta.sampleSlug }
						: {}),
				},
			];
		});
}

export function resolveRoutePath(entry: RouteEntry): string {
	if (!entry.sampleSlug) return entry.path;
	return entry.path.replace(/:slug/g, entry.sampleSlug);
}

async function findMdxFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	async function walk(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true }).catch(
			() => null,
		);
		if (!entries) return;
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.name.endsWith(".mdx")) {
				results.push(full);
			}
		}
	}
	try {
		await walk(dir);
	} catch {
		// content dir doesn't exist yet
	}
	return results;
}

function parseMdxFrontmatter(
	source: string,
	filePath: string,
): PostFrontmatter {
	const { data } = matter(source);
	if (!data.title)
		throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
	let publishedAt: string | undefined;
	if (data.publishedAt != null) {
		publishedAt =
			data.publishedAt instanceof Date
				? data.publishedAt.toISOString().slice(0, 10)
				: String(data.publishedAt);
	}
	return {
		title: data.title as string,
		description: data.description as string | undefined,
		publishedAt,
		slug: data.slug as string | undefined,
		category: data.category as string | undefined,
		series: data.series as string | undefined,
		seriesPart:
			data.seriesPart != null
				? parseInt(String(data.seriesPart), 10) || undefined
				: undefined,
		draft: data.draft as boolean | undefined,
		noTranslation: data.noTranslation as boolean | undefined,
	};
}

function deriveSlug(filePath: string, frontmatterSlug?: string): string {
	return frontmatterSlug ?? basename(filePath, extname(filePath));
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

export async function getPostInventory(): Promise<PostEntry[]> {
	const contentDir = join(process.cwd(), "app", "content", "posts");
	const filePaths = await findMdxFiles(contentDir);

	if (filePaths.length === 0) return [];

	// Build slug set per locale for hasTwin computation
	const slugsByLocale: Record<string, Set<string>> = {};
	for (const locale of LOCALES) {
		slugsByLocale[locale] = new Set();
	}

	type ParsedFile = {
		filePath: string;
		slug: string;
		lang: Locale;
		frontmatter: PostFrontmatter;
	};

	const parsed: ParsedFile[] = [];
	for (const filePath of filePaths) {
		try {
			const source = await readFile(filePath, "utf-8");
			const frontmatter = parseMdxFrontmatter(source, filePath);
			const lang = deriveLang(filePath);
			const slug = deriveSlug(filePath, frontmatter.slug);
			slugsByLocale[lang].add(slug);
			parsed.push({ filePath, slug, lang, frontmatter });
		} catch (err) {
			process.stderr.write(
				`[site-model] skipping malformed file: ${filePath}: ${err instanceof Error ? err.message : String(err)}\n`,
			);
		}
	}

	return parsed.map(({ filePath, slug, lang, frontmatter }) => {
		const otherLocales = LOCALES.filter((l) => l !== lang);
		const hasTwin = otherLocales.some((l) => slugsByLocale[l]?.has(slug));
		return {
			slug,
			lang,
			filePath,
			frontmatter,
			hasTwin,
		};
	});
}
