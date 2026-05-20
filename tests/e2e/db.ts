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

function buildErrorResponse(err: Error): Buffer {
	const fields: Buffer[] = [];
	const push = (code: string, value: string) => {
		fields.push(Buffer.from([code.charCodeAt(0)]));
		fields.push(Buffer.from(value, "utf-8"));
		fields.push(Buffer.from([0x00]));
	};
	push("S", "ERROR");
	push("V", "ERROR");
	push("C", "XX000");
	push("M", err.message || "PGLite execProtocolRaw rejected");
	fields.push(Buffer.from([0x00])); // terminator
	const body = Buffer.concat(fields);
	const header = Buffer.alloc(5);
	header[0] = 0x45; // 'E'
	header.writeInt32BE(body.length + 4, 1);
	return Buffer.concat([header, body]);
}

// Returns true when the batch contains a Parse message for the unnamed statement ("").
// Parse format: P(1) + length(4) + stmtName(null-terminated) + ...
// Unnamed statement: the stmtName field is a single null byte, i.e. byte[5] === 0x00.
function batchHasParseForUnnamed(batch: Buffer): boolean {
	let offset = 0;
	while (offset + 6 <= batch.length) {
		const type = batch[offset];
		const len = batch.readInt32BE(offset + 1);
		if (type === 0x50 && batch[offset + 5] === 0x00) return true;
		offset += 1 + len;
	}
	return false;
}

// Returns true when the batch contains a Bind message for the unnamed statement ("").
// Bind format: B(1) + length(4) + portalName(null-term) + stmtName(null-term) + ...
// For unnamed portal + unnamed stmt: byte[5] === 0x00 (portal) and byte[6] === 0x00 (stmt).
function batchHasBindForUnnamed(batch: Buffer): boolean {
	let offset = 0;
	while (offset + 7 <= batch.length) {
		const type = batch[offset];
		const len = batch.readInt32BE(offset + 1);
		if (type === 0x42 && batch[offset + 5] === 0x00 && batch[offset + 6] === 0x00)
			return true;
		offset += 1 + len;
	}
	return false;
}

// Starts a TCP server that proxies PostgreSQL wire protocol messages to PGLite.
// Handles SSLRequest denial and startup handshake synthesis, then pipes all
// subsequent messages through PGlite.execProtocolRaw for true wire-protocol fidelity.
function startPgProxy(
	pglite: PGlite,
): Promise<{ port: number; stop: () => Promise<void> }> {
	// Unnamed-statement lock: PGLite has a single unnamed prepared-statement slot
	// shared across all connections. The race is:
	//   A sends Parse(Q_A)+Sync [pipeline 1] → "" = Q_A
	//   B sends Parse(Q_B)+Sync [pipeline 2] → "" = Q_B   ← corrupts A's slot
	//   A sends Bind(params for Q_A)+Sync [pipeline 3] → 08P01
	// Fix: hold the lock from when a connection Parses "" until it Binds "".
	// During that window, other connections' Parse pipelines queue up.
	// For the common case (Parse+Bind in one pipeline), the lock is held only
	// for the duration of that single execProtocolRaw call.
	let unnamedSlotLock: Promise<void> = Promise.resolve();

	const activeSockets = new Set<net.Socket>();

	const server = net.createServer((socket) => {
		activeSockets.add(socket);

		let buf = Buffer.alloc(0);
		let started = false;
		let pipelineBuf = Buffer.alloc(0);

		// Whether this connection currently holds the unnamed-statement lock.
		// Acquired after a Parse('') pipeline; released after the Bind('') pipeline.
		let lockRelease: (() => void) | null = null;
		const releaseUnnamedSlotLock = () => {
			if (lockRelease) {
				lockRelease();
				lockRelease = null;
			}
		};

		socket.on("close", () => {
			activeSockets.delete(socket);
			releaseUnnamedSlotLock();
		});
		socket.on("error", () => {
			releaseUnnamedSlotLock();
			socket.destroy();
		});

		// Acquire the unnamed-slot lock if not already held.
		// Returns a Promise that resolves when it is this connection's turn.
		const acquireUnnamedSlotLock = (): Promise<void> => {
			if (lockRelease !== null) return Promise.resolve();
			let resolve!: () => void;
			const mySlot = new Promise<void>((r) => {
				resolve = r;
			});
			const prev = unnamedSlotLock;
			unnamedSlotLock = mySlot;
			lockRelease = resolve;
			return prev.then(() => {});
		};

		// Per-connection pipeline queue: pipelines from THIS connection run in order.
		let myQueue: Promise<Uint8Array | undefined> = Promise.resolve(undefined);
		const enqueue = (
			fn: () => Promise<Uint8Array>,
			needsLock: boolean,
			releasesLock: boolean,
		): Promise<Uint8Array> => {
			const next = myQueue.then(() => {
				const run = needsLock
					? acquireUnnamedSlotLock().then(() => fn())
					: fn();
				return run.then((res) => {
					if (releasesLock) releaseUnnamedSlotLock();
					return res;
				});
			}) as Promise<Uint8Array>;
			myQueue = next.then(
				() => undefined,
				() => undefined,
			);
			return next;
		};

		socket.on("data", (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			drain();
		});

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
					// Terminate ('X'): release any held lock then close.
					if (msgType === 0x58) {
						releaseUnnamedSlotLock();
						socket.end();
						return;
					}
					// Accumulate messages until a pipeline-end marker, then dispatch.
					pipelineBuf = Buffer.concat([pipelineBuf, msg]);
					const isPipelineEnd =
						msgType === 0x53 || msgType === 0x51 || msgType === 0x48;
					if (isPipelineEnd) {
						const batch = pipelineBuf;
						pipelineBuf = Buffer.alloc(0);
						// Acquire the lock on Parse(''): hold it until the matching Bind('').
						// Release immediately if the same batch also has Bind('').
						const hasParse = batchHasParseForUnnamed(batch);
						const hasBind = batchHasBindForUnnamed(batch);
						// needsLock: true if this batch needs the unnamed slot (Parse or Bind)
						// releasesLock: true if this batch contains the Bind that "consumes" the slot
						const needsLock = hasParse || hasBind;
						const releasesLock = hasBind;
						enqueue(
							() => pglite.execProtocolRaw(batch),
							needsLock,
							releasesLock,
						).then(
							(res) => {
								if (!socket.destroyed) socket.write(Buffer.from(res));
							},
							(err) => {
								console.error("[pg-proxy] execProtocolRaw rejected:", err);
								releaseUnnamedSlotLock();
								if (!socket.destroyed) {
									socket.write(buildErrorResponse(err as Error));
									socket.write(
										Buffer.from([0x5a, 0x00, 0x00, 0x00, 0x05, 0x49]),
									);
								}
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
