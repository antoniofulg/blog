import { defineConfig } from "drizzle-kit"

export default defineConfig({
	schema: ["./app/db/schema.ts", "./app/db/auth-schema.ts"],
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
	},
})
