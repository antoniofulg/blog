import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
	head: () => ({
		meta: [{ title: "Buscar — Antonio Fulgencio Blog" }],
	}),
	component: SearchPage,
});

function SearchPage() {
	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-3xl flex flex-col items-center gap-4 text-center">
				<h1 className="font-heading text-3xl font-extrabold text-foreground">
					Buscar
				</h1>
				<p className="text-sm text-foreground-secondary">
					{/* TODO: Wire to a full-text search provider (e.g. Meilisearch, Algolia) */}
					A busca estará disponível em breve.
				</p>
			</div>
		</div>
	);
}
