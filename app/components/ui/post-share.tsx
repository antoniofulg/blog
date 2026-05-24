import {
	Copy,
	Linkedin,
	Mail,
	MessageCircle,
	Newspaper,
	Send,
	Share2,
	Twitter,
} from "lucide-react";
import { useEffect, useState } from "react";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

export type PostShareProps = {
	/** Canonical URL WITHOUT utm tags — component appends them (ADR-002). */
	postUrl: string;
	postTitle: string;
	locale: Locale;
};

/**
 * Appends UTM share attribution query params to the canonical post URL.
 * Output: `<postUrl>?utm_source=blog&utm_medium=share`
 *
 * Pure function — exported for direct unit testing.
 */
export function buildShareUrl(postUrl: string): string {
	// Use URL constructor for correct param encoding; fall back to simple concat
	// if the URL is relative or malformed (shouldn't happen in prod).
	try {
		const u = new URL(postUrl);
		u.searchParams.set("utm_source", "blog");
		u.searchParams.set("utm_medium", "share");
		return u.toString();
	} catch {
		// Fallback: naive append (safe for tests with relative paths).
		const sep = postUrl.includes("?") ? "&" : "?";
		return `${postUrl}${sep}utm_source=blog&utm_medium=share`;
	}
}

type ChipConfig = {
	id: string;
	labelKey: keyof (typeof strings)["en"]["postShare"]["chips"];
	Icon: React.FC<React.SVGProps<SVGSVGElement>>;
	href: (utmUrl: string, title: string) => string;
};

const CHIPS: ChipConfig[] = [
	{
		id: "x",
		labelKey: "x",
		Icon: Twitter,
		href: (utmUrl, title) =>
			`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(utmUrl)}`,
	},
	{
		id: "linkedin",
		labelKey: "linkedin",
		Icon: Linkedin,
		href: (utmUrl) =>
			`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(utmUrl)}`,
	},
	{
		id: "bluesky",
		labelKey: "bluesky",
		Icon: Send,
		href: (utmUrl, title) =>
			`https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${utmUrl}`)}`,
	},
	{
		id: "hackernews",
		labelKey: "hackernews",
		Icon: Newspaper,
		href: (utmUrl, title) =>
			`https://news.ycombinator.com/submitlink?u=${encodeURIComponent(utmUrl)}&t=${encodeURIComponent(title)}`,
	},
	{
		id: "reddit",
		labelKey: "reddit",
		Icon: MessageCircle,
		href: (utmUrl, title) =>
			`https://reddit.com/submit?url=${encodeURIComponent(utmUrl)}&title=${encodeURIComponent(title)}`,
	},
	{
		id: "email",
		labelKey: "email",
		Icon: Mail,
		href: (utmUrl, title) =>
			`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(utmUrl)}`,
	},
];

/**
 * PostShare — renders a row of 7 share chips by default (SSR-safe).
 *
 * After client mount:
 *   - Resolves the canonical URL to an absolute URL using window.location.origin
 *     when a relative path is passed (SSR-safe: relative URLs are used in the
 *     SSR pass; absolute URLs kick in immediately after hydration).
 *   - If `navigator.share` is available (mobile / modern browser), swaps to
 *     a single native Share button (ADR-003, Decision 2).
 *   - Otherwise, the chip row stays visible.
 *
 * All shared URLs carry ?utm_source=blog&utm_medium=share for analytics
 * attribution (ADR-002).
 */
export function PostShare({ postUrl, postTitle, locale }: PostShareProps) {
	const t = strings[locale].postShare;

	/**
	 * UTM-tagged share URL. Initialised from postUrl (may be relative on SSR);
	 * updated to absolute after mount so that platform share-intent links work.
	 */
	const [utmUrl, setUtmUrl] = useState(() => buildShareUrl(postUrl));
	/** true after mount if Web Share API is available */
	const [hasNativeShare, setHasNativeShare] = useState(false);
	/** brief "Copied!" confirmation state */
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		// Resolve to absolute URL after mount (postUrl may be a relative path
		// like "/my-slug" on SSR; we need the full URL for social share intents).
		const absoluteUrl = postUrl.startsWith("/")
			? `${window.location.origin}${postUrl}`
			: postUrl;
		setUtmUrl(buildShareUrl(absoluteUrl));

		if (typeof navigator.share === "function") {
			setHasNativeShare(true);
		}
	}, [postUrl]);

	async function handleCopyLink() {
		try {
			await navigator.clipboard.writeText(utmUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may be unavailable in non-secure contexts; fail silently.
		}
	}

	async function handleNativeShare() {
		try {
			await navigator.share({ url: utmUrl, title: postTitle, text: postTitle });
		} catch (err) {
			// DOMException may not extend Error in all environments; check .name
			// directly (ADR-003: AbortError means user dismissed the sheet — silent).
			const name =
				err != null && typeof (err as Record<string, unknown>).name === "string"
					? (err as { name: string }).name
					: "";
			if (name === "AbortError") return;
			console.error("[PostShare] navigator.share failed:", err);
		}
	}

	if (hasNativeShare) {
		return (
			<div className="my-8 flex justify-center">
				<button
					type="button"
					onClick={handleNativeShare}
					aria-label={t.share}
					className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-6 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Share2 className="h-4 w-4" aria-hidden="true" />
					{t.share}
				</button>
			</div>
		);
	}

	return (
		<section className="my-8" aria-label={t.share}>
			<div className="flex flex-wrap items-center justify-center gap-2">
				{CHIPS.map(({ id, labelKey, Icon, href }) => {
					const label = t.chips[labelKey];
					const ariaLabel = t.ariaShareOn.replace("{platform}", label);
					return (
						<a
							key={id}
							href={href(utmUrl, postTitle)}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={ariaLabel}
							className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						>
							<Icon className="h-4 w-4" aria-hidden="true" />
							{label}
						</a>
					);
				})}

				{/* Copy Link chip */}
				<button
					type="button"
					onClick={handleCopyLink}
					aria-label={t.chips.copyLink}
					className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Copy className="h-4 w-4" aria-hidden="true" />
					{t.chips.copyLink}
				</button>
			</div>

			{/* aria-live region for clipboard confirmation — <output> has
			    implicit role="status" per ARIA spec; Biome a11y prefers it
			    over <p role="status">. */}
			<output
				aria-live="polite"
				aria-atomic="true"
				className="mt-2 block text-center text-xs text-foreground-secondary"
			>
				{copied ? t.copied : ""}
			</output>
		</section>
	);
}
