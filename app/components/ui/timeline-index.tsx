import { useEffect, useState } from "react";
import type { Locale } from "#/lib/locale";

export type MonthEntry = {
	year: number;
	month: number;
	id: string;
	count: number;
};

export type YearEntry = {
	year: number;
	months: MonthEntry[];
};

function monthName(month: number, locale: Locale): string {
	return new Date(2000, month).toLocaleDateString(
		locale === "pt-br" ? "pt-BR" : "en-US",
		{ month: "long" },
	);
}

export function TimelineIndex({
	years,
	locale,
}: {
	years: YearEntry[];
	locale: Locale;
}) {
	const [activeId, setActiveId] = useState<string | null>(
		years[0]?.months[0]?.id ?? null,
	);

	useEffect(() => {
		const sections = document.querySelectorAll("[data-timeline-section]");
		if (!sections.length) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible.length > 0) {
					setActiveId(visible[0].target.id);
				}
			},
			{ rootMargin: "-10% 0px -60% 0px" },
		);

		for (const el of sections) {
			observer.observe(el);
		}
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // sections render before this effect; observer only needs to mount once

	return (
		<nav aria-label="Timeline" className="flex flex-col gap-6">
			{years.map((yearGroup) => (
				<div key={yearGroup.year} className="flex flex-col gap-1">
					<span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
						{yearGroup.year}
					</span>
					<ul className="mt-1 flex flex-col gap-0.5">
						{yearGroup.months.map(({ month, id, count }) => {
							const isActive = activeId === id;
							return (
								<li key={id}>
									<a
										href={`#${id}`}
										aria-current={isActive ? "location" : undefined}
										onClick={(e) => {
											e.preventDefault();
											document.getElementById(id)?.scrollIntoView({
												behavior: "smooth",
												block: "start",
											});
											setActiveId(id);
										}}
										className={`flex items-center justify-between rounded-sm px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
											isActive
												? "font-medium text-accent"
												: "text-foreground-secondary hover:text-foreground"
										}`}
									>
										<span>{monthName(month, locale)}</span>
										<span
											className={`tabular-nums text-xs ${isActive ? "text-accent" : "text-foreground-muted"}`}
										>
											{count}
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}
