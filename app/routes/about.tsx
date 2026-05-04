import { createFileRoute } from "@tanstack/react-router";
import {
	Atom,
	BookOpen,
	Database,
	FileCode,
	Github,
	Layout,
	Linkedin,
	Mail,
	Package,
	Route as RouteIcon,
	Twitter,
	User,
} from "lucide-react";

export const Route = createFileRoute("/about")({
	head: () => ({
		meta: [
			{ title: "Sobre — Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Desenvolvedor Full-Stack apaixonado por web moderna, performance e experiência do desenvolvedor.",
			},
		],
	}),
	component: AboutPage,
});

const stack = [
	{ name: "React", icon: Atom, color: "text-accent" },
	{ name: "TypeScript", icon: FileCode, color: "text-tag-typescript" },
	{ name: "Bun", icon: Package, color: "text-accent" },
	{ name: "TanStack", icon: RouteIcon, color: "text-tag-tanstack" },
	{ name: "Next.js", icon: Layout, color: "text-accent" },
	{ name: "Django", icon: Database, color: "text-success" },
];

const experience = [
	{
		area: "Front-end",
		badgeColor: "bg-accent-light text-accent",
		title: "React, TypeScript, Next.js",
		desc: "Construção de interfaces modernas, componentização avançada, SSR/SSG e otimização de performance.",
	},
	{
		area: "Back-end",
		badgeColor: "bg-callout-tip text-success",
		title: "Django, Bun, Node.js",
		desc: "APIs REST, GraphQL, microsserviços, banco de dados e deploy em cloud e VPS.",
	},
	{
		area: "Full-Stack",
		badgeColor: "bg-callout-warn text-warning",
		title: "TanStack, Bun, SSR",
		desc: "Projetos end-to-end com foco em DX, performance e arquitetura moderna.",
	},
];

function AboutPage() {
	return (
		<div className="flex flex-col items-center gap-12 px-5 py-12 lg:px-20 lg:py-16">
			<section className="flex w-full max-w-4xl flex-col items-center gap-12 md:flex-row">
				<div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-accent-light md:h-48 md:w-48">
					<User className="h-16 w-16 text-accent md:h-20 md:w-20" />
				</div>
				<div className="flex flex-col gap-4 text-center md:text-left">
					<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
						Antonio Fulgencio
					</h1>
					<span className="text-lg font-medium text-accent">
						Full-Stack Developer
					</span>
					<p className="leading-relaxed text-foreground-secondary">
						Desenvolvedor Full-Stack apaixonado por web moderna, performance e
						experiência do desenvolvedor. Com experiência internacional,
						trabalho com React, TypeScript, Next.js, TanStack, Bun e Django para
						criar aplicações web escaláveis e de alta qualidade.
					</p>
					<div className="flex justify-center gap-3 md:justify-start">
						<a
							href="https://github.com"
							className="text-foreground-secondary hover:text-foreground"
						>
							<Github className="h-5 w-5" />
						</a>
						<a
							href="https://linkedin.com"
							className="text-foreground-secondary hover:text-foreground"
						>
							<Linkedin className="h-5 w-5" />
						</a>
						<a
							href="https://twitter.com"
							className="text-foreground-secondary hover:text-foreground"
						>
							<Twitter className="h-5 w-5" />
						</a>
					</div>
				</div>
			</section>

			<section className="w-full max-w-4xl">
				<h2 className="mb-6 font-heading text-2xl font-bold text-foreground">
					Stack Principal
				</h2>
				<div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
					{stack.map((tech) => (
						<div
							key={tech.name}
							className="flex flex-col items-center gap-2 rounded-md border border-border bg-card p-4"
						>
							<tech.icon className={`h-7 w-7 ${tech.color}`} />
							<span className="text-xs font-semibold text-foreground">
								{tech.name}
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="w-full max-w-4xl">
				<h2 className="mb-6 font-heading text-2xl font-bold text-foreground">
					Experiência
				</h2>
				<div className="flex flex-col gap-4">
					{experience.map((exp) => (
						<div
							key={exp.area}
							className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
						>
							<span
								className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${exp.badgeColor}`}
							>
								{exp.area}
							</span>
							<h3 className="font-heading text-base font-semibold text-foreground">
								{exp.title}
							</h3>
							<p className="text-sm leading-relaxed text-foreground-secondary">
								{exp.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:justify-center">
				<a
					href="/blog"
					className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-7 py-3 text-sm font-semibold text-foreground-inverse hover:bg-accent-hover"
				>
					<BookOpen className="h-4.5 w-4.5" />
					Ler Artigos
				</a>
				<a
					href="mailto:antoniofulg@gmail.com"
					className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-7 py-3 text-sm font-semibold text-foreground hover:bg-surface"
				>
					<Mail className="h-4.5 w-4.5" />
					Entrar em Contato
				</a>
			</section>
		</div>
	);
}
