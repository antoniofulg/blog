import { describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import {
	buildPreviewEnv,
	resolveAuditBaseUrl,
	waitForReady,
} from "../../scripts/run-audit-fe";

async function stop(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return;
	child.kill("SIGTERM");
	await once(child, "close");
}

describe("app-audit preview readiness", () => {
	test("forces SITE_URL to the preview origin", () => {
		const env = buildPreviewEnv(
			{ SITE_URL: "http://localhost:3000" },
			"http://localhost:49173",
		);

		expect(env.SITE_URL).toBe("http://localhost:49173");
	});

	test("resolves CLI, env, then local preview origins", () => {
		expect(
			resolveAuditBaseUrl(["--baseUrl=http://staging:8080"], {
				AUDIT_BASE_URL: "http://env:3000",
			}),
		).toBe("http://staging:8080");
		expect(resolveAuditBaseUrl([], { AUDIT_BASE_URL: "http://env:3000" })).toBe(
			"http://env:3000",
		);
		expect(resolveAuditBaseUrl([], {})).toBe("http://localhost:4173");
	});

	test("waits for the spawned child listening message", async () => {
		const child = spawn(
			process.execPath,
			[
				"-e",
				'console.log("➜ Listening on: http://localhost:4173/");setInterval(()=>{},1000)',
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		try {
			await expect(
				waitForReady(child, {
					baseUrl: "http://localhost:4173",
					fetchImpl: async () => new Response(null, { status: 200 }),
					timeoutMs: 2_000,
				}),
			).resolves.toBeUndefined();
		} finally {
			await stop(child);
		}
	});

	test("rejects when the spawned child exits before listening", async () => {
		const child = spawn(process.execPath, ["-e", "process.exit(7)"], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		await expect(
			waitForReady(child, {
				baseUrl: "http://localhost:4173",
				fetchImpl: async () => new Response(null, { status: 200 }),
				timeoutMs: 2_000,
			}),
		).rejects.toThrow("exited before becoming ready (code=7)");
	});

	test("rejects when the preview process cannot spawn", async () => {
		const child = spawn("/definitely-missing-app-audit-command", [], {
			stdio: ["ignore", "pipe", "pipe"],
		});
		await expect(
			waitForReady(child, {
				baseUrl: "http://localhost:4173",
				fetchImpl: async () => new Response(null, { status: 200 }),
				timeoutMs: 2_000,
			}),
		).rejects.toThrow("failed to spawn preview server");
	});
});
