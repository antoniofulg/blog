import { eq } from "drizzle-orm";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { account, user } from "../app/db/auth-schema";

export type SeedResult =
	| { status: "created"; message: string }
	| { status: "skipped"; message: string }
	| { status: "error"; message: string };

// biome-ignore lint/suspicious/noExplicitAny: accepts any drizzle instance for DI in tests
export async function seedAdmin(
	db: any,
	env: Record<string, string | undefined> = process.env,
): Promise<SeedResult> {
	const adminEmail = env.ADMIN_EMAIL;
	const adminPassword = env.ADMIN_PASSWORD;

	if (!adminEmail) {
		return {
			status: "error",
			message: "ADMIN_EMAIL environment variable is required",
		};
	}
	if (!adminPassword) {
		return {
			status: "error",
			message: "ADMIN_PASSWORD environment variable is required",
		};
	}

	const existing = await db
		.select()
		.from(user)
		.where(eq(user.email, adminEmail))
		.limit(1);

	if (existing.length > 0) {
		return {
			status: "skipped",
			message: `Admin user already exists (${adminEmail}), skipping`,
		};
	}

	const hashedPassword = await hashPassword(adminPassword);
	const userId = generateRandomString(32);
	const now = new Date();

	await db.transaction(async (tx: any) => {
		await tx.insert(user).values({
			id: userId,
			name: "Admin",
			email: adminEmail,
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});
		await tx.insert(account).values({
			id: generateRandomString(32),
			accountId: userId,
			providerId: "credential",
			userId,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		});
	});

	return { status: "created", message: `Admin user created (${adminEmail})` };
}

if (import.meta.main) {
	const { db } = await import("../app/db/client");
	let result: SeedResult;
	try {
		result = await seedAdmin(db);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[seed] Error: ${msg}`);
		process.exit(1);
	}
	if (result.status === "error") {
		console.error(`[seed] Error: ${result.message}`);
		process.exit(1);
	}
	console.log(`[seed] ${result.message}`);
	process.exit(0);
}
