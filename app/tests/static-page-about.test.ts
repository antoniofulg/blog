// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { StaticPageProfile } from "#/components/ui/static-page-profile";
import { strings } from "#/lib/i18n/strings";

afterEach(cleanup);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// All six keys present; only github + linkedin + email have URLs.
const FM_AVATAR_TWO_LINKS = {
	title: "About",
	description: "About the author",
	avatar: "/about/profile.jpeg",
	links: {
		github: "https://github.com/me",
		linkedin: "https://linkedin.com/in/me",
		x: undefined,
		instagram: undefined,
		rss: undefined,
		email: undefined,
	} as Record<
		"github" | "linkedin" | "x" | "instagram" | "rss" | "email",
		string | undefined
	>,
};

// All six keys present with undefined values — no links to render.
const FM_AVATAR_EMPTY_LINKS = {
	title: "About",
	avatar: "/about/profile.jpeg",
	links: {
		github: undefined,
		linkedin: undefined,
		x: undefined,
		instagram: undefined,
		rss: undefined,
		email: undefined,
	} as Record<
		"github" | "linkedin" | "x" | "instagram" | "rss" | "email",
		string | undefined
	>,
};

// No avatar field — regression fixture for pages like /privacy.
const FM_NO_AVATAR_NO_LINKS = {
	title: "Privacy Policy",
	description: "Our privacy policy.",
};

// No avatar, but links present.
const FM_NO_AVATAR_WITH_LINKS = {
	title: "Contact",
	links: {
		github: "https://github.com/me",
		linkedin: undefined,
		x: undefined,
		instagram: undefined,
		rss: undefined,
		email: undefined,
	} as Record<
		"github" | "linkedin" | "x" | "instagram" | "rss" | "email",
		string | undefined
	>,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderProfile(
	frontmatter: Parameters<typeof StaticPageProfile>[0]["frontmatter"],
	locale: "en" | "pt-br" = "en",
	html = "<p>Page content</p>",
) {
	return render(
		React.createElement(StaticPageProfile, { frontmatter, locale, html }),
	);
}

// ─── AC-1: avatar + populated links ──────────────────────────────────────────

describe("StaticPageProfile — avatar present (AC-1)", () => {
	it("renders <img> with the avatar src", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const img = screen.getByRole("img");
		expect(img).toBeTruthy();
		expect(img.getAttribute("src")).toBe("/about/profile.jpeg");
	});

	it("avatar img uses loading=eager (above-the-fold)", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const img = screen.getByRole("img");
		expect(img.getAttribute("loading")).toBe("eager");
	});

	it("avatar img has alt text equal to the page title", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const img = screen.getByRole("img");
		expect(img.getAttribute("alt")).toBe("About");
	});

	it("renders exactly 2 social link anchors for 2 populated keys", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(2);
	});

	it("social anchor hrefs match the populated link URLs", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const links = screen.getAllByRole("link");
		const hrefs = links.map((l) => l.getAttribute("href"));
		expect(hrefs).toContain("https://github.com/me");
		expect(hrefs).toContain("https://linkedin.com/in/me");
	});

	it("renders the page title heading", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		expect(screen.getByRole("heading", { name: "About" })).toBeTruthy();
	});

	it("heading has id=page-title for aria-labelledby", () => {
		renderProfile(FM_AVATAR_TWO_LINKS);
		const heading = document.getElementById("page-title");
		expect(heading).not.toBeNull();
		expect(heading?.textContent).toBe("About");
	});

	it("renders MDX html content", () => {
		renderProfile(FM_AVATAR_TWO_LINKS, "en", "<p>Hello world</p>");
		expect(screen.getByText("Hello world")).toBeTruthy();
	});
});

// ─── AC-6: localized aria-label (accessible name via visible label text) ─────

