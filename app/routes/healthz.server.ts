import { sql } from "drizzle-orm";
import { db } from "#/db/client";

type DatabaseCheck = () => Promise<unknown>;

async function checkDatabase(): Promise<void> {
	await db.execute(sql`select 1`);
}

const HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
};

export async function getHealthResponse(
	check: DatabaseCheck = checkDatabase,
): Promise<Response> {
	try {
		await check();
		return new Response(JSON.stringify({ status: "ok" }), {
			status: 200,
			headers: HEADERS,
		});
	} catch {
		return new Response(JSON.stringify({ status: "unavailable" }), {
			status: 503,
			headers: HEADERS,
		});
	}
}

export async function getHealthHandler(): Promise<Response> {
	return getHealthResponse();
}
