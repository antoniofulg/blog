export type PostFrontmatter = {
	title: string;
	description?: string;
	publishedAt?: string; // ISO 8601
	slug?: string;
	category?: string;
	series?: string;
	seriesPart?: number;
	draft?: boolean;
};
