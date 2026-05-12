import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

const client = postgres(
	process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
);

export const db = drizzle(client, { schema: { ...schema, ...authSchema } });

export async function closeDb(): Promise<void> {
	await client.end();
}
