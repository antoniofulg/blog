import { useLocation } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

const COPY: Record<Locale, { message: string; dismissLabel: string }> = {
	en: {
		message:
			"🚧 This blog is a work in progress — content and features are still being added.",
		dismissLabel: "Dismiss work-in-progress notice",
	},
	"pt-br": {
		message:
			"🚧 Este blog está em desenvolvimento — conteúdo e recursos ainda estão sendo adicionados.",
		dismissLabel: "Dispensar aviso de blog em desenvolvimento",
	},
};

const DISMISS_KEY = "wip-banner-dismissed-v1";

export function WipBanner() {
	const { pathname } = useLocation();
	const segment = pathname.split("/")[1] as Locale;
	const locale = LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
	const t = COPY[locale];

	const [visible, setVisible] = useState(true);

	useEffect(() => {
		if (localStorage.getItem(DISMISS_KEY) === "1") setVisible(false);
	}, []);

	if (!visible) return null;

	return (
		<div className="bg-orange-700 text-white">
			<div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2 text-sm font-medium">
				<span>{t.message}</span>
				<button
					type="button"
					aria-label={t.dismissLabel}
					onClick={() => {
						localStorage.setItem(DISMISS_KEY, "1");
						setVisible(false);
					}}
					className="-mr-1 rounded p-1 transition-colors hover:bg-black/15 focus:outline-none focus:ring-2 focus:ring-white/60"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
