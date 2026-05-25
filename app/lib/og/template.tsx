export type TokenSpan = {
	content: string;
	color: string;
};

export type TokenLine = TokenSpan[];

export type CardTemplateProps = {
	title: string;
	/** Pre-tokenized lines from Shiki codeToTokens. Null when the post has no code block. */
	tokenLines: TokenLine[] | null;
	/** True when code was truncated — triggers a fade gradient at the bottom of the code area */
	didTruncate: boolean;
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
	didTruncate,
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
			{/* Title */}
			<div
				style={{
					display: "flex",
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

					{/* Fade-out gradient when code was truncated */}
					{didTruncate && (
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
					)}
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
