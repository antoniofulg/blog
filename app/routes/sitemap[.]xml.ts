import { createFileRoute } from "@tanstack/react-router";
import { getSitemapXmlResponse } from "./sitemap[.]xml.server";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: getSitemapXmlResponse,
		},
	},
});
