/**
 * Device classification buckets used in `analytics_events.device`.
 */
export type DeviceClass = "mobile" | "tablet" | "desktop";

/**
 * Classifies a User-Agent string into one of three device buckets.
 * Regex order matters: tablet check runs before mobile so that iPad UAs
 * are not incorrectly classified as mobile.
 *
 * Known limitation (~5% misclassification per ADR-004): Android tablets
 * that omit "Tablet" from their UA string fall into "mobile". Smart TVs,
 * game consoles, and embedded devices fall into "desktop". This is
 * acceptable for an indie-blog donut chart widget.
 *
 * Pure function — no I/O, no side effects. Hand-rolled per ADR-004 to
 * avoid bundling `ua-parser-js` (~17 KB).
 */
export function detectDevice(
	userAgent: string | null | undefined,
): DeviceClass {
	const ua = userAgent ?? "";
	if (/iPad|Tablet/i.test(ua)) return "tablet";
	if (/iPhone|Android|Mobile/i.test(ua)) return "mobile";
	return "desktop";
}
