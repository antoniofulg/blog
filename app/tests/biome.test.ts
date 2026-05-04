import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const tmpFile = join(root, "app/tests/_biome_tmp.ts");

afterEach(() => {
	if (existsSync(tmpFile)) unlinkSync(tmpFile);
});

describe("biome configuration", () => {
	it("biome check . exits 0 on clean project", () => {
		const result = execSync("bunx biome check .", {
			cwd: root,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		expect(result).toContain("No fixes applied");
	});

	it("biome check --write fixes formatting issues and exits 0", () => {
		writeFileSync(tmpFile, "const x = 'hello'\n");
		execSync(`bunx biome check --write ${tmpFile}`, {
			cwd: root,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const fixed = readFileSync(tmpFile, "utf8");
		expect(fixed).toContain('"hello"');
	});

	it("biome.json schema version matches installed biome", () => {
		const biomeJson = JSON.parse(
			readFileSync(join(root, "biome.json"), "utf8"),
		);
		expect(biomeJson.$schema).toContain("2.4.5");
	});
});

describe("tailwind configuration", () => {
	it("tailwind.config.ts content paths include app/ glob", () => {
		const config = readFileSync(join(root, "tailwind.config.ts"), "utf8");
		expect(config).toMatch(/app\/\*\*\/\*\.\{ts,tsx\}/);
	});

	it("tailwind.config.ts includes typography plugin", () => {
		const config = readFileSync(join(root, "tailwind.config.ts"), "utf8");
		expect(config).toContain("typography");
	});

	it("global.css includes tailwindcss import and typography plugin", () => {
		const css = readFileSync(join(root, "app/styles/global.css"), "utf8");
		expect(css).toContain('@import "tailwindcss"');
		expect(css).toContain('@plugin "@tailwindcss/typography"');
	});
});

describe("environment configuration", () => {
	it(".env.example contains DATABASE_URL", () => {
		const env = readFileSync(join(root, ".env.example"), "utf8");
		expect(env).toContain("DATABASE_URL=");
	});

	it(".env.example contains ADMIN_EMAIL", () => {
		const env = readFileSync(join(root, ".env.example"), "utf8");
		expect(env).toContain("ADMIN_EMAIL=");
	});

	it(".env.example contains ADMIN_PASSWORD", () => {
		const env = readFileSync(join(root, ".env.example"), "utf8");
		expect(env).toContain("ADMIN_PASSWORD=");
	});
});

describe("lefthook configuration", () => {
	it("lefthook.yml has pre-commit hook", () => {
		const config = readFileSync(join(root, "lefthook.yml"), "utf8");
		expect(config).toContain("pre-commit:");
	});

	it("lefthook.yml pre-commit runs biome", () => {
		const config = readFileSync(join(root, "lefthook.yml"), "utf8");
		expect(config).toContain("biome");
	});

	it("lefthook install exits 0", () => {
		expect(() =>
			execSync("bunx lefthook install", { cwd: root, stdio: "pipe" }),
		).not.toThrow();
	});
});

describe("package.json", () => {
	it("biome:check script exists", () => {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		expect(pkg.scripts["biome:check"]).toBeDefined();
	});

	it("biome:fix script exists", () => {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		expect(pkg.scripts["biome:fix"]).toBeDefined();
	});

	it("no unpinned dependency versions", () => {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
		for (const [name, version] of Object.entries(allDeps)) {
			const v = version as string;
			const unpinned = v.startsWith("^") || v.startsWith("~");
			expect(unpinned, `${name}: "${v}" should be pinned`).toBe(false);
		}
	});
});

describe("vscode configuration", () => {
	it(".vscode/settings.json sets BiomeJS as default formatter", () => {
		const settings = JSON.parse(
			readFileSync(join(root, ".vscode/settings.json"), "utf8"),
		);
		expect(settings["editor.defaultFormatter"]).toBe("biomejs.biome");
	});

	it(".vscode/settings.json enables formatOnSave", () => {
		const settings = JSON.parse(
			readFileSync(join(root, ".vscode/settings.json"), "utf8"),
		);
		expect(settings["editor.formatOnSave"]).toBe(true);
	});
});
