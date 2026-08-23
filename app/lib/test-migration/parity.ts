import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import * as ts from "typescript";

export type TestRunner = "vitest" | "bun:test";
export type TestCohort = "pure" | "dom" | "mocks-timers" | "integration-infra";

export type MockExportInventory = {
	module: string;
	symbols: string[];
};

export type TestFileInventory = {
	relativePath: string;
	runner: TestRunner;
	cohort?: TestCohort;
	testCount: number;
	assertionCount: number;
	tests: number;
	assertions: number;
	fixturePaths: string[];
	missingFixtures: string[];
	residualVitestApis: string[];
	omissionMarkers: string[];
	mockExports: MockExportInventory[];
};

export type VitestOnlyDisposition = {
	file: string;
	reason: string;
	evidence: string;
	owner: string;
	followUp: string;
};

export type ParityResult = {
	ok: boolean;
	valid: boolean;
	reasons: string[];
	reference: TestFileInventory[];
	candidate: TestFileInventory[];
	missingFiles: string[];
	extraFiles: string[];
};

const TEST_FILE = /\.(?:test|spec)\.tsx?$/;
const OMITTED_MOCK = /partial\s+mock\s+skipped/i;

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
		if (entry.isDirectory()) {
			files.push(...(await testFiles(path)));
		} else if (entry.isFile() && TEST_FILE.test(entry.name)) {
			files.push(path);
		}
	}
	return files.sort((a, b) => normalized(a).localeCompare(normalized(b)));
}

function calleeName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (
		ts.isPropertyAccessExpression(expression) &&
		ts.isIdentifier(expression.expression)
	) {
		return expression.expression.text;
	}
	return undefined;
}

function propertyName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
	return undefined;
}

function fixtureReferences(
	source: ts.SourceFile,
	filePath: string,
): {
	paths: string[];
	missing: string[];
} {
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
	return {
		paths: [...paths].sort(),
		missing: [...missing].sort(),
	};
}

