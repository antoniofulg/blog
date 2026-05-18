import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as authSchema from "#/db/auth-schema";

const DEFAULT_EMAIL = "e2e@test.local";
const DEFAULT_PASSWORD = "e2e-test-password";

// biome-ignore lint/suspicious/noExplicitAny: accepts any PgliteDatabase schema for DI
type AnyPgliteDb = PgliteDatabase<any>;

// Seeds the e2e admin user via Better Auth's signUpEmail API.
// Idempotent: returns the userId of the existing user if already present.
// On CI (process.env.CI === "true"), throws if E2E_ADMIN_EMAIL or
// E2E_ADMIN_PASSWORD are not set — prevents silent credential fallback.
export async function seedAdminUser(
	db: AnyPgliteDb,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	const isCI = env.CI === "true";
	const email = env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : DEFAULT_EMAIL);
	const password =
		env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : DEFAULT_PASSWORD);

	if (!email)
		throw new Error(
			"Missing credential: E2E_ADMIN_EMAIL is required on CI",
		);
	if (!password)
		throw new Error(
			"Missing credential: E2E_ADMIN_PASSWORD is required on CI",
		);

	// Idempotency check — return existing userId if already seeded
	const existing = await db
		.select({ id: authSchema.user.id })
		.from(authSchema.user)
		.where(eq(authSchema.user.email, email))
		.limit(1);

	if (existing.length > 0) {
		return existing[0].id;
	}

	// Use a dedicated auth instance backed by this PGLite db (not the production singleton)
	const auth = betterAuth({
		database: drizzleAdapter(db, { provider: "pg" }),
		emailAndPassword: { enabled: true },
	});

	const result = await auth.api.signUpEmail({
		body: { email, password, name: "E2E Admin" },
	});

	if (!result?.user?.id) {
		throw new Error(
			`seedAdminUser: signUpEmail did not return a user for ${email}`,
		);
	}

	return result.user.id;
}
