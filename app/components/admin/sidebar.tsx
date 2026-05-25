import { Link, useLocation } from "@tanstack/react-router";
import { strings } from "#/lib/i18n/strings";
import { useLocale } from "#/lib/locale";

type NavItem = {
	key: "posts" | "analytics";
	href: string;
	isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
	{
		key: "posts",
		href: "/admin",
		isActive: (p) => p === "/admin" || p === "/admin/",
	},
	{
		key: "analytics",
		href: "/admin/analytics",
		isActive: (p) => p.startsWith("/admin/analytics"),
	},
];

/**
 * AdminSidebar — nav-only surface.
 *
 * The language switcher used to live pinned to the sidebar bottom; it now
 * lives in the public Header so admin gets the same locale-toggle affordance
 * as reader pages (consistent IA). See header.tsx useLangSwitcher — the admin
 * branch short-circuits navigation and only calls setLocale().
 */
export function AdminSidebar() {
	const { locale } = useLocale();
	const { pathname } = useLocation();
	const t = strings[locale].admin.sidebar;

	return (
		<nav
			aria-label={t.navLabel}
			className="p-3 md:flex md:h-full md:flex-col md:p-4"
		>
			{/* Mobile: horizontal row; Desktop: vertical column. */}
			<ul className="flex flex-row flex-wrap gap-1 md:flex-col">
				{NAV_ITEMS.map(({ key, href, isActive }) => {
					const active = isActive(pathname);
					return (
						<li key={key}>
							<Link
								to={href}
								aria-current={active ? "page" : undefined}
								className={[
									"flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
									"focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									active
										? "bg-accent text-foreground-inverse"
										: "text-foreground-secondary hover:bg-muted hover:text-foreground",
								].join(" ")}
							>
								{t[key]}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
