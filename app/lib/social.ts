/**
 * Canonical social-kind definitions shared between the server-side schema
 * (`app/lib/mdx/pages.server.ts`) and client-side components
 * (`app/components/ui/static-page-profile.tsx`).
 *
 * All social-related modules derive their type from this single source so that
 * adding a new platform requires only one edit here.
 */
export const SOCIAL_KINDS = [
	"github",
	"linkedin",
	"x",
	"instagram",
	"rss",
	"email",
] as const;

export type SocialKind = (typeof SOCIAL_KINDS)[number];
