import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function CategoryCard({
	name,
	count,
	icon: Icon,
}: {
	name: string;
	count: number;
	icon: LucideIcon;
}) {
	return (
		<Link
			to="/{-$locale}"
			params={{ locale: undefined }}
			className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
		>
			<div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-light">
				<Icon className="h-5 w-5 text-accent" />
			</div>
			<span className="font-heading text-sm font-semibold text-foreground">
				{name}
			</span>
			<span className="text-xs text-foreground-secondary">{count} artigos</span>
		</Link>
	);
}
