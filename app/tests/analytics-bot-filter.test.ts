import { describe, expect, it } from "vitest";
import { isBotUserAgent } from "#/lib/analytics/bot-filter";

// AC-6: importing the module must not trigger any DB connection.
// Verified implicitly: bot-filter.ts has no DB imports; this import succeeds in a
// pure Node environment with no database configured.

describe("isBotUserAgent", () => {
	// ── Known bot User-Agents ────────────────────────────────────────────────────

	it.each([
		["Googlebot/2.1 (+http://www.google.com/bot.html)", "Googlebot"],
		["bingbot/2.0 (+http://www.bing.com/bingbot.htm)", "bingbot"],
		["GPTBot/1.0 (+https://openai.com/gptbot)", "GPTBot"],
		["Bytespider; spider-feedback@bytedance.com", "Bytespider"],
		["Slack-ImgProxy 1.0 (+https://api.slack.com)", "Slack-ImgProxy"],
	])("returns true for %s (%s)", (ua, _label) => {
		expect(isBotUserAgent(ua)).toBe(true);
	});

	// ── Known human User-Agents ──────────────────────────────────────────────────

	it.each([
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Chrome on Mac",
		],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			"Safari on iPhone",
		],
		[
			"Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
			"Firefox on Linux",
		],
		[
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
			"Edge on Windows",
		],
		[
			"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			"Safari on iPad",
		],
	])("returns false for %s (%s)", (ua, _label) => {
		expect(isBotUserAgent(ua)).toBe(false);
	});

	// ── Edge cases ───────────────────────────────────────────────────────────────

	it("returns false for null", () => {
		expect(isBotUserAgent(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isBotUserAgent(undefined)).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isBotUserAgent("")).toBe(false);
	});
});
