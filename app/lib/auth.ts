import "@tanstack/react-start/server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { reactStartCookies } from "better-auth/react-start";
import { db } from "../db/client";

/**
 * Public origin for CSRF + Secure cookies. Coolify terminates TLS at the
 * proxy, so the app request is HTTP and Better Auth would otherwise trust
 * `http://<container>:3000` and reject `Origin: https://antoniofulg.tech`.
 * Prefer BETTER_AUTH_URL; fall back to SITE_URL (already required in prod).
 */
export function resolveAuthBaseURL(
	env: Record<string, string | undefined> = process.env,
): string | undefined {
	const raw = env.BETTER_AUTH_URL ?? env.SITE_URL;
	if (!raw) return undefined;
	return raw.replace(/\/+$/, "");
}

const baseURL = resolveAuthBaseURL();

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg" }),
	emailAndPassword: { enabled: true },
	...(baseURL ? { baseURL } : {}),
	plugins: [reactStartCookies()], // MUST be last plugin (ADR-001)
});
