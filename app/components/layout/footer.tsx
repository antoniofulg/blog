import { Link, useRouterState } from "@tanstack/react-router";
import { Rss } from "lucide-react";
import { DEFAULT_LOCALE, type Locale, useCurrentLocale } from "#/lib/locale";

const AUTHOR = "Antonio Fulgencio";

const navLinksByLocale: Record<
	Locale,
	readonly { label: string; to: string }[]
> = {
	en: [
		{ label: "Home", to: "/" },
		{ label: "About", to: "/en/about" },
		{ label: "Privacy", to: "/en/privacy" },
	],
	"pt-br": [
		{ label: "Home", to: "/pt-br/" },
		{ label: "Sobre", to: "/pt-br/about" },
		{ label: "Privacidade", to: "/pt-br/privacy" },
	],
};

const tagline: Record<Locale, string> = {
	en: "Daily lessons from shipping software — patterns, gotchas, refactors, and the tools that change how I work.",
	"pt-br":
		"Lições do dia a dia entregando software — padrões, pegadinhas, refactors e as ferramentas que mudam como eu trabalho.",
};

const rightsReserved: Record<Locale, string> = {
	en: "All rights reserved.",
	"pt-br": "Todos os direitos reservados.",
};

const colophon: Record<Locale, string> = {
	en: "Built with Bun, TanStack Start, and PostgreSQL.",
	"pt-br": "Feito com Bun, TanStack Start e PostgreSQL.",
};

const navEyebrow: Record<Locale, string> = {
	en: "Sitemap",
	"pt-br": "Navegação",
};

function isActiveLink(to: string, pathname: string): boolean {
	if (to === "/") {
		return pathname === "/" || pathname === "/en/" || pathname === "/pt-br/";
	}
	return pathname.startsWith(to);
}

export function Footer() {
	const locale = useCurrentLocale();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const year = new Date().getFullYear();
	const navLinks = navLinksByLocale[locale];

	return (
		<footer className="border-t border-border bg-surface px-6 py-14 lg:px-20 lg:py-20">
			<div className="mx-auto flex max-w-5xl flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
				<div className="flex max-w-md flex-col gap-3">
					<Link
						to="/{-$locale}/"
						params={{
							locale: locale === DEFAULT_LOCALE ? undefined : locale,
						}}
						aria-label="Antonio Fulgencio — home"
						className="rounded-sm font-heading text-base font-bold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
					>
						<span aria-hidden="true">{AUTHOR}</span>
					</Link>
					<p className="text-sm leading-relaxed text-foreground-secondary">
						{tagline[locale]}
					</p>
				</div>

				<nav aria-label={navEyebrow[locale]} className="flex flex-col gap-3">
					<span className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
						{navEyebrow[locale]}
					</span>
					<ul className="flex flex-col gap-2">
						{navLinks.map((link) => {
							const active = isActiveLink(link.to, pathname);
							return (
								<li key={link.to}>
									<Link
										to={link.to}
										aria-current={active ? "page" : undefined}
										className={`rounded-sm text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface ${
											active
												? "font-medium text-accent"
												: "text-foreground-secondary hover:text-accent"
										}`}
									>
										{link.label}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
			</div>

			<div className="mx-auto mt-12 flex max-w-5xl flex-col gap-2 border-t border-border pt-6 text-xs text-foreground-muted sm:flex-row sm:items-center sm:justify-between">
				<p>
					© {year} {AUTHOR}. {rightsReserved[locale]}
				</p>
				<div className="flex items-center gap-4">
					<p>{colophon[locale]}</p>
					<a
						href="/rss.xml"
						className="inline-flex items-center gap-1.5 text-foreground-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
					>
						<Rss className="h-4 w-4" aria-hidden="true" />
						<span>RSS</span>
					</a>
				</div>
			</div>
		</footer>
	);
}
