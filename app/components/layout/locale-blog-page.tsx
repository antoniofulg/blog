import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState } from "#/components/ui/empty-state";
import { TimelineIndex, type YearEntry } from "#/components/ui/timeline-index";
import type { Post } from "#/db/schema";
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";

// Shared between the optional-locale index route (`{-$locale}/index.tsx`) and
// the literal locale-index shim routes (`en.index.tsx`, `pt-br.index.tsx`).
// The shims exist because TanStack Router's optional path-param `{-$locale}`
// + index-at-`/` does not match `/<locale>/` with explicit locale + trailing
// slash (see reviews-012/issue_002.md for the empirical evidence). Posts +
// locale are passed as props instead of being read off `Route` so the same
// component can render under three different route declarations.

const copy = {
	en: {
		eyebrow: "Articles",
		heading: "Writing",
		subtitle:
			"Notes on web development, React, TypeScript, Bun, and modern tooling.",
		emptyTitle: "No articles found",
		emptyDesc: "No published articles yet.",
	},
	"pt-br": {
		eyebrow: "Artigos",
		heading: "Escrita",
		subtitle:
			"Notas sobre desenvolvimento web, React, TypeScript, Bun e ferramentas modernas.",
		emptyTitle: "Nenhum artigo encontrado",
		emptyDesc: "Não há artigos publicados ainda.",
	},
} satisfies Record<
	Locale,
	{
		eyebrow: string;
		heading: string;
		subtitle: string;
		emptyTitle: string;
		emptyDesc: string;
	}
>;

type MonthGroup = {
	year: number;
	month: number;
	id: string;
	posts: Post[];
};

type YearGroup = {
	year: number;
	months: MonthGroup[];
};

function groupByYearMonth(posts: Post[]): YearGroup[] {
	const map = new Map<number, Map<number, Post[]>>();
	for (const post of posts) {
		if (!post.publishedAt) continue;
		const d = new Date(post.publishedAt);
		const y = d.getFullYear();
		const m = d.getMonth();
		if (!map.has(y)) map.set(y, new Map());
		const ym = map.get(y) ?? new Map<number, Post[]>();
		map.set(y, ym);
		if (!ym.has(m)) ym.set(m, []);
		const monthPosts = ym.get(m) ?? [];
		ym.set(m, monthPosts);
		monthPosts.push(post);
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => b - a)
		.map(([year, months]) => ({
			year,
			months: Array.from(months.entries())
				.sort(([a], [b]) => b - a)
				.map(([month, groupPosts]) => ({
					year,
					month,
					id: `${year}-${String(month + 1).padStart(2, "0")}`,
					posts: groupPosts,
				})),
		}));
}

function toYearEntries(groups: YearGroup[]): YearEntry[] {
	return groups.map((yg) => ({
		year: yg.year,
		months: yg.months.map((mg) => ({
			year: mg.year,
			month: mg.month,
			id: mg.id,
			count: mg.posts.length,
		})),
	}));
}

function monthLabel(month: number, locale: Locale): string {
	return new Date(2000, month).toLocaleDateString(
		locale === "pt-br" ? "pt-BR" : "en-US",
		{ month: "long" },
	);
}

