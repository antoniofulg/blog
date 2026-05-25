// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { SocialLink } from "#/components/ui/social-link";

afterEach(cleanup);

// ─── helper ──────────────────────────────────────────────────────────────────

type LinkKind = Parameters<typeof SocialLink>[0]["kind"];

function renderLink(
	kind: LinkKind,
	label = "Test",
	url = "https://example.com",
) {
	return render(React.createElement(SocialLink, { kind, label, url }));
}

// ─── AC-5: new icon kinds ─────────────────────────────────────────────────────

describe("unit: SocialLink — new icon kinds (AC-5)", () => {
	it("kind='x' renders an anchor containing the lucide-twitter icon", () => {
		const { container } = renderLink("x", "X / Twitter", "https://x.com/me");
		const anchor = container.querySelector("a");
		expect(anchor).not.toBeNull();
		expect(anchor?.getAttribute("href")).toBe("https://x.com/me");
		// lucide-react renders Twitter with class "lucide-twitter"
		expect(container.querySelector(".lucide-twitter")).not.toBeNull();
	});

	it("kind='instagram' renders an anchor containing the lucide-instagram icon", () => {
		const { container } = renderLink(
			"instagram",
			"Instagram",
			"https://instagram.com/me",
		);
		const anchor = container.querySelector("a");
		expect(anchor).not.toBeNull();
		expect(container.querySelector(".lucide-instagram")).not.toBeNull();
	});

	it("kind='rss' renders an anchor containing the lucide-rss icon", () => {
		const { container } = renderLink(
			"rss",
			"RSS Feed",
			"https://example.com/rss.xml",
		);
		const anchor = container.querySelector("a");
		expect(anchor).not.toBeNull();
		expect(container.querySelector(".lucide-rss")).not.toBeNull();
	});
});

// ─── AC-6: existing kinds regression ─────────────────────────────────────────

describe("unit: SocialLink — existing icon kinds regression (AC-6)", () => {
	it("kind='github' renders the lucide-github icon", () => {
		const { container } = renderLink(
			"github",
			"GitHub",
			"https://github.com/me",
		);
		expect(container.querySelector(".lucide-github")).not.toBeNull();
	});

	it("kind='linkedin' renders the lucide-linkedin icon", () => {
		const { container } = renderLink(
			"linkedin",
			"LinkedIn",
			"https://linkedin.com/in/me",
		);
		expect(container.querySelector(".lucide-linkedin")).not.toBeNull();
	});

	it("kind='email' renders lucide-mail icon (mailto link, no external target)", () => {
		const { container } = renderLink("email", "Email", "mailto:me@example.com");
		expect(container.querySelector(".lucide-mail")).not.toBeNull();
		const anchor = container.querySelector("a");
		// mailto links must NOT open in a new tab
		expect(anchor?.getAttribute("target")).toBeNull();
	});

	it("kind='other' renders the lucide-external-link icon", () => {
		const { container } = renderLink("other", "Other", "https://example.com");
		expect(container.querySelector(".lucide-external-link")).not.toBeNull();
	});
});

// ─── Structural: anchor attributes ───────────────────────────────────────────

describe("unit: SocialLink — anchor attributes", () => {
	it("external URL gets target=_blank and rel=noopener noreferrer", () => {
		const { container } = renderLink(
			"github",
			"GitHub",
			"https://github.com/me",
		);
		const anchor = container.querySelector("a");
		expect(anchor?.getAttribute("target")).toBe("_blank");
		expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
	});

	it("mailto URL does NOT get target=_blank", () => {
		const { container } = renderLink("email", "Email", "mailto:me@example.com");
		const anchor = container.querySelector("a");
		expect(anchor?.getAttribute("target")).toBeNull();
	});

	it("exposes the label via aria-label + title (icon-only ghost variant)", () => {
		const { container } = renderLink(
			"github",
			"My GitHub",
			"https://github.com/me",
		);
		const anchor = container.querySelector("a");
		// SocialLink renders icon-only per the simplified ghost-button variant;
		// the label survives as the accessible name (aria-label) + hover tooltip
		// (title). No visible text inside the anchor.
		expect(anchor?.getAttribute("aria-label")).toBe("My GitHub");
		expect(anchor?.getAttribute("title")).toBe("My GitHub");
		expect(anchor?.textContent?.trim()).toBe("");
	});
});
