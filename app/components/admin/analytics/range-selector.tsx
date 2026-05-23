import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyticsRange } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
	value: AnalyticsRange;
	locale: Locale;
	onSelect: (range: AnalyticsRange) => void;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const RANGE_OPTIONS: AnalyticsRange[] = [
	"7d",
	"30d",
	"90d",
	"mtd",
	"ytd",
	"all",
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Accessible range preset dropdown for the analytics dashboard.
 *
 * Keyboard behaviour:
 *   - Tab to focus the trigger button.
 *   - Enter or ArrowDown opens the dropdown and focuses the current selection.
 *   - ArrowDown / ArrowUp navigate options.
 *   - Enter commits the focused option.
 *   - Escape closes without selecting.
 *
 * Navigation is implemented via explicit onKeyDown handlers so the behaviour
 * is testable in jsdom (native <select> keyboard events are not dispatched in
 * the jsdom environment).
 */
export function RangeSelector({ value, locale, onSelect }: Props) {
	const [open, setOpen] = useState(false);
	const [focusedIdx, setFocusedIdx] = useState(-1);

	const t = strings[locale].admin.analytics.range;

	const buttonRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// ── Focus management ────────────────────────────────────────────────────────

	// Move focus to the list whenever the dropdown opens.
	useEffect(() => {
		if (open && listRef.current) {
			listRef.current.focus();
		}
	}, [open]);

	// ── Handlers ────────────────────────────────────────────────────────────────

	const openDropdown = useCallback(() => {
		setOpen(true);
		setFocusedIdx(RANGE_OPTIONS.indexOf(value));
	}, [value]);

	const commitSelection = useCallback(
		(idx: number) => {
			if (idx >= 0 && idx < RANGE_OPTIONS.length) {
				onSelect(RANGE_OPTIONS[idx]);
				setOpen(false);
				buttonRef.current?.focus();
			}
		},
		[onSelect],
	);

	const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openDropdown();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			openDropdown();
		}
	};

	const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setFocusedIdx((prev) => Math.min(prev + 1, RANGE_OPTIONS.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setFocusedIdx((prev) => Math.max(prev - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			commitSelection(focusedIdx);
		} else if (e.key === "Escape") {
			e.preventDefault();
			setOpen(false);
			buttonRef.current?.focus();
		}
	};

	// ── Outside-click close ─────────────────────────────────────────────────────

	useEffect(() => {
		if (!open) return;
		const handleOutside = (e: Event) => {
			if (
				!listRef.current?.contains(e.target as Node) &&
				!buttonRef.current?.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", handleOutside);
		return () => document.removeEventListener("pointerdown", handleOutside);
	}, [open]);

	// ── Render ──────────────────────────────────────────────────────────────────

	return (
		<div className="relative" data-testid="range-selector">
			<button
				ref={buttonRef}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => (open ? setOpen(false) : openDropdown())}
				onKeyDown={handleButtonKeyDown}
				className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				{t[value]}
				{/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative chevron */}
				<span aria-hidden="true" className="text-foreground-muted">
					▾
				</span>
			</button>

			{open && (
				<div
					ref={listRef}
					role="listbox"
					aria-label="Select time range"
					aria-activedescendant={
						focusedIdx >= 0
							? `range-opt-${RANGE_OPTIONS[focusedIdx]}`
							: undefined
					}
					tabIndex={-1}
					onKeyDown={handleListKeyDown}
					className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-md border border-border bg-card py-1 shadow-md focus:outline-none"
				>
					{RANGE_OPTIONS.map((r, i) => (
						<div
							key={r}
							id={`range-opt-${r}`}
							role="option"
							aria-selected={r === value}
							data-focused={i === focusedIdx ? "true" : undefined}
							tabIndex={-1}
							onClick={() => commitSelection(i)}
							onKeyDown={(e) => {
								if (e.key === "Enter") commitSelection(i);
							}}
							className={[
								"cursor-pointer px-3 py-1.5 text-sm",
								r === value
									? "font-medium text-accent"
									: "text-foreground hover:bg-muted",
								i === focusedIdx ? "bg-muted" : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							{t[r]}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
