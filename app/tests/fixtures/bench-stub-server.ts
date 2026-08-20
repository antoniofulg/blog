#!/usr/bin/env bun
// Stub HTTP server used by the runtime-measurement tests. Stands in for
// .output/server/index.mjs so the test never depends on a built bundle.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 0);
const bootDelayMs = Number(process.env.STUB_BOOT_DELAY_MS ?? 0);
const held: Buffer[] = [];

const server = createServer((req, res) => {
	if ((req.url ?? "/") === "/heavy") {
		held.push(Buffer.alloc(40 * 1024 * 1024, 1));
	}
	res.writeHead(200, { "content-type": "text/plain" });
	res.end("ok");
});

setTimeout(() => server.listen(port), bootDelayMs);
