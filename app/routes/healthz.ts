import { createFileRoute } from "@tanstack/react-router";
import { getHealthHandler } from "./healthz.server";

export const Route = createFileRoute("/healthz")({
	server: {
		handlers: {
			GET: getHealthHandler,
		},
	},
});
