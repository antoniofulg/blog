export type TocItem = {
	id: string;
	title: string;
	level: number;
};

export function TableOfContents({
	items,
	activeId,
}: {
	items: TocItem[];
	activeId?: string;
}) {
	return (
		<nav className="flex flex-col gap-1" aria-label="Índice">
			<span className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground-muted">
				Neste artigo
			</span>
			{items.map((item) => (
				<a
					key={item.id}
					href={`#${item.id}`}
					className={`border-l-2 py-1 text-sm transition-colors ${
						item.level > 2 ? "pl-6" : "pl-3"
					} ${
						activeId === item.id
							? "border-accent font-medium text-accent"
							: "border-transparent text-foreground-secondary hover:border-border hover:text-foreground"
					}`}
				>
					{item.title}
				</a>
			))}
		</nav>
	);
}
