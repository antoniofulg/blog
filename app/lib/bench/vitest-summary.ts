export type TestOutcome = {
	filesPassed: number;
	filesFailed: number;
	testsPassed: number;
	testsFailed: number;
	testsSkipped: number;
	leafTestsSkipped: number;
	testFileCount: number;
};

function counts(line: string, word: string): number {
	return Number.parseInt(
		line.match(new RegExp(`(\\d+)\\s+${word}\\b`))?.[1] ?? "0",
		10,
	);
}

function fileCount(line: string): number {
	return Number.parseInt(line.match(/\((\d+)\)/)?.[1] ?? "0", 10);
}

// biome-ignore lint/complexity/useRegexLiterals: escaped control codes stay readable in a string pattern.
const ANSI_ESCAPE = new RegExp(
	"\\u001B(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))",
	"g",
);

function normalize(line: string): string {
	return line.replace(ANSI_ESCAPE, "").trim();
}

export function parseVitestSummary(stdout: string): TestOutcome | null {
	const lines = stdout.split("\n");
	const filesLine = lines.find((line) =>
		/^Test Files\s+/.test(normalize(line)),
	);
	const testsLine = lines.find((line) => /^Tests\s+/.test(normalize(line)));
	if (!filesLine || !testsLine) return null;
	const files = normalize(filesLine);
	const tests = normalize(testsLine);
	return {
		filesPassed: counts(files, "passed"),
		filesFailed: counts(files, "failed"),
		testsPassed: counts(tests, "passed"),
		testsFailed: counts(tests, "failed"),
		testsSkipped: counts(tests, "skipped"),
		leafTestsSkipped: counts(tests, "skipped"),
		testFileCount: fileCount(files),
	};
}
