import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as net from "node:net";
import * as authSchema from "#/db/auth-schema";
import * as schema from "#/db/schema";

type CombinedSchema = typeof schema & typeof authSchema;

export type TestDb = {
	db: PgliteDatabase<CombinedSchema>;
	client: PGlite;
	connectionString: string;
	close: () => Promise<void>;
};

// Minimal PG wire protocol startup response (AuthOk + params + BackendKeyData + ReadyForQuery)
function buildStartupResponse(): Buffer {
	function param(name: string, value: string): Buffer {
		const body = Buffer.concat([
			Buffer.from(`${name}\0`),
			Buffer.from(`${value}\0`),
		]);
		const len = Buffer.alloc(4);
		len.writeInt32BE(4 + body.length, 0);
		return Buffer.concat([Buffer.from([0x53]), len, body]);
	}
	return Buffer.concat([
		// AuthenticationOk
		Buffer.from([0x52, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00]),
		param("server_version", "16.0"),
		param("client_encoding", "UTF8"),
		param("DateStyle", "ISO, MDY"),
		param("integer_datetimes", "on"),
		param("standard_conforming_strings", "on"),
		// BackendKeyData (pid=1, secret=0)
		Buffer.from([0x4b, 0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]),
		// ReadyForQuery('I' = idle)
		Buffer.from([0x5a, 0x00, 0x00, 0x00, 0x05, 0x49]),
	]);
}

// Starts a TCP server that proxies PostgreSQL wire protocol messages to PGLite.
// Handles SSLRequest denial and startup handshake synthesis, then pipes all
// subsequent messages through PGlite.execProtocolRaw for true wire-protocol fidelity.
function startPgProxy(
	pglite: PGlite,
): Promise<{ port: number; stop: () => Promise<void> }> {
	// Serialize all execProtocolRaw calls across connections (PGLite is single-client)
	let queue: Promise<Uint8Array | undefined> = Promise.resolve(undefined);
	const enqueue = (fn: () => Promise<Uint8Array>): Promise<Uint8Array> => {
		const next = queue.then(() => fn()) as Promise<Uint8Array>;
		queue = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	};

	const activeSockets = new Set<net.Socket>();

	const server = net.createServer((socket) => {
		activeSockets.add(socket);
		socket.on("close", () => activeSockets.delete(socket));

		let buf = Buffer.alloc(0);
		let started = false;
		// Per-connection pipeline buffer: accumulates messages until a pipeline-end
		// marker (Sync/SimpleQuery/Flush) so they are dispatched atomically to PGLite.
		// Without this, Parse from one connection can overwrite the unnamed prepared
		// statement slot before another connection's Bind arrives (08P01 mismatch).
		let pipelineBuf = Buffer.alloc(0);

		socket.on("data", (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			drain();
		});
		socket.on("error", () => socket.destroy());

		function drain() {
			for (;;) {
				if (!started) {
					if (buf.length < 4) return;
					const msgLen = buf.readInt32BE(0);
					if (buf.length < msgLen) return;
					// SSLRequest (code = 80877103): deny with 'N'
					if (msgLen === 8 && buf.readInt32BE(4) === 80877103) {
						socket.write(Buffer.from("N"));
						buf = buf.subarray(msgLen);
						continue;
					}
					// StartupMessage: synthesize auth response
					buf = buf.subarray(msgLen);
					socket.write(buildStartupResponse());
					started = true;
				} else {
					if (buf.length < 5) return;
					const msgType = buf[0];
					const msgLen = buf.readInt32BE(1);
					if (buf.length < 1 + msgLen) return;
					const msg = Buffer.from(buf.subarray(0, 1 + msgLen));
					buf = buf.subarray(1 + msgLen);
					// Terminate ('X'): close connection
					if (msgType === 0x58) {
						socket.end();
						return;
					}
					// Append message to the per-connection pipeline buffer.
					// S=Sync(0x53), Q=SimpleQuery(0x51), H=Flush(0x48) are pipeline-end
					// markers: flush the accumulated batch to PGLite atomically so that
					// no other connection's messages can interleave within this pipeline.
					pipelineBuf = Buffer.concat([pipelineBuf, msg]);
					const isPipelineEnd =
						msgType === 0x53 || msgType === 0x51 || msgType === 0x48;
					if (isPipelineEnd) {
						const batch = pipelineBuf;
						pipelineBuf = Buffer.alloc(0);
						enqueue(() => pglite.execProtocolRaw(batch)).then(
							(res) => {
								if (!socket.destroyed) socket.write(Buffer.from(res));
							},
							(err) => {
								console.error("[pg-proxy] execProtocolRaw rejected:", err);
								// On error send ReadyForQuery to keep the connection alive
								if (!socket.destroyed)
									socket.write(
										Buffer.from([0x5a, 0x00, 0x00, 0x00, 0x05, 0x49]),
									);
							},
						);
					}
				}
			}
		}
	});

	return new Promise<{ port: number; stop: () => Promise<void> }>(
		(resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", () => {
				const { port } = server.address() as net.AddressInfo;
				const stop = () =>
					new Promise<void>((res, rej) => {
						// Destroy all active sockets so server.close() resolves promptly
						for (const s of activeSockets) s.destroy();
						activeSockets.clear();
						server.close((e) => (e ? rej(e) : res()));
					});
				resolve({ port, stop });
			});
		},
	);
}

export async function createTestDb(): Promise<TestDb> {
	const { pushSchema } = await import("drizzle-kit/api");

	const client = new PGlite("memory://");
	await client.waitReady;
	const db = drizzle<CombinedSchema>(client, {
		schema: { ...schema, ...authSchema } as CombinedSchema,
	});

	// Cast required: drizzle-kit/api's PgDatabase type differs from PgliteDatabase generic
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = await pushSchema({ ...schema, ...authSchema }, db as any);
	await result.apply();

	const proxy = await startPgProxy(client);
	const connectionString = `postgres://localhost:${proxy.port}/postgres`;

	let closed = false;
	const close = async () => {
		if (closed) return;
		closed = true;
		await proxy.stop();
		await client.close();
	};

	return { db, client, connectionString, close };
}
