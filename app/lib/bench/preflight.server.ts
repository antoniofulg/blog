import "@tanstack/react-start/server-only";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { cpus, loadavg } from "node:os";
import { promisify } from "node:util";
import postgres from "postgres";
import { installCommand, toolchainFor } from "#/lib/bench/versions";
import type { Workload } from "#/lib/bench/workloads";
import { getPostInventory } from "#/lib/site-model.server";

const run = promisify(execFile);

/**
 * Maximum share of the machine's cores that may already be busy. Expressed per
 * core because a raw load average means nothing without the core count: 2.0 is
 * full saturation on a dual-core box and 3% of a 64-core one.
 *
 * 0.25 is a judgement call, not a measurement: below it a measured process can
 * hold a core without timesharing. Override the whole check with --allow-noisy.
 */
export const LOAD_PER_CORE_LIMIT = 0.25;

/** Absolute limit for this machine, given its core count. */
export function loadLimitFor(cores: number): number {
	return LOAD_PER_CORE_LIMIT * Math.max(cores, 1);
}

/** Default port the runtime workload boots the production bundle on when the
 * operator does not pin one. Deliberately not 4173, which the e2e harness and
 * the FE audit already use. */
export const RUNTIME_PORT = 4174;

/** Name of the Postgres service in docker-compose.yml. */
export const DB_SERVICE = "db";

export type PreflightResult = { ok: true } | { ok: false; reason: string };

export type DbIdentity =
	| { kind: "ok" }
	| { kind: "unreachable"; message: string }
	| { kind: "wrong-database"; database: string };

export type PreflightDeps = {
	bunVersion: (binary: string) => Promise<string | null>;
	loadAvg1: () => number;
	cores: () => number;
	dockerAvailable: () => Promise<boolean>;
	dbContainerRunning: () => Promise<boolean>;
	portOwner: (port: number) => Promise<number | null>;
	runtimeRoutes: () => Promise<string[]>;
	dbIdentity: () => Promise<DbIdentity>;
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
	// `/` and `/pt-br/` are the two locale home routes. There is no `/blog`
	// route in this app — an earlier version of this list assumed one, and a
	// quarter of every load phase went to a 404 that both versions served
	// cheaply, flattering the absolute latency and throughput numbers.
	const routes = ["/", "/pt-br/"];
	if (en) routes.push(`/${en.slug}`);
	if (ptBr) routes.push(`/pt-br/${ptBr.slug}`);
	return routes;
}

/**
 * Confirms DATABASE_URL reaches this blog's database rather than some other
 * project's Postgres on the same port. Without it, a misconfigured connection
 * fails partway through the matrix and gets recorded as a `compat` finding —
 * a database problem misattributed to a Bun version, in a published post.
 */
export async function checkDbIdentity(): Promise<DbIdentity> {
	const url = process.env.DATABASE_URL;
	if (!url) {
		return { kind: "unreachable", message: "DATABASE_URL is not set" };
	}
	const sql = postgres(url, {
		max: 1,
		connect_timeout: 5,
		onnotice: () => {},
	});
	try {
		const [row] = await sql<{ db: string; posts: string | null }[]>`
			SELECT current_database() AS db, to_regclass('public.posts')::text AS posts
		`;
		if (row?.posts === null) {
			return { kind: "wrong-database", database: row.db };
		}
		return { kind: "ok" };
	} catch (error) {
		return {
			kind: "unreachable",
			message: error instanceof Error ? error.message : String(error),
		};
	} finally {
		await sql.end().catch(() => {});
	}
}

export const defaultPreflightDeps: PreflightDeps = {
	bunVersion: readBunVersion,
	loadAvg1: () => loadavg()[0],
	cores: () => cpus().length,
	dockerAvailable,
	dbContainerRunning,
	portOwner,
	runtimeRoutes: resolveRuntimeRoutes,
	dbIdentity: checkDbIdentity,
};

export type PreflightOpts = {
	versions: string[];
	workloads: Workload[];
	allowNoisy: boolean;
	includeRuntime: boolean;
	cwd: string;
	/** Runtime port the operator pinned, if any. Unpinned means the harness
	 * picks a free port and no conflict is possible. */
	runtimePort?: number;
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
	const cores = deps.cores();
	const limit = loadLimitFor(cores);
	if (load > limit && !opts.allowNoisy) {
		const busy = ((load / cores) * 100).toFixed(0);
		return {
			ok: false,
			reason: `1-minute load average is ${load.toFixed(2)} on ${cores} cores — roughly ${busy}% of the machine is already busy, above the ${limit.toFixed(2)} limit (${LOAD_PER_CORE_LIMIT} per core). Close what you can and retry, or pass --allow-noisy. Numbers taken now will mostly land inside the noise band, so the report will read "within noise" for almost everything.`,
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
		const identity = await deps.dbIdentity();
		if (identity.kind === "unreachable") {
			return {
				ok: false,
				reason: `DATABASE_URL does not connect: ${identity.message}. Check that POSTGRES_PORT in .env matches the port in DATABASE_URL.`,
			};
		}
		if (identity.kind === "wrong-database") {
			return {
				ok: false,
				reason: `DATABASE_URL reaches database "${identity.database}", which has no \`posts\` table — that is not this blog's database. Another project's Postgres is probably on the same port; change POSTGRES_PORT in .env and mirror it in DATABASE_URL.`,
			};
		}
	}

	if (opts.includeRuntime) {
		// Only a pinned port can conflict. Left unpinned, the harness binds a
		// free ephemeral port at boot time, so there is nothing to check.
		if (opts.runtimePort !== undefined) {
			const owner = await deps.portOwner(opts.runtimePort);
			if (owner !== null) {
				return {
					ok: false,
					reason: `Port ${opts.runtimePort} is already bound by PID ${owner}. Free it, pick another with --runtime-port, or drop the flag and let the harness choose a free port.`,
				};
			}
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
