import { Link } from "@tanstack/react-router";

const navLinks = [{ label: "Home", to: "/" }];

const resourceLinks = [{ label: "Sobre", to: "/about" }];

export function Footer() {
	return (
		<footer className="bg-surface px-6 py-12 lg:px-20">
			<div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:justify-between">
				<div className="flex max-w-xs flex-col gap-3">
					<span className="font-heading text-base font-bold text-foreground">
						Antonio Fulgencio Blog
					</span>
					<p className="text-sm leading-relaxed text-foreground-secondary">
						Artigos sobre desenvolvimento web, React, TypeScript e carreira
						internacional.
					</p>
				</div>

				<div className="flex gap-16">
					<div className="flex flex-col gap-3">
						<span className="text-sm font-semibold text-foreground">
							Navegação
						</span>
						{navLinks.map((link) => (
							<Link
								key={link.to}
								to={link.to}
								className="text-sm text-foreground-secondary transition-colors hover:text-accent"
							>
								{link.label}
							</Link>
						))}
					</div>
					<div className="flex flex-col gap-3">
						<span className="text-sm font-semibold text-foreground">
							Recursos
						</span>
						{resourceLinks.map((link) => (
							<Link
								key={link.to}
								to={link.to}
								className="text-sm text-foreground-secondary transition-colors hover:text-accent"
							>
								{link.label}
							</Link>
						))}
					</div>
				</div>
			</div>

			<div className="mx-auto mt-10 max-w-7xl border-t border-border pt-6">
				<p className="text-center text-xs text-foreground-muted">
					© 2026 Antonio Fulgencio. Todos os direitos reservados.
				</p>
			</div>
		</footer>
	);
}
