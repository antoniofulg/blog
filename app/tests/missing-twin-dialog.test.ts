// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	LOCALE_NAMES,
	MissingTwinDialog,
} from "#/components/ui/missing-twin-dialog";

afterEach(() => {
	cleanup();
});

// ─── unit: locale names ───────────────────────────────────────────────────────

describe("unit: LOCALE_NAMES", () => {
	it("English label", () => {
		expect(LOCALE_NAMES.en).toBe("English");
	});

	it("Portuguese label", () => {
		expect(LOCALE_NAMES["pt-br"]).toBe("Português (BR)");
	});
});

// ─── unit: English copy ───────────────────────────────────────────────────────

describe("unit: renders English copy when currentLocale is en", () => {
	function setup() {
		return render(
			React.createElement(MissingTwinDialog, {
				open: true,
				currentLocale: "en",
				targetLocale: "pt-br",
				onConfirm: vi.fn(),
				onCancel: vi.fn(),
			}),
		);
	}

	it("renders title in English", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByText("Content not available")).toBeDefined();
	});

	it("body contains target locale human-readable name", async () => {
		await act(async () => {
			setup();
		});
		const desc = screen.getByText(/Português \(BR\)/);
		expect(desc).toBeDefined();
	});

	it("renders confirm button in English", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Continue" })).toBeDefined();
	});

	it("renders cancel button in English", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
	});
});

// ─── unit: Portuguese copy ────────────────────────────────────────────────────

describe("unit: renders Portuguese copy when currentLocale is pt-br", () => {
	function setup() {
		return render(
			React.createElement(MissingTwinDialog, {
				open: true,
				currentLocale: "pt-br",
				targetLocale: "en",
				onConfirm: vi.fn(),
				onCancel: vi.fn(),
			}),
		);
	}

	it("renders title in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByText("Conteúdo não disponível")).toBeDefined();
	});

	it("body contains English as target locale name", async () => {
		await act(async () => {
			setup();
		});
		const desc = screen.getByText(/English/);
		expect(desc).toBeDefined();
	});

	it("renders confirm button in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Continuar" })).toBeDefined();
	});

	it("renders cancel button in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined();
	});
});

// ─── unit: confirm callback ───────────────────────────────────────────────────

describe("unit: confirm button calls onConfirm exactly once", () => {
	it("onConfirm invoked once; onCancel not invoked", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		await act(async () => {
			render(
				React.createElement(MissingTwinDialog, {
					open: true,
					currentLocale: "en",
					targetLocale: "pt-br",
					onConfirm,
					onCancel,
				}),
			);
		});

		const btn = screen.getByRole("button", { name: "Continue" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
	});
});

// ─── unit: cancel callback ────────────────────────────────────────────────────

describe("unit: cancel button calls onCancel exactly once", () => {
	it("onCancel invoked once; onConfirm not invoked", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		await act(async () => {
			render(
				React.createElement(MissingTwinDialog, {
					open: true,
					currentLocale: "en",
					targetLocale: "pt-br",
					onConfirm,
					onCancel,
				}),
			);
		});

		const btn = screen.getByRole("button", { name: "Cancel" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});

// ─── integration: Escape key fires onCancel ───────────────────────────────────

describe("integration: Escape key closes dialog and fires onCancel", () => {
	it("onCancel fires on Escape keydown", async () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();

		await act(async () => {
			render(
				React.createElement(MissingTwinDialog, {
					open: true,
					currentLocale: "en",
					targetLocale: "pt-br",
					onConfirm,
					onCancel,
				}),
			);
		});

		// Dialog content should be visible
		expect(screen.getByText("Content not available")).toBeDefined();

		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		});

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
