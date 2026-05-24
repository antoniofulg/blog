/**
 * Date formatting helpers for the blog dashboard.
 *
 * ## BRT / UTC convention
 * All timestamps stored in the database are UTC (`timestamp with time zone`).
 * `formatBRT` converts to America/Sao_Paulo (UTC-3 in standard time, UTC-2
 * during Brasília summer time) before formatting, so dashboard timestamps
 * match the author's local clock.
 *
 * `formatDayMonth` and `formatMonth` use UTC as the display timezone so that
 * date-only values from daily aggregations (e.g. `date_trunc('day', …) AT
 * TIME ZONE 'UTC'`) render the same date string on every server regardless of
 * the host's local timezone. The caller is responsible for supplying a Date
 * whose UTC instant represents the intended calendar date.
 *
 * Tree-shake note: no top-level side effects. `Intl.DateTimeFormat` instances
 * are created inside function bodies — they are NOT cached at module scope to
 * ensure the module is free of initialisation side effects.
 *
 * @module
 */

import type { Locale } from "#/lib/locale";

/** Maps a blog `Locale` to the BCP-47 language tag used by `Intl` APIs. */
const BCP47: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" };

/**
 * Format a UTC Date for display in BRT (America/Sao_Paulo timezone), using
 * the `pt-BR` locale. Suitable for dashboard event timestamps.
 *
 * @example
 *   formatBRT(new Date("2025-05-23T12:00:00Z")) // "23/05/2025, 09:00"
 *
 * @returns Formatted string, or `""` if `date` is not a valid Date.
 */
export function formatBRT(date: Date): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "America/Sao_Paulo",
	}).format(date);
}

/**
 * Format a Date as an axis-friendly short day + month label.
 * The UTC timezone is used so that date-only aggregation values render
 * consistently across deployment environments.
 *
 * @example
 *   formatDayMonth(new Date("2025-05-23T00:00:00Z"), "en")     // "May 23"
 *   formatDayMonth(new Date("2025-05-23T00:00:00Z"), "pt-br")  // "23 de mai." (ICU-dependent)
 *
 * @returns Formatted string, or `""` if `date` is not a valid Date.
 */
export function formatDayMonth(date: Date, locale: Locale): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(BCP47[locale], {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

/**
 * Format a Date as a full day + month + year label, suitable for table cells
 * and metadata where the year is part of the signal.
 *
 * The UTC timezone is used for the same consistency reasons as
 * `formatDayMonth` — callers are expected to supply a Date whose UTC instant
 * represents the intended calendar date.
 *
 * @example
 *   formatDate(new Date("2025-05-23T00:00:00Z"), "en")     // "May 23, 2025"
 *   formatDate(new Date("2025-05-23T00:00:00Z"), "pt-br")  // "23 de mai. de 2025"
 *
 * @returns Formatted string, or `""` if `date` is not a valid Date.
 */
export function formatDate(date: Date, locale: Locale): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(BCP47[locale], {
		year: "numeric",
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(date);
}

/**
 * Format a Date as a full month name, suitable for grouping labels.
 * The UTC timezone is used for the same consistency reasons as `formatDayMonth`.
 *
 * @example
 *   formatMonth(new Date("2025-05-23T00:00:00Z"), "en")     // "May"
 *   formatMonth(new Date("2025-05-23T00:00:00Z"), "pt-br")  // "maio"
 *
 * @returns Formatted string, or `""` if `date` is not a valid Date.
 */
export function formatMonth(date: Date, locale: Locale): string {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(BCP47[locale], {
		month: "long",
		timeZone: "UTC",
	}).format(date);
}
