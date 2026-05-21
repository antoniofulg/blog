import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "#/lib/locale";

const ariaStrings: Record<
	Locale,
	{ label: string; prev: string; next: string }
> = {
	en: { label: "Pagination", prev: "Previous page", next: "Next page" },
	"pt-br": {
		label: "Paginação",
		prev: "Página anterior",
		next: "Próxima página",
	},
};

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
	locale = "en",
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	locale?: Locale;
}) {
	const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
	const s = ariaStrings[locale];

	return (
		<nav
			className="flex items-center justify-center gap-1"
			aria-label={s.label}
		>
			<button
				type="button"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
				className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				aria-label={s.prev}
			>
				<ChevronLeft className="h-4 w-4" aria-hidden="true" />
			</button>

			{pages.map((page) => (
				<button
					key={page}
					type="button"
					onClick={() => onPageChange(page)}
					aria-current={page === currentPage ? "page" : undefined}
					className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
						page === currentPage
							? "bg-accent text-foreground-inverse"
							: "text-foreground-secondary hover:bg-muted"
					}`}
				>
					{page}
				</button>
			))}

			<button
				type="button"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
				className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				aria-label={s.next}
			>
				<ChevronRight className="h-4 w-4" aria-hidden="true" />
			</button>
		</nav>
	);
}
