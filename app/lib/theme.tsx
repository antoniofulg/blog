import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useLocale } from "#/lib/locale";

export type Theme = "light" | "dark" | "cs16";

/**
 * Identifies how a cs16 theme activation was triggered.
 * Passed to `setTheme` and forwarded to the `recordThemeEvent` server fn.
 * Per ADR-002: only cs16 activations are recorded; light/dark changes do not
 * carry a source.
 */
export type ThemeSource = "long-press" | "keyboard";

const ThemeContext = createContext<{
	theme: Theme;
	toggle: () => void;
	setTheme: (theme: Theme, source?: ThemeSource) => void;
}>({ theme: "light", toggle: () => {}, setTheme: () => {} });

/**
 * Module-level flag tracking whether the Press Start 2P font `<link>` has been
 * injected into `document.head` in this page session.
 *
 * Lives in module scope, NOT React state — per ADR-004. This means it survives
 * React re-renders and is reset only by a full page reload, preventing duplicate
 * `<link>` elements on repeated cs16 activations within the same session.
 */
let cs16FontLoaded = false;

/**
 * Appends a `<link rel="stylesheet">` for the Press Start 2P font exactly once
 * per page load. Subsequent calls are a no-op (idempotent via module flag).
 *
 * Returns early without error when `document` is undefined (SSR path).
 *
 * URL contract (ADR-004): `/_fontsource/press-start-2p/latin-400.css`
 * served via Nitro `publicAssets` (task_03).
 */
export function ensureCs16Font(): void {
	if (cs16FontLoaded || typeof document === "undefined") return;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = "/_fontsource/press-start-2p/latin-400.css";
	link.dataset.cs16 = "true";
	document.head.appendChild(link);
	cs16FontLoaded = true;
}

/**
 * Resets the module-level cs16FontLoaded flag.
 *
 * @internal Test-only. Call in `beforeEach` / `afterEach` alongside DOM cleanup.
 * Production code never calls this — the flag's lifecycle is the page session.
 */
export function _resetCs16FontFlagForTest(): void {
	cs16FontLoaded = false;
}

function applyThemeClass(theme: Theme) {
	const root = document.documentElement;
	root.classList.remove("dark", "cs16");
	if (theme === "dark") root.classList.add("dark");
	else if (theme === "cs16") root.classList.add("cs16");
}

function isTheme(value: string | null): value is Theme {
	return value === "light" || value === "dark" || value === "cs16";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>("light");
	const { locale } = useLocale();

	// Hydration effect: reads localStorage/media query on mount.
	// Also calls ensureCs16Font() for returning cs16 visitors so the font is
	// injected immediately — no user interaction required (AC-5).
	useEffect(() => {
		const stored = localStorage.getItem("theme");
		const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
		const resolved: Theme = isTheme(stored) ? stored : preferred;
		setThemeState(resolved);
		applyThemeClass(resolved);
		if (resolved === "cs16") {
			ensureCs16Font();
		}
	}, []);

	/**
	 * Switches the active theme. For cs16 activations:
	 *  - Calls ensureCs16Font() before any state update.
	 *  - Dispatches recordThemeEvent server fn (fire-and-forget; never throws).
	 *
	 * Light/dark changes do NOT dispatch telemetry and do NOT touch the font —
	 * per ADR-002 (telemetry-only-for-cs16 scope).
	 *
	 * @param next   Target theme.
	 * @param source Attribution source — defaults to 'long-press' so existing
	 *               call sites (theme-toggle.tsx pickTheme) stay valid unchanged.
	 */
	const setTheme = useCallback(
		(next: Theme, source: ThemeSource = "long-press") => {
			if (next === "cs16") {
				ensureCs16Font();
				// Dynamic import of the non-.server. wrapper (dispatch-theme-event.ts)
				// avoids TanStack Start's import-protection plugin, which blocks any
				// *.server.* import from the client bundle. dispatch-theme-event.ts
				// defines a createServerFn() whose handler delegates to the actual
				// server fn in record-theme-event.server.ts — transparent to the caller.
				// Failures are silently swallowed — analytics MUST NOT surface to visitors.
				import("#/lib/analytics/dispatch-theme-event")
					.then(({ dispatchThemeEvent }) =>
						dispatchThemeEvent({
							data: { theme: "cs16", source, lang: locale },
						}),
					)
					.catch(() => {
						// Silently swallow — analytics failures MUST NOT surface to the visitor.
						// Observable on the server via structured JSON log.
					});
			}
			setThemeState(next);
			localStorage.setItem("theme", next);
			applyThemeClass(next);
		},
		[locale],
	);

	/**
	 * Cycles between light and dark only. Never invokes cs16 — per AC-6.
	 * Preserved semantics: toggle() is the short-click fast path.
	 */
	const toggle = useCallback(() => {
		setThemeState((prev) => {
			const next: Theme = prev === "dark" ? "light" : "dark";
			localStorage.setItem("theme", next);
			applyThemeClass(next);
			return next;
		});
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, toggle, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return useContext(ThemeContext);
}
