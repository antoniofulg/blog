import postgres from "postgres";

export const LOCAL_TEST_DATABASE_URL =
	"postgres://blog:blog@127.0.0.1:5432/blog";

function isLoopback(hostname: string): boolean {
	return (
		hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
	);
}

export function localDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
	const candidate = env.DATABASE_URL;
	if (!candidate) return LOCAL_TEST_DATABASE_URL;
	try {
		const parsed = new URL(candidate);
		return isLoopback(parsed.hostname) ? candidate : LOCAL_TEST_DATABASE_URL;
	} catch {
		return LOCAL_TEST_DATABASE_URL;
	}
}

export function sanitizedBenchmarkEnv(
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const result: NodeJS.ProcessEnv = {
		...env,
		DATABASE_URL: LOCAL_TEST_DATABASE_URL,
		TZ: "UTC",
	};
	delete result.POSTGRES_DB;
	delete result.POSTGRES_USER;
	delete result.POSTGRES_PASSWORD;
	delete result.POSTGRES_PORT;
	return result;
}

export async function isPostgresAvailable(
	databaseUrl = localDatabaseUrl(),
): Promise<boolean> {
	const sql = postgres(databaseUrl, {
		connect_timeout: 1,
		idle_timeout: 1,
		max: 1,
	});
	try {
		await sql`select 1`;
		return true;
	} catch {
		return false;
	} finally {
		await sql.end({ timeout: 1 });
	}
}
