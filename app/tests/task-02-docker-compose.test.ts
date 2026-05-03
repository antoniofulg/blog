import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

describe("unit: docker-compose.yml", () => {
	let content: string;

	beforeAll(() => {
		content = readFileSync(join(root, "docker-compose.yml"), "utf8");
	});

	it("is valid YAML (docker compose config exits 0)", () => {
		expect(() =>
			execSync("docker compose config", { cwd: root, stdio: "pipe" }),
		).not.toThrow();
	});

	it("health check command is pg_isready -U blog", () => {
		expect(content).toContain("pg_isready -U blog");
	});

	it("postgres_data volume declared in top-level volumes key", () => {
		const topLevelVolumesIdx = content.indexOf("\nvolumes:");
		expect(topLevelVolumesIdx).toBeGreaterThan(-1);
		const afterVolumes = content.slice(topLevelVolumesIdx);
		expect(afterVolumes).toContain("postgres_data:");
	});
});

// Integration tests require port 5432 to be free on the host.
// If another service owns port 5432, stop it before running these tests.
describe.skipIf(!port5432Free)("integration: docker compose lifecycle", () => {
	afterAll(() => {
		try {
			execSync("docker compose down -v", { cwd: root, stdio: "pipe" });
		} catch {
			// No-op — already cleaned up or never started
		}
	}, 60_000);

	it("docker compose up -d exits 0", () => {
		expect(() =>
			execSync("docker compose up -d", {
				cwd: root,
				stdio: "pipe",
				timeout: 120_000,
			}),
		).not.toThrow();
	}, 120_000);

	it("db service reaches healthy within 30 seconds", async () => {
		const deadline = Date.now() + 30_000;
		while (Date.now() < deadline) {
			const output = execSync("docker compose ps", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			if (output.includes("healthy")) return;
			await new Promise((r) => setTimeout(r, 1_000));
		}
		throw new Error("db service did not reach healthy within 30 seconds");
	}, 35_000);

	// Uses psql bundled in postgres:16-alpine — no host psql required
	it("database reachable via psql", () => {
		expect(() =>
			execSync("docker exec blog-db-1 psql -U blog blog -c '\\l'", {
				cwd: root,
				stdio: "pipe",
			}),
		).not.toThrow();
	});

	it("docker compose down -v exits 0", () => {
		expect(() =>
			execSync("docker compose down -v", {
				cwd: root,
				stdio: "pipe",
				timeout: 60_000,
			}),
		).not.toThrow();
	}, 60_000);
});
