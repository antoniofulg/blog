import {
	parseBunTestSummary,
	parseVitestSummary,
} from "#/lib/test-bench/runner.server";
import type { TestArmSample, TestOutcome } from "#/lib/test-bench/types";
import type { ParityResult } from "#/lib/test-migration/parity";

type ShadowSample = Pick<TestArmSample, "exitCode" | "timedOut" | "outcome">;

export type ShadowRunRecord = {
	timestamp: string;
	commit: string;
	validComparison: boolean;
	noisy?: boolean;
	noiseEvidence?: string;
	loadAvg1?: number;
	inventory: { ok: boolean; reasons: string[] };
	/** Bun + Vitest, the reference runner for this shadow comparison. */
	reference?: ShadowSample;
	/** Bun Test, the candidate runner. */
	candidate?: ShadowSample;
	/** Kept for compatibility with the benchmark result shape. */
	samples: ShadowSample[];
};

export type ShadowRunInput = {
	parity: Pick<ParityResult, "ok" | "reasons">;
	referenceStatus?: number;
	referenceOutput?: string;
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

export function isPgliteHookTimeout(output: string): boolean {
	return (
		/pg[_ -]?lite/i.test(output) &&
		/(?:hook|before(?:all|each)|after(?:all|each)).*(?:timed?\s*out|timeout)|(?:timed?\s*out|timeout).*(?:hook|before(?:all|each)|after(?:all|each))/i.test(
			output,
		)
	);
}

export function createShadowRunRecord(input: ShadowRunInput): ShadowRunRecord {
	const referenceFailed =
		input.referenceStatus === undefined || input.referenceStatus !== 0;
	const candidateFailed = input.bunStatus !== 0;
	const referenceOutput = input.referenceOutput ?? "";
	const referenceOutcome = input.referenceOutput
		? parseVitestSummary(input.referenceOutput)
		: null;
	const candidateOutcome = parseBunTestSummary(input.bunOutput);
	const noisy =
		(referenceFailed && isPgliteHookTimeout(referenceOutput)) ||
		(candidateFailed && isPgliteHookTimeout(input.bunOutput));
	const reference: ShadowSample = {
		exitCode: input.referenceStatus ?? null,
		timedOut: referenceFailed && /timed?\s*out|timeout/i.test(referenceOutput),
		outcome: referenceOutcome,
	};
	const candidate: ShadowSample = {
		exitCode: candidateFailed ? input.bunStatus : 0,
		timedOut: candidateFailed && /timed?\s*out|timeout/i.test(input.bunOutput),
		outcome: candidateOutcome,
	};
	const outcomeReasons = outcomeMismatches(referenceOutcome, candidateOutcome);
	const failedOutcome = [referenceOutcome, candidateOutcome].some(
		(outcome) =>
			outcome !== null && (outcome.filesFailed > 0 || outcome.testsFailed > 0),
	);
	return {
		timestamp: input.timestamp,
		commit: input.commit,
		validComparison:
			input.parity.ok &&
			!referenceFailed &&
			!candidateFailed &&
			referenceOutcome !== null &&
			candidateOutcome !== null &&
			!failedOutcome &&
			!noisy &&
			outcomeReasons.length === 0,
		noisy,
		...(noisy ? { noiseEvidence: "PGLite hook timeout" } : {}),
		...(input.loadAvg1 === undefined ? {} : { loadAvg1: input.loadAvg1 }),
		inventory: { ok: input.parity.ok, reasons: [...input.parity.reasons] },
		reference,
		candidate,
		samples: [candidate],
	};
}

const OUTCOME_FIELDS: Array<keyof TestOutcome> = [
	"testFileCount",
	"filesPassed",
	"filesFailed",
	"testsPassed",
	"testsFailed",
];

function outcomeMismatches(
	reference: TestOutcome | null,
	candidate: TestOutcome | null,
): string[] {
	if (!reference || !candidate) return ["reference/candidate outcome missing"];
	const reasons: string[] = [];
	for (const field of OUTCOME_FIELDS) {
		if (reference[field] !== candidate[field]) {
			reasons.push(
				`reference/candidate outcome ${field} mismatch: reference=${reference[field]}, candidate=${candidate[field]}`,
			);
		}
	}
	const referenceSkipped = reference.leafTestsSkipped ?? reference.testsSkipped;
	const candidateSkipped = candidate.leafTestsSkipped ?? candidate.testsSkipped;
	if (referenceSkipped !== candidateSkipped) {
		reasons.push(
			`reference/candidate outcome leafTestsSkipped mismatch: reference=${referenceSkipped}, candidate=${candidateSkipped}`,
		);
	}
	return reasons;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseShadowRun(value: unknown): ShadowRunRecord | undefined {
	if (!isRecord(value)) return undefined;
	const inventory = value.inventory;
	const samples = value.samples;
	const reference = parseShadowSample(value.reference);
	const candidate = parseShadowSample(value.candidate);
	if (
		typeof value.timestamp !== "string" ||
		Number.isNaN(Date.parse(value.timestamp)) ||
		typeof value.commit !== "string" ||
		typeof value.validComparison !== "boolean" ||
		!isRecord(inventory) ||
		typeof inventory.ok !== "boolean" ||
		!Array.isArray(inventory.reasons) ||
		!Array.isArray(samples) ||
		!reference ||
		!candidate
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
		reference,
		candidate,
		samples: samples
			.filter(isRecord)
			.map(parseShadowSample)
			.filter((sample): sample is ShadowSample => sample !== undefined),
	};
}

function parseOutcome(value: unknown): TestOutcome | null {
	if (!isRecord(value)) return null;
	const fields = [
		"filesPassed",
		"filesFailed",
		"testsPassed",
		"testsFailed",
		"testsSkipped",
		"leafTestsSkipped",
		"testFileCount",
	] as const;
	if (!fields.every((field) => typeof value[field] === "number")) return null;
	return value as unknown as TestOutcome;
}

function parseShadowSample(value: unknown): ShadowSample | undefined {
	if (!isRecord(value)) return undefined;
	if (
		(value.exitCode !== null && typeof value.exitCode !== "number") ||
		typeof value.timedOut !== "boolean"
	)
		return undefined;
	const outcome = parseOutcome(value.outcome);
	if (!outcome) return undefined;
	return {
		exitCode: value.exitCode as number | null,
		timedOut: value.timedOut,
		outcome,
	};
}

function green(run: ShadowRunRecord): boolean {
	return (
		run.validComparison &&
		!run.noisy &&
		run.inventory.ok &&
		run.inventory.reasons.length === 0 &&
		run.samples.length > 0 &&
		run.reference !== undefined &&
		run.candidate !== undefined &&
		run.reference.exitCode === 0 &&
		run.candidate.exitCode === 0 &&
		!run.reference.timedOut &&
		!run.candidate.timedOut &&
		outcomeMismatches(run.reference.outcome, run.candidate.outcome).length ===
			0 &&
		run.reference.outcome !== null &&
		run.candidate.outcome !== null &&
		run.reference.outcome.filesFailed === 0 &&
		run.reference.outcome.testsFailed === 0 &&
		run.candidate.outcome.filesFailed === 0 &&
		run.candidate.outcome.testsFailed === 0 &&
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
	const commits = new Set(runs.map((run) => run.commit));
	if (commits.size !== runs.length) reasons.push("duplicate shadow commits");
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
		const run = ordered[index];
		if (!green(run)) {
			if (run.noisy) reasons.push("latest suffix reset by noisy run");
			else if (!run.inventory.ok)
				reasons.push("latest suffix reset by inventory mismatch");
			else if (
				run.reference &&
				run.candidate &&
				outcomeMismatches(run.reference.outcome, run.candidate.outcome).length >
					0
			)
				reasons.push("latest suffix reset by outcome mismatch");
			else if (run.reference?.timedOut || run.candidate?.timedOut)
				reasons.push("latest suffix reset by timeout");
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
