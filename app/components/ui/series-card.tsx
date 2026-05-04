export function SeriesCard({
	title,
	description,
	tag,
	parts,
	progress,
	status,
}: {
	title: string;
	description: string;
	tag: string;
	parts: number;
	progress: number;
	status: string;
}) {
	return (
		<div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
			<div className="flex items-center justify-between">
				<span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
					{tag}
				</span>
				<span className="text-xs font-medium text-foreground-muted">
					{status}
				</span>
			</div>
			<h3 className="font-heading text-lg font-bold leading-snug text-foreground">
				{title}
			</h3>
			<p className="text-sm leading-relaxed text-foreground-secondary">
				{description}
			</p>
			<span className="text-xs text-foreground-muted">{parts} partes</span>
			<div className="h-1 overflow-hidden rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-accent"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}