describe("StaticPageProfile — accessible names from i18n strings (AC-6)", () => {
	it("en: github link accessible name matches strings.en.socials.github", () => {
		renderProfile(FM_AVATAR_TWO_LINKS, "en");
		expect(
			screen.getByRole("link", { name: strings.en.socials.github }),
		).toBeTruthy();
	});

	it("en: linkedin link accessible name matches strings.en.socials.linkedin", () => {
		renderProfile(FM_AVATAR_TWO_LINKS, "en");
		expect(
			screen.getByRole("link", { name: strings.en.socials.linkedin }),
		).toBeTruthy();
	});

	it("pt-br: github link accessible name matches strings['pt-br'].socials.github", () => {
		renderProfile(FM_AVATAR_TWO_LINKS, "pt-br");
		expect(
			screen.getByRole("link", {
				name: strings["pt-br"].socials.github,
			}),
		).toBeTruthy();
	});

	it("pt-br: linkedin link accessible name matches strings['pt-br'].socials.linkedin", () => {
		renderProfile(FM_AVATAR_TWO_LINKS, "pt-br");
		expect(
			screen.getByRole("link", {
				name: strings["pt-br"].socials.linkedin,
			}),
		).toBeTruthy();
	});
});

// ─── AC-4: empty links map → no social row ────────────────────────────────────

describe("StaticPageProfile — empty links map → no social row (AC-4)", () => {
	it("renders no anchor elements when all link values are undefined", () => {
		renderProfile(FM_AVATAR_EMPTY_LINKS);
		const links = screen.queryAllByRole("link");
		expect(links).toHaveLength(0);
	});

	it("still renders the avatar img when links map is empty", () => {
		renderProfile(FM_AVATAR_EMPTY_LINKS);
		expect(screen.getByRole("img")).toBeTruthy();
	});
});

// ─── AC-5: no-avatar page → original header fallback ─────────────────────────

describe("StaticPageProfile — no avatar → single-column fallback (AC-5)", () => {
	it("renders no img element when avatar is absent", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS);
		const img = screen.queryByRole("img");
		expect(img).toBeNull();
	});

	it("renders the page title heading", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS);
		expect(
			screen.getByRole("heading", { name: "Privacy Policy" }),
		).toBeTruthy();
	});

	it("heading has id=page-title", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS);
		const heading = document.getElementById("page-title");
		expect(heading).not.toBeNull();
		expect(heading?.textContent).toBe("Privacy Policy");
	});

	it("renders no social link anchors when no links field", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS);
		const links = screen.queryAllByRole("link");
		expect(links).toHaveLength(0);
	});

	it("renders the description when present", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS);
		expect(screen.getByText("Our privacy policy.")).toBeTruthy();
	});

	it("renders MDX html content", () => {
		renderProfile(FM_NO_AVATAR_NO_LINKS, "en", "<p>Privacy text</p>");
		expect(screen.getByText("Privacy text")).toBeTruthy();
	});
});

// ─── No avatar + links present → social row renders ──────────────────────────

describe("StaticPageProfile — no avatar + populated links", () => {
	it("renders social link anchors even when avatar is absent", () => {
		renderProfile(FM_NO_AVATAR_WITH_LINKS);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("https://github.com/me");
	});

	it("renders no img element", () => {
		renderProfile(FM_NO_AVATAR_WITH_LINKS);
		expect(screen.queryByRole("img")).toBeNull();
	});
});

// ─── AC-4 partial removal: single link hidden when entry removed ──────────────

describe("StaticPageProfile — AC-4: only populated entries render", () => {
	it("removing github from links hides github icon, linkedin remains", () => {
		const fm = {
			title: "About",
			avatar: "/about/profile.jpeg",
			links: {
				github: undefined, // removed
				linkedin: "https://linkedin.com/in/me",
				x: undefined,
				instagram: undefined,
				rss: undefined,
				email: undefined,
			} as Record<
				"github" | "linkedin" | "x" | "instagram" | "rss" | "email",
				string | undefined
			>,
		};
		renderProfile(fm);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0].getAttribute("href")).toBe("https://linkedin.com/in/me");
	});
});
