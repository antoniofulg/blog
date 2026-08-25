import { BROWSER_SMOKE_ROUTES } from "#/lib/browser-bench/contract";
import { expect, test } from "./fixtures/browser-smoke";

function canonicalPath(value: string | null): string | null {
	return value ? new URL(value).pathname : null;
}

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
