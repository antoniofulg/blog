import type { TestArmSample } from "#/lib/test-bench/types";

export type ShadowRunRecord = {
	timestamp: string;
	commit: string;
	validComparison: boolean;
	noisy?: boolean;
	inventory: { ok: boolean; reasons: string[] };
	samples: Pick<TestArmSample, "exitCode" | "timedOut" | "outcome">[];
};

export type ShadowEligibility = {
	eligible: boolean;
	consecutiveGreen: number;
	reasons: string[];
};

const GREEN_THRESHOLD = 10;

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
	const commits = new Set(runs.map((run) => run.commit));
	if (commits.size > 1) reasons.push("mixed shadow commits");
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
