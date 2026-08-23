import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["app/tests/**/*.test.ts", "app/tests/**/*.test.tsx"],
		// Vitest under Bun needs these ESM transforms to load the full React
		// inventory. Node must externalize the CommonJS entry points instead.
		...(process.versions.bun
			? { server: { deps: { inline: [/react/, /react-dom/, /zod/] } } }
			: {}),
		// PGLite boots inside beforeAll hooks and can exceed Vitest's 10 s
		// default when several integration files contend for CPU.
		hookTimeout: 60_000,
		testTimeout: 30_000,
	},
});
