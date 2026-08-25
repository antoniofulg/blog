import { execFile, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { E2E_STATE_FILE, default as seedE2E } from "../../tests/e2e/global-setup";

const BASE_URL = "http://localhost:4173";
const START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;
const PORT_RELEASE_TIMEOUT_MS = 120_000;
const exec = promisify(execFile);

export type LocalE2EServer = {
	baseUrl: string;
	stop: () => Promise<void>;
};

async function waitForHttp(url: string, childExited: () => boolean): Promise<void> {
	const deadline = Date.now() + START_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (childExited()) throw new Error("E2E server exited before becoming ready");
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// Server is still starting.
		}
		await Bun.sleep(100);
	}
	throw new Error(`E2E server did not become ready within ${START_TIMEOUT_MS}ms`);
}

export async function waitForLocalE2EServerRelease(): Promise<void> {
	const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
	let freeSince: number | undefined;
	while (Date.now() < deadline) {
		try {
			const { stdout } = await exec("lsof", ["-nP", "-iTCP:4173", "-sTCP:LISTEN", "-t"]);
			if (stdout.trim()) {
				freeSince = undefined;
			} else {
				freeSince ??= Date.now();
				if (Date.now() - freeSince >= 500) return;
			}
		} catch {
			freeSince ??= Date.now();
			if (Date.now() - freeSince >= 500) return;
		}
		await Bun.sleep(100);
	}
	throw new Error(`E2E server port remained occupied after ${PORT_RELEASE_TIMEOUT_MS}ms`);
}

export async function startLocalE2EServer(options?: {
	quiet?: boolean;
}): Promise<LocalE2EServer> {
	await waitForLocalE2EServerRelease();
	await rm(E2E_STATE_FILE, { force: true });
	const child = spawn("bun", ["run", "scripts/e2e-server.ts"], {
		cwd: process.cwd(),
		detached: true,
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let output = "";
	const capture = (chunk: Uint8Array, stream: NodeJS.WriteStream) => {
		output = `${output}${String(chunk)}`.slice(-4_000);
		if (!options?.quiet) stream.write(chunk);
	};
	child.stdout?.on("data", (chunk) => capture(chunk, process.stdout));
	child.stderr?.on("data", (chunk) => capture(chunk, process.stderr));
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
			try {
				await waitForLocalE2EServerRelease();
			} catch {
				// A delayed listener is rechecked strictly by the next start.
			}
		},
	};
}
