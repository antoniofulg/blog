import { useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

const COPY: Record<Locale, { message: string; dismissLabel: string }> = {
	en: {
		message:
			"This blog is a work in progress. Content and features are still being added.",
		dismissLabel: "Dismiss work-in-progress notice",
	},
	"pt-br": {
		message:
			"Este blog está em desenvolvimento. Conteúdo e recursos ainda estão sendo adicionados.",
		dismissLabel: "Dispensar aviso de blog em desenvolvimento",
	},
};

const DISMISS_KEY = "wip-banner-dismissed-v1";

// Custom event dispatched on same-tab dismiss so useSyncExternalStore
// re-reads sessionStorage immediately (the native `storage` event only
// fires for cross-tab writes, not same-tab ones).
const DISMISS_EVENT = "wip-banner-dismissed";

function subscribe(callback: () => void) {
	window.addEventListener(DISMISS_EVENT, callback);
	return () => window.removeEventListener(DISMISS_EVENT, callback);
}

function getClientSnapshot() {
	return sessionStorage.getItem(DISMISS_KEY) !== "1";
}

// Server snapshot: banner hidden during SSR — no hydration mismatch
// when a returning user (dismissed banner) loads the page.
function getServerSnapshot() {
	return false;
}

function dismiss() {
	sessionStorage.setItem(DISMISS_KEY, "1");
	window.dispatchEvent(new Event(DISMISS_EVENT));
}

export function WipBanner() {
	const { pathname } = useLocation();
	const segment = pathname.split("/")[1] as Locale;
	const locale = LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
	const t = COPY[locale];

	const visible = useSyncExternalStore(
		subscribe,
		getClientSnapshot,
		getServerSnapshot,
	);

	if (!visible) return null;

	return (
		<div className="wip-banner bg-accent text-foreground-inverse">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2 text-sm font-medium">
				<span>{t.message}</span>
				<button
					type="button"
					aria-label={t.dismissLabel}
					onClick={dismiss}
					className="-mr-1 rounded p-1 transition-colors hover:bg-black/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-inverse focus-visible:ring-offset-2 focus-visible:ring-offset-accent"
				>
					<X className="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}
