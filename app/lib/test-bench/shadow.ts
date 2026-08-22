import type { TestArmSample, TestOutcome } from "#/lib/test-bench/types";
import type { ParityResult } from "#/lib/test-migration/parity";

export type ShadowRunRecord = {
	timestamp: string;
	commit: string;
	validComparison: boolean;
	noisy?: boolean;
	noiseEvidence?: string;
	loadAvg1?: number;
	inventory: { ok: boolean; reasons: string[] };
	samples: Pick<TestArmSample, "exitCode" | "timedOut" | "outcome">[];
};

export type ShadowRunInput = {
	parity: Pick<ParityResult, "ok" | "reasons">;
	bunStatus: number;
	bunOutput: string;
	commit: string;
	timestamp: string;
	loadAvg1?: number;
};

export type ShadowEligibility = {
	eligible: boolean;
	consecutiveGreen: number;
	reasons: string[];
};

const GREEN_THRESHOLD = 10;

function count(output: string, word: string): number {
	return Number.parseInt(
		output.match(new RegExp(`(\\d+)\\s+${word}\\b`, "i"))?.[1] ?? "0",
		10,
	);
}

function parseBunOutcome(output: string): TestOutcome | null {
	const ran = output.match(/Ran\s+(\d+)\s+tests?\s+across\s+(\d+)\s+files?/i);
	if (!ran) return null;
	const testsFailed = count(output, "fail");
	return {
		filesPassed: testsFailed === 0 ? Number.parseInt(ran[2], 10) : 0,
		filesFailed: testsFailed > 0 ? Number.parseInt(ran[2], 10) : 0,
		testsPassed: count(output, "pass"),
		testsFailed,
		testsSkipped: count(output, "skip"),
		testFileCount: Number.parseInt(ran[2], 10),
	};
}

export function isPgliteHookTimeout(output: string): boolean {
	return (
		/pg[_ -]?lite/i.test(output) &&
		/(?:hook|before(?:all|each)|after(?:all|each)).*(?:timed?\s*out|timeout)|(?:timed?\s*out|timeout).*(?:hook|before(?:all|each)|after(?:all|each))/i.test(
			output,
		)
	);
}

export function createShadowRunRecord(input: ShadowRunInput): ShadowRunRecord {
	const outcome = parseBunOutcome(input.bunOutput);
	const failed = input.bunStatus !== 0;
	const noisy = failed && isPgliteHookTimeout(input.bunOutput);
	return {
		timestamp: input.timestamp,
		commit: input.commit,
		validComparison:
			input.parity.ok && input.bunStatus === 0 && outcome !== null,
		noisy,
		...(noisy ? { noiseEvidence: "PGLite hook timeout" } : {}),
		...(input.loadAvg1 === undefined ? {} : { loadAvg1: input.loadAvg1 }),
		inventory: { ok: input.parity.ok, reasons: [...input.parity.reasons] },
		samples: [
			{
				exitCode: input.bunStatus === 0 ? 0 : input.bunStatus,
				timedOut: failed && /timed?\s*out|timeout/i.test(input.bunOutput),
				outcome,
			},
		],
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseShadowRun(value: unknown): ShadowRunRecord | undefined {
	if (!isRecord(value)) return undefined;
	const inventory = value.inventory;
	const samples = value.samples;
	if (
		typeof value.timestamp !== "string" ||
		Number.isNaN(Date.parse(value.timestamp)) ||
		typeof value.commit !== "string" ||
		typeof value.validComparison !== "boolean" ||
		!isRecord(inventory) ||
		typeof inventory.ok !== "boolean" ||
		!Array.isArray(inventory.reasons) ||
		!Array.isArray(samples)
	)
		return undefined;
	return {
		timestamp: value.timestamp,
		commit: value.commit,
		validComparison: value.validComparison,
		noisy: value.noisy === true,
		...(typeof value.noiseEvidence === "string"
			? { noiseEvidence: value.noiseEvidence }
			: {}),
		...(typeof value.loadAvg1 === "number" ? { loadAvg1: value.loadAvg1 } : {}),
		inventory: {
			ok: inventory.ok,
			reasons: inventory.reasons.filter(
				(reason): reason is string => typeof reason === "string",
			),
		},
		samples: samples.filter(isRecord).map((sample) => ({
			exitCode: typeof sample.exitCode === "number" ? sample.exitCode : null,
			timedOut: sample.timedOut === true,
			outcome: isRecord(sample.outcome)
				? (sample.outcome as TestArmSample["outcome"])
				: null,
		})),
	};
}

function green(run: ShadowRunRecord): boolean {
	return (
		run.validComparison &&
		!run.noisy &&
		run.inventory.ok &&
		run.inventory.reasons.length === 0 &&
		run.samples.length > 0 &&
		run.samples.every(
			(sample) =>
				sample.exitCode === 0 && !sample.timedOut && sample.outcome !== null,
		)
	);
}

export function evaluateShadowEligibility(
	results: unknown[],
): ShadowEligibility {
	if (results.length === 0) {
		return {
			eligible: false,
			consecutiveGreen: 0,
			reasons: ["no shadow results"],
		};
	}
	const parsed = results.map(parseShadowRun);
	const reasons: string[] = [];
	if (parsed.some((run) => run === undefined))
		reasons.push("malformed shadow result");
	const runs = parsed.filter(
		(run): run is ShadowRunRecord => run !== undefined,
	);
	const timestamps = new Set(runs.map((run) => run.timestamp));
	if (timestamps.size !== runs.length)
		reasons.push("duplicate shadow timestamps");
	if (reasons.length > 0 && runs.length !== results.length) {
		return {
			eligible: false,
			consecutiveGreen: 0,
			reasons: [...new Set(reasons)],
		};
	}
	const ordered = [...runs].sort(
		(a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
	);
	let consecutiveGreen = 0;
	for (let index = ordered.length - 1; index >= 0; index -= 1) {
		if (!green(ordered[index])) {
			if (ordered[index].noisy)
				reasons.push("latest suffix reset by noisy run");
			else if (!ordered[index].inventory.ok)
				reasons.push("latest suffix reset by inventory mismatch");
			else reasons.push("latest suffix reset by failed shadow run");
			break;
		}
		consecutiveGreen += 1;
	}
	if (consecutiveGreen < GREEN_THRESHOLD) {
		reasons.push(`requires ${GREEN_THRESHOLD} consecutive green shadow runs`);
	}
	return {
		eligible: reasons.length === 0 && consecutiveGreen >= GREEN_THRESHOLD,
		consecutiveGreen,
		reasons: [...new Set(reasons)],
	};
}
