import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import * as ts from "typescript";

export type TestRunner = "vitest" | "bun:test";
export type TestCohort = "pure" | "dom" | "mocks-timers" | "integration-infra";

export type MockExportInventory = {
	dynamicSpread?: boolean;
	module: string;
	symbols: string[];
};

export type HookInventory = {
	afterAll: number;
	afterEach: number;
	beforeAll: number;
	beforeEach: number;
};

export type TestStaticSemantics = {
	usesDom: boolean;
	usesFakeTimers: boolean;
	usesEnvironment: boolean;
	usesFilesystem: boolean;
	usesSubprocess: boolean;
};

export type TestFileInventory = {
	relativePath: string;
	runner: TestRunner;
	cohort?: TestCohort;
	leafTests: string[];
	testCount: number;
	assertionCount: number;
	// Kept as aliases for existing consumers and report formats.
	tests: number;
	assertions: number;
	fixturePaths: string[];
	missingFixtures: string[];
	residualVitestApis: string[];
	omissionMarkers: string[];
	mockExports: MockExportInventory[];
	hooks: HookInventory;
	semantics: TestStaticSemantics;
};

export type VitestOnlyDisposition = {
	file: string;
	reason: string;
	evidence: string;
	owner: string;
	followUp: string;
};

export type RuntimeOutcome = {
	filesPassed: number;
	filesFailed: number;
	testsPassed: number;
	testsFailed: number;
	testsSkipped: number;
	testsTodo: number;
	testFileCount: number;
	leafTests?: string[];
};

export type RuntimeParityResult = {
	ok: boolean;
	reasons: string[];
};

export type ParityResult = {
	ok: boolean;
	valid: boolean;
	reasons: string[];
	reference: TestFileInventory[];
	candidate: TestFileInventory[];
	missingFiles: string[];
	extraFiles: string[];
	dispositions: VitestOnlyDisposition[];
};

export const DEFAULT_VITEST_ONLY_DISPOSITIONS: VitestOnlyDisposition[] = [
	...[
		"bench-cli.test.ts",
		"bench-e2e-runtimes.test.ts",
		"bench-host.test.ts",
		"bench-load.test.ts",
		"bench-matrix.test.ts",
		"bench-preflight.test.ts",
		"bench-reporter.test.ts",
		"bench-runner.test.ts",
		"bench-runtime.test.ts",
		"bench-setup.test.ts",
		"bench-stats.test.ts",
		"bench-store.test.ts",
		"bench-versions.test.ts",
		"bench-vitest-workers.test.ts",
		"bench-workloads.test.ts",
	].map((file) => ({
		file,
		reason:
			"benchmark infrastructure is the control/evidence producer, not product behavior",
		evidence:
			"file name and imports target app/lib/bench or benchmark CLI entry points",
		owner: "test-infrastructure",
		followUp:
			"keep covered by the canonical Vitest suite; do not include in Bun product-runner comparison",
	})),
	...[
		"ci-runtime-contract.test.ts",
		"test-runtime.test.ts",
		"test-scripts.test.ts",
		"test-migration-parity.test.ts",
		"vitest-summary.test.ts",
	].map((file) => ({
		file,
		reason:
			"runner/CI contract test depends on Vitest or validates runner infrastructure",
		evidence:
			"file name and assertions inspect package scripts, runtime guards, or Vitest output",
		owner: "test-infrastructure",
		followUp:
			"retain in Vitest; validate candidate commands through the profile smoke tests",
	})),
];

const TEST_FILE = /\.(?:test|spec)\.tsx?$/;
const HOOKS = new Set(["afterAll", "afterEach", "beforeAll", "beforeEach"]);

function normalized(value: string): string {
	return value.split(sep).join("/");
}

function fixtureExists(path: string): boolean {
	if (existsSync(path)) return true;
	return [".ts", ".tsx", ".js", ".jsx", ".json", ".mdx"].some((extension) =>
		existsSync(`${path}${extension}`),
	);
}

async function testFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) files.push(...(await testFiles(path)));
		else if (entry.isFile() && TEST_FILE.test(entry.name)) files.push(path);
	}
	return files.sort((a, b) => normalized(a).localeCompare(normalized(b)));
}

function calleeName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return undefined;
}

function literalLabel(node: ts.Node | undefined): string {
	return node && ts.isStringLiteralLike(node) ? node.text : "<dynamic>";
}

