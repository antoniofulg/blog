import {
	BROWSER_SMOKE_ROUTES,
	normalizeBrowserSmokeOutcome,
	type BrowserSmokeObservation,
} from "#/lib/browser-bench/contract";
import {
	expect,
	HYBRID_RESULT_PREFIX,
	test,
	type BrowserSmokeFixture,
} from "./fixtures/browser-smoke";

function canonicalPath(value: string | null): string | null {
	return value ? new URL(value).pathname : null;
}

export async function runBrowserSmokePass(
	browserSmoke: BrowserSmokeFixture,
	baseURL: string,
): Promise<{ durationMs: number; routes: BrowserSmokeObservation[] }> {
	const startedAt = performance.now();
	const routes: BrowserSmokeObservation[] = [];
	for (const route of BROWSER_SMOKE_ROUTES) {
		routes.push((await browserSmoke.observe(route, baseURL)).observation);
	}
	return { durationMs: performance.now() - startedAt, routes };
}

const benchmarkPhase = process.env.PLAYWRIGHT_WEBVIEW_BENCHMARK_PHASE;

if (benchmarkPhase) {
	test.describe(
		"matched public browser benchmark",
		{ tag: ["@public", "@smoke", "@benchmark"] },
		() => {
			test("five-route pass: emits lifecycle metrics", async ({
				browserSmoke,
				baseURL,
			}, testInfo) => {
				if (benchmarkPhase !== "cold" && benchmarkPhase !== "warm") {
					throw new Error(`unknown hybrid benchmark phase: ${benchmarkPhase}`);
				}
				if (!baseURL) throw new Error("hybrid browser baseURL is required");

				const warmup =
					benchmarkPhase === "warm"
						? await runBrowserSmokePass(browserSmoke, baseURL)
						: null;
				const measured = await runBrowserSmokePass(browserSmoke, baseURL);
				const outcome = normalizeBrowserSmokeOutcome({ routes: measured.routes });
				if (!outcome) throw new Error("hybrid benchmark produced invalid routes");

				const result = {
					schemaVersion: 1,
					profile: browserSmoke.profile.project,
					phase: benchmarkPhase,
					startupMs: browserSmoke.startupMs,
					driverSetupMs: browserSmoke.driverSetupMs,
					warmupMs: warmup?.durationMs ?? null,
					actionMs: measured.durationMs,
					routes: outcome.routes,
					passed: outcome.passed,
					runtimeVersion: browserSmoke.runtimeVersion,
					browserVersion: browserSmoke.browserVersion,
				};
				console.log(`${HYBRID_RESULT_PREFIX}${JSON.stringify(result)}`);
				await testInfo.attach("hybrid-browser-result.json", {
					body: Buffer.from(JSON.stringify(result, null, 2)),
					contentType: "application/json",
				});
				expect(outcome.passed).toBe(true);
			});
		},
	);
} else {
	test.describe(
		"matched public browser smoke",
		{ tag: ["@public", "@smoke"] },
		() => {
		for (const route of BROWSER_SMOKE_ROUTES) {
			test(`${route.id}: matches the canonical route contract`, async ({
				browserSmoke,
				baseURL,
			}, testInfo) => {
				if (!baseURL) throw new Error("hybrid browser baseURL is required");

				const result = await test.step(`navigate to ${route.path}`, () =>
					browserSmoke.observe(route, baseURL),
				);

				expect(result.snapshot.readyState).toBe("complete");
				if (route.expectedStatus !== undefined) {
					expect(result.snapshot.status).toBe(route.expectedStatus);
				}
				if (route.expectedLang) {
					expect(result.snapshot.lang).toBe(route.expectedLang);
				}
				if (route.expectedHeading) {
					expect(result.snapshot.headings).toContain(route.expectedHeading);
				}
				if (route.expectedText) {
					expect(result.snapshot.bodyText).toContain(route.expectedText);
				}
				if (route.expectedCanonicalPath) {
					expect(canonicalPath(result.snapshot.canonical)).toBe(
						route.expectedCanonicalPath,
					);
				}
				expect(result.observation.error).toBeUndefined();
				expect(result.observation.passed).toBe(true);

				await testInfo.attach(`${route.id}.json`, {
					body: Buffer.from(JSON.stringify(result, null, 2)),
					contentType: "application/json",
				});
			});
		}
		},
	);
}
