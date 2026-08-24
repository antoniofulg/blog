export function Badge({ label, count }: { label: string; count: number }) {
	return (
		<output aria-label={`${label}: ${count}`}>
			{label} ({count})
		</output>
	);
}
