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
	"#/lib/session",
	"#/lib/site-model.server",
	"#/lib/content-audit/link-parser.server",
	"#/lib/content-audit/checks.server",
	"#/lib/content-audit/reporter.server",
	"#/lib/app-audit/browser-sweep.server",
	"#/lib/app-audit/a11y-adapter.server",
	"#/lib/app-audit/lighthouse.server",
	"#/lib/app-audit/checks.server",
	"#/lib/app-audit/reporter.server",
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
					"indexer=null,closeDb=()=>Promise.resolve(),requireSession=()=>Promise.resolve()," +
					"extractLinks=null,runContentAudit=null,writeReport=null," +
					"runAppAudit=null,initSummary=null,sweepRoute=null,analyzeA11y=null," +
					"runLighthouse=null,lighthouseToFindings=null;"
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
				const { runDevBoot } = await import("./app/lib/dev-boot");
				await runDevBoot();
			},
		},
		devtools(),
		nitro({
			preset: "bun",
			// Pre-compress static assets at build time so the production Nitro
			// server can serve `.br` / `.gz` variants based on Accept-Encoding.
			// Without this, Lighthouse measures uncompressed 866KB JS over a
			// throttled link (~6s FCP). Real prod usually sits behind a CDN
			// that compresses on the fly, but the audit preview hits Nitro
			// directly — so we need build-time compression for the score to
			// reflect what users see.
			compressPublicAssets: { gzip: true, brotli: true },
			rollupConfig: { external: [/^@sentry\//] },
			// CS 1.6 ArialPixel font is vendored at public/fonts/cs16/ArialPixel.ttf
			// and served by Nitro's built-in public/ handler. No publicAssets entry
			// needed. See ADR-004 for the lazy-load rationale and URL contract
			// (/fonts/cs16/cs16-font.css → /fonts/cs16/ArialPixel.ttf).
		}),
		tailwindcss(),
		tanstackStart({
			srcDirectory: "app",
			importProtection: {
				client: {
					excludeFiles: [
						"app/routes/{-$locale}/$slug.server.ts",
						"app/routes/{-$locale}/index.server.ts",
						"app/routes/admin/index.server.ts",
						"app/routes/admin/analytics/index.server.ts",
						"app/routes/sitemap[.]xml.server.ts",
					],
				},
			},
		}),
		viteReact(),
		serverOnlyStubPlugin(),
	],
	test: {
		environment: "node",
		include: ["app/tests/**/*.test.ts"],
	},
});

export default config;
