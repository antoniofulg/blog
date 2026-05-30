import * as Popover from "@radix-ui/react-popover";
import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import {
	buildTaggedUrl,
	type PlatformId,
	SHARE_PLATFORMS,
	type SharePlatform,
} from "#/lib/share/platforms";

// Re-export buildTaggedUrl for direct unit testing (replaces legacy buildShareUrl).
export { buildTaggedUrl };

export type PostShareProps = {
	/** Canonical URL WITHOUT utm tags — component appends them per platform (ADR-001). */
	postUrl: string;
	/** Post slug — used as utm_campaign value. */
	postSlug: string;
	postTitle: string;
	locale: Locale;
	/** "inline" renders chip row (default); "dropdown" renders Radix Popover (admin). */
	variant?: "inline" | "dropdown";
};

// ── Internal chip class ───────────────────────────────────────────────────────

const CHIP_CLASS =
	"inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// ── Internal Chip sub-component ───────────────────────────────────────────────

type ChipProps = {
	platform: SharePlatform;
	canonicalUrl: string;
	postSlug: string;
	postTitle: string;
	label: string;
	ariaLabel: string;
	onCopy: () => Promise<void>;
	/** ARIA role override — "menuitem" in dropdown context (ADR-005). */
	itemRole?: React.AriaRole;
	/**
	 * When true (admin dropdown), every chip — including platform ones —
	 * writes the platform-tagged URL to the clipboard instead of opening a
	 * share-intent in a new tab. The admin dashboard is a private surface;
	 * authors typically grab a URL to paste into Slack, an email, or a DM
	 * client, not bounce through twitter.com/intent. The "copy" chip in this
	 * mode still copies the un-tagged canonical URL.
	 */
	copyOnly?: boolean;
	onCopyTagged?: (taggedUrl: string) => Promise<void>;
};

function Chip({
	platform,
	canonicalUrl,
	postSlug,
	postTitle,
	label,
	ariaLabel,
	onCopy,
	itemRole,
	copyOnly = false,
	onCopyTagged,
}: ChipProps) {
	const { id, Icon, href } = platform;
	const taggedUrl = buildTaggedUrl(canonicalUrl, id as PlatformId, postSlug);

	if (id === "copy") {
		return (
			<button
				type="button"
				onClick={onCopy}
				aria-label={ariaLabel}
				role={itemRole}
				className={CHIP_CLASS}
			>
				<Icon className="h-4 w-4" aria-hidden="true" />
				{label}
			</button>
		);
	}

	if (copyOnly) {
		return (
			<button
				type="button"
				onClick={() => onCopyTagged?.(taggedUrl)}
				aria-label={ariaLabel}
				role={itemRole}
				className={CHIP_CLASS}
			>
				<Icon className="h-4 w-4" aria-hidden="true" />
				{label}
			</button>
		);
	}

	// All non-copy platforms define href; guard prevents runtime crash if type
	// invariant is ever violated without a non-null assertion.
	const intentUrl = href ? href(taggedUrl, postTitle) : "";
	return (
		<a
			href={intentUrl}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={ariaLabel}
			role={itemRole}
			className={CHIP_CLASS}
		>
			<Icon className="h-4 w-4" aria-hidden="true" />
			{label}
		</a>
	);
}

// ── PostShare ─────────────────────────────────────────────────────────────────

/**
 * PostShare — renders share chips in two variants (ADR-003):
 *
 * `variant="inline"` (default) — chip row on public post detail:
 *   - 6 chips: X, LinkedIn, Reddit, WhatsApp, Email, Copy
 *   - Each chip emits a per-platform UTM-tagged URL (ADR-001)
 *   - After client mount: swaps to a single native Share button when
 *     `navigator.share` is available (mobile / modern browser)
 *   - Copy writes the canonical URL (no UTM) to clipboard
 *
 * `variant="dropdown"` — Radix Popover on admin posts list (ADR-005):
 *   - Single icon-button trigger; clicking opens a Popover panel
 *   - Popover content has `role="menu"`; each chip has `role="menuitem"`
 *   - Native share swap NEVER applies in this variant
 *   - Copy still writes canonical URL
 *
 * SSR-safe: initial render uses the relative `postUrl`; a client-side effect
 * upgrades to an absolute URL after hydration.
 */
