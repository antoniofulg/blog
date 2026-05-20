import "@tanstack/react-start/server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { analyzeA11y } from "#/lib/app-audit/a11y-adapter.server";
import { sweepRoute } from "#/lib/app-audit/browser-sweep.server";
import {
	lighthouseToFindings,
	runLighthouse,
} from "#/lib/app-audit/lighthouse.server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";
import {
	getRouteInventory,
	type RouteEntry,
	resolveRoutePath,
} from "#/lib/site-model.server";

export type {
	AppAuditCategory,
	AppAuditFinding,
} from "#/lib/app-audit/browser-sweep.server";

const AUTH_STATES = ["anon", "admin"] as const;

export function normalizeRoutePath(p: string): string {
	let s = p.trim();
	if (!s.startsWith("/")) s = `/${s}`;
	if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
	return s.toLowerCase();
}

function buildLocalePath(path: string, locale: Locale): string {
	if (locale === "en") return path;
	// Skip double-prefixing for shim routes whose path already contains the locale prefix.
	// e.g. pt-br.index.tsx has path="/pt-br/" and locale="pt-br"; prefixing again → /pt-br/pt-br/.
	if (path.startsWith("/pt-br/") || path === "/pt-br") return path;
	return path === "/" ? "/pt-br/" : `/pt-br${path}`;
}

async function getAdminStorageState(): Promise<string | undefined> {
	const statePath = join(process.cwd(), "tests/e2e/.auth/admin.json");
	try {
		await readFile(statePath, "utf-8");
		return statePath;
	} catch {
		return undefined;
	}
}

export async function runAppAudit(opts: {
	lighthouse: boolean;
	baseUrl?: string;
	routes?: string[];
}): Promise<import("#/lib/app-audit/browser-sweep.server").AppAuditFinding[]> {
	const baseUrl =
		opts.baseUrl ?? process.env.AUDIT_BASE_URL ?? "http://localhost:4173";

	try {
		await fetch(baseUrl, { signal: AbortSignal.timeout(3000) });
	} catch {
		return [
			{
				category: "preflight-error" as const,
				severity: "blocker" as const,
				filePath: "preflight",
				message: `[app-audit] baseUrl ${baseUrl} unreachable — invoke via 'make audit-fe' (auto-orchestrates the Nitro preview), or start manually with 'bun run build && PORT=4173 bun run .output/server/index.mjs' then re-run, or pass --baseUrl=<url>. Note: 'bun preview' (vite preview) does NOT serve the TanStack Start SSR bundle and will not work.`,
			},
		];
	}

	const allRoutes = await getRouteInventory();
	const findings: import("#/lib/app-audit/browser-sweep.server").AppAuditFinding[] =
		[];

	const routeFilter = opts.routes;
	let routes: RouteEntry[];

	if (routeFilter && routeFilter.length > 0) {
		const normalizedFilter = routeFilter.map(normalizeRoutePath);
		routes = allRoutes.filter((r) =>
			normalizedFilter.includes(normalizeRoutePath(r.path)),
		);
		if (routes.length === 0) {
			findings.push({
				category: "sweep-error",
				severity: "major",
				filePath: "cli",
				message: `No routes matched filter: ${routeFilter.join(", ")}`,
			});
			return findings;
		}
	} else {
		routes = allRoutes;
	}

	const adminStorageState = await getAdminStorageState();
	// AUDIT_HEADED=1 surfaces the Playwright Chromium window so operators can
	// watch the sweep live. AUDIT_SLOWMO=<ms> slows each action proportionally
	// (e.g. 250 = quarter-second between clicks). Both default OFF for CI.
	const headed = process.env.AUDIT_HEADED === "1";
	const slowMo = Number(process.env.AUDIT_SLOWMO ?? "0") || undefined;
	const browser = await chromium.launch({ headless: !headed, slowMo });

	try {
		const anonContext = await browser.newContext({ baseURL: baseUrl });
		const adminContext = await browser.newContext({
			baseURL: baseUrl,
			...(adminStorageState ? { storageState: adminStorageState } : {}),
		});

		try {
			for (const route of routes) {
				// Shim routes embed their locale prefix in the path (e.g. /pt-br/, /en/).
				// Walking across all LOCALES would produce /pt-br/pt-br/ or /pt-br/en/.
				// Detect by checking whether the route path starts with a locale segment.
				const isShimRoute =
					route.locale !== null &&
					LOCALES.some(
						(l) => route.path.startsWith(`/${l}/`) || route.path === `/${l}`,
					);
				const localesToWalk =
					isShimRoute || route.locale === null ? [DEFAULT_LOCALE] : LOCALES;
				for (const locale of localesToWalk) {
					const resolvedPath = resolveRoutePath(route);
					const localePath = buildLocalePath(resolvedPath, locale);
					const fullUrl = `${baseUrl}${localePath}`;
					const routeWithLocale: RouteEntry = {
						...route,
						path: localePath,
						locale,
					};

					if (opts.lighthouse) {
						try {
							const scores = await runLighthouse(fullUrl);
							findings.push(...lighthouseToFindings(scores, fullUrl));
						} catch (err) {
							findings.push({
								category: "sweep-error",
								severity: "major",
								filePath: fullUrl,
								message: `Lighthouse failed: ${err instanceof Error ? err.message : String(err)}`,
							});
						}
					}

					for (const authState of AUTH_STATES) {
						const context = authState === "admin" ? adminContext : anonContext;
						const page = await context.newPage();
						try {
							const sweep = await sweepRoute(page, routeWithLocale);
							findings.push(...sweep);
							const hasSweepError = sweep.some(
								(f) => f.category === "sweep-error",
							);
							if (!hasSweepError) {
								const a11y = await analyzeA11y(page);
								findings.push(...a11y);
							}
						} finally {
							await page.close();
						}
					}
				}
			}
		} finally {
			await anonContext.close();
			await adminContext.close();
		}
	} finally {
		await browser.close();
	}

	return findings;
}
