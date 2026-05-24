import { SocialLink } from "#/components/ui/social-link";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// Stable display order for social links in the profile row.
type SocialKind = "github" | "linkedin" | "x" | "instagram" | "rss" | "email";
const SOCIAL_ORDER: readonly SocialKind[] = [
	"github",
	"linkedin",
	"x",
	"instagram",
	"rss",
	"email",
];

// Subset of PageFrontmatter fields consumed by this component. Defined locally
// to avoid importing from .server.ts (components must not depend on server
// modules). The shape is structurally compatible with PageFrontmatter.
type ProfileFrontmatter = {
	title: string;
	description?: string;
	avatar?: string;
	links?: Record<SocialKind, string | undefined>;
};

type Props = {
	frontmatter: ProfileFrontmatter;
	locale: Locale;
	html: string;
};

// Tailwind prose class string shared between both render branches (avatar /
// no-avatar). Extracted as a constant to avoid duplication.
const PROSE_CLASSES =
	"animate-fade-up prose prose-lg prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h2:text-foreground prose-h3:mt-10 prose-h3:text-xl prose-h3:text-foreground prose-p:text-foreground-secondary prose-p:leading-relaxed prose-a:text-accent prose-a:underline-offset-4 hover:prose-a:text-accent-hover prose-strong:text-foreground prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:font-code prose-code:text-foreground-code prose-code:before:content-none prose-code:after:content-none prose-pre:bg-code-bg prose-pre:text-foreground-code prose-li:text-foreground-secondary prose-li:leading-relaxed prose-blockquote:border-border prose-blockquote:text-foreground-secondary prose-hr:border-border";

/**
 * Renders the full content area for a static page, with optional profile-row
 * layout when `frontmatter.avatar` is set.
 *
 * Layout with avatar (≥ 768px):
 *   [rounded avatar img] | [title + description + social row + hr + MDX body]
 *
 * Layout without avatar (or < 768px single-column):
 *   header (title + description + social row) → hr → MDX body
 *
 * Only links entries with truthy values render a <SocialLink>; the row is
 * omitted entirely when all entries are empty/undefined.
 */
export function StaticPageProfile({ frontmatter, locale, html }: Props) {
	const t = strings[locale];

	// Only render links that have a non-empty URL value.
	const populatedLinks = SOCIAL_ORDER.filter(
		(kind) => !!frontmatter.links?.[kind],
	);
	const hasAvatar = !!frontmatter.avatar;
	const hasLinks = populatedLinks.length > 0;

	const socialRow = hasLinks ? (
		<div className="flex flex-wrap gap-2">
			{populatedLinks.map((kind) => {
				const url = frontmatter.links?.[kind];
				if (!url) return null;
				return (
					<SocialLink
						key={kind}
						kind={kind}
						url={url}
						label={t.socials[kind]}
					/>
				);
			})}
		</div>
	) : null;

	// HR + MDX prose shared by both render branches.
	const bodyBlock = (
		<>
			<hr
				className="animate-fade-up my-8 border-border lg:my-12"
				style={{ animationDelay: "300ms" }}
			/>
			<div
				className={PROSE_CLASSES}
				style={{ animationDelay: "300ms" }}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</>
	);

	if (hasAvatar) {
		// Responsive 2-column layout: avatar left, content right on md+; stacked on mobile.
		return (
			<div className="animate-fade-up flex flex-col gap-8 md:flex-row md:items-start">
				<img
					src={frontmatter.avatar}
					alt={frontmatter.title}
					loading="eager"
					className="h-32 w-32 flex-shrink-0 self-start rounded-full object-cover md:h-40 md:w-40"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-4">
					<h1
						id="page-title"
						className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl"
					>
						{frontmatter.title}
					</h1>
					{frontmatter.description && (
						<p className="text-lg leading-relaxed text-foreground-secondary">
							{frontmatter.description}
						</p>
					)}
					{socialRow}
					{bodyBlock}
				</div>
			</div>
		);
	}

	// No-avatar path: preserves the original StaticPageView header structure
	// exactly (header → hr → prose). The social row is appended inside the
	// header when links are present; if absent the header is identical to the
	// pre-task rendering (AC-5 regression safety).
	return (
		<>
			<header className="animate-fade-up mb-8 flex flex-col gap-4 lg:mb-12">
				<h1
					id="page-title"
					className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl"
				>
					{frontmatter.title}
				</h1>
				{frontmatter.description && (
					<p className="text-lg leading-relaxed text-foreground-secondary">
						{frontmatter.description}
					</p>
				)}
				{socialRow}
			</header>
			{bodyBlock}
		</>
	);
}
