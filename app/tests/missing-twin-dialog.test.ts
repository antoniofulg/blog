import "./happydom";
import { afterEach, describe, expect, jest, test } from "bun:test";

const { act, cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);

import React from "react";
import {
	LOCALE_NAMES,
	MissingTwinDialog,
} from "#/components/ui/missing-twin-dialog";

afterEach(() => {
	cleanup();
});

// ─── unit: locale names ───────────────────────────────────────────────────────

describe("unit: LOCALE_NAMES", () => {
	test("English label", () => {
		expect(LOCALE_NAMES.en).toBe("English");
	});

	test("Portuguese label", () => {
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
				onConfirm: jest.fn(),
				onCancel: jest.fn(),
			}),
		);
	}

	test("renders title in English", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByText("Content not available")).toBeDefined();
	});

	test("body contains target locale human-readable name", async () => {
		await act(async () => {
			setup();
		});
		const desc = screen.getByText(/Português \(BR\)/);
		expect(desc).toBeDefined();
	});

	test("renders confirm button in English", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Continue" })).toBeDefined();
	});

	test("renders cancel button in English", async () => {
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
				onConfirm: jest.fn(),
				onCancel: jest.fn(),
			}),
		);
	}

	test("renders title in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByText("Conteúdo não disponível")).toBeDefined();
	});

	test("body contains English as target locale name", async () => {
		await act(async () => {
			setup();
		});
		const desc = screen.getByText(/English/);
		expect(desc).toBeDefined();
	});

	test("renders confirm button in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Continuar" })).toBeDefined();
	});

	test("renders cancel button in Portuguese", async () => {
		await act(async () => {
			setup();
		});
		expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined();
	});
});

// ─── unit: confirm callback ───────────────────────────────────────────────────

describe("unit: confirm button calls onConfirm exactly once", () => {
	test("onConfirm invoked once; onCancel not invoked", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();

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
	test("onCancel invoked once; onConfirm not invoked", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();

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
	test("onCancel fires on Escape keydown", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();

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
