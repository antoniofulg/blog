import { Github, Linkedin, Twitter, User } from "lucide-react";

export function AuthorCard({
	name = "Antonio Fulgencio",
	role = "Full-Stack Developer",
	bio = "Desenvolvedor Full-Stack apaixonado por web moderna, performance e experiência do desenvolvedor.",
}: {
	name?: string;
	role?: string;
	bio?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-light">
				<User className="h-8 w-8 text-accent" />
			</div>
			<div className="flex flex-col gap-1">
				<span className="font-heading text-sm font-bold text-foreground">
					{name}
				</span>
				<span className="text-xs text-accent">{role}</span>
			</div>
			<p className="text-xs leading-relaxed text-foreground-secondary">{bio}</p>
			<div className="flex gap-3">
				<a
					href="https://github.com"
					className="text-foreground-muted hover:text-foreground"
				>
					<Github className="h-4 w-4" />
				</a>
				<a
					href="https://linkedin.com"
					className="text-foreground-muted hover:text-foreground"
				>
					<Linkedin className="h-4 w-4" />
				</a>
				<a
					href="https://twitter.com"
					className="text-foreground-muted hover:text-foreground"
				>
					<Twitter className="h-4 w-4" />
				</a>
			</div>
		</div>
	);
}
