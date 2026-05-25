/**
 * Tests for app/lib/date.ts
 *
 * Coverage targets:
 *  - formatBRT: UTC → America/Sao_Paulo (UTC-3 in May), pt-BR format
 *  - formatDayMonth: locale-aware short day+month axis label (UTC timezone)
 *  - formatMonth: locale-aware full month name (UTC timezone)
 *  - All three functions: invalid Date → empty string guard
 */

import { describe, expect, it } from "vitest";

import { formatBRT, formatDate, formatDayMonth, formatMonth } from "#/lib/date";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * 2025-05-23T12:00:00Z
 * In America/Sao_Paulo (UTC-3, standard time in May): 2025-05-23 09:00
 * In UTC: 2025-05-23 12:00
 */
const UTC_MAY_23_NOON = new Date("2025-05-23T12:00:00Z");

/**
 * 2025-01-01T00:00:00Z — January, useful for month-name assertions
 * In UTC: 2025-01-01 (January)
 */
const UTC_JAN_1 = new Date("2025-01-01T00:00:00Z");

const INVALID_DATES = [new Date("not-a-date"), new Date(NaN)];

// ---------------------------------------------------------------------------
// formatBRT
// ---------------------------------------------------------------------------

describe("formatBRT", () => {
	it("formats in pt-BR locale with America/Sao_Paulo timezone applied", () => {
		const result = formatBRT(UTC_MAY_23_NOON);
		// Must be non-empty
		expect(result).toBeTruthy();
		// UTC 12:00 → BRT 09:00 (UTC-3 in May, no DST)
		// Different ICU versions may use "09:00" or "09h00" — match both
		expect(result).toMatch(/09[h:]?00/);
		// Calendar date must still be May 23
		expect(result).toContain("23");
		// Month as 2-digit
		expect(result).toContain("05");
		// Year
		expect(result).toContain("2025");
	});

	it("midnight UTC does NOT shift the calendar date into the previous day in BRT (UTC-3)", () => {
		// 2025-05-23T00:00:00Z → BRT: 2025-05-22 21:00 → day shifts back
		const midnightUtc = new Date("2025-05-23T00:00:00Z");
		const result = formatBRT(midnightUtc);
		// In BRT this is May 22
		expect(result).toContain("22");
	});

	it.each(INVALID_DATES)("returns empty string for invalid Date", (d) => {
		expect(formatBRT(d)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// formatDayMonth
// ---------------------------------------------------------------------------

describe("formatDayMonth", () => {
	it("en locale: formats as short-month day (e.g. 'May 23')", () => {
		const result = formatDayMonth(UTC_MAY_23_NOON, "en");
		// Must contain the short English month abbreviation for May
		expect(result).toMatch(/may/i);
		// Must contain the day number
		expect(result).toContain("23");
	});

	it("pt-br locale: formats as day + short-month (e.g. '23 de mai.')", () => {
		const result = formatDayMonth(UTC_MAY_23_NOON, "pt-br");
		// Must contain the Portuguese short month abbreviation for May
		expect(result).toMatch(/mai/i);
		// Must contain the day number
		expect(result).toContain("23");
	});

	it("uses UTC timezone — date boundary does not shift", () => {
		// 2025-05-23T12:00:00Z is May 23 in UTC; must render as May 23 regardless
		// of test runner's local timezone
		const result = formatDayMonth(UTC_MAY_23_NOON, "en");
		expect(result).toContain("23");
		expect(result).toMatch(/may/i);
	});

	it.each(INVALID_DATES)("returns empty string for invalid Date", (d) => {
		expect(formatDayMonth(d, "en")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// formatDate (day + month + year)
// ---------------------------------------------------------------------------

describe("formatDate", () => {
	it("en locale: day, short month, and year for May 23 2025", () => {
		const result = formatDate(UTC_MAY_23_NOON, "en");
		// en-US Intl format is typically "May 23, 2025" but tolerate ICU drift
		// on the comma and the month abbreviation.
		expect(result).toMatch(/may/i);
		expect(result).toMatch(/23/);
		expect(result).toMatch(/2025/);
	});

	it("pt-br locale: day, short month, and year for May 23 2025", () => {
		const result = formatDate(UTC_MAY_23_NOON, "pt-br");
		expect(result).toMatch(/mai/i);
		expect(result).toMatch(/23/);
		expect(result).toMatch(/2025/);
	});

	it("renders the year of a UTC instant in UTC (no off-by-one across timezones)", () => {
		// 2024-12-31T23:30:00Z is the last 30 minutes of 2024 in UTC. In any
		// timezone east of UTC it would already be 2025 — but the helper uses
		// timeZone: "UTC", so the year must read as 2024.
		const result = formatDate(new Date("2024-12-31T23:30:00Z"), "en");
		expect(result).toMatch(/2024/);
		expect(result).not.toMatch(/2025/);
	});

	it.each(INVALID_DATES)("returns empty string for invalid Date", (d) => {
		expect(formatDate(d, "en")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// formatMonth
// ---------------------------------------------------------------------------

describe("formatMonth", () => {
	it("en locale: full English month name for May", () => {
		const result = formatMonth(UTC_MAY_23_NOON, "en");
		expect(result).toMatch(/may/i);
	});

	it("pt-br locale: full Portuguese month name for May", () => {
		const result = formatMonth(UTC_MAY_23_NOON, "pt-br");
		expect(result).toMatch(/maio/i);
	});

	it("en locale: full English month name for January", () => {
		const result = formatMonth(UTC_JAN_1, "en");
		expect(result).toMatch(/january/i);
	});

	it("pt-br locale: full Portuguese month name for January", () => {
		const result = formatMonth(UTC_JAN_1, "pt-br");
		expect(result).toMatch(/janeiro/i);
	});

	it.each(INVALID_DATES)("returns empty string for invalid Date", (d) => {
		expect(formatMonth(d, "pt-br")).toBe("");
	});
});
