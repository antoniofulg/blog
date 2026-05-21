import { Send } from "lucide-react";
import type { Locale } from "#/lib/locale";

const copy: Record<
	Locale,
	{
		namePlaceholder: string;
		nameLabel: string;
		emailPlaceholder: string;
		emailLabel: string;
		submitLabel: string;
	}
> = {
	en: {
		nameLabel: "Name",
		namePlaceholder: "Your name",
		emailLabel: "Email",
		emailPlaceholder: "you@example.com",
		submitLabel: "Subscribe",
	},
	"pt-br": {
		nameLabel: "Nome",
		namePlaceholder: "Seu nome",
		emailLabel: "Email",
		emailPlaceholder: "seu@email.com",
		submitLabel: "Inscrever-se",
	},
};

export function NewsletterForm({
	compact = false,
	locale = "en",
}: {
	compact?: boolean;
	locale?: Locale;
}) {
	const t = copy[locale];

	return (
		<form
			className={`flex w-full flex-col gap-3 ${compact ? "" : "max-w-lg"}`}
			onSubmit={(e) => e.preventDefault()}
		>
			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="newsletter-name"
					className="text-sm font-medium text-foreground"
				>
					{t.nameLabel}
				</label>
				<input
					id="newsletter-name"
					type="text"
					name="name"
					placeholder={t.namePlaceholder}
					autoComplete="name"
					className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="newsletter-email"
					className="text-sm font-medium text-foreground"
				>
					{t.emailLabel}
				</label>
				<input
					id="newsletter-email"
					type="email"
					name="email"
					required
					placeholder={t.emailPlaceholder}
					autoComplete="email"
					className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				/>
			</div>
			<button
				type="submit"
				className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<Send className="h-4 w-4" aria-hidden="true" />
				{t.submitLabel}
			</button>
		</form>
	);
}
