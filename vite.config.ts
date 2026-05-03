import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { denyImports } from "vite-env-only";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		{
			name: "content-watcher-dev",
			apply: "serve",
			// Starts the content watcher when `bun dev` launches.
			// apply: "serve" ensures this only runs during the Vite dev server, not during
			// builds. The dynamic import runs in Bun's Node.js context (not the browser
			// bundle pipeline), so the #/ alias resolves via package.json imports map.
			// Skipped during vitest: tests start the watcher explicitly via their own imports.
			async configureServer() {
				if (process.env.VITEST) return;
				const { startContentWatcher } = await import(
					join(process.cwd(), "app/lib/watcher.server.ts")
				);
				startContentWatcher(join(process.cwd(), "content"));
			},
		},
		denyImports({
			client: {
				files: [
					"app/db/client.ts",
					"app/db/indexer.ts",
					"app/lib/mdx.server.ts",
					"app/lib/watcher.server.ts",
					"app/lib/auth.ts",
				],
			},
		}),
		devtools(),
		nitro({ preset: "bun", rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart({ srcDirectory: "app" }),
		viteReact(),
	],
	test: {
		environment: "node",
		include: ["app/tests/**/*.test.ts"],
	},
});

export default config;
