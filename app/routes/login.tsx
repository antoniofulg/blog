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

function friendlyError(message: string): string {
	const msg = message.toLowerCase();
	if (
		msg.includes("invalid") ||
		msg.includes("password") ||
		msg.includes("credentials") ||
		msg.includes("sign_in") ||
		msg.includes("sign in") ||
		msg.includes("not found") ||
		msg.includes("incorrect")
	) {
		return "Incorrect email or password.";
	}
	if (
		msg.includes("rate") ||
		msg.includes("too many") ||
		msg.includes("limit")
	) {
		return "Too many attempts. Try again later.";
	}
	return "Login failed. Try again.";
}

const signInEmail = createClientOnlyFn(
	async (email: string, password: string) => {
		const { authClient } = await import("#/lib/auth.client");
		return authClient.signIn.email({ email, password });
	},
);

function Spinner() {
	return (
		<svg
			className="h-4 w-4 animate-spin"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle
				className="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				strokeWidth="4"
			/>
			<path
				className="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	);
}

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
			setError(friendlyError(result.error.message ?? ""));
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
							autoComplete="email"
							className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
							autoComplete="current-password"
							className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
						className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						{pending ? (
							<>
								<Spinner />
								<span>Entrando</span>
							</>
						) : (
							"Entrar"
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
