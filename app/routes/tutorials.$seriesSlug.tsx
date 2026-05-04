import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";
import { TutorialStep } from "#/components/ui/tutorial-step";

export const Route = createFileRoute("/tutorials/$seriesSlug")({
	head: () => ({
		meta: [{ title: "Série — Antonio Fulgencio Blog" }],
	}),
	component: SeriesDetailPage,
});

const seriesData: Record<
	string,
	{
		title: string;
		description: string;
		tag: string;
		steps: { title: string; description: string; isCompleted: boolean }[];
	}
> = {
	"tanstack-blog": {
		title: "Criando um Blog com TanStack Start",
		description:
			"Aprenda do zero a criar um blog moderno com SSR, MDX e deploy em VPS.",
		tag: "TanStack",
		steps: [
			{
				title: "Setup do projeto com Bun e TanStack Start",
				description:
					"Configurando o ambiente de desenvolvimento e criando a estrutura inicial.",
				isCompleted: true,
			},
			{
				title: "Roteamento e layouts com TanStack Router",
				description:
					"Criando o sistema de rotas file-based e layouts reutilizáveis.",
				isCompleted: true,
			},
			{
				title: "MDX e renderização de artigos",
				description:
					"Integrando MDX para renderizar conteúdo com componentes React.",
				isCompleted: true,
			},
			{
				title: "Database e admin panel",
				description:
					"Configurando PostgreSQL com Drizzle ORM e painel administrativo.",
				isCompleted: true,
			},
			{
				title: "Deploy em VPS com Docker",
				description: "Publicando o blog em produção com Docker e CI/CD.",
				isCompleted: false,
			},
		],
	},
	"vps-bun": {
		title: "Deploy em VPS com Bun",
		description: "Configure um servidor VPS do zero com Bun, Docker e CI/CD.",
		tag: "DevOps",
		steps: [
			{
				title: "Provisionando uma VPS",
				description:
					"Escolhendo provider, configurando SSH e segurança básica.",
				isCompleted: true,
			},
			{
				title: "Instalando Bun e Docker",
				description: "Setup do runtime e containerização de apps.",
				isCompleted: false,
			},
			{
				title: "CI/CD com GitHub Actions",
				description: "Automatizando deploys com workflows do GitHub.",
				isCompleted: false,
			},
		],
	},
};

function SeriesDetailPage() {
	const { seriesSlug } = Route.useParams();
	const data = seriesData[seriesSlug];

	if (!data) {
		return (
			<div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
				<BookOpen className="h-12 w-12 text-foreground-muted" />
				<h1 className="font-heading text-xl font-bold text-foreground">
					Série não encontrada
				</h1>
				<Link to="/tutorials" className="text-sm text-accent hover:underline">
					Voltar para Tutoriais
				</Link>
			</div>
		);
	}

	const completedSteps = data.steps.filter((s) => s.isCompleted).length;
	const progress = Math.round((completedSteps / data.steps.length) * 100);

	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-3xl">
				<Link
					to="/tutorials"
					className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground-secondary hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Voltar para Tutoriais
				</Link>

				<div className="flex flex-col gap-4">
					<span className="w-fit rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
						{data.tag}
					</span>
					<h1 className="font-heading text-2xl font-extrabold text-foreground lg:text-3xl">
						{data.title}
					</h1>
					<p className="leading-relaxed text-foreground-secondary">
						{data.description}
					</p>

					<div className="flex items-center gap-4 text-sm text-foreground-muted">
						<span className="inline-flex items-center gap-1.5">
							<BookOpen className="h-4 w-4" />
							{data.steps.length} partes
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Clock className="h-4 w-4" />
							{progress}% completo
						</span>
					</div>

					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-accent transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>

				<div className="mt-10 flex flex-col">
					{data.steps.map((step, i) => (
						<TutorialStep
							key={step.title}
							number={i + 1}
							title={step.title}
							description={step.description}
							isCompleted={step.isCompleted}
							isActive={!step.isCompleted && i === completedSteps}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
