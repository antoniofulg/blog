import { Link } from "@tanstack/react-router";
import { Menu, Moon, Search, Sun, Terminal } from "lucide-react";
import { useState } from "react";
import { useTheme } from "#/lib/theme";

const navLinks = [
	{ label: "Home", to: "/" },
	{ label: "Blog", to: "/blog" },
	{ label: "Tutoriais", to: "/tutorials" },
	{ label: "Projetos", to: "/projects" },
	{ label: "Sobre", to: "/about" },
	{ label: "Newsletter", to: "/newsletter" },
] as const;

export function Header() {
	const { theme, toggle } = useTheme();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<>
			<header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-6 lg:px-20">
				<Link to="/" className="flex items-center gap-2">
					<Terminal className="h-6 w-6 text-accent" />
					<span className="font-heading text-lg font-bold text-foreground">
						Antonio Fulgencio
					</span>
				</Link>

				<nav className="hidden items-center gap-8 lg:flex">
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="text-sm font-medium text-foreground-secondary transition-colors hover:text-accent"
						>
							{link.label}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-3">
					<Link
						to="/search"
						className="text-foreground-secondary transition-colors hover:text-foreground"
					>
						<Search className="h-5 w-5" />
					</Link>
					<button
						type="button"
						onClick={toggle}
						className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted"
					>
						{theme === "dark" ? (
							<Sun className="h-5 w-5" />
						) : (
							<Moon className="h-5 w-5" />
						)}
					</button>
					<button
						type="button"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-secondary lg:hidden"
					>
						<Menu className="h-5 w-5" />
					</button>
				</div>
			</header>

			{mobileMenuOpen && (
				<MobileMenu onClose={() => setMobileMenuOpen(false)} />
			)}
		</>
	);
}

function MobileMenu({ onClose }: { onClose: () => void }) {
	const { theme, toggle } = useTheme();

	return (
		<div className="fixed inset-0 z-50 bg-background lg:hidden">
			<div className="flex h-14 items-center justify-between border-b border-border px-5">
				<span className="font-heading text-base font-bold text-foreground">
					AF Blog
				</span>
				<button type="button" onClick={onClose} className="text-foreground">
					<span className="sr-only">Fechar menu</span>✕
				</button>
			</div>
			<nav className="flex flex-col px-5 py-2">
				{navLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						onClick={onClose}
						className="flex h-13 items-center border-b border-border text-base font-medium text-foreground-secondary"
					>
						{link.label}
					</Link>
				))}
			</nav>
			<div className="flex items-center gap-3 px-5 py-4">
				<button
					type="button"
					onClick={toggle}
					className="flex h-10 w-10 items-center justify-center rounded-md bg-surface"
				>
					{theme === "dark" ? (
						<Sun className="h-5 w-5 text-foreground" />
					) : (
						<Moon className="h-5 w-5 text-foreground" />
					)}
				</button>
				<span className="text-sm text-foreground-secondary">Alternar tema</span>
			</div>
		</div>
	);
}
