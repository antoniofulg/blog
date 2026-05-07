// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_LOCALE,
	detectLocaleFromRequest,
	LocaleProvider,
	useLocale,
} from "#/lib/locale";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(acceptLanguage?: string): Request {
	const headers: Record<string, string> = {};
	if (acceptLanguage !== undefined) {
		headers["Accept-Language"] = acceptLanguage;
	}
	return new Request("http://localhost/", { headers });
}

function wrapper({ children }: { children: React.ReactNode }) {
	return React.createElement(LocaleProvider, null, children);
}

// ─── unit: detectLocaleFromRequest ──────────────────────────────────────────

describe("unit: detectLocaleFromRequest", () => {
	it("pt-BR,pt;q=0.9,en-US;q=0.8 → 'pt-br'", () => {
		expect(
			detectLocaleFromRequest(makeRequest("pt-BR,pt;q=0.9,en-US;q=0.8")),
		).toBe("pt-br");
	});

	it("en-US,en;q=0.9 → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest("en-US,en;q=0.9"))).toBe("en");
	});

	it("'pt' → 'pt-br'", () => {
		expect(detectLocaleFromRequest(makeRequest("pt"))).toBe("pt-br");
	});

	it("missing header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest())).toBe("en");
	});

	it("empty header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest(""))).toBe(DEFAULT_LOCALE);
	});
});

// ─── unit: LocaleProvider + useLocale ───────────────────────────────────────

describe("unit: LocaleProvider + useLocale", () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => localStorage.clear());

	it("initializes with 'en' when localStorage has no 'locale' key", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {});
		expect(result.current.locale).toBe("en");
	});

	it("setLocale('pt-br') writes 'pt-br' to localStorage", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {
			result.current.setLocale("pt-br");
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
		expect(result.current.locale).toBe("pt-br");
	});

	it("useLocale() returns { locale, setLocale } shape", () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		expect(result.current).toHaveProperty("locale");
		expect(typeof result.current.setLocale).toBe("function");
	});
});
