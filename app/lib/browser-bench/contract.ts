export const BROWSER_SMOKE_ROUTE_IDS = [
	"en-post",
	"pt-br-post",
	"not-found",
	"en-index",
	"pt-br-index",
] as const;

export type BrowserSmokeRouteId = (typeof BROWSER_SMOKE_ROUTE_IDS)[number];

export type BrowserSmokeRoute = {
	id: BrowserSmokeRouteId;
	path: string;
	expectedStatus: number;
	expectedLang?: string;
	expectedHeading?: string;
	expectedText?: string;
	expectedCanonicalPath?: string;
};

export const BROWSER_SMOKE_ROUTES: readonly BrowserSmokeRoute[] = [
	{
		id: "en-post",
		path: "/e2e-public-fixture",
		expectedStatus: 200,
		expectedLang: "en",
		expectedHeading: "E2E Public Fixture",
		expectedText: "English body",
	},
	{
		id: "pt-br-post",
		path: "/pt-br/e2e-public-fixture",
		expectedStatus: 200,
		expectedLang: "pt-BR",
		expectedHeading: "E2E Fixture Público",
		expectedText: "português",
	},
	{
		id: "not-found",
		path: "/this-slug-does-not-exist-e2e-99999",
		expectedStatus: 200,
		expectedHeading: "Post not found",
	},
	{
		id: "en-index",
		path: "/",
		expectedStatus: 200,
		expectedLang: "en",
		expectedCanonicalPath: "/",
	},
	{
		id: "pt-br-index",
		path: "/pt-br/",
		expectedStatus: 200,
		expectedLang: "pt-BR",
		expectedCanonicalPath: "/pt-br/",
	},
] as const;

export type BrowserSmokeObservation = {
	id: BrowserSmokeRouteId;
	passed: boolean;
	status?: number;
	error?: string;
};

export type BrowserSmokeOutcome = {
	routes: BrowserSmokeObservation[];
	passed: boolean;
};

export function normalizeBrowserSmokeOutcome(
	value: unknown,
): BrowserSmokeOutcome | null {
	if (typeof value !== "object" || value === null) return null;
	const routes = Reflect.get(value, "routes");
	if (!Array.isArray(routes)) return null;
	if (routes.length !== BROWSER_SMOKE_ROUTE_IDS.length) return null;
	const observations: BrowserSmokeObservation[] = [];
	for (const [index, route] of routes.entries()) {
		if (typeof route !== "object" || route === null) return null;
		const id = Reflect.get(route, "id");
		const passed = Reflect.get(route, "passed");
		if (id !== BROWSER_SMOKE_ROUTE_IDS[index] || typeof passed !== "boolean") {
			return null;
		}
		const status = Reflect.get(route, "status");
		if (status !== undefined && typeof status !== "number") return null;
		const error = Reflect.get(route, "error");
		if (error !== undefined && typeof error !== "string") return null;
		observations.push({
			id,
			passed,
			...(status === undefined ? {} : { status }),
			...(error === undefined ? {} : { error }),
		});
	}
	return {
		routes: observations,
		passed: observations.every((route) => route.passed),
	};
}
