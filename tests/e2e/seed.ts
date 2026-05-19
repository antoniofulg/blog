import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import * as authSchema from "#/db/auth-schema";
import * as schema from "#/db/schema";

const DEFAULT_EMAIL = "e2e@test.local";
const DEFAULT_PASSWORD = "e2e-test-password";

// biome-ignore lint/suspicious/noExplicitAny: accepts postgres-js or pglite drizzle DB
type AnyDb = any;

// Seeds the e2e admin user via Better Auth's signUpEmail API.
// Idempotent: returns the userId of the existing user if already present.
// On CI (process.env.CI === "true"), throws if E2E_ADMIN_EMAIL or
// E2E_ADMIN_PASSWORD are not set — prevents silent credential fallback.
export async function seedAdminUser(
	db: AnyDb,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	const isCI = env.CI === "true";
	const email = env.E2E_ADMIN_EMAIL ?? (isCI ? undefined : DEFAULT_EMAIL);
	const password =
		env.E2E_ADMIN_PASSWORD ?? (isCI ? undefined : DEFAULT_PASSWORD);

	if (!email)
		throw new Error("Missing credential: E2E_ADMIN_EMAIL is required on CI");
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

	// Use a dedicated auth instance backed by this DB (not the production singleton)
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

export const FIXTURE_POST_SLUG = "e2e-fixture-post";
export const FIXTURE_POST_TITLE = "E2E Fixture Post";

export async function seedFixturePost(
	db: AnyDb,
	filePath: string,
): Promise<{ id: number; slug: string; title: string }> {
	const { posts } = schema;

	const existing = await db
		.select({ id: posts.id })
		.from(posts)
		.where(eq(posts.slug, FIXTURE_POST_SLUG))
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(posts)
			.set({ isPublished: false })
			.where(eq(posts.id, existing[0].id));
		return {
			id: existing[0].id,
			slug: FIXTURE_POST_SLUG,
			title: FIXTURE_POST_TITLE,
		};
	}

	const [inserted] = await db
		.insert(posts)
		.values({
			filePath,
			slug: FIXTURE_POST_SLUG,
			lang: "en",
			title: FIXTURE_POST_TITLE,
			description: "Fixture post for E2E tests",
			isPublished: false,
		})
		.returning({ id: posts.id });

	return { id: inserted.id, slug: FIXTURE_POST_SLUG, title: FIXTURE_POST_TITLE };
}
