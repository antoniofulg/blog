export function TagBadge({
	label,
	className = "",
}: {
	label: string;
	className?: string;
}) {
	return (
		<span
			className={`inline-flex items-center rounded-full bg-accent-light px-3 py-1.5 text-xs font-medium text-accent ${className}`}
		>
			{label}
		</span>
	);
}
