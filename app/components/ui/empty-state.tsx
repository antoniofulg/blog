import type { LucideIcon } from "lucide-react";
import { SearchX } from "lucide-react";

export function EmptyState({
	icon: Icon = SearchX,
	title = "Nenhum resultado encontrado",
	description = "Tente ajustar seus filtros ou buscar por outro termo.",
}: {
	icon?: LucideIcon;
	title?: string;
	description?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-4 py-16 text-center">
			<Icon className="h-12 w-12 text-foreground-muted" />
			<h2 className="font-heading text-lg font-semibold text-foreground">
				{title}
			</h2>
			<p className="max-w-sm text-sm text-foreground-secondary">
				{description}
			</p>
		</div>
	);
}
