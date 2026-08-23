// The code under test in the pilot. Deliberately small and shared by both
// runtimes so the comparison measures the runner, not different work.
export type Post = { slug: string; title: string; lang: "en" | "pt-br" };

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function groupByLang(posts: Post[]): Record<string, Post[]> {
	const out: Record<string, Post[]> = {};
	for (const p of posts) {
		if (!out[p.lang]) out[p.lang] = [];
		out[p.lang].push(p);
	}
	return out;
}

export async function loadTitle(slug: string): Promise<string> {
	const { readTitle } = await import("./reader");
	return readTitle(slug);
}
