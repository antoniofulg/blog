import { execFileSync, execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const makefilePath = join(root, "Makefile");
const envExamplePath = join(root, ".env.example");

function runMake(args: string[], cwd = root, env: NodeJS.ProcessEnv = {}) {
	return execFileSync("make", ["-f", makefilePath, ...args], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
		stdio: ["pipe", "pipe", "pipe"],
	});
}

function makeSetupWorkspace(databaseUrl: string) {
	const workspace = mkdtempSync(join(tmpdir(), "blog-makefile-"));
	const binDir = join(workspace, "bin");
	mkdirSync(binDir);

	writeFileSync(join(workspace, ".env.example"), readFileSync(envExamplePath));
	writeFileSync(
		join(workspace, ".env"),
		`DATABASE_URL=${databaseUrl}\nADMIN_EMAIL=admin@example.com\nADMIN_PASSWORD=changeme\n`,
	);
	writeFileSync(
		join(binDir, "docker"),
		'#!/bin/sh\nprintf \'docker %s\\n\' "$*" >> "$FAKE_COMMAND_LOG"\nexit 0\n',
		{ mode: 0o755 },
	);
	writeFileSync(
		join(binDir, "bun"),
		'#!/bin/sh\nprintf \'bun %s\\n\' "$*" >> "$FAKE_COMMAND_LOG"\nexit 0\n',
		{ mode: 0o755 },
	);
	writeFileSync(
		join(binDir, "bunx"),
		'#!/bin/sh\nprintf \'bunx %s\\n\' "$*" >> "$FAKE_COMMAND_LOG"\nexit 0\n',
		{ mode: 0o755 },
	);

	return {
		binDir,
		logPath: join(workspace, "commands.log"),
		workspace,
	};
}

