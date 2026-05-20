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
import { LOCALES, type Locale } from "#/lib/locale";
import { getRouteInventory, type RouteEntry } from "#/lib/site-model.server";

export type {
	AppAuditCategory,
	AppAuditFinding,
} from "#/lib/app-audit/browser-sweep.server";

const AUTH_STATES = ["anon", "admin"] as const;

function buildLocalePath(path: string, locale: Locale): string {
	if (locale === "en") return path;
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
		opts.baseUrl ?? process.env.AUDIT_BASE_URL ?? "http://localhost:3000";

	const allRoutes = await getRouteInventory();
	const routeFilter = opts.routes;
	const routes =
		routeFilter && routeFilter.length > 0
			? allRoutes.filter((r) => routeFilter.includes(r.path))
			: allRoutes;
	const findings: import("#/lib/app-audit/browser-sweep.server").AppAuditFinding[] =
		[];

	const adminStorageState = await getAdminStorageState();
	const browser = await chromium.launch({ headless: true });

	try {
		const anonContext = await browser.newContext({ baseURL: baseUrl });
		const adminContext = await browser.newContext({
			baseURL: baseUrl,
			...(adminStorageState ? { storageState: adminStorageState } : {}),
		});

		try {
			for (const route of routes) {
				for (const locale of LOCALES) {
					const localePath = buildLocalePath(route.path, locale);
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
							const a11y = await analyzeA11y(page);
							findings.push(...a11y);
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
