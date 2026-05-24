import {
	ExternalLink,
	Github,
	Instagram,
	Linkedin,
	Mail,
	Rss,
	Twitter,
} from "lucide-react";

type LinkKind =
	| "github"
	| "linkedin"
	| "email"
	| "other"
	| "x"
	| "instagram"
	| "rss";

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

export function SocialLink({ label, url, kind }: Props) {
	const Icon = iconByKind[kind];
	const isExternal = !url.startsWith("mailto:");

	return (
		<a
			href={url}
			className="group inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			{...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}
		>
			<Icon
				className="h-4 w-4 text-foreground-muted transition-colors group-hover:text-accent"
				aria-hidden="true"
			/>
			<span>{label}</span>
		</a>
	);
}
