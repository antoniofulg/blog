#!/usr/bin/env bun

import * as ts from "typescript";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const E2E_DIR = join(import.meta.dirname, "..", "tests", "e2e");
const MAX_AGE_HOURS = 48;
const DATE_RE = /\/\/\s*added:\s*(\d{4}-\d{2}-\d{2})/;

function findDateComment(lines: string[], lineIndex: number): string | null {
	const sameLine = lines[lineIndex] ?? "";
	const m1 = sameLine.match(DATE_RE);
	if (m1) return m1[1];

	if (lineIndex > 0) {
		const prevLine = lines[lineIndex - 1] ?? "";
		const m2 = prevLine.match(DATE_RE);
		if (m2) return m2[1];
	}

	return null;
}

export function computeAgeHours(isoDate: string): number {
	const added = new Date(`${isoDate}T00:00:00Z`);
	const now = new Date();
	return (now.getTime() - added.getTime()) / (1000 * 60 * 60);
}

function isFlakyTagArray(node: ts.Expression): boolean {
	if (!ts.isArrayLiteralExpression(node)) return false;
	return node.elements.some(
		(el) => ts.isStringLiteral(el) && el.text === "@flaky",
	);
}

function hasFlakyTag(callExpr: ts.CallExpression): boolean {
	for (const arg of callExpr.arguments) {
		if (!ts.isObjectLiteralExpression(arg)) continue;
		for (const prop of arg.properties) {
			if (
				ts.isPropertyAssignment(prop) &&
				ts.isIdentifier(prop.name) &&
				prop.name.text === "tag" &&
				isFlakyTagArray(prop.initializer)
			) {
				return true;
			}
		}
	}
	return false;
}

export function scanFile(content: string, relPath: string): string[] {
	const offenses: string[] = [];
	const lines = content.split("\n");

	const sourceFile = ts.createSourceFile(
		relPath,
		content,
		ts.ScriptTarget.Latest,
		true,
	);

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node)) {
			const callee = node.expression;
			let annotation: string | null = null;

			if (
				ts.isPropertyAccessExpression(callee) &&
				ts.isIdentifier(callee.expression) &&
				callee.expression.text === "test"
			) {
				const prop = callee.name.text;
				if (prop === "skip") annotation = "test.skip";
				else if (prop === "todo") annotation = "test.todo";
			}

			if (
				annotation === null &&
				ts.isIdentifier(callee) &&
				callee.text === "test" &&
				hasFlakyTag(node)
			) {
				annotation = "@flaky";
			}

			if (annotation !== null) {
				const { line } = sourceFile.getLineAndCharacterOfPosition(
					node.getStart(),
				);
				const dateStr = findDateComment(lines, line);

				if (!dateStr) {
					offenses.push(
						`${relPath}:${line + 1}: ${annotation} missing ISO-date comment`,
					);
				} else {
					const hours = computeAgeHours(dateStr);
					if (hours > MAX_AGE_HOURS) {
						offenses.push(
							`${relPath}:${line + 1}: ${annotation} is ${Math.floor(hours)}h old, exceeds 48h SLA`,
						);
					}
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return offenses;
}

async function safeReaddir(dir: string) {
	try {
		return await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
}

export async function scanDir(dir: string, cwd: string): Promise<string[]> {
	const allOffenses: string[] = [];

	async function walkDir(currentDir: string): Promise<void> {
		const entries = await safeReaddir(currentDir);
		for (const entry of entries) {
			const name = entry.name as string;
			const full = join(currentDir, name);
			if (entry.isDirectory()) {
				await walkDir(full);
			} else if (entry.isFile() && name.endsWith(".ts")) {
				const content = await readFile(full, "utf-8");
				const relPath = relative(cwd, full);
				allOffenses.push(...scanFile(content, relPath));
			}
		}
	}

	await walkDir(dir);
	return allOffenses;
}

if (import.meta.main) {
	const offenses = await scanDir(E2E_DIR, process.cwd());
	for (const o of offenses) console.log(o);
	if (offenses.length > 0) process.exit(1);
}
