// @vitest-environment jsdom
/**
 * Tests for app/lib/mdx/embeds.tsx — the embed allowlist registry and the
 * server `Embed` placeholder supplied to the MDX components map.
 *
 * Covers ADR-004's placeholder contract: a single `<div data-embed>` carrying a
 * JSON `data-props` and a static no-JS fallback. The registry is the only place
 * embeddable components are imported (ADR-001).
 *
 * File is .ts (not .tsx) per project convention — React.createElement throughout.
 */

import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TicTacToe } from "#/components/ui/tic-tac-toe";
import { EMBEDS, Embed } from "#/lib/mdx/embeds";

afterEach(cleanup);

describe("EMBEDS registry", () => {
	it("resolves the tic-tac-toe key to the TicTacToe component", () => {
		expect(EMBEDS["tic-tac-toe"]).toBe(TicTacToe);
	});

	it("returns undefined for an unregistered key", () => {
		expect(EMBEDS["does-not-exist"]).toBeUndefined();
	});
});

describe("Embed placeholder", () => {
	it("renders a single div with data-embed set to the name", () => {
		const { container } = render(
			React.createElement(Embed, { name: "tic-tac-toe", locale: "en" }),
		);
		const nodes = container.querySelectorAll("[data-embed]");
		expect(nodes).toHaveLength(1);
		expect(nodes[0].tagName).toBe("DIV");
		expect(nodes[0].getAttribute("data-embed")).toBe("tic-tac-toe");
	});

	it("serializes props (minus name) to JSON-parsable data-props", () => {
		const { container } = render(
			React.createElement(Embed, { name: "tic-tac-toe", locale: "en" }),
		);
		const raw = container
			.querySelector("[data-embed]")
			?.getAttribute("data-props");
		expect(raw).toBeTruthy();
		expect(JSON.parse(raw as string)).toEqual({ locale: "en" });
	});

	it("excludes name from data-props and keeps arbitrary extra props", () => {
		const { container } = render(
			React.createElement(Embed, {
				name: "tic-tac-toe",
				locale: "pt-br",
				difficulty: "hard",
			}),
		);
		const raw = container
			.querySelector("[data-embed]")
			?.getAttribute("data-props");
		expect(JSON.parse(raw as string)).toEqual({
			locale: "pt-br",
			difficulty: "hard",
		});
	});

	it("renders a non-empty static fallback string visible without JS", () => {
		const { container } = render(
			React.createElement(Embed, { name: "tic-tac-toe", locale: "en" }),
		);
		expect(container.textContent?.trim()).toBeTruthy();
		expect(container.querySelector(".embed-fallback")?.textContent).toContain(
			"requires JavaScript",
		);
	});
});
