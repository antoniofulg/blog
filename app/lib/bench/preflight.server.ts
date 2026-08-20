import "@tanstack/react-start/server-only";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { loadavg } from "node:os";
import { promisify } from "node:util";
import { installCommand, toolchainFor } from "#/lib/bench/versions";
import type { Workload } from "#/lib/bench/workloads";
import { getPostInventory } from "#/lib/site-model.server";

const run = promisify(execFile);

/** Above this one-minute load average the machine is too busy to measure. */
export const LOAD_AVG_LIMIT = 2.0;

/** Port the runtime workload boots the production bundle on. Deliberately not
 * 4173, which the e2e harness and the FE audit already use. */
export const RUNTIME_PORT = 4174;

/** Name of the Postgres service in docker-compose.yml. */
export const DB_SERVICE = "db";

export type PreflightResult = { ok: true } | { ok: false; reason: string };

export type PreflightDeps = {
	bunVersion: (binary: string) => Promise<string | null>;
	loadAvg1: () => number;
	dockerAvailable: () => Promise<boolean>;
	dbContainerRunning: () => Promise<boolean>;
	portOwner: (port: number) => Promise<number | null>;
	runtimeRoutes: () => Promise<string[]>;
};

async function readBunVersion(binary: string): Promise<string | null> {
	try {
		await access(binary);
		const { stdout } = await run(binary, ["--version"]);
		return stdout.trim();
	} catch {
		return null;
	}
}

async function dockerAvailable(): Promise<boolean> {
	try {
		await run("docker", ["version", "--format", "{{.Server.Version}}"]);
		return true;
	} catch {
		return false;
	}
}

async function dbContainerRunning(): Promise<boolean> {
	try {
		const { stdout } = await run("docker", [
			"compose",
			"ps",
			"--status=running",
			"--format",
			"{{.Service}}",
		]);
		return stdout.split("\n").some((line) => line.trim() === DB_SERVICE);
	} catch {
		return false;
	}
}

/**
 * PID listening on `port`, or null when nothing is. `lsof -ti` exits 1 with no
 * output when there is no match, which is the only failure that means "free" —
 * any other error is reported as unknown rather than silently as free.
 */
export async function portOwner(port: number): Promise<number | null> {
	try {
		const { stdout } = await run("lsof", ["-ti", `tcp:${port}`]);
		const pid = Number.parseInt(stdout.trim().split("\n")[0] ?? "", 10);
		return Number.isFinite(pid) ? pid : null;
	} catch (error) {
		const code = (error as { code?: number }).code;
		if (code === 1) return null; // no listener — the normal empty result
		throw new Error(
			`could not determine whether port ${port} is free: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * The four SSR routes the runtime workload hits. Sourced from the post
 * inventory rather than hardcoded, so a renamed post fails preflight instead
 * of silently measuring a 404 path.
 */
export async function resolveRuntimeRoutes(): Promise<string[]> {
	const posts = await getPostInventory();
	const en = posts.find(
		(p) => p.lang === "en" && p.hasTwin && p.frontmatter.draft !== true,
	);
	const ptBr = posts.find(
		(p) =>
			p.lang === "pt-br" && p.slug === en?.slug && p.frontmatter.draft !== true,
	);
	const routes = ["/", "/blog"];
	if (en) routes.push(`/${en.slug}`);
	if (ptBr) routes.push(`/pt-br/${ptBr.slug}`);
	return routes;
}

export const defaultPreflightDeps: PreflightDeps = {
	bunVersion: readBunVersion,
	loadAvg1: () => loadavg()[0],
	dockerAvailable,
	dbContainerRunning,
	portOwner,
	runtimeRoutes: resolveRuntimeRoutes,
};

export type PreflightOpts = {
	versions: string[];
	workloads: Workload[];
	allowNoisy: boolean;
	includeRuntime: boolean;
	cwd: string;
};

/**
 * Refuses to start a run that cannot produce publishable numbers. Returns a
 * reason rather than throwing so the entry point owns the exit code.
 */
export async function preflight(
	opts: PreflightOpts,
	deps: PreflightDeps = defaultPreflightDeps,
): Promise<PreflightResult> {
	for (const version of opts.versions) {
		const { binary } = toolchainFor(version, opts.cwd);
		const found = await deps.bunVersion(binary);
		if (found === null) {
			return {
				ok: false,
				reason: `bun ${version} is not installed at ${binary}. Install it with:\n  ${installCommand(version, opts.cwd)}`,
			};
		}
		if (found !== version) {
			return {
				ok: false,
				reason: `${binary} reports ${found}, expected ${version}. Reinstall it with:\n  ${installCommand(version, opts.cwd)}`,
			};
		}
	}

	const load = deps.loadAvg1();
	if (load > LOAD_AVG_LIMIT && !opts.allowNoisy) {
		return {
			ok: false,
			reason: `1-minute load average is ${load.toFixed(2)}, above the ${LOAD_AVG_LIMIT.toFixed(1)} limit. Wait for a quiet machine, or pass --allow-noisy to measure anyway.`,
		};
	}

	if (opts.workloads.some((w) => w.needsDb)) {
		if (!(await deps.dockerAvailable())) {
			return {
				ok: false,
				reason:
					"Docker is not available, and a selected workload needs the database. Install or start Docker, then run `docker compose up db -d`.",
			};
		}
		if (!(await deps.dbContainerRunning())) {
			return {
				ok: false,
				reason: `The \`${DB_SERVICE}\` container is not running, and a selected workload needs the database. Start it with \`docker compose up ${DB_SERVICE} -d\`.`,
			};
		}
	}

	if (opts.includeRuntime) {
		const owner = await deps.portOwner(RUNTIME_PORT);
		if (owner !== null) {
			return {
				ok: false,
				reason: `Port ${RUNTIME_PORT} is already bound by PID ${owner}. Free it before measuring, or the runtime numbers will describe someone else's server.`,
			};
		}
		const routes = await deps.runtimeRoutes();
		if (!routes.some((r) => r.startsWith("/pt-br/"))) {
			return {
				ok: false,
				reason:
					"No published pt-br post with an English twin was found, so the runtime workload has no pt-br route to measure. Publish one or drop the runtime workload.",
			};
		}
	}

	return { ok: true };
}
