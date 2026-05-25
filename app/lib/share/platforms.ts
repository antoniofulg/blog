import {
	Copy,
	Linkedin,
	Mail,
	MessageCircle,
	MessageSquare,
	Twitter,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/**
 * Union of all supported share platform identifiers.
 * Also used as the utm_source value (except "copy" — no UTM tagging per ADR-001).
 */
export type PlatformId =
	| "twitter"
	| "linkedin"
	| "reddit"
	| "whatsapp"
	| "email"
	| "copy";

/**
 * Config entry for a single share platform.
 *
 * - `id`: unique identifier; matches `PlatformId` union.
 * - `utmSource`: value for `utm_source` query param; absent for "copy" (no UTM tagging).
 * - `labelKey`: key into `strings[locale].postShare.chips` for the chip label.
 * - `Icon`: lucide-react icon component.
 * - `href`: returns the platform share-intent URL; absent for "copy" (clipboard action).
 */
export type SharePlatform = {
	id: PlatformId;
	/** utm_source value; undefined for "copy" (no tagging applied — ADR-001 amendment). */
	utmSource?: string;
	labelKey: PlatformId;
	Icon: ComponentType<SVGProps<SVGSVGElement>>;
	/** Returns the platform share-intent URL; undefined for "copy" (clipboard action). */
	href?: (taggedUrl: string, title: string) => string;
};

/**
 * Single source of truth for the 6 share platforms.
 * Consumed by PostShare (task 05) and any future share surface.
 *
 * Order: twitter, linkedin, reddit, whatsapp, email, copy.
 * ADR-003: extracted to a shared constant so both inline + dropdown variants
 *   consume the same platform list.
 */
export const SHARE_PLATFORMS: readonly SharePlatform[] = [
	{
		id: "twitter",
		utmSource: "twitter",
		labelKey: "twitter",
		Icon: Twitter,
		href: (u, t) =>
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`,
	},
	{
		id: "linkedin",
		utmSource: "linkedin",
		labelKey: "linkedin",
		Icon: Linkedin,
		href: (u) =>
			`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
	},
	{
		id: "reddit",
		utmSource: "reddit",
		labelKey: "reddit",
		Icon: MessageCircle,
		href: (u, t) =>
			`https://reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
	},
	{
		id: "whatsapp",
		utmSource: "whatsapp",
		labelKey: "whatsapp",
		Icon: MessageSquare,
		href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`,
	},
	{
		id: "email",
		utmSource: "email",
		labelKey: "email",
		Icon: Mail,
		href: (u, t) =>
			`mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(u)}`,
	},
	{
		id: "copy",
		// No utmSource — clipboard copies do not receive UTM tagging (ADR-001 amendment).
		labelKey: "copy",
		Icon: Copy,
		// No href — clipboard action, not a share-intent URL.
	},
];

/**
 * Builds a UTM-tagged URL for share-button clicks.
 *
 * For tagged platforms (all except "copy"):
 *   `<canonicalUrl>?utm_source=<platform>&utm_medium=social&utm_campaign=<slug>`
 *
 * For "copy":
 *   Returns `canonicalUrl` unchanged — clipboard pastes go to unknown destinations
 *   and UTM-tagging them would pollute downstream attribution (ADR-001 amendment).
 *
 * Pure function — no side effects, no DOM access. Safe for SSR and unit tests.
 * Exported for direct unit testing.
 *
 * @param canonicalUrl - Post URL without UTM params.
 * @param platform     - One of the 6 PlatformId values.
 * @param slug         - Post slug; used as `utm_campaign` value.
 */
export function buildTaggedUrl(
	canonicalUrl: string,
	platform: PlatformId,
	slug: string,
): string {
	const config = SHARE_PLATFORMS.find((p) => p.id === platform);

	// "copy" has no utmSource — return canonical unchanged.
	if (!config?.utmSource) {
		return canonicalUrl;
	}

	try {
		// Use URL API for correct param encoding and to preserve existing params.
		const u = new URL(canonicalUrl);
		u.searchParams.set("utm_source", config.utmSource);
		u.searchParams.set("utm_medium", "social");
		u.searchParams.set("utm_campaign", slug);
		return u.toString();
	} catch {
		// Fallback: naive append for relative URLs (SSR / test contexts where
		// the URL constructor requires an absolute URL).
		const sep = canonicalUrl.includes("?") ? "&" : "?";
		return `${canonicalUrl}${sep}utm_source=${config.utmSource}&utm_medium=social&utm_campaign=${encodeURIComponent(slug)}`;
	}
}
