import { Search } from "lucide-react";

export function SearchInput({
	value,
	onChange,
	placeholder = "Buscar artigos...",
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}) {
	return (
		<div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3">
			<Search className="h-4.5 w-4.5 shrink-0 text-foreground-muted" />
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
			/>
		</div>
	);
}
