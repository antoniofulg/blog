import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Github } from "lucide-react";

export const Route = createFileRoute("/projects")({
	head: () => ({
		meta: [
			{ title: "Projetos — Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Projetos pessoais e profissionais que desenvolvi ao longo da minha carreira.",
			},
		],
	}),
	component: ProjectsPage,
});

const projects = [
	{
		title: "Antonio Fulgencio Blog",
		desc: "Blog técnico pessoal com SSR, MDX, TanStack Start e Bun. Design system com Tailwind e shadcn/ui.",
		status: "Em Produção",
		statusColor: "bg-callout-tip text-success",
		tags: ["React", "TanStack", "Bun"],
		github: "#",
		demo: "#",
	},
	{
		title: "DevDash CLI",
		desc: "CLI tool para gerenciar ambientes de desenvolvimento, scripts e deploy de projetos web.",
		status: "Em Desenvolvimento",
		statusColor: "bg-callout-warn text-warning",
		tags: ["Bun", "TypeScript"],
		github: "#",
	},
	{
		title: "React Form Toolkit",
		desc: "Biblioteca de formulários para React com validação, tipagem forte e integração com shadcn/ui.",
		status: "Open Source",
		statusColor: "bg-accent-light text-accent",
		tags: ["React", "TypeScript"],
		github: "#",
		demo: "#",
	},
];

const filters = [
	"Todos",
	"React",
	"TypeScript",
	"Bun",
	"Django",
	"Open Source",
];

function ProjectsPage() {
	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
					Projetos
				</h1>
				<p className="mt-3 text-foreground-secondary">
					Projetos pessoais e profissionais que desenvolvi ao longo da minha
					carreira.
				</p>

				<div className="mt-8 flex flex-wrap gap-2">
					{filters.map((f, i) => (
						<button
							key={f}
							type="button"
							className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
								i === 0
									? "bg-accent text-foreground-inverse"
									: "bg-surface text-foreground hover:bg-muted"
							}`}
						>
							{f}
						</button>
					))}
				</div>

				<div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{projects.map((p) => (
						<article
							key={p.title}
							className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
						>
							<div className="h-40 bg-muted" />
							<div className="flex flex-1 flex-col gap-3 p-5">
								<span
									className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${p.statusColor}`}
								>
									{p.status}
								</span>
								<h2 className="font-heading text-lg font-bold text-foreground">
									{p.title}
								</h2>
								<p className="text-sm leading-relaxed text-foreground-secondary">
									{p.desc}
								</p>
								<div className="flex flex-wrap gap-1.5">
									{p.tags.map((t) => (
										<span
											key={t}
											className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent"
										>
											{t}
										</span>
									))}
								</div>
								<div className="mt-auto flex gap-2 pt-2">
									<a
										href={p.github}
										className="inline-flex items-center gap-1.5 rounded-sm bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
									>
										<Github className="h-3.5 w-3.5" />
										GitHub
									</a>
									{p.demo && (
										<a
											href={p.demo}
											className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-foreground-inverse"
										>
											<ExternalLink className="h-3.5 w-3.5" />
											Demo
										</a>
									)}
								</div>
							</div>
						</article>
					))}
				</div>
			</div>
		</div>
	);
}
