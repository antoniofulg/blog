/**
 * Guard: the published privacy policy must disclose every referrer-source
 * bucket that `analytics_events.referrer_source` can persist.
 *
 * `ALL_SOURCES` is the single source of truth for the bucket set. Both the
 * English and Portuguese privacy pages enumerate the stored categories inline,
 * so they drift out of sync whenever a new `ReferrerSource` is added (as
 * happened when `whatsapp` and `email` were introduced for the share work).
 * This test fails the build if any bucket is missing from either page, forcing
 * the policy update to ship alongside the enum change.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_SOURCES } from "#/lib/analytics/referrer-bucketer";

const PRIVACY_PAGES = [
	join(import.meta.dirname, "../content/pages/en/privacy.mdx"),
	join(import.meta.dirname, "../content/pages/pt-br/privacy.mdx"),
] as const;

describe("privacy policy referrer-bucket disclosure", () => {
	for (const page of PRIVACY_PAGES) {
		const relative = page.slice(page.indexOf("app/content"));

		describe(relative, () => {
			const content = readFileSync(page, "utf-8");

			for (const source of ALL_SOURCES) {
				it(`discloses the \`${source}\` bucket`, () => {
					// Match the backtick-wrapped token as written in the policy
					// table, so a substring like "media" in prose can't satisfy
					// the "medium" bucket by accident.
					expect(content).toContain(`\`${source}\``);
				});
			}
		});
	}
});