export function PostShare({
	postUrl,
	postSlug,
	postTitle,
	locale,
	variant = "inline",
}: PostShareProps) {
	const t = strings[locale].postShare;

	/**
	 * Resolved canonical URL. Starts as postUrl (may be relative on SSR);
	 * upgraded to absolute after mount so that platform share-intent links work.
	 */
	const [canonicalUrl, setCanonicalUrl] = useState(postUrl);
	/** true after mount if Web Share API is available AND variant === "inline" */
	const [hasNativeShare, setHasNativeShare] = useState(false);
	/** brief "Copied!" confirmation state */
	const [copied, setCopied] = useState(false);
	/** timer ref for the "Copied!" reset — cleared on new click and on unmount */
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup: cancel any pending reset timer when the component unmounts.
	// Prevents a state update on an unmounted component (minor memory leak).
	useEffect(
		() => () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		// Resolve to absolute URL after mount (postUrl may be a relative path
		// like "/my-slug" on SSR; we need the full URL for social share intents).
		const absoluteUrl = postUrl.startsWith("/")
			? `${window.location.origin}${postUrl}`
			: postUrl;
		setCanonicalUrl(absoluteUrl);

		// Native share swap only applies to the inline variant (ADR-003).
		if (variant === "inline" && typeof navigator.share === "function") {
			setHasNativeShare(true);
		}
	}, [postUrl, variant]);

	async function handleCopyLink() {
		// Copy writes canonical URL — no UTM tagging for clipboard (ADR-001 amendment).
		const copyUrl = buildTaggedUrl(canonicalUrl, "copy", postSlug);
		await writeAndConfirm(copyUrl);
	}

	async function writeAndConfirm(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			// Cancel any previous pending reset before starting a new one so rapid
			// double-clicks don't leave orphaned timers.
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
			copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may be unavailable in non-secure contexts; fail silently.
		}
	}

	async function handleNativeShare() {
		try {
			await navigator.share({
				url: canonicalUrl,
				title: postTitle,
				text: postTitle,
			});
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

	/**
	 * Renders all 6 chips; optionally attaches itemRole for dropdown context.
	 * `copyOnly` is set for the admin dropdown so platform chips write the
	 * tagged URL to the clipboard instead of opening a share intent.
	 */
	function renderChips(itemRole?: React.AriaRole, copyOnly = false) {
		return SHARE_PLATFORMS.map((platform) => {
			const label = t.chips[platform.labelKey];
			const ariaLabel =
				platform.id === "copy"
					? label
					: t.ariaShareOn.replace("{platform}", label);
			return (
				<Chip
					key={platform.id}
					platform={platform}
					canonicalUrl={canonicalUrl}
					postSlug={postSlug}
					postTitle={postTitle}
					label={label}
					ariaLabel={ariaLabel}
					onCopy={handleCopyLink}
					itemRole={itemRole}
					copyOnly={copyOnly}
					onCopyTagged={writeAndConfirm}
				/>
			);
		});
	}

	// ── Inline variant ────────────────────────────────────────────────────────

	if (variant === "inline") {
		// Native share available → swap chip row for native Share button.
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
					{renderChips()}
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

	// ── Dropdown variant (ADR-005) ────────────────────────────────────────────

	return (
		<Popover.Root>
			<Popover.Trigger asChild>
				<button
					type="button"
					aria-label="Share post"
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Share2 className="h-4 w-4" aria-hidden="true" />
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					role="menu"
					align="end"
					sideOffset={4}
					className="z-50 flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-md"
				>
					{renderChips("menuitem", true)}
					{/* Clipboard confirmation inside dropdown */}
					<output
						aria-live="polite"
						aria-atomic="true"
						className="block px-2 text-center text-xs text-foreground-secondary"
					>
						{copied ? t.copied : ""}
					</output>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
