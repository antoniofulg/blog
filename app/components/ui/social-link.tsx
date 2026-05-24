import {
	ExternalLink,
	Github,
	Instagram,
	Linkedin,
	Mail,
	Rss,
	Twitter,
} from "lucide-react";
import type { SocialKind } from "#/lib/social";

// Derived from the shared SocialKind so that adding a new platform to
// SOCIAL_KINDS causes a TS exhaustiveness error in iconByKind, forcing
// the icon entry to be added here at compile time.
type LinkKind = SocialKind | "other";

const iconByKind: Record<LinkKind, typeof Github> = {
	github: Github,
	linkedin: Linkedin,
	email: Mail,
	other: ExternalLink,
	x: Twitter,
	instagram: Instagram,
	rss: Rss,
};

type Props = {
	label: string;
	url: string;
	kind: LinkKind;
};

/**
 * SocialLink — icon-only ghost-button affordance matching the
 * `button-ghost` token in DESIGN.md §5 Components (40×40, bg-surface
 * rest, bg-muted hover, rounded-md). The `label` prop is exposed only
 * as `aria-label` + `title` so screen readers and hover-tooltips still
 * announce the platform identity; the chip itself reads as quiet
 * typography-first chrome that does not compete with the prose.
 *
 * Email kind auto-detects `mailto:` URLs and skips `target="_blank"`
 * so the OS mail client opens in the foreground.
 */
export function SocialLink({ label, url, kind }: Props) {
	const Icon = iconByKind[kind];
	const isExternal = !url.startsWith("mailto:");

	return (
		<a
			href={url}
			aria-label={label}
			title={label}
			className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground-secondary transition-colors hover:bg-muted hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			{...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}
		>
			<Icon className="h-[18px] w-[18px]" aria-hidden="true" />
		</a>
	);
}