function collectLeavesAndHooks(source: ts.SourceFile): {
	leafTests: string[];
	hooks: HookInventory;
} {
	const leafTests: string[] = [];
	const hooks: HookInventory = {
		afterAll: 0,
		afterEach: 0,
		beforeAll: 0,
		beforeEach: 0,
	};

	function walk(node: ts.Node, scopes: string[]): void {
		if (ts.isCallExpression(node)) {
			const name = calleeName(node.expression);
			if (name && HOOKS.has(name)) hooks[name as keyof HookInventory] += 1;
			if (name === "describe") {
				const callback = node.arguments[1];
				const nextScopes = [...scopes, literalLabel(node.arguments[0])];
				if (
					callback &&
					(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
				) {
					walk(callback.body, nextScopes);
					return;
				}
			}
			if (name === "test" || name === "it") {
				leafTests.push(
					[...scopes, literalLabel(node.arguments[0])].join(" > "),
				);
			}
		}
		ts.forEachChild(node, (child) => walk(child, scopes));
	}

	walk(source, []);
	return { leafTests: [...new Set(leafTests)].sort(), hooks };
}

function propertyName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return undefined;
}

function fixtureReferences(
	source: ts.SourceFile,
	filePath: string,
): { paths: string[]; missing: string[] } {
	const paths = new Set<string>();
	const missing = new Set<string>();
	const pathCallNames = new Set([
		"join",
		"resolve",
		"readFile",
		"readFileSync",
		"stat",
		"access",
	]);
	function visit(node: ts.Node): void {
		if (ts.isStringLiteralLike(node)) {
			const value = node.text;
			const parent = node.parent;
			const isImportPath = ts.isImportDeclaration(parent);
			const isPathCall =
				ts.isCallExpression(parent) &&
				pathCallNames.has(propertyName(parent.expression) ?? "");
			if (
				/(?:^|[\\/])fixtures?(?:[\\/]|$)/i.test(value) &&
				(isImportPath || isPathCall)
			) {
				const resolved = value.startsWith("app/")
					? resolve(process.cwd(), value)
					: resolve(dirname(filePath), value);
				const path = normalized(value).replace(/^app\/tests\//, "");
				paths.add(path);
				if (!fixtureExists(resolved)) missing.add(path);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return { paths: [...paths].sort(), missing: [...missing].sort() };
}

function residualVitestApis(source: ts.SourceFile, text: string): string[] {
	const found = new Set<string>();
	function visit(node: ts.Node): void {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === "vitest"
		)
			found.add('import "vitest"');
		if (ts.isIdentifier(node) && node.text === "vi") found.add("vi");
		ts.forEachChild(node, visit);
	}
	visit(source);
	if (/from\s+["']vitest["']/.test(text)) found.add('import "vitest"');
	return [...found].sort();
}

function staticSemantics(text: string): TestStaticSemantics {
	return {
		usesDom:
			/document\.|window\.|@testing-library|HTMLElement|ResizeObserver|matchMedia|render\(/i.test(
				text,
			),
		usesFakeTimers:
			/fakeTimers|useFakeTimers|setSystemTime|useRealTimers/i.test(text),
		usesEnvironment: /process\.env|Bun\.env/i.test(text),
		usesFilesystem: /node:(?:fs|os|path)|readFile|writeFile|mkdtemp|rm\(/i.test(
			text,
		),
		usesSubprocess: /node:child_process|spawn\(|exec(?:File)?\(/i.test(text),
	};
}

function omissionMarkers(text: string): string[] {
	return text
		.split("\n")
		.filter((line) =>
			/(?:^\s*\/\/|^\s*\/\*|^\s*\*|NOTE:).*partial\s+mock\s+skipped/i.test(
				line,
			),
		).length > 0
		? ["partial mock skipped"]
		: [];
}

function mockExports(source: ts.SourceFile): MockExportInventory[] {
	const byModule = new Map<
		string,
		{ dynamicSpread: boolean; symbols: Set<string> }
	>();
	function visit(node: ts.Node): void {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression)
		) {
			const method = node.expression.name.text;
			const receiver = node.expression.expression;
			if (
				(method === "mock" || method === "module") &&
				ts.isIdentifier(receiver) &&
				(receiver.text === "vi" || receiver.text === "mock")
			) {
				const moduleName = node.arguments[0];
				const factory = node.arguments[1];
				if (
					moduleName &&
					ts.isStringLiteralLike(moduleName) &&
					factory &&
					(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))
				) {
					const functionBody = ts.isParenthesizedExpression(factory.body)
						? factory.body.expression
						: factory.body;
					const body = ts.isBlock(functionBody)
						? functionBody.statements.find(
								(statement): statement is ts.ReturnStatement =>
									ts.isReturnStatement(statement),
							)?.expression
						: functionBody;
					if (body && ts.isObjectLiteralExpression(body)) {
						const entry = byModule.get(moduleName.text) ?? {
							dynamicSpread: false,
							symbols: new Set<string>(),
						};
						for (const property of body.properties) {
							if (ts.isSpreadAssignment(property)) {
								entry.dynamicSpread = true;
								continue;
							}
							const name =
								property.name &&
								(ts.isIdentifier(property.name) ||
									ts.isStringLiteral(property.name))
									? property.name.text
									: undefined;
							if (name) entry.symbols.add(name);
						}
						byModule.set(moduleName.text, entry);
					}
				}
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return [...byModule.entries()]
		.map(([module, entry]) => ({
			dynamicSpread: entry.dynamicSpread,
			module,
			symbols: [...entry.symbols].sort(),
		}))
		.sort((a, b) => a.module.localeCompare(b.module));
}

async function scanFile(
	root: string,
	filePath: string,
	runner: TestRunner,
): Promise<TestFileInventory> {
	const text = await readFile(filePath, "utf8");
	const source = ts.createSourceFile(
		filePath,
		text,
		ts.ScriptTarget.Latest,
		true,
		extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
	);
	const { leafTests, hooks } = collectLeavesAndHooks(source);
	if (/import\s+["'][^"']*happydom["']/.test(text)) hooks.afterEach += 1;
	let assertionCount = 0;
	ts.forEachChild(source, function visit(node): void {
		if (ts.isCallExpression(node) && calleeName(node.expression) === "expect")
			assertionCount += 1;
		ts.forEachChild(node, visit);
	});
	const fixtures = fixtureReferences(source, filePath);
	return {
		relativePath: normalized(relative(root, filePath)),
		runner,
		leafTests,
		testCount: leafTests.length,
		assertionCount,
		tests: leafTests.length,
		assertions: assertionCount,
		fixturePaths: fixtures.paths,
		missingFixtures: fixtures.missing,
		residualVitestApis: residualVitestApis(source, text),
		omissionMarkers: omissionMarkers(text),
		mockExports: mockExports(source),
		hooks,
		semantics: staticSemantics(text),
	};
}

export async function scanTestTree(
	root: string,
	runner: TestRunner,
): Promise<TestFileInventory[]> {
	const files = await testFiles(root);
	return (
		await Promise.all(files.map((filePath) => scanFile(root, filePath, runner)))
	).sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function dispositionError(
	disposition: VitestOnlyDisposition,
): string | undefined {
	for (const field of [
		"file",
		"reason",
		"evidence",
		"owner",
		"followUp",
	] as const) {
		if (
			typeof disposition[field] !== "string" ||
			disposition[field].trim() === ""
		)
			return `invalid Vitest-only disposition for ${disposition.file || "<unknown>"}: ${field} is required`;
	}
	return undefined;
}

function compareStaticFile(
	referenceFile: TestFileInventory,
	candidateFile: TestFileInventory,
	reasons: string[],
): void {
	const path = referenceFile.relativePath;
	if (candidateFile.testCount !== referenceFile.testCount)
		reasons.push(
			`${path}: leaf tests ${candidateFile.testCount} != ${referenceFile.testCount}`,
		);
	if (candidateFile.assertionCount !== referenceFile.assertionCount)
		reasons.push(
			`${path}: assertions ${candidateFile.assertionCount} != ${referenceFile.assertionCount}`,
		);
	if (candidateFile.leafTests.join("\n") !== referenceFile.leafTests.join("\n"))
		reasons.push(`${path}: leaf test identities differ`);
	for (const hook of Object.keys(referenceFile.hooks) as Array<
		keyof HookInventory
	>)
		if (candidateFile.hooks[hook] < referenceFile.hooks[hook])
			reasons.push(`${path}: lifecycle hook inventory differs`);
	for (const semantic of Object.keys(referenceFile.semantics) as Array<
		keyof TestStaticSemantics
	>)
		if (referenceFile.semantics[semantic] && !candidateFile.semantics[semantic])
			reasons.push(`${path}: static state/resource semantics differ`);
	for (const fixture of candidateFile.missingFixtures)
		reasons.push(`${path}: missing fixture ${fixture}`);
	for (const fixture of referenceFile.fixturePaths)
		if (
			!candidateFile.fixturePaths.some(
				(candidateFixture) =>
					candidateFixture === fixture ||
					candidateFixture.startsWith(`${fixture}/`),
			)
		)
			reasons.push(`${path}: fixture inventory differs`);
	for (const api of candidateFile.residualVitestApis)
		reasons.push(`${path}: residual Vitest API ${api}`);
	for (const marker of candidateFile.omissionMarkers)
		reasons.push(`${path}: forbidden omission marker ${marker}`);
	const candidateMocks = new Map(
		candidateFile.mockExports.map((mock) => [mock.module, mock]),
	);
	for (const referenceMock of referenceFile.mockExports) {
		const candidateMock = candidateMocks.get(referenceMock.module);
		if (candidateMock?.dynamicSpread) continue;
		for (const symbol of referenceMock.symbols)
			if (!candidateMock?.symbols.includes(symbol))
				reasons.push(
					`${path}: mock ${referenceMock.module} missing export ${symbol}`,
				);
	}
}

export function compareTestTrees(
	reference: TestFileInventory[],
	candidate: TestFileInventory[],
	dispositions: VitestOnlyDisposition[] = [],
): ParityResult {
	const reasons: string[] = [];
	const referenceByPath = new Map(
		reference.map((file) => [file.relativePath, file]),
	);
	const candidateByPath = new Map(
		candidate.map((file) => [file.relativePath, file]),
	);
	const dispositionByPath = new Map<string, VitestOnlyDisposition>();
	for (const disposition of dispositions) {
		const error = dispositionError(disposition);
		if (error) reasons.push(error);
		if (dispositionByPath.has(disposition.file))
			reasons.push(`duplicate Vitest-only disposition for ${disposition.file}`);
		dispositionByPath.set(disposition.file, disposition);
	}
	const missingFiles: string[] = [];
	for (const [path, referenceFile] of referenceByPath) {
		const disposition = dispositionByPath.get(path);
		const candidateFile = candidateByPath.get(path);
		if (!candidateFile) {
			missingFiles.push(path);
			if (!disposition || dispositionError(disposition))
				reasons.push(`missing Bun twin: ${path}`);
			continue;
		}
		if (disposition) reasons.push(`stale Vitest-only disposition: ${path}`);
		else compareStaticFile(referenceFile, candidateFile, reasons);
	}
	const extraFiles: string[] = [];
	for (const path of candidateByPath.keys())
		if (!referenceByPath.has(path)) {
			extraFiles.push(path);
			reasons.push(`extra Bun test without Vitest twin: ${path}`);
		}
	for (const disposition of dispositions)
		if (!referenceByPath.has(disposition.file))
			reasons.push(`stale Vitest-only disposition: ${disposition.file}`);
	const sortedReasons = [...new Set(reasons)].sort();
	return {
		ok: sortedReasons.length === 0,
		valid: sortedReasons.length === 0,
		reasons: sortedReasons,
		reference: [...reference].sort((a, b) =>
			a.relativePath.localeCompare(b.relativePath),
		),
		candidate: [...candidate].sort((a, b) =>
			a.relativePath.localeCompare(b.relativePath),
		),
		missingFiles: missingFiles.sort(),
		extraFiles: extraFiles.sort(),
		dispositions,
	};
}

export function compareRuntimeOutcomes(
	reference: RuntimeOutcome,
	candidate: RuntimeOutcome,
): RuntimeParityResult {
	const reasons: string[] = [];
	for (const field of [
		"testFileCount",
		"filesPassed",
		"filesFailed",
		"testsPassed",
		"testsFailed",
		"testsSkipped",
		"testsTodo",
	] as const) {
		if (reference[field] !== candidate[field])
			reasons.push(
				`runtime outcome ${field} mismatch: reference=${reference[field]}, candidate=${candidate[field]}`,
			);
	}
	if (
		reference.leafTests &&
		candidate.leafTests &&
		reference.leafTests.join("\n") !== candidate.leafTests.join("\n")
	)
		reasons.push("runtime leaf test identities differ");
	return { ok: reasons.length === 0, reasons };
}

export function formatParityFailure(result: ParityResult): string {
	if (result.ok)
		return `Parity passed: ${result.reference.length} reference and ${result.candidate.length} candidate files match.`;
	return [
		"Parity failed:",
		...result.reasons.map((reason) => `- ${reason}`),
	].join("\n");
}
