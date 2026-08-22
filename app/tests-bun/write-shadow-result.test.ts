import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateShadowEligibility } from "#/lib/test-bench/shadow";
import { writeShadowResult } from "../../scripts/write-shadow-result";

describe("CI shadow artifact writer", () => {
	test("writes a producer record that the eligibility evaluator can parse", async () => {
		const root = await mkdtemp(join(tmpdir(), "btr-shadow-writer-"));
		try {
			const parityLog = join(root, "parity.log");
			const bunLog = join(root, "bun.log");
			const output = join(root, "nested", "shadow-result.json");
			await writeFile(
				parityLog,
				"Parity passed: reference and candidate inventories match.\n",
			);
			await writeFile(bunLog, "2 pass\nRan 2 tests across 1 file.\n");
			const record = await writeShadowResult({
				parityStatus: 0,
				bunStatus: 0,
				parityLogPath: parityLog,
				bunLogPath: bunLog,
				outputPath: output,
				commit: "ci-commit",
				timestamp: "2026-08-22T00:00:00.000Z",
				loadAvg1: 0.2,
			});
			const parsed = JSON.parse(await readFile(output, "utf8")) as unknown;
			expect(record.validComparison).toBe(true);
			expect(parsed).toMatchObject({
				commit: "ci-commit",
				validComparison: true,
			});
			expect(evaluateShadowEligibility([parsed]).consecutiveGreen).toBe(1);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
