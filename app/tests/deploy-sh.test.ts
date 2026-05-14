import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const deployScript = join(root, "scripts/deploy.sh");

function makeWorkspace() {
	const workspace = mkdtempSync(join(tmpdir(), "deploy-sh-"));
	const binDir = join(workspace, "bin");
	mkdirSync(binDir);
	const logPath = join(workspace, "ssh.log");
	writeFileSync(
		join(binDir, "ssh"),
		`#!/bin/sh\nprintf 'ssh %s\\n' "$*" >> "${logPath}"\nexit 0\n`,
		{ mode: 0o755 },
	);
	writeFileSync(
		join(binDir, "scp"),
		`#!/bin/sh\nprintf 'scp %s\\n' "$*" >> "${logPath}"\nexit 0\n`,
		{ mode: 0o755 },
	);
	return { binDir, logPath };
}

const baseEnv: NodeJS.ProcessEnv = {
	HOME: process.env.HOME ?? "/tmp",
	PATH: process.env.PATH,
};

const requiredVars = {
	VPS_USER: "testuser",
	VPS_HOST: "testhost",
	DEPLOY_PATH: "/home/deploy/blog",
	GHCR_OWNER: "myowner",
	GHCR_REPO: "myblog",
};

describe("unit: scripts/deploy.sh", () => {
	it("bash -n syntax check exits 0", () => {
		const result = spawnSync("bash", ["-n", deployScript], {
			encoding: "utf8",
		});
		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
	});

	it("git tracks executable bit (mode 100755)", () => {
		const result = spawnSync(
			"git",
			["ls-files", "--stage", "scripts/deploy.sh"],
			{ cwd: root, encoding: "utf8" },
		);
		expect(result.stdout.trim()).toMatch(/^100755/);
	});

	it("SSH call includes -p 22 when VPS_PORT is unset", () => {
		const { binDir, logPath } = makeWorkspace();
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).toBe(0);
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("-p 22");
	});

	it("SSH call includes StrictHostKeyChecking=accept-new", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("StrictHostKeyChecking=accept-new");
	});

	it("SSH call includes ConnectTimeout and ServerAlive options", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("ConnectTimeout=30");
		expect(log).toContain("ServerAliveInterval=15");
		expect(log).toContain("ServerAliveCountMax=3");
	});

	it("scp pushes docker-compose.prod.yml to VPS before ssh runs", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		const scpIdx = log.indexOf("scp ");
		const sshIdx = log.indexOf("ssh ");
		expect(scpIdx).toBeGreaterThan(-1);
		expect(sshIdx).toBeGreaterThan(scpIdx);
		expect(log).toContain("docker-compose.prod.yml");
		expect(log).toContain(
			"testuser@testhost:/home/deploy/blog/docker-compose.yml",
		);
	});

	it("scp uses COMPOSE_FILE override as destination filename", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				COMPOSE_FILE: "docker-compose.prod.yml",
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain(
			"testuser@testhost:/home/deploy/blog/docker-compose.prod.yml",
		);
	});

	it("docker pull runs before migration before docker compose up", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		const pullIdx = log.indexOf("docker pull");
		const migrateIdx = log.indexOf("bun run db:migrate");
		const upIdx = log.indexOf("up -d --no-deps app");
		expect(pullIdx).toBeGreaterThan(-1);
		expect(migrateIdx).toBeGreaterThan(pullIdx);
		expect(upIdx).toBeGreaterThan(migrateIdx);
	});

	it("bun run sync runs after migrate and before docker compose up", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		const migrateIdx = log.indexOf("bun run db:migrate");
		const syncIdx = log.indexOf("bun run sync");
		const upIdx = log.indexOf("up -d --no-deps app");
		expect(syncIdx).toBeGreaterThan(-1);
		expect(syncIdx).toBeGreaterThan(migrateIdx);
		expect(upIdx).toBeGreaterThan(syncIdx);
	});

	it("runs migrations inside pulled image via docker run, not from VPS filesystem", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("docker run --rm");
		expect(log).toContain("bun run db:migrate");
		expect(log).not.toContain("make db-migrate");
	});

	it("uses docker-compose.yml (default) for app restart", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("docker-compose.yml");
		expect(log).toContain("up -d --no-deps app");
	});

	it("uses COMPOSE_FILE override when set", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				COMPOSE_FILE: "docker-compose.prod.yml",
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("docker-compose.prod.yml");
		expect(log).toContain("up -d --no-deps app");
	});

	it("uses IMAGE_TAG when set, deploying exact SHA image", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				IMAGE_TAG: "abc1234",
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("docker pull ghcr.io/myowner/myblog:abc1234");
		expect(log).toContain("IMAGE_TAG=abc1234");
		expect(log).not.toContain("docker pull ghcr.io/myowner/myblog:latest");
	});

	it("defaults to :latest tag when IMAGE_TAG is unset", () => {
		const { binDir, logPath } = makeWorkspace();
		spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...requiredVars,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		const log = readFileSync(logPath, "utf8");
		expect(log).toContain("ghcr.io/myowner/myblog:latest");
	});

	it("exits non-zero and references VPS_USER when unset", () => {
		const { binDir } = makeWorkspace();
		const { VPS_USER: _removed, ...withoutUser } = requiredVars;
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...withoutUser,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("VPS_USER");
	});

	it("exits non-zero and references DEPLOY_PATH when unset", () => {
		const { binDir } = makeWorkspace();
		const { DEPLOY_PATH: _removed, ...withoutPath } = requiredVars;
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...withoutPath,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("DEPLOY_PATH");
	});

	it("exits non-zero and references VPS_HOST when unset", () => {
		const { binDir } = makeWorkspace();
		const { VPS_HOST: _removed, ...withoutHost } = requiredVars;
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...withoutHost,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("VPS_HOST");
	});

	it("exits non-zero and references GHCR_OWNER when unset", () => {
		const { binDir } = makeWorkspace();
		const { GHCR_OWNER: _removed, ...withoutGhcrOwner } = requiredVars;
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...withoutGhcrOwner,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("GHCR_OWNER");
	});

	it("exits non-zero and references GHCR_REPO when unset", () => {
		const { binDir } = makeWorkspace();
		const { GHCR_REPO: _removed, ...withoutGhcrRepo } = requiredVars;
		const result = spawnSync("bash", [deployScript], {
			env: {
				...baseEnv,
				...withoutGhcrRepo,
				PATH: `${binDir}:${baseEnv.PATH}`,
			},
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("GHCR_REPO");
	});
});

describe("integration: make deploy", () => {
	it("make deploy with deploy script present does not print 'No deploy script found'", () => {
		const result = spawnSync("make", ["-f", join(root, "Makefile"), "deploy"], {
			cwd: root,
			env: { ...baseEnv, PATH: process.env.PATH },
			encoding: "utf8",
		});
		const combined = (result.stdout ?? "") + (result.stderr ?? "");
		expect(combined).not.toContain("No deploy script found");
	});

	it("bash scripts/deploy.sh without env vars exits non-zero with clear error", () => {
		const result = spawnSync("bash", [deployScript], {
			env: { ...baseEnv },
			encoding: "utf8",
		});
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("required");
	});
});