function residualVitestApis(source: ts.SourceFile, text: string): string[] {
	const found = new Set<string>();
	function visit(node: ts.Node): void {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === "vitest"
		) {
			found.add('import "vitest"');
		}
		if (ts.isIdentifier(node) && node.text === "vi") found.add("vi");
		ts.forEachChild(node, visit);
	}
	visit(source);
	if (/from\s+["']vitest["']/.test(text)) found.add('import "vitest"');
	return [...found].sort();
}

function omissionMarkers(text: string): string[] {
	const marker = text
		.split("\n")
		.find((line) =>
			/(?:^\s*\/\/|^\s*\/\*|^\s*\*|NOTE:).*partial\s+mock\s+skipped/i.test(
				line,
			),
		);
	return marker && OMITTED_MOCK.test(marker) ? ["partial mock skipped"] : [];
}

function mockCallModule(expression: ts.Expression): string | undefined {
	if (!ts.isPropertyAccessExpression(expression)) return undefined;
	if (!ts.isIdentifier(expression.expression)) return undefined;
	if (expression.name.text !== "mock" && expression.name.text !== "module")
		return undefined;
	return expression.expression.text === "vi" ||
		expression.expression.text === "mock"
		? expression.name.text
		: undefined;
}

function staticPropertyName(
	name: ts.PropertyName | undefined,
): string | undefined {
	if (!name) return undefined;
	if (
		ts.isIdentifier(name) ||
		ts.isStringLiteral(name) ||
		ts.isNumericLiteral(name)
	)
		return name.text;
	return undefined;
}

function factoryObject(
	factory: ts.Expression,
): ts.ObjectLiteralExpression | undefined {
	if (!ts.isArrowFunction(factory) && !ts.isFunctionExpression(factory))
		return undefined;
	const body = ts.isParenthesizedExpression(factory.body)
		? factory.body.expression
		: factory.body;
	if (ts.isObjectLiteralExpression(body)) return body;
	if (!ts.isBlock(body)) return undefined;
	for (const statement of body.statements) {
		if (!ts.isReturnStatement(statement) || !statement.expression) continue;
		if (ts.isObjectLiteralExpression(statement.expression))
			return statement.expression;
	}
	return undefined;
}

function mockExports(source: ts.SourceFile): MockExportInventory[] {
	const byModule = new Map<string, Set<string>>();
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && mockCallModule(node.expression)) {
			const moduleName = node.arguments[0];
			const factory = node.arguments[1];
			if (ts.isStringLiteralLike(moduleName) && factory) {
				const object = factoryObject(factory);
				if (object) {
					const symbols = byModule.get(moduleName.text) ?? new Set<string>();
					for (const property of object.properties) {
						// Spread properties are deliberately ignored: importOriginal and
						// other dynamic sources cannot be proven statically.
						if (ts.isSpreadAssignment(property)) continue;
						const name = ts.isShorthandPropertyAssignment(property)
							? property.name.text
							: staticPropertyName(property.name);
						if (name) symbols.add(name);
					}
					byModule.set(moduleName.text, symbols);
				}
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return [...byModule.entries()]
		.map(([module, symbols]) => ({ module, symbols: [...symbols].sort() }))
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
	let testCount = 0;
	let assertionCount = 0;
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const name = calleeName(node.expression);
			if (name === "test" || name === "it") testCount += 1;
			if (name === "expect") assertionCount += 1;
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	const fixtures = fixtureReferences(source, filePath);
	return {
		relativePath: normalized(relative(root, filePath)),
		runner,
		testCount,
		assertionCount,
		tests: testCount,
		assertions: assertionCount,
		fixturePaths: fixtures.paths,
		missingFixtures: fixtures.missing,
		residualVitestApis: residualVitestApis(source, text),
		omissionMarkers: omissionMarkers(text),
		mockExports: mockExports(source),
	};
}

export async function scanTestTree(
	root: string,
	runner: TestRunner,
): Promise<TestFileInventory[]> {
	const files = await testFiles(root);
	const inventory = await Promise.all(
		files.map((filePath) => scanFile(root, filePath, runner)),
	);
	return inventory.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function dispositionError(
	disposition: VitestOnlyDisposition,
): string | undefined {
	const fields: Array<keyof VitestOnlyDisposition> = [
		"file",
		"reason",
		"evidence",
		"owner",
		"followUp",
	];
	for (const field of fields) {
		if (
			typeof disposition[field] !== "string" ||
			disposition[field].trim() === ""
		) {
			return `invalid Vitest-only disposition for ${disposition.file || "<unknown>"}: ${field} is required`;
		}
	}
	return undefined;
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
		if (dispositionByPath.has(disposition.file)) {
			reasons.push(`duplicate Vitest-only disposition for ${disposition.file}`);
		}
		dispositionByPath.set(disposition.file, disposition);
	}

	const missingFiles: string[] = [];
	for (const [path, referenceFile] of referenceByPath) {
		const disposition = dispositionByPath.get(path);
		const candidateFile = candidateByPath.get(path);
		if (!candidateFile) {
			missingFiles.push(path);
			if (!disposition || dispositionError(disposition)) {
				reasons.push(`missing Bun twin: ${path}`);
			}
			continue;
		}
		if (disposition) {
			reasons.push(`stale Vitest-only disposition: ${path}`);
			continue;
		}
		if (candidateFile.testCount !== referenceFile.testCount) {
			reasons.push(
				`${path}: test declarations ${candidateFile.testCount} != ${referenceFile.testCount}`,
			);
		}
		if (candidateFile.assertionCount !== referenceFile.assertionCount) {
			reasons.push(
				`${path}: assertions ${candidateFile.assertionCount} != ${referenceFile.assertionCount}`,
			);
		}
		for (const fixture of candidateFile.missingFixtures) {
			reasons.push(`${path}: missing fixture ${fixture}`);
		}
		for (const fixture of referenceFile.fixturePaths) {
			const candidateHasFixture = candidateFile.fixturePaths.some(
				(path) => path === fixture || path.startsWith(`${fixture}/`),
			);
			if (
				!candidateHasFixture &&
				!candidateFile.missingFixtures.includes(fixture)
			) {
				reasons.push(`${path}: missing fixture twin ${fixture}`);
			}
		}
		for (const api of candidateFile.residualVitestApis) {
			reasons.push(`${path}: residual Vitest API ${api}`);
		}
		for (const marker of candidateFile.omissionMarkers) {
			reasons.push(`${path}: forbidden omission marker ${marker}`);
		}
		const candidateMocks = new Map(
			(candidateFile.mockExports ?? []).map((mock) => [
				mock.module,
				new Set(mock.symbols),
			]),
		);
		for (const referenceMock of referenceFile.mockExports ?? []) {
			const candidateSymbols = candidateMocks.get(referenceMock.module);
			for (const symbol of referenceMock.symbols) {
				if (!candidateSymbols?.has(symbol)) {
					reasons.push(
						`${path}: mock ${referenceMock.module} missing export ${symbol}`,
					);
				}
			}
		}
	}

	const extraFiles: string[] = [];
	for (const path of candidateByPath.keys()) {
		if (!referenceByPath.has(path)) {
			extraFiles.push(path);
			reasons.push(`extra Bun test without Vitest twin: ${path}`);
		}
	}
	for (const disposition of dispositions) {
		if (!referenceByPath.has(disposition.file)) {
			reasons.push(`stale Vitest-only disposition: ${disposition.file}`);
		}
	}

	const sortedReasons = [...new Set(reasons)].sort();
	const ok = sortedReasons.length === 0;
	return {
		ok,
		valid: ok,
		reasons: sortedReasons,
		reference: [...reference].sort((a, b) =>
			a.relativePath.localeCompare(b.relativePath),
		),
		candidate: [...candidate].sort((a, b) =>
			a.relativePath.localeCompare(b.relativePath),
		),
		missingFiles: missingFiles.sort(),
		extraFiles: extraFiles.sort(),
	};
}

export function formatParityFailure(result: ParityResult): string {
	if (result.ok)
		return "Parity passed: reference and candidate inventories match.";
	return [
		"Parity failed:",
		...result.reasons.map((reason) => `- ${reason}`),
	].join("\n");
}
