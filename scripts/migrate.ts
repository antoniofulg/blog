import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"

const url = process.env.DATABASE_URL
if (!url) {
	console.error("[migrate] DATABASE_URL not set")
	process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })

try {
	console.log("[migrate] applying migrations from ./drizzle")
	await migrate(drizzle(client), { migrationsFolder: "./drizzle" })
	console.log("[migrate] done")
} catch (err) {
	console.error("[migrate] failed:", err)
	process.exitCode = 1
} finally {
	await client.end()
}
