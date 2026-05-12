import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";

export async function requireSession(): Promise<void> {
	const session = await auth.api.getSession({
		headers: getRequest().headers,
	});
	if (!session?.user) {
		throw new Response("Unauthorized", { status: 401 });
	}
}
