// The PGLite proxy lifecycle is owned by scripts/e2e-server.ts (the Playwright
// webServer process). When Playwright stops the webServer, e2e-server.ts closes
// the proxy and deletes the state file automatically. Nothing to do here.
export default async function globalTeardown(): Promise<void> {}
