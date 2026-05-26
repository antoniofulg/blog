import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOgImagePath } from "#/lib/og/resolve.server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGIN = "https://blog.example.com";

/** Always returns false — simulates no auto-generated PNG on disk. */
const noFile = () => false;

/** Always returns true — simulates auto-generated PNG present on disk. */
const hasFile = () => true;

// ---------------------------------------------------------------------------
// Unit tests: resolveOgImagePath
// ---------------------------------------------------------------------------

describe("unit: resolveOgImagePath — coverImage priority (step 1)", () => {
	it("returns relative coverImage made absolute with origin", () => {
		const result = resolveOgImagePath({
			coverImage: "/custom.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/custom.png");
	});

	it("returns absolute http coverImage unchanged", () => {
		const result = resolveOgImagePath({
			coverImage: "https://cdn.example.com/cover.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://cdn.example.com/cover.png");
	});

	it("returns absolute https coverImage unchanged", () => {
		const result = resolveOgImagePath({
			coverImage: "https://cdn.example.com/deep/path.jpg",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://cdn.example.com/deep/path.jpg");
	});

	it("does not call existsFn when coverImage is present", () => {
		let called = false;
		resolveOgImagePath({
			coverImage: "/x.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: () => {
				called = true;
				return true;
			},
		});
		expect(called).toBe(false);
	});
});

describe("unit: resolveOgImagePath — null/empty/missing coverImage (step 1 fallthrough)", () => {
	it("falls through when coverImage is undefined", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/og-image.jpg");
	});

	it("falls through when coverImage is null", () => {
		const result = resolveOgImagePath({
			coverImage: null,
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/og-image.jpg");
	});

	it("falls through when coverImage is empty string", () => {
		const result = resolveOgImagePath({
			coverImage: "",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/og-image.jpg");
	});

	it("null and undefined produce the same result", () => {
		const withNull = resolveOgImagePath({
			coverImage: null,
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		const withUndefined = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(withNull).toBe(withUndefined);
	});

	it("empty string and null produce the same result", () => {
		const withEmpty = resolveOgImagePath({
			coverImage: "",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		const withNull = resolveOgImagePath({
			coverImage: null,
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(withEmpty).toBe(withNull);
	});
});

describe("unit: resolveOgImagePath — auto-generated PNG (step 2)", () => {
	it("returns og PNG URL when file exists and coverImage is absent", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: hasFile,
		});
		expect(result).toBe("https://blog.example.com/og/en/my-post.png");
	});

	it("uses pt-br locale in path", () => {
		const result = resolveOgImagePath({
			locale: "pt-br",
			slug: "meu-post",
			origin: ORIGIN,
			existsFn: hasFile,
		});
		expect(result).toBe("https://blog.example.com/og/pt-br/meu-post.png");
	});

	it("passes the correct filesystem path to existsFn", () => {
		const capturedPaths: string[] = [];
		resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: (p) => {
				capturedPaths.push(p);
				return false;
			},
		});
		expect(capturedPaths).toHaveLength(1);
		const [fsPath] = capturedPaths;
		expect(fsPath).toContain("public");
		expect(fsPath).toContain("og");
		expect(fsPath).toContain("en");
		expect(fsPath).toContain("my-post.png");
		// Must be the correct cross-platform join
		expect(fsPath).toBe(
			join(process.cwd(), "public", "og", "en", "my-post.png"),
		);
	});

	it("does NOT return og PNG URL when file does not exist", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).not.toContain("/og/en/my-post.png");
	});
});

describe("unit: resolveOgImagePath — fallback (step 3)", () => {
	it("returns /og-image.jpg fallback when coverImage absent and file missing", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/og-image.jpg");
	});

	it("fallback URL is absolute regardless of origin", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: "http://localhost:3000",
			existsFn: noFile,
		});
		expect(result).toBe("http://localhost:3000/og-image.jpg");
		expect(result.startsWith("http://")).toBe(true);
	});
});

describe("unit: resolveOgImagePath — absolute URL requirement", () => {
	it("result starts with https:// for an https origin (coverImage)", () => {
		const result = resolveOgImagePath({
			coverImage: "/x.png",
			locale: "en",
			slug: "my-post",
			origin: "https://blog.example.com",
			existsFn: noFile,
		});
		expect(result.startsWith("https://")).toBe(true);
	});

	it("result starts with https:// for an https origin (og PNG)", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: "https://blog.example.com",
			existsFn: hasFile,
		});
		expect(result.startsWith("https://")).toBe(true);
	});

	it("result starts with https:// for an https origin (fallback)", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: "https://blog.example.com",
			existsFn: noFile,
		});
		expect(result.startsWith("https://")).toBe(true);
	});

	it("result starts with http:// for an http origin (local dev)", () => {
		const result = resolveOgImagePath({
			locale: "en",
			slug: "my-post",
			origin: "http://localhost:3000",
			existsFn: noFile,
		});
		expect(result.startsWith("http://")).toBe(true);
	});
});

describe("unit: resolveOgImagePath — http-prefix false-positive guard (issue-005)", () => {
	it("treats '/http-icon.png' as a relative path, not an absolute URL", () => {
		const result = resolveOgImagePath({
			coverImage: "/http-icon.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		// Must be made absolute, NOT returned as-is
		expect(result).toBe("https://blog.example.com/http-icon.png");
	});

	it("treats '/httpfoo/cover.png' as a relative path", () => {
		const result = resolveOgImagePath({
			coverImage: "/httpfoo/cover.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://blog.example.com/httpfoo/cover.png");
	});

	it("still treats 'http://...' as an absolute URL", () => {
		const result = resolveOgImagePath({
			coverImage: "http://cdn.example.com/cover.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("http://cdn.example.com/cover.png");
	});

	it("still treats 'https://...' as an absolute URL", () => {
		const result = resolveOgImagePath({
			coverImage: "https://cdn.example.com/cover.png",
			locale: "en",
			slug: "my-post",
			origin: ORIGIN,
			existsFn: noFile,
		});
		expect(result).toBe("https://cdn.example.com/cover.png");
	});
});
