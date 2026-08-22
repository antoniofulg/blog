import type { ParityResult } from "#/lib/test-migration/parity";

export type TestArmId = "A" | "B" | "C";
export type TestRunner = "vitest" | "bun:test";
export type RuntimeKind = "node" | "bun";

export type TestArm = {
	id: TestArmId;
	runner: TestRunner;
	runtime: RuntimeKind;
	runtimeVersion: string;
	runnerVersion: string;
	command: string[];
	testRoot: string;
	timeoutMs: number;
};

export type RuntimeProvenance = {
	command: string;
	execPath: string;
	runtime: RuntimeKind;
	runtimeVersion: string;
	runner: TestRunner;
	runnerVersion: string;
};

export type TestOutcome = {
	filesPassed: number;
	filesFailed: number;
	testsPassed: number;
	testsFailed: number;
	testsSkipped: number;
	testFileCount: number;
};

export type TestArmSample = {
	arm: TestArmId;
	durationMs: number;
	peakRssBytes: number;
	exitCode: number | null;
	timedOut: boolean;
	outcome: TestOutcome | null;
	provenance: RuntimeProvenance;
	loadAvg1: number;
	failureExcerpt?: string;
};

export type TestComparisonRun = {
	commit: string;
	timestamp: string;
	host: {
		host: string;
		cpuModel: string;
		cores: number;
		totalMemBytes: number;
		loadAvg1: number;
		powerSource: "ac" | "battery" | "unknown";
		startedAt: string;
	};
	samples: TestArmSample[];
	inventory: ParityResult;
	validComparison: boolean;
	invalidReasons: string[];
};

const TEST_TIMEOUT_MS = 15 * 60 * 1000;

export const TEST_ARMS: Record<TestArmId, TestArm> = {
	A: {
		id: "A",
		runner: "vitest",
		runtime: "node",
		runtimeVersion: "24",
		runnerVersion: "4.1.5",
		command: ["bun", "run", "test:vitest:node"],
		testRoot: "app/tests",
		timeoutMs: TEST_TIMEOUT_MS,
	},
	B: {
		id: "B",
		runner: "vitest",
		runtime: "bun",
		runtimeVersion: "1.4.0",
		runnerVersion: "4.1.5",
		command: ["bun", "run", "test:vitest:bun"],
		testRoot: "app/tests",
		timeoutMs: TEST_TIMEOUT_MS,
	},
	C: {
		id: "C",
		runner: "bun:test",
		runtime: "bun",
		runtimeVersion: "1.4.0",
		runnerVersion: "1.4.0",
		command: ["bun", "run", "test:bun"],
		testRoot: "app/tests-bun",
		timeoutMs: TEST_TIMEOUT_MS,
	},
};

export const TEST_ARM_IDS: TestArmId[] = ["A", "B", "C"];
