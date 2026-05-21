// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";

afterEach(() => {
	cleanup();
});

// ─── unit: exports ────────────────────────────────────────────────────────────

describe("unit: dialog exports", () => {
	it("Dialog is defined", () => {
		expect(Dialog).toBeDefined();
	});

	it("DialogTrigger is defined", () => {
		expect(DialogTrigger).toBeDefined();
	});

	it("DialogContent is defined", () => {
		expect(DialogContent).toBeDefined();
	});

	it("DialogHeader is defined", () => {
		expect(DialogHeader).toBeDefined();
	});

	it("DialogTitle is defined", () => {
		expect(DialogTitle).toBeDefined();
	});

	it("DialogDescription is defined", () => {
		expect(DialogDescription).toBeDefined();
	});

	it("DialogFooter is defined", () => {
		expect(DialogFooter).toBeDefined();
	});

	it("DialogClose is defined", () => {
		expect(DialogClose).toBeDefined();
	});
});

// ─── unit: Dialog opens on trigger click ─────────────────────────────────────

describe("unit: Dialog opens on trigger click", () => {
	it("renders dialog content after trigger click", async () => {
		render(
			React.createElement(
				Dialog,
				null,
				React.createElement(DialogTrigger, null, "open"),
				React.createElement(
					DialogContent,
					null,
					React.createElement(DialogTitle, null, "Test title"),
					React.createElement(DialogDescription, null, "Test description"),
				),
			),
		);

		// Content not visible initially (closed state; DialogContent returns null until mounted)
		expect(screen.queryByText("Test title")).toBeNull();

		// Click trigger
		const trigger = screen.getByText("open");
		await act(async () => {
			fireEvent.click(trigger);
		});

		// After click, component mounts; content appears
		expect(screen.getByText("Test title")).toBeDefined();
	});
});

// ─── unit: Dialog closes on Escape key ───────────────────────────────────────

describe("unit: Dialog closes on Escape key", () => {
	it("dialog content disappears after Escape keydown", async () => {
		render(
			React.createElement(
				Dialog,
				null,
				React.createElement(DialogTrigger, null, "open"),
				React.createElement(
					DialogContent,
					null,
					React.createElement(DialogTitle, null, "Escape test"),
				),
			),
		);

		const trigger = screen.getByText("open");
		await act(async () => {
			fireEvent.click(trigger);
		});

		expect(screen.getByText("Escape test")).toBeDefined();

		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		});

		// After escape, Radix closes the dialog
		expect(screen.queryByText("Escape test")).toBeNull();
	});
});

// ─── unit: DialogClose button closes the dialog ───────────────────────────────

describe("unit: DialogClose button closes the dialog", () => {
	it("dialog content disappears after close button click", async () => {
		render(
			React.createElement(
				Dialog,
				null,
				React.createElement(DialogTrigger, null, "open"),
				React.createElement(
					DialogContent,
					null,
					React.createElement(DialogTitle, null, "Close test"),
					React.createElement(DialogClose, null, "close"),
				),
			),
		);

		const trigger = screen.getByText("open");
		await act(async () => {
			fireEvent.click(trigger);
		});

		expect(screen.getByText("Close test")).toBeDefined();

		const closeBtn = screen.getByText("close");
		await act(async () => {
			fireEvent.click(closeBtn);
		});

		expect(screen.queryByText("Close test")).toBeNull();
	});
});

// ─── integration: SSR guard — closed dialog emits no portal markup ────────────

describe("integration: SSR guard — closed dialog emits no portal markup before mount", () => {
	it("DialogContent renders null when dialog is closed (not yet mounted)", () => {
		// Simulate closed dialog (default state — no open prop)
		const { container } = render(
			React.createElement(
				Dialog,
				null,
				React.createElement(DialogTrigger, null, "open"),
				React.createElement(
					DialogContent,
					null,
					React.createElement(DialogTitle, null, "SSR guard title"),
				),
			),
		);

		// The portal content must not appear before mount / trigger click
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(screen.queryByText("SSR guard title")).toBeNull();
	});
});
