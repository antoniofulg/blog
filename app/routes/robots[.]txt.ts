import { createFileRoute } from "@tanstack/react-router";

export const ROBOTS_BODY =
	"User-agent: *\nAllow: /\n\nDisallow: /admin/\nDisallow: /api/\nDisallow: /login\n";

export function getRobotsResponse() {
	return new Response(ROBOTS_BODY, {
		status: 200,
		headers: { "content-type": "text/plain" },
	});
}

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: getRobotsResponse,
		},
	},
});
