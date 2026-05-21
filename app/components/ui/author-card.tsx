import { User } from "lucide-react";

export function AuthorCard({
	name = "Antonio Fulgencio",
	role = "Full-Stack Developer",
	bio = "Building modern web applications with React, TypeScript, TanStack, Bun, and PostgreSQL.",
	avatarUrl,
}: {
	name?: string;
	role?: string;
	bio?: string;
	avatarUrl?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
			<div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
				{avatarUrl ? (
					<img
						src={avatarUrl}
						alt={`Portrait of ${name}`}
						width={64}
						height={64}
						className="h-full w-full object-cover"
					/>
				) : (
					<User className="h-8 w-8 text-foreground-muted" aria-hidden="true" />
				)}
			</div>
			<div className="flex flex-col gap-1">
				<span className="font-heading text-sm font-bold text-foreground">
					{name}
				</span>
				<span className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
					{role}
				</span>
			</div>
			<p className="max-w-xs text-sm leading-relaxed text-foreground-secondary">
				{bio}
			</p>
		</div>
	);
}
