// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "#/components/layout/footer";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		className,
	}: {
		children: React.ReactNode;
		to: string;
		className?: string;
	}) => React.createElement("a", { href: to, className }, children),
}));

function renderFooter() {
	return render(React.createElement(Footer));
}

afterEach(() => {
	cleanup();
});

// ─── unit: navLinks absent entries ────────────────────────────────────────────

describe("unit: Footer navLinks absent entries", () => {
	it("no link to /tutorials", () => {
		renderFooter();
		expect(document.querySelector('a[href="/tutorials"]')).toBeNull();
	});

	it("no link to /projects", () => {
		renderFooter();
		expect(document.querySelector('a[href="/projects"]')).toBeNull();
	});
});

// ─── unit: resourceLinks absent entries ───────────────────────────────────────

describe("unit: Footer resourceLinks absent entries", () => {
	it("no link to /feed.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/feed.xml"]')).toBeNull();
	});

	it("no link to /sitemap.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/sitemap.xml"]')).toBeNull();
	});

	it("no link to /newsletter", () => {
		renderFooter();
		expect(document.querySelector('a[href="/newsletter"]')).toBeNull();
	});

	it("no link to /search", () => {
		renderFooter();
		expect(document.querySelector('a[href="/search"]')).toBeNull();
	});
});

// ─── unit: valid remaining links ──────────────────────────────────────────────

describe("unit: Footer valid remaining links", () => {
	it("renders link to /", () => {
		renderFooter();
		expect(document.querySelector('a[href="/"]')).not.toBeNull();
	});

	it("renders link to /blog", () => {
		renderFooter();
		expect(document.querySelector('a[href="/blog"]')).not.toBeNull();
	});

	it("renders link to /about", () => {
		renderFooter();
		expect(document.querySelector('a[href="/about"]')).not.toBeNull();
	});
});
