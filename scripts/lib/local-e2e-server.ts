import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { E2E_STATE_FILE, default as seedE2E } from "../../tests/e2e/global-setup";

const BASE_URL = "http://localhost:4173";
const START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;

export type LocalE2EServer = {
	baseUrl: string;
	stop: () => Promise<void>;
};

function tail(value: string, length = 4_000): string {
	return value.slice(-length);
}

async function waitForHttp(url: string, childExited: () => boolean): Promise<void> {
	const deadline = Date.now() + START_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (childExited()) throw new Error("E2E server exited before becoming ready");
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Server is still starting.
		}
		await Bun.sleep(100);
	}
	throw new Error(`E2E server did not become ready within ${START_TIMEOUT_MS}ms`);
}

export async function startLocalE2EServer(options?: {
	quiet?: boolean;
}): Promise<LocalE2EServer> {
	await rm(E2E_STATE_FILE, { force: true });
	const child = spawn("bun", ["run", "scripts/e2e-server.ts"], {
		cwd: process.cwd(),
		detached: true,
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	child.stdout?.on("data", (chunk) => {
		output = tail(`${output}${String(chunk)}`);
		if (!options?.quiet) process.stdout.write(chunk);
	});
	child.stderr?.on("data", (chunk) => {
		output = tail(`${output}${String(chunk)}`);
		if (!options?.quiet) process.stderr.write(chunk);
	});
	let exited = false;
	const exitPromise = new Promise<number>((resolve) => {
		child.once("error", () => {
			exited = true;
			resolve(-1);
		});
		child.once("close", (code) => {
			exited = true;
			resolve(code ?? -1);
		});
	});

	try {
		await Promise.race([
			seedE2E(),
			exitPromise.then((code) => {
				throw new Error(`E2E server exited with code ${code}\n${output}`);
			}),
		]);
		await waitForHttp(BASE_URL, () => exited);
	} catch (error) {
		if (child.pid) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				// Process group already exited.
			}
		}
		throw error;
	}

	let stopped = false;
	return {
		baseUrl: BASE_URL,
		stop: async () => {
			if (stopped) return;
			stopped = true;
			child.kill("SIGTERM");
			const result = await Promise.race([
				exitPromise.then(() => "closed" as const),
				Bun.sleep(STOP_TIMEOUT_MS).then(() => "timeout" as const),
			]);
			if (result === "timeout" && child.pid) {
				try {
					process.kill(-child.pid, "SIGKILL");
				} catch {
					// Process group already exited.
				}
				await exitPromise;
			}
		},
	};
}
