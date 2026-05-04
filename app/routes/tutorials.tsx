import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";

export const Route = createFileRoute("/tutorials")({
	head: () => ({
		meta: [
			{ title: "Tutoriais — Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Séries completas e tutoriais passo-a-passo sobre desenvolvimento web moderno.",
			},
		],
	}),
	component: TutorialsPage,
});

const series = [
	{
		slug: "tanstack-blog",
		title: "Criando um Blog com TanStack Start",
		description:
			"Aprenda do zero a criar um blog moderno com SSR, MDX e deploy em VPS.",
		tag: "TanStack",
		parts: 5,
		progress: 80,
		status: "Em andamento",
	},
	{
		slug: "vps-bun",
		title: "Deploy em VPS com Bun",
		description: "Configure um servidor VPS do zero com Bun, Docker e CI/CD.",
		tag: "DevOps",
		parts: 3,
		progress: 33,
		status: "Em andamento",
	},
	{
		slug: "typescript-avancado",
		title: "TypeScript Avançado para React",
		description: "Domine patterns avançados de TypeScript aplicados ao React.",
		tag: "TypeScript",
		parts: 5,
		progress: 10,
		status: "Nova",
	},
	{
		slug: "design-system-react",
		title: "Design System com React e Tailwind",
		description:
			"Crie um design system completo e reutilizável com tokens, componentes e documentação.",
		tag: "UI/UX",
		parts: 4,
		progress: 0,
		status: "Em breve",
	},
];

function TutorialsPage() {
	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<div className="flex items-center gap-3">
					<BookOpen className="h-8 w-8 text-accent" />
					<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
						Tutoriais & Séries
					</h1>
				</div>
				<p className="mt-3 text-foreground-secondary">
					Séries completas e tutoriais passo-a-passo sobre desenvolvimento web
					moderno.
				</p>

				<div className="mt-10 grid gap-6 md:grid-cols-2">
					{series.map((s) => (
						<Link
							key={s.slug}
							to="/tutorials/$seriesSlug"
							params={{ seriesSlug: s.slug }}
							className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
						>
							<div className="flex items-center justify-between">
								<span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
									{s.tag}
								</span>
								<span className="text-xs font-medium text-foreground-muted">
									{s.status}
								</span>
							</div>
							<h2 className="font-heading text-lg font-bold leading-snug text-foreground group-hover:text-accent">
								{s.title}
							</h2>
							<p className="text-sm leading-relaxed text-foreground-secondary">
								{s.description}
							</p>
							<div className="flex items-center justify-between">
								<span className="text-xs text-foreground-muted">
									{s.parts} partes
								</span>
								<span className="inline-flex items-center gap-1 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
									Ver série <ArrowRight className="h-3 w-3" />
								</span>
							</div>
							<div className="h-1 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-accent"
									style={{ width: `${s.progress}%` }}
								/>
							</div>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}
