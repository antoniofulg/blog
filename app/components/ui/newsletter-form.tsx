import { Send } from "lucide-react";

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
	return (
		<form
			className={`flex w-full flex-col gap-3 ${compact ? "" : "max-w-lg"}`}
			onSubmit={(e) => e.preventDefault()}
		>
			<input
				type="text"
				placeholder="Seu nome"
				className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
			/>
			<input
				type="email"
				placeholder="seu@email.com"
				className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
			/>
			<button
				type="submit"
				className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover"
			>
				<Send className="h-4 w-4" />
				Inscrever-se
			</button>
		</form>
	);
}