export function LocaleBlogPage({
	locale,
	posts,
}: {
	locale: Locale;
	posts: Post[];
}) {
	const t = copy[locale] ?? copy.en;
	const groups = useMemo(() => groupByYearMonth(posts), [posts]);
	const yearEntries = useMemo(() => toYearEntries(groups), [groups]);

	return (
		<div className="px-5 py-16 lg:px-20 lg:py-24">
			<div className="mx-auto max-w-5xl">
				<p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.18em] text-accent">
					{t.eyebrow}
				</p>
				<h1
					className="animate-fade-up mt-3 font-heading text-[clamp(2rem,5.5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-foreground"
					style={{ animationDelay: "80ms" }}
				>
					{t.heading}
				</h1>
				<p
					className="animate-fade-up mt-6 max-w-2xl text-xl leading-relaxed text-foreground-secondary"
					style={{ animationDelay: "160ms" }}
				>
					{t.subtitle}
				</p>

				{groups.length === 0 ? (
					<div
						className="animate-fade-up mt-16"
						style={{ animationDelay: "240ms" }}
					>
						<EmptyState title={t.emptyTitle} description={t.emptyDesc} />
					</div>
				) : (
					<>
						{/* Mobile year navigation — hidden on lg+, sidebar handles desktop */}
						{groups.length > 1 && (
							<nav
								aria-label="Jump to year"
								className="animate-fade-up mt-8 flex gap-2 overflow-x-auto lg:hidden"
								style={{ animationDelay: "220ms" }}
							>
								{groups.map(({ year }) => (
									<a
										key={year}
										href={`#year-${year}`}
										onClick={(e) => {
											e.preventDefault();
											document.getElementById(`year-${year}`)?.scrollIntoView({
												behavior: "smooth",
												block: "start",
											});
										}}
										className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-surface px-3 text-xs font-medium text-foreground-secondary transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
									>
										{year}
									</a>
								))}
							</nav>
						)}

						<div
							className="animate-fade-up mt-16 flex items-start gap-12 lg:gap-20"
							style={{ animationDelay: "260ms" }}
						>
							{/* Sticky timeline index — desktop only */}
							<aside className="sticky top-24 hidden w-36 shrink-0 lg:block">
								<TimelineIndex years={yearEntries} locale={locale} />
							</aside>

							{/* Chronological post list */}
							<div className="min-w-0 flex-1">
								{groups.map((yearGroup) => (
									<section
										key={yearGroup.year}
										id={`year-${yearGroup.year}`}
										aria-labelledby={`year-${yearGroup.year}-heading`}
										className="mb-16 scroll-mt-24 last:mb-0"
									>
										<h2
											id={`year-${yearGroup.year}-heading`}
											className="font-heading text-2xl font-bold text-foreground"
										>
											{yearGroup.year}
										</h2>

										{yearGroup.months.map((monthGroup) => {
											const headingId = `${monthGroup.id}-heading`;
											return (
												<section
													key={monthGroup.id}
													id={monthGroup.id}
													data-timeline-section=""
													aria-labelledby={headingId}
													className="mt-10 scroll-mt-24"
												>
													<div className="mb-4 flex items-center gap-4">
														<h3
															id={headingId}
															className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted"
														>
															{monthLabel(monthGroup.month, locale)}
														</h3>
														<div
															className="flex-1 border-t border-border"
															aria-hidden="true"
														/>
													</div>

													<ul className="flex flex-col">
														{monthGroup.posts.map((post) => (
															<li key={post.id}>
																<Link
																	to="/{-$locale}/$slug/"
																	params={{
																		locale:
																			locale === DEFAULT_LOCALE
																				? undefined
																				: locale,
																		slug: post.slug,
																	}}
																	className="group -mx-3 flex items-start gap-5 rounded-sm border-b border-border px-3 py-4 transition-colors last:border-0 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
																>
																	{post.publishedAt && (
																		<time
																			dateTime={new Date(
																				post.publishedAt,
																			).toISOString()}
																			className="w-7 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-foreground-muted"
																		>
																			{new Date(post.publishedAt).getDate()}
																		</time>
																	)}
																	<div className="flex min-w-0 flex-col gap-1">
																		<span className="font-heading text-base font-bold text-foreground transition-colors group-hover:text-accent">
																			{post.title}
																		</span>
																		{post.description && (
																			<span className="line-clamp-2 text-sm leading-relaxed text-foreground-secondary">
																				{post.description}
																			</span>
																		)}
																	</div>
																</Link>
															</li>
														))}
													</ul>
												</section>
											);
										})}
									</section>
								))}
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
