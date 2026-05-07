import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vitest/config";

// Server-only module IDs that must never reach the client bundle.
// Instead of erroring (like vite-env-only), we return no-op stubs so
// route files that import these for server functions still compile client-side.
const SERVER_ONLY_IDS = new Set([
	"#/db/client",
	"#/db/indexer",
	"#/lib/mdx/parser.server",
	"#/lib/mdx/renderer.server",
	"#/lib/watcher.server",
	"#/lib/auth",
]);
// Node built-ins used only in server function bodies — stub for browser.
const NODE_ONLY_IDS = new Set([
	"node:fs/promises",
	"node:fs",
	"node:path",
	"node:child_process",
]);
const STUB_PREFIX = "\0server-stub:";

function serverOnlyStubPlugin(): Plugin {
	return {
		name: "server-only-stub",
		enforce: "pre",
		resolveId(id, _importer, options) {
			if (!options?.ssr) {
				if (SERVER_ONLY_IDS.has(id) || NODE_ONLY_IDS.has(id)) {
					return STUB_PREFIX + id;
				}
			}
		},
		load(id) {
			if (id.startsWith(STUB_PREFIX)) {
				const original = id.slice(STUB_PREFIX.length);
				if (NODE_ONLY_IDS.has(original)) {
					// node built-ins: stub all common exports as no-ops
					return "export default {}; export const readFile=()=>Promise.resolve(''), writeFile=()=>Promise.resolve(), mkdir=()=>Promise.resolve(), stat=()=>Promise.resolve({}), watch=()=>({}), join=(...a)=>a.join('/'), resolve=(...a)=>a.join('/'), execFileSync=()=>'', spawn=()=>({unref:()=>{}});";
				}
				return (
					"export default {}; " +
					"export const db=null,renderMdx=null,parseFrontmatter=null,auth=null,syncAll=null," +
					"upsertPost=null,removePost=null,startContentWatcher=null," +
					"indexer=null,closeDb=()=>Promise.resolve();"
				);
			}
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		{
			name: "content-watcher-dev",
			apply: "serve",
			// Starts the content watcher when `bun dev` launches.
			// apply: "serve" ensures this only runs during the Vite dev server, not during
			// builds. The watcher runs in a separate Bun subprocess so .ts resolves
			// natively — Node.js (which runs Vite) cannot import .ts files directly.
			// Skipped during vitest: tests start the watcher explicitly via their own imports.
			async configureServer() {
				if (process.env.VITEST) return;
				const { execFileSync, spawn } = await import("node:child_process");
				execFileSync("bun", ["run", "db:migrate"], { stdio: "inherit" });
				execFileSync("bun", ["run", "db:seed"], { stdio: "inherit" });
				const proc = spawn("bun", ["scripts/watcher.ts"], {
					stdio: "inherit",
					cwd: process.cwd(),
				});
				proc.unref();
			},
		},
		devtools(),
		nitro({ preset: "bun", rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart({ srcDirectory: "app" }),
		viteReact(),
		serverOnlyStubPlugin(),
	],
	test: {
		environment: "node",
		include: ["app/tests/**/*.test.ts"],
	},
});

export default config;
