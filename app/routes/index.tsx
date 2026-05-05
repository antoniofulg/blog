import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	ArrowRight,
	Code,
	Database,
	FileCode,
	Layout,
	Package,
	Route as RouteIcon,
} from "lucide-react";
import { getPublishedPostsFn } from "#/db/queries";
import type { Post } from "#/db/schema";

const getPublishedPosts = createServerFn({ method: "GET" }).handler(
	getPublishedPostsFn,
);

export const Route = createFileRoute("/")({
	loader: () => getPublishedPosts(),
	head: () => ({
		meta: [
			{ title: "Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Desenvolvedor Full-Stack compartilhando experiências sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional.",
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	const postList = Route.useLoaderData();
	const recentPosts = postList.slice(0, 3);

	return (
		<>
			<HeroSection />
			<RecentPosts posts={recentPosts} />
			<CategoriesSection />
			<SeriesSection />
			<NewsletterSection />
		</>
	);
}

function HeroSection() {
	return (
		<section className="flex flex-col items-center gap-6 px-5 py-16 text-center lg:px-20 lg:py-24">
			<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-5xl">
				Antonio Fulgencio Blog
			</h1>
			<p className="max-w-xl text-base leading-relaxed text-foreground-secondary lg:text-lg">
				Desenvolvedor Full-Stack compartilhando experiências sobre
				desenvolvimento web, React, TypeScript, Bun e carreira internacional.
			</p>
			<Link
				to="/blog"
				className="inline-flex items-center gap-2 rounded-md bg-accent px-8 py-3 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover"
			>
				Explorar Artigos
				<ArrowRight className="h-4 w-4" />
			</Link>
		</section>
	);
}

function RecentPosts({ posts }: { posts: Post[] }) {
	return (
		<section className="px-5 py-12 lg:px-20 lg:py-16">
			<h2 className="mb-8 font-heading text-2xl font-bold text-foreground lg:text-3xl">
				Artigos Recentes
			</h2>
			{posts.length === 0 ? (
				<p className="text-foreground-secondary">
					Nenhum artigo publicado ainda.
				</p>
			) : (
				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{posts.map((post) => (
						<article
							key={post.id}
							className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
						>
							<div className="h-48 bg-muted" />
							<div className="flex flex-col gap-3 p-5">
								{post.publishedAt && (
									<time
										dateTime={new Date(post.publishedAt).toISOString()}
										className="text-xs text-foreground-muted"
									>
										{new Date(post.publishedAt).toLocaleDateString("pt-BR", {
											day: "numeric",
											month: "short",
											year: "numeric",
										})}
									</time>
								)}
								<h3 className="font-heading text-lg font-bold leading-snug text-foreground group-hover:text-accent">
									<Link to="/$slug" params={{ slug: post.slug }}>
										{post.title}
									</Link>
								</h3>
								{post.description && (
									<p className="line-clamp-2 text-sm leading-relaxed text-foreground-secondary">
										{post.description}
									</p>
								)}
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}

// TODO: Replace hardcoded counts with real DB aggregates once a `category` field is added to the Post schema.
const categories = [
	{ name: "Front-end", count: 12, icon: Code },
	{ name: "Back-end", count: 8, icon: Database },
	{ name: "TypeScript", count: 15, icon: FileCode },
	{ name: "DevOps", count: 5, icon: Package },
	{ name: "TanStack", count: 7, icon: RouteIcon },
	{ name: "UI/UX", count: 4, icon: Layout },
];

function CategoriesSection() {
	return (
		<section className="bg-surface px-5 py-12 lg:px-20 lg:py-16">
			<h2 className="mb-8 font-heading text-2xl font-bold text-foreground lg:text-3xl">
				Categorias
			</h2>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				{/* TODO: Restore search={{ category: cat.name }} on each Link when Post schema gains a category field and /blog re-wires the filter. */}
				{categories.map((cat) => (
					<Link
						key={cat.name}
						to="/blog"
						className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
					>
						<div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-light">
							<cat.icon className="h-5 w-5 text-accent" />
						</div>
						<span className="font-heading text-sm font-semibold text-foreground">
							{cat.name}
						</span>
						<span className="text-xs text-foreground-secondary">
							{cat.count} artigos
						</span>
					</Link>
				))}
			</div>
		</section>
	);
}

function SeriesSection() {
	// TODO: Replace hardcoded series data with real DB queries once a `series` field is added to the Post schema.
	return (
		<section className="px-5 py-12 lg:px-20 lg:py-16">
			<h2 className="mb-8 font-heading text-2xl font-bold text-foreground lg:text-3xl">
				Séries &amp; Tutoriais
			</h2>
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{[
					{
						title: "Criando um Blog com TanStack Start",
						desc: "Aprenda do zero a criar um blog moderno com SSR, MDX e deploy em VPS.",
						tag: "TanStack",
						parts: 5,
						progress: 80,
						status: "Em andamento",
					},
					{
						title: "Deploy em VPS com Bun",
						desc: "Configure um servidor VPS do zero com Bun, Docker e CI/CD.",
						tag: "DevOps",
						parts: 3,
						progress: 33,
						status: "Em andamento",
					},
					{
						title: "TypeScript Avançado para React",
						desc: "Domine patterns avançados de TypeScript aplicados ao React.",
						tag: "TypeScript",
						parts: 5,
						progress: 10,
						status: "Nova",
					},
				].map((series) => (
					<div
						key={series.title}
						className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
					>
						<div className="flex items-center justify-between">
							<span className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-medium text-accent">
								{series.tag}
							</span>
							<span className="text-xs font-medium text-foreground-muted">
								{series.status}
							</span>
						</div>
						<h3 className="font-heading text-lg font-bold leading-snug text-foreground">
							{series.title}
						</h3>
						<p className="text-sm leading-relaxed text-foreground-secondary">
							{series.desc}
						</p>
						<span className="text-xs text-foreground-muted">
							{series.parts} partes
						</span>
						<div className="h-1 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-accent"
								style={{ width: `${series.progress}%` }}
							/>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function NewsletterSection() {
	return (
		<section className="flex justify-center bg-surface px-5 py-12 lg:px-20 lg:py-16">
			<div className="w-full max-w-lg rounded-lg border border-border bg-card p-8">
				<h2 className="font-heading text-xl font-bold text-foreground">
					Inscreva-se na Newsletter
				</h2>
				<p className="mt-2 text-sm leading-relaxed text-foreground-secondary">
					Receba os melhores artigos sobre desenvolvimento web diretamente no
					seu e-mail.
				</p>
				<form
					className="mt-5 flex flex-col gap-3"
					onSubmit={(e) => e.preventDefault()}
				>
					<input
						type="text"
						placeholder="Seu nome"
						className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
					/>
					<input
						type="email"
						placeholder="seu@email.com"
						className="h-11 rounded-md border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none"
					/>
					{/* TODO: Wire to a real newsletter provider before enabling. */}
					<button
						type="submit"
						disabled
						className="h-11 cursor-not-allowed rounded-md bg-accent/50 text-sm font-semibold text-foreground-inverse"
					>
						Em breve
					</button>
				</form>
			</div>
		</section>
	);
}
