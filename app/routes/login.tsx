import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "#/lib/auth.client";

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
		const result = await authClient.signIn.email({
			email: formData.get("email") as string,
			password: formData.get("password") as string,
		});
		setPending(false);
		if (result.error) {
			setError(result.error.message ?? "Login failed");
		} else {
			await navigate({ to: isSafeRedirect(redirectTo) ? redirectTo : "/" });
		}
	};

	return (
		<main>
			<h1>Login</h1>
			<form onSubmit={handleSubmit}>
				<div>
					<label htmlFor="email">Email</label>
					<input id="email" type="email" name="email" required />
				</div>
				<div>
					<label htmlFor="password">Password</label>
					<input id="password" type="password" name="password" required />
				</div>
				{error && <p role="alert">{error}</p>}
				<button type="submit" disabled={pending}>
					{pending ? "Signing in…" : "Sign in"}
				</button>
			</form>
		</main>
	);
}
