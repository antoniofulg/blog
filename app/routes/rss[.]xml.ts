import { createFileRoute } from "@tanstack/react-router";
import { getSiteOrigin } from "#/lib/site-origin";

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

async function getRssResponse() {
	const { listPostsFn } = await import("#/db/queries");
	const siteUrl = getSiteOrigin() || "http://localhost:3000";

	const posts = await listPostsFn("en");
	const feedUrl = `${siteUrl}/rss.xml`;

	const items = posts
		.filter((p) => p.publishedAt != null)
		.map((p) => {
			const url = `${siteUrl}/${p.slug}/`;
			const pubDate = new Date(p.publishedAt!).toUTCString();
			const description = p.description
				? `<description>${escapeXml(p.description)}</description>`
				: "";
			return [
				"<item>",
				`<title>${escapeXml(p.title)}</title>`,
				`<link>${url}</link>`,
				`<guid isPermaLink="true">${url}</guid>`,
				`<pubDate>${pubDate}</pubDate>`,
				description,
				"</item>",
			]
				.filter(Boolean)
				.join("\n      ");
		})
		.join("\n    ");

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
		"  <channel>",
		`    <title>${escapeXml("Antonio Fulgencio — Posts")}</title>`,
		`    <link>${siteUrl}</link>`,
		`    <description>${escapeXml("Daily lessons from shipping software — patterns, gotchas, refactors, and the tools that change how I work.")}</description>`,
		"    <language>en</language>",
		`    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
		`    ${items}`,
		"  </channel>",
		"</rss>",
	].join("\n");

	return new Response(xml, {
		status: 200,
		headers: {
			"content-type": "application/rss+xml; charset=utf-8",
			"cache-control": "public, max-age=3600",
		},
	});
}

export const Route = createFileRoute("/rss.xml")({
	server: {
		handlers: {
			GET: getRssResponse,
		},
	},
});
