import { createFileRoute } from "@tanstack/react-router";
import { Mail, Send } from "lucide-react";

export const Route = createFileRoute("/newsletter")({
	head: () => ({
		meta: [
			{ title: "Newsletter — Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Receba artigos exclusivos sobre desenvolvimento web, React, TypeScript e carreira internacional.",
			},
		],
	}),
	component: NewsletterPage,
});

function NewsletterPage() {
	return (
		<div className="flex flex-col items-center px-5 py-12 lg:px-20 lg:py-20">
			<div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
					<Mail className="h-8 w-8 text-accent" />
				</div>

				<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
					Newsletter
				</h1>

				<p className="leading-relaxed text-foreground-secondary">
					Receba artigos exclusivos sobre desenvolvimento web, React,
					TypeScript, Bun e carreira internacional. Sem spam, apenas conteúdo
					relevante.
				</p>

				<form
					className="flex w-full flex-col gap-3"
					onSubmit={(e) => e.preventDefault()}
				>
					<input
						type="text"
						placeholder="Seu nome"
						className="h-12 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
					/>
					<input
						type="email"
						placeholder="seu@email.com"
						className="h-12 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
					/>
					<button
						type="submit"
						className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-foreground-inverse hover:bg-accent-hover"
					>
						<Send className="h-4 w-4" />
						Inscrever-se na Newsletter
					</button>
				</form>

				<p className="text-xs leading-relaxed text-foreground-muted">
					Ao se inscrever, você concorda com nossa Política de Privacidade.
					Cancele quando quiser.
				</p>
			</div>
		</div>
	);
}
