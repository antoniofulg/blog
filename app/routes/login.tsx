import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import { useState } from "react";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function isSafeRedirect(url: string | undefined): url is string {
	if (!url) return false;
	try {
		const parsed = new URL(url, window.location.origin);
		return parsed.origin === window.location.origin;
	} catch {
		return url.startsWith("/");
	}
}

const signInEmail = createClientOnlyFn(
	async (email: string, password: string) => {
		const { authClient } = await import("#/lib/auth.client");
		return authClient.signIn.email({ email, password });
	},
);

function LoginPage() {
	const { redirect: redirectTo } = Route.useSearch();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setPending(true);
		const formData = new FormData(e.currentTarget);
		const result = await signInEmail(
			formData.get("email") as string,
			formData.get("password") as string,
		);
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? "Login failed");
		} else {
			await navigate({ to: isSafeRedirect(redirectTo) ? redirectTo : "/" });
		}
	};

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-5 py-12">
			<div className="w-full max-w-sm rounded-lg border border-border bg-card p-8">
				<h1 className="mb-6 font-heading text-2xl font-bold text-foreground">
					Login
				</h1>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="email"
							className="text-sm font-medium text-foreground"
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							name="email"
							required
							className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="password"
							className="text-sm font-medium text-foreground"
						>
							Senha
						</label>
						<input
							id="password"
							type="password"
							name="password"
							required
							className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
						/>
					</div>
					{error && (
						<p
							role="alert"
							className="rounded-md bg-callout-error px-3 py-2 text-sm text-error"
						>
							{error}
						</p>
					)}
					<button
						type="submit"
						disabled={pending}
						className="mt-2 h-11 rounded-md bg-accent text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover disabled:opacity-60"
					>
						{pending ? "Entrando…" : "Entrar"}
					</button>
				</form>
			</div>
		</div>
	);
}
