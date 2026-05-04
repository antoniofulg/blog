import { Check } from "lucide-react";

export function TutorialStep({
	number,
	title,
	description,
	isCompleted = false,
	isActive = false,
}: {
	number: number;
	title: string;
	description?: string;
	isCompleted?: boolean;
	isActive?: boolean;
}) {
	return (
		<div className="flex gap-4">
			<div className="flex flex-col items-center">
				<div
					className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
						isCompleted
							? "bg-success text-foreground-inverse"
							: isActive
								? "bg-accent text-foreground-inverse"
								: "bg-muted text-foreground-muted"
					}`}
				>
					{isCompleted ? <Check className="h-4 w-4" /> : number}
				</div>
				<div className="mt-2 h-full w-px bg-border" />
			</div>
			<div className="flex flex-col gap-1 pb-6">
				<span
					className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-foreground-secondary"}`}
				>
					{title}
				</span>
				{description && (
					<p className="text-xs leading-relaxed text-foreground-muted">
						{description}
					</p>
				)}
			</div>
		</div>
	);
}
