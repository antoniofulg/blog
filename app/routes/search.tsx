import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/search")({
	head: () => ({
		meta: [{ title: "Buscar — Antonio Fulgencio Blog" }],
	}),
	component: SearchPage,
});

function SearchPage() {
	const [query, setQuery] = useState("");

	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-3xl">
				<div className="flex flex-col items-center gap-4">
					<h1 className="font-heading text-3xl font-extrabold text-foreground">
						Buscar
					</h1>
					<div className="flex w-full max-w-xl items-center gap-3 rounded-lg border-2 border-accent bg-background px-4 py-3">
						<SearchIcon className="h-5 w-5 text-accent" />
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Buscar artigos, tutoriais, categorias..."
							className="flex-1 bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none"
						/>
					</div>
					{query && (
						<p className="text-sm text-foreground-secondary">
							Resultados para &ldquo;{query}&rdquo;
						</p>
					)}
				</div>

				{!query && (
					<div className="mt-16 flex flex-col items-center gap-4 text-center">
						<SearchIcon className="h-12 w-12 text-foreground-muted" />
						<h2 className="font-heading text-lg font-semibold text-foreground">
							Comece a buscar
						</h2>
						<p className="text-sm text-foreground-secondary">
							Digite um termo para encontrar artigos, tutoriais e categorias.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
