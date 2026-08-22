import { describe, expect, it } from "vitest";
import {
	createShadowRunRecord,
	evaluateShadowEligibility,
	isPgliteHookTimeout,
	type ShadowRunRecord,
} from "#/lib/test-bench/shadow";

function result(
	index: number,
	over: Partial<ShadowRunRecord> = {},
): ShadowRunRecord {
	return {
		timestamp: `2026-08-22T00:${String(index).padStart(2, "0")}:00.000Z`,
		commit: "abc",
		validComparison: true,
		inventory: { ok: true, reasons: [] },
		samples: [
			{
				exitCode: 0,
				timedOut: false,
				outcome: {
					filesPassed: 1,
					filesFailed: 0,
					testsPassed: 1,
					testsFailed: 0,
					testsSkipped: 0,
					testFileCount: 1,
				},
			},
		],
		...over,
	};
}

describe("Bun Test shadow eligibility", () => {
	it("rejects an empty history", () => {
		expect(evaluateShadowEligibility([])).toMatchObject({
			eligible: false,
			consecutiveGreen: 0,
		});
	});

	it("requires ten green runs, so nine are ineligible", () => {
		const evaluation = evaluateShadowEligibility(
			Array.from({ length: 9 }, (_, index) => result(index)),
		);
		expect(evaluation.eligible).toBe(false);
		expect(evaluation.consecutiveGreen).toBe(9);
	});

	it("marks exactly ten green runs eligible", () => {
		expect(
			evaluateShadowEligibility(
				Array.from({ length: 10 }, (_, index) => result(index)),
			).eligible,
		).toBe(true);
	});

	it("keeps an eleven-run suffix eligible", () => {
		const evaluation = evaluateShadowEligibility(
			Array.from({ length: 11 }, (_, index) => result(index)),
		);
		expect(evaluation.eligible).toBe(true);
		expect(evaluation.consecutiveGreen).toBe(11);
	});

	it("sorts by timestamp instead of input order", () => {
		const runs = Array.from({ length: 10 }, (_, index) => result(index));
		expect(evaluateShadowEligibility([...runs].reverse()).eligible).toBe(true);
	});

	it("resets the suffix after a failed run", () => {
		const runs = Array.from({ length: 10 }, (_, index) => result(index));
		runs[4].validComparison = false;
		const evaluation = evaluateShadowEligibility(runs);
		expect(evaluation.consecutiveGreen).toBe(5);
		expect(evaluation.reasons).toContain(
			"latest suffix reset by failed shadow run",
		);
	});

	it("resets after noise or inventory mismatch", () => {
		const noisy = Array.from({ length: 10 }, (_, index) => result(index));
		noisy[9].noisy = true;
		const noisyEvaluation = evaluateShadowEligibility(noisy);
		expect(noisyEvaluation.consecutiveGreen).toBe(0);
		expect(noisyEvaluation.reasons).toContain(
			"latest suffix reset by noisy run",
		);
		const mismatch = Array.from({ length: 10 }, (_, index) => result(index));
		mismatch[9].inventory = { ok: false, reasons: ["missing twin"] };
		const mismatchEvaluation = evaluateShadowEligibility(mismatch);
		expect(mismatchEvaluation.consecutiveGreen).toBe(0);
		expect(mismatchEvaluation.reasons).toContain(
			"latest suffix reset by inventory mismatch",
		);
	});

	it("reports malformed, duplicate, and mixed-commit history explicitly", () => {
		expect(
			evaluateShadowEligibility([result(0), { nope: true }]).reasons,
		).toContain("malformed shadow result");
		expect(evaluateShadowEligibility([result(0), result(0)]).reasons).toContain(
			"duplicate shadow timestamps",
		);
		expect(
			evaluateShadowEligibility(
				Array.from({ length: 10 }, (_, index) =>
					result(index, { commit: `commit-${index}` }),
				),
			).eligible,
		).toBe(true);
	});

	it("produces an evaluable record from Bun output and parity", () => {
		const record = createShadowRunRecord({
			parity: { ok: true, reasons: [] },
			bunStatus: 0,
			bunOutput: "2 pass\n1 skip\nRan 3 tests across 1 file.",
			commit: "abc",
			timestamp: "2026-08-22T00:00:00.000Z",
			loadAvg1: 0.5,
		});
		expect(record.validComparison).toBe(true);
		expect(record.samples[0].exitCode).toBe(0);
		expect(record.samples[0].outcome?.testsPassed).toBe(2);
		expect(record.loadAvg1).toBe(0.5);
		expect(evaluateShadowEligibility([record]).consecutiveGreen).toBe(1);
	});

	it("marks PGLite hook timeouts noisy but ordinary failures clean", () => {
		const noisy = "PGLite beforeEach/afterEach hook timed out after 25ms";
		expect(isPgliteHookTimeout(noisy)).toBe(true);
		expect(isPgliteHookTimeout("1 fail\nRan 1 test across 1 file.")).toBe(
			false,
		);
		expect(
			createShadowRunRecord({
				parity: { ok: true, reasons: [] },
				bunStatus: 1,
				bunOutput: noisy,
				commit: "abc",
				timestamp: "2026-08-22T00:00:00.000Z",
			}).noisy,
		).toBe(true);
	});
});
