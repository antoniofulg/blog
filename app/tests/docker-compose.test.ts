import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const composePath = join(root, "docker-compose.yml");

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);
const runComposeLifecycle = process.env.RUN_DOCKER_COMPOSE_INTEGRATION === "1";

describe("unit: docker-compose.yml", () => {
	let content: string;

	beforeAll(() => {
		content = readFileSync(composePath, "utf8");
	});

	it("is valid YAML (docker compose config exits 0)", () => {
		expect(() =>
			execSync("docker compose config", { cwd: root, stdio: "pipe" }),
		).not.toThrow();
	});

	it("defines an app service built from the dev Dockerfile target", () => {
		const config = JSON.parse(
			execSync("docker compose config --format json", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			}),
		);

		expect(config.services.app).toBeDefined();
		expect(config.services.app.build.target).toBe("dev");
		expect(config.services.app.ports).toContainEqual(
			expect.objectContaining({ target: 3000, published: "3000" }),
		);
		expect(config.services.app.environment).toEqual(
			expect.objectContaining({
				ADMIN_EMAIL: "admin@example.com",
				ADMIN_PASSWORD: "changeme",
				DATABASE_URL:
					"postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5432/POSTGRES_DB",
			}),
		);
	});

	it("loads app environment from .env", () => {
		expect(content).toMatch(/^\s+env_file: \.env$/m);
	});

	it("waits for the database healthcheck before starting app", () => {
		const config = JSON.parse(
			execSync("docker compose config --format json", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			}),
		);

		expect(config.services.app.depends_on.db).toEqual(
			expect.objectContaining({ condition: "service_healthy" }),
		);
	});

	it("declares an anonymous node_modules volume for app", () => {
		const config = JSON.parse(
			execSync("docker compose config --format json", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			}),
		);

		expect(config.services.app.volumes).toContainEqual(
			expect.objectContaining({
				type: "volume",
				target: "/app/node_modules",
			}),
		);
	});

	it("configures compose watch sync and rebuild paths", () => {
		const config = JSON.parse(
			execSync("docker compose config --format json", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			}),
		);

		expect(config.services.app.develop.watch).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: "sync",
					path: join(root, "app"),
					target: "/app/app",
				}),
				expect.objectContaining({
					action: "sync",
					path: join(root, "content"),
					target: "/app/content",
				}),
				expect.objectContaining({
					action: "rebuild",
					path: join(root, "package.json"),
				}),
				expect.objectContaining({
					action: "rebuild",
					path: join(root, "bun.lock"),
				}),
			]),
		);
	});

	it("health check command is pg_isready -U ${POSTGRES_USER}", () => {
		expect(content).toContain("pg_isready -U ${POSTGRES_USER}");
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
describe.skipIf(!runComposeLifecycle || !port5432Free)(
	"integration: docker compose lifecycle",
	() => {
		afterAll(() => {
			try {
				execSync("docker compose down", { cwd: root, stdio: "pipe" });
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

		it("compose services reach running or healthy state within 30 seconds", async () => {
			const deadline = Date.now() + 30_000;
			while (Date.now() < deadline) {
				const output = execSync("docker compose ps", {
					cwd: root,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
				});
				if (output.includes("blog-db-1") && output.includes("blog-app-1")) {
					return;
				}
				await new Promise((r) => setTimeout(r, 1_000));
			}
			throw new Error("compose services did not start within 30 seconds");
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

		it("docker compose down exits 0 without removing named volumes", () => {
			expect(() =>
				execSync("docker compose down", {
					cwd: root,
					stdio: "pipe",
					timeout: 60_000,
				}),
			).not.toThrow();

			const volumes = execSync("docker volume ls --format '{{.Name}}'", {
				cwd: root,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			expect(volumes).toContain("blog_postgres_data");
		}, 60_000);
	},
);
