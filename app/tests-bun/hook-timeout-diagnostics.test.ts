import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnMeasured } from "#/lib/bench/runner.server";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

describe("Bun hook timeout diagnostics", () => {
	test("names the fixture and lifecycle hook within a bounded subprocess", async () => {
		const root = await mkdtemp(join(tmpdir(), "btr-hook-timeout-"));
		temporaryRoots.push(root);
		const fixture = join(root, "hook-timeout-fixture.test.ts");
		await writeFile(
			fixture,
			'import { beforeEach, test } from "bun:test";\nbeforeEach(async () => new Promise(() => {}), 25);\ntest("never runs", () => {});\n',
			"utf8",
		);
		const run = await spawnMeasured(["bun", "test", fixture], process.env, {
			timeoutMs: 3_000,
		});
		const output = `${run.stdout}\n${run.stderrTail}`;
		expect(run.exitCode).not.toBe(0);
		expect(run.timedOut).toBe(false);
		expect(run.ms).toBeLessThan(3_000);
		expect(output).toContain(basename(fixture));
		expect(output).toMatch(/beforeEach|afterEach|hook/i);
		expect(output).toMatch(/timed out|timeout/i);
	});
});
