import { isbot } from "isbot";

/**
 * Returns true if the given User-Agent string is a known bot.
 * Delegates to the `isbot` package for pattern matching.
 * Pure function — no I/O, no side effects.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
	return isbot(userAgent);
}
