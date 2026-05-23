import { describe, expect, it } from "vitest";
import type { DeviceClass } from "#/lib/analytics/device-detector";
import { detectDevice } from "#/lib/analytics/device-detector";

// AC-6: importing the module must not trigger any DB connection.
// Verified implicitly: device-detector.ts has no DB imports; this import
// succeeds in a pure Node environment with no database configured.

describe("detectDevice", () => {
	// ── Table-driven coverage ────────────────────────────────────────────────────
	// At least 8 representative UAs covering all three DeviceClass values.

	const cases: Array<[string, DeviceClass]> = [
		// ── mobile ──
		[
			// iPhone — Safari on iOS
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			"mobile",
		],
		[
			// Android phone — Chrome on Pixel 7
			"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
			"mobile",
		],
		[
			// Android phone — Chrome on Samsung Galaxy S21
			"Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
			"mobile",
		],
		// ── tablet ──
		[
			// iPad — Safari on iPadOS
			"Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			"tablet",
		],
		[
			// Generic Android Tablet (UA explicitly contains "Tablet")
			"Mozilla/5.0 (Linux; Android 12; Tablet Build/XXXXX) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Safari/537.36",
			"tablet",
		],
		// ── desktop ──
		[
			// Chrome on macOS
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"desktop",
		],
		[
			// Firefox on Linux
			"Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
			"desktop",
		],
		[
			// Edge on Windows
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
			"desktop",
		],
		[
			// Safari on macOS
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			"desktop",
		],
	];

	it.each(cases)("classifies %s as %s", (ua, expected) => {
		expect(detectDevice(ua)).toBe(expected);
	});

	// ── Edge cases ───────────────────────────────────────────────────────────────

	it("returns desktop for null", () => {
		expect(detectDevice(null)).toBe("desktop");
	});

	it("returns desktop for undefined", () => {
		expect(detectDevice(undefined)).toBe("desktop");
	});

	it("returns desktop for empty string", () => {
		expect(detectDevice("")).toBe("desktop");
	});
});
