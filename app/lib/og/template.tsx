export type TokenSpan = {
	content: string;
	color: string;
};

export type TokenLine = TokenSpan[];

export type CardTemplateProps = {
	title: string;
	/** Pre-tokenized lines from Shiki codeToTokens. Null when the post has no code block. */
	tokenLines: TokenLine[] | null;
	/** Background color from Shiki theme (e.g. "#24292e" for github-dark) */
	codeBg: string;
	/** Foreground/default text color from Shiki theme */
	codeFg: string;
	/** Site URL shown in footer (e.g. "https://antoniofulg.dev") */
	siteUrl?: string;
};

const CARD_BG = "#0d1117";
const TITLE_COLOR = "#f0f6fc";
const FOOTER_COLOR = "#8b949e";
const ACCENT_COLOR = "#7ee787";

/**
 * OG card template — 1200 × 630 px, satori-compatible CSS subset.
 *
 * Constraints respected:
 * - No CSS variables
 * - No display: grid (only flexbox)
 * - No pseudo-elements
 * - No @keyframes
 * - All dimensions in px or unitless numbers
 */
// Pre-defined style constants to keep JSX elements on single lines (biome-ignore works per-line)
const LINE_ROW_STYLE = {
	display: "flex",
	flexDirection: "row" as const,
	minHeight: 28,
};

const EMPTY_SPAN_STYLE = {
	fontFamily: "JetBrains Mono",
	fontSize: 20,
	whiteSpace: "pre" as const,
};

const TOKEN_SPAN_STYLE = {
	fontFamily: "JetBrains Mono",
	fontSize: 20,
	whiteSpace: "pre" as const,
};

export function CardTemplate({
	title,
	tokenLines,
	codeBg,
	codeFg,
	siteUrl,
}: CardTemplateProps) {
	const displayUrl = siteUrl
		? siteUrl.replace(/^https?:\/\//, "")
		: "antoniofulg.dev";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: 1200,
				height: 630,
				backgroundColor: CARD_BG,
				fontFamily: "Inter",
				padding: "48px",
			}}
		>
			{/* Title — pinned with flexShrink: 0 so the full title always renders
			    at its natural height. Without this, a long (multi-line) title's
			    flex box is shrunk by the engine and its text overflows downward
			    into the code block below. The code block (flexGrow: 1, minHeight:
			    0, overflow: hidden) absorbs the squeeze and clips its bottom
			    lines instead — title takes priority over code. */}
			<div
				style={{
					display: "flex",
					flexShrink: 0,
					fontSize: 56,
					fontWeight: 700,
					color: TITLE_COLOR,
					lineHeight: 1.2,
					marginBottom: 28,
					maxWidth: 1104,
				}}
			>
				{title}
			</div>

			{/* Code block */}
			{tokenLines !== null && tokenLines.length > 0 ? (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flexGrow: 1,
						// flexShrink + minHeight: 0 let this block shrink BELOW its
						// intrinsic content height when a tall title claims the space,
						// so overflow: hidden clips the bottom code lines (the title
						// stays whole). Without minHeight: 0 a flex column refuses to
						// shrink past its content and the title would be pushed off-card.
						flexShrink: 1,
						minHeight: 0,
						backgroundColor: codeBg,
						borderRadius: 8,
						padding: "20px 24px",
						overflow: "hidden",
						position: "relative",
					}}
				>
					{tokenLines.map((line, lineIdx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: satori renders once — no reconciliation occurs
						<div key={`l-${lineIdx}`} style={LINE_ROW_STYLE}>
							{line.length === 0 ? (
								/* Empty line — render a space so the row takes height */
								<span style={{ ...EMPTY_SPAN_STYLE, color: codeFg }}> </span>
							) : (
								line.map((token, tokenIdx) => {
									const s = { ...TOKEN_SPAN_STYLE, color: token.color };
									return (
										// biome-ignore lint/suspicious/noArrayIndexKey: satori renders once — no reconciliation occurs
										<span key={`t-${lineIdx}-${tokenIdx}`} style={s}>
											{token.content}
										</span>
									);
								})
							)}
						</div>
					))}

					{/* Bottom fade — always rendered. It signals "more code below"
					    whether the code was cut by truncateCode OR clipped because a
					    long title shrank the block. On short, fully-visible code the
					    fade blends transparent→codeBg over empty background and is
					    effectively invisible, so it is safe to render unconditionally. */}
					<div
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
							right: 0,
							height: 80,
							backgroundImage: `linear-gradient(to bottom, transparent, ${codeBg})`,
						}}
					/>
				</div>
			) : (
				/* No code block — empty flex spacer so footer stays at bottom */
				<div style={{ display: "flex", flexGrow: 1 }} />
			)}

			{/* Footer */}
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					marginTop: 28,
				}}
			>
				{/* Terminal icon (lucide-style inline SVG) */}
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke={ACCENT_COLOR}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-label="Terminal"
					role="img"
				>
					<title>Terminal</title>
					<polyline points="4 17 10 11 4 5" />
					<line x1="12" y1="17" x2="20" y2="17" />
				</svg>

				<span
					style={{
						fontSize: 20,
						color: TITLE_COLOR,
						marginLeft: 10,
						fontWeight: 600,
					}}
				>
					Antonio Fulgencio Blog
				</span>

				<span
					style={{
						fontSize: 18,
						color: FOOTER_COLOR,
						marginLeft: 16,
					}}
				>
					{displayUrl}
				</span>
			</div>
		</div>
	);
}
