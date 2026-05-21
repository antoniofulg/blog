import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// The PGLite proxy lifecycle is owned by scripts/e2e-server.ts (the Playwright
// webServer process). When Playwright stops the webServer, e2e-server.ts closes
// the proxy and deletes the state file automatically.
// Fixture MDX file lifecycle is owned here since global-setup.ts writes it.
export default async function globalTeardown(): Promise<void> {
	const fixtureFilePath = join(tmpdir(), "e2e-fixture-post.mdx");
	await unlink(fixtureFilePath).catch(() => {});
}
