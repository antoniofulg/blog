import type { Locale } from "#/lib/locale";

const partsLabelByLocale: Record<Locale, (n: number) => string> = {
	en: (n) => `${n} ${n === 1 ? "part" : "parts"}`,
	"pt-br": (n) => `${n} ${n === 1 ? "parte" : "partes"}`,
};

export function SeriesCard({
	title,
	description,
	tag,
	parts,
	progress,
	status,
	locale = "en",
}: {
	title: string;
	description: string;
	tag: string;
	parts: number;
	progress: number;
	status: string;
	locale?: Locale;
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
			<span className="text-xs text-foreground-muted">
				{partsLabelByLocale[locale](parts)}
			</span>
			<div
				className="h-1 overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-valuenow={progress}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`${progress}%`}
			>
				<div
					className="h-full rounded-full bg-accent"
					style={{ width: `${progress}%` }}
				/>
			</div>
		</div>
	);
}