describe("unit: Makefile", () => {
	it("make help exits 0 and prints all V1 targets", () => {
		const output = runMake(["help"]);

		for (const target of [
			"help",
			"setup",
			"dev",
			"dev-docker",
			"test",
			"lint",
			"format",
			"check",
			"build",
			"preview",
			"db-migrate",
			"db-generate",
			"db-seed",
			"db-reset",
			"stop",
			"restart",
			"restart-all",
			"logs",
			"shell",
			"deploy",
		]) {
			expect(output).toContain(target);
		}
	});

	it("make help output uses ANSI cyan for target names", () => {
		const output = runMake(["help"]);

		expect(output).toContain("\u001b[36m");
	});

	it("bare make uses help as the default goal", () => {
		const output = runMake([]);

		expect(output).toContain("setup");
		expect(output).toContain("dev-docker");
	});

	it("declares all V1 targets in one .PHONY list", () => {
		const content = readFileSync(makefilePath, "utf8");
		const phonyBlock = content.match(/\.PHONY:[\s\S]*?\n\n/);

		expect(phonyBlock?.[0]).toBeDefined();
		for (const target of [
			"help",
			"setup",
			"dev",
			"dev-docker",
			"build",
			"preview",
			"test",
			"lint",
			"format",
			"check",
			"db-migrate",
			"db-generate",
			"db-seed",
			"db-reset",
			"stop",
			"restart",
			"restart-all",
			"logs",
			"shell",
			"deploy",
		]) {
			expect(phonyBlock?.[0]).toContain(target);
		}
	});

	it("make setup with no .env creates .env from .env.example", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);
		execSync("rm .env", { cwd: workspace });

		runMake(["setup"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});

		expect(existsSync(join(workspace, ".env"))).toBe(true);
		expect(readFileSync(join(workspace, ".env"), "utf8")).toBe(
			readFileSync(envExamplePath, "utf8"),
		);
	});

	it("make setup runs DB startup and migration steps regardless of DATABASE_URL value", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);

		runMake(["setup"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("docker compose pull db");
		expect(commands).toContain("docker compose up db -d");
		expect(commands).toContain("docker compose exec db pg_isready -U blog");
		expect(commands).toContain("bun run db:migrate");
		expect(commands).not.toContain("bun run db:seed"); // PRD F2: setup must not seed
	});

	it("quality gate targets delegate to the expected tools", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		for (const target of ["test", "lint", "format", "check"]) {
			runMake([target], workspace, {
				FAKE_COMMAND_LOG: logPath,
				PATH: `${binDir}:${process.env.PATH}`,
			});
		}

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("bun run test");
		expect(commands).toContain("bun run lint");
		expect(commands).toContain("bun run format");
		expect(commands).toContain("bunx tsc --noEmit");
		expect(commands).not.toContain("bun run check");
		expect(commands).not.toContain("biome");
	});

	it("build and preview targets delegate to docker with configured names", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		runMake(["build", "IMAGE_NAME=custom-blog"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});
		runMake(
			["preview", "IMAGE_NAME=custom-blog", "CONTAINER_APP=custom-app"],
			workspace,
			{
				FAKE_COMMAND_LOG: logPath,
				PATH: `${binDir}:${process.env.PATH}`,
			},
		);

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("docker build -t custom-blog .");
		expect(commands).toContain(
			"docker run --rm --env-file .env --network blog -e DATABASE_URL=postgres://blog:blog@db:5432/blog -p 3000:3000 --name custom-app custom-blog",
		);
	});

	it("database targets delegate to bun scripts and db-reset drops the public schema first", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		for (const target of ["db-migrate", "db-generate", "db-seed", "db-reset"]) {
			runMake([target], workspace, {
				FAKE_COMMAND_LOG: logPath,
				PATH: `${binDir}:${process.env.PATH}`,
			});
		}

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("bun run db:migrate");
		expect(commands).toContain("bun run db:generate");
		expect(commands).toContain("bun run db:seed");
		expect(commands).toContain(
			"docker compose exec db psql -U blog -c DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
		);
	});

	it("container lifecycle targets delegate to docker compose", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		for (const target of ["stop", "restart", "restart-all", "logs", "shell"]) {
			runMake([target], workspace, {
				FAKE_COMMAND_LOG: logPath,
				PATH: `${binDir}:${process.env.PATH}`,
			});
		}

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("docker compose down");
		expect(commands).toContain("docker compose restart db");
		expect(commands).toContain("docker compose up -d");
		expect(commands).toContain("docker compose logs -f app");
		expect(commands).toContain("docker compose exec app sh");
	});

	it("dev and dev-docker targets delegate to the expected commands", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		runMake(["dev"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});
		runMake(["dev-docker"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("docker compose up db -d");
		expect(commands).toContain("bun dev");
		expect(commands).toContain("docker compose watch");
		expect(commands).not.toContain("docker compose up -d\n");
	});

	it("make deploy with no deploy script prints actionable instructions", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		const output = runMake(["deploy"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});

		expect(output).toContain("No deploy script found");
		expect(output).toContain("Create scripts/deploy.sh");
	});

	it("e2e quality targets are declared in .PHONY", () => {
		const content = readFileSync(makefilePath, "utf8");
		const phonyBlock = content.match(/\.PHONY:[\s\S]*?\n\n/);

		expect(phonyBlock?.[0]).toBeDefined();
		expect(phonyBlock?.[0]).toContain("test-e2e");
		expect(phonyBlock?.[0]).toContain("lint-tests");
	});

	it("test-e2e and lint-tests targets delegate to expected bun scripts", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);

		for (const target of ["test-e2e", "lint-tests"]) {
			runMake([target], workspace, {
				FAKE_COMMAND_LOG: logPath,
				PATH: `${binDir}:${process.env.PATH}`,
			});
		}

		const commands = readFileSync(logPath, "utf8");
		expect(commands).toContain("bun run test:e2e");
		expect(commands).toContain("bun run lint:tests");
	});

	it("make deploy runs scripts/deploy.sh when present", () => {
		const { binDir, logPath, workspace } = makeSetupWorkspace(
			"postgres://blog:custom@localhost:5432/blog",
		);
		mkdirSync(join(workspace, "scripts"));
		writeFileSync(
			join(workspace, "scripts/deploy.sh"),
			'#!/bin/sh\necho "deploy script ran"\n',
			{ mode: 0o755 },
		);

		const output = runMake(["deploy"], workspace, {
			FAKE_COMMAND_LOG: logPath,
			PATH: `${binDir}:${process.env.PATH}`,
		});

		expect(output).toContain("deploy script ran");
		expect(output).not.toContain("No deploy script found");
	});
});
