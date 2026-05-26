export type PostFrontmatter = {
	title: string;
	description?: string;
	publishedAt?: string; // ISO 8601
	slug?: string;
	category?: string;
	series?: string;
	seriesPart?: number;
	draft?: boolean;
	noTranslation?: boolean;
	/**
	 * Public path to a custom OG image for this post.
	 * Overrides the auto-generated code-block card from the sync pipeline.
	 * Relative paths are made absolute using the site origin.
	 * Example: "/og/custom-cover.png"
	 */
	coverImage?: string;
};
