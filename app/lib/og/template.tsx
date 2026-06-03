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
	/**
	 * True when `truncateCode` actually cut the source (line or char cap). Drives
	 * the bottom "more code below" fade. Gating on this real signal — not the line
	 * count — keeps a complete 10-line block (nothing cut) clean, while still
	 * fading genuinely truncated blocks (ADR-005). Defaults to false.
	 */
	didTruncate?: boolean;
	/** Site URL shown in footer (e.g. "https://antoniofulg.tech") */
	siteUrl?: string;
	/** Round profile photo as a base64 data URI, shown bottom-left in the footer. */
	avatarDataUri?: string;
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
// Code-panel sizing (ADR-005). The panel sizes to its content (flexGrow: 0) and
// caps at CODE_PANEL_MAX_HEIGHT. VISIBLE_LINE_CAP matches the truncateCode 10-line
// limit, so a complete (un-truncated) block up to 10 lines renders in full with no
// clip; the fade is driven by the real `didTruncate` signal, not the line count, so
// an exact-10-line block is never clipped under a misleading fade. Each row is
// exactly LINE_HEIGHT tall (whiteSpace: "pre", no wrapping), so line count maps
// directly to height.
const LINE_HEIGHT = 28;
const PANEL_PADDING_Y = 20;
const VISIBLE_LINE_CAP = 10;
const CODE_PANEL_MAX_HEIGHT =
	VISIBLE_LINE_CAP * LINE_HEIGHT + PANEL_PADDING_Y * 2;

// Pre-defined style constants to keep JSX elements on single lines (biome-ignore works per-line)
const LINE_ROW_STYLE = {
	display: "flex",
	flexDirection: "row" as const,
	minHeight: LINE_HEIGHT,
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
	didTruncate = false,
	siteUrl,
	avatarDataUri,
}: CardTemplateProps) {
	const displayUrl = siteUrl
		? siteUrl.replace(/^https?:\/\//, "")
		: "antoniofulg.tech";

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
			    into the code block below. When a tall title claims the space, the
			    spacer below the code panel collapses first, then the panel
			    (flexShrink: 1, minHeight: 0, overflow: hidden) shrinks and clips
			    its bottom lines — title takes priority over code. */}
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

			{/* Code panel — sizes to its content (flexGrow: 0) and caps at
			    CODE_PANEL_MAX_HEIGHT (ADR-005). flexShrink: 1 + minHeight: 0 still
			    let the panel shrink BELOW its intrinsic content height when a tall
			    title claims the space, so overflow: hidden clips the bottom code
			    lines (the title stays whole). The bottom fade is rendered only when
			    truncateCode actually cut the source (`didTruncate`) — complete
			    snippets stay clean with no fade over their code. */}
			{tokenLines !== null && tokenLines.length > 0 ? (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flexGrow: 0,
						flexShrink: 1,
						minHeight: 0,
						maxHeight: CODE_PANEL_MAX_HEIGHT,
						backgroundColor: codeBg,
						borderRadius: 8,
						padding: `${PANEL_PADDING_Y}px 24px`,
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

					{/* Bottom fade — rendered only when truncateCode actually cut the
					    source (`didTruncate`), signaling "more code below". Gating on the
					    real truncation signal (not the line count) keeps a complete
					    10-line block — nothing cut — clean, instead of fading its last
					    line under a misleading gradient (ADR-005). */}
					{didTruncate ? (
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
					) : null}
				</div>
			) : null}

			{/* Spacer — always rendered between the code panel and the footer.
			    flexGrow: 1 fills the gap below a short (or absent) panel so the
			    footer stays bottom-pinned; it collapses first when a tall title
			    squeezes the layout. */}
			<div style={{ display: "flex", flexGrow: 1 }} />

			{/* Footer */}
			<div
				style={{
					display: "flex",
					flexDirection: "row",
					alignItems: "center",
					marginTop: 28,
				}}
			>
				{/* Round profile photo, bottom-left. Falls back to the Terminal mark
				    when no avatar data URI is supplied (best-effort load). */}
				{avatarDataUri ? (
					<img
						src={avatarDataUri}
						width={44}
						height={44}
						alt=""
						style={{
							width: 44,
							height: 44,
							borderRadius: 22,
							objectFit: "cover",
						}}
					/>
				) : (
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
				)}

				<span
					style={{
						fontSize: 20,
						color: TITLE_COLOR,
						marginLeft: 12,
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
