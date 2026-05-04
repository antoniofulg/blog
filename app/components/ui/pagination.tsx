import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

	return (
		<nav
			className="flex items-center justify-center gap-1"
			aria-label="Paginação"
		>
			<button
				type="button"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
				className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
				aria-label="Página anterior"
			>
				<ChevronLeft className="h-4 w-4" />
			</button>

			{pages.map((page) => (
				<button
					key={page}
					type="button"
					onClick={() => onPageChange(page)}
					className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors ${
						page === currentPage
							? "bg-accent text-foreground-inverse"
							: "text-foreground-secondary hover:bg-muted"
					}`}
					aria-current={page === currentPage ? "page" : undefined}
				>
					{page}
				</button>
			))}

			<button
				type="button"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
				className="flex h-9 w-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent"
				aria-label="Próxima página"
			>
				<ChevronRight className="h-4 w-4" />
			</button>
		</nav>
	);
}
