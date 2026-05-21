import * as net from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestDb, type TestDb } from "../../tests/e2e/db";

// ---- lock-acquire timer-cleanup tests (round-016 issue-001) ----
// Verifies that the happy-path acquireUnnamedSlotLock clears its setTimeout
// so no orphan timer fires after the acquire resolves.
// Uses PGLITE_LOCK_TIMEOUT_MS=50 so the grace-period wait is short.
describe("PGLite proxy: lock-acquire timer cleanup", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		process.env.PGLITE_LOCK_TIMEOUT_MS = "50";
		testDb = await createTestDb();
	});

	afterAll(async () => {
		delete process.env.PGLITE_LOCK_TIMEOUT_MS;
		await testDb.close();
	});

	test("100 fast acquires: no unhandledRejection fires after acquire resolves", async () => {
		const port = Number(new URL(testDb.connectionString).port);
		const unhandledErrors: Error[] = [];
		const onUnhandled = (err: Error) => unhandledErrors.push(err);
		process.on("unhandledRejection", onUnhandled);

		try {
			for (let i = 0; i < 100; i++) {
				const sock = await pgConnect(port);
				try {
					// Full pipeline: acquires the unnamed-slot lock, executes, releases.
					sock.write(
						Buffer.concat([
							buildParse("SELECT $1::text"),
							buildBind(["hello"]),
							buildExecute(),
							SYNC,
						]),
					);
					await readUntilReady(sock, 2_000);
				} finally {
					sock.destroy();
				}
			}

			// Grace period — 4× the lock timeout. With the old code, 100 orphan
			// timers of 50ms would all fire here and push to unhandledErrors.
			await new Promise<void>((r) => setTimeout(r, 200));

			expect(unhandledErrors).toHaveLength(0);
		} finally {
			process.removeListener("unhandledRejection", onUnhandled);
		}
	}, 15_000);
});

// ---- lock-acquire-timeout stall tests ----
// Uses PGLITE_LOCK_TIMEOUT_MS=500 so the lock acquire timeout fires quickly.
// Must be a separate describe block with its own testDb so the env var is read
// when startPgProxy is called inside createTestDb.
describe("PGLite proxy: lock acquire timeout", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		process.env.PGLITE_LOCK_TIMEOUT_MS = "500";
		testDb = await createTestDb();
	});

	afterAll(async () => {
		delete process.env.PGLITE_LOCK_TIMEOUT_MS;
		await testDb.close();
	});

	test("stall: second connection gets a wire response within 2 s when first holds lock without Bind", async () => {
		const port = Number(new URL(testDb.connectionString).port);
		const sockA = await pgConnect(port);
		const sockB = await pgConnect(port);

		try {
			// Socket A: Parse+Sync — acquires the unnamed-slot lock.
			// ReadyForQuery comes back immediately after ParseComplete.
			sockA.write(Buffer.concat([buildParse("SELECT $1::text"), SYNC]));
			await readUntilReady(sockA, 3_000);

			// Socket A now holds the lock (lockRelease !== null).
			// It deliberately sends no Bind and does NOT close.

			// Socket B: Parse+Sync — must wait for A's lock, then timeout at ~500 ms.
			sockB.write(Buffer.concat([buildParse("SELECT $1::text"), SYNC]));
			const bResult = await readUntilReady(sockB, 2_000);

			// B must have received ReadyForQuery within 2 s (not hung forever).
			expect(bResult.raw.length).toBeGreaterThan(0);

			// If an ErrorResponse (0x45) was sent, it must precede ReadyForQuery (0x5a).
			const errIdx = bResult.raw.indexOf(0x45);
			const rfqIdx = bResult.raw.lastIndexOf(0x5a);
			expect(rfqIdx).toBeGreaterThan(-1);
			if (errIdx !== -1) {
				expect(errIdx).toBeLessThan(rfqIdx);
			}
		} finally {
			sockA.destroy();
			sockB.destroy();
		}
	}, 5_000);
});

// ---- wire protocol helpers ----

function buildParse(query: string, paramOids: number[] = []): Buffer {
	const stmtName = Buffer.from("\0"); // unnamed statement
	const queryBuf = Buffer.from(`${query}\0`);
	const numParams = Buffer.alloc(2);
	numParams.writeInt16BE(paramOids.length, 0);
	const oids = Buffer.alloc(paramOids.length * 4);
	for (let i = 0; i < paramOids.length; i++)
		oids.writeInt32BE(paramOids[i]!, i * 4);
	const body = Buffer.concat([stmtName, queryBuf, numParams, oids]);
	const msgLen = Buffer.alloc(4);
	msgLen.writeInt32BE(4 + body.length, 0);
	return Buffer.concat([Buffer.from([0x50]), msgLen, body]);
}

function buildBind(params: string[]): Buffer {
	const portalName = Buffer.from("\0");
	const stmtName = Buffer.from("\0");
	const numFormatCodes = Buffer.alloc(2); // 0 = all text
	const numParams = Buffer.alloc(2);
	numParams.writeInt16BE(params.length, 0);
	const paramBufs = params.flatMap((p) => {
		const val = Buffer.from(p);
		const len = Buffer.alloc(4);
		len.writeInt32BE(val.length, 0);
		return [len, val];
	});
	const numResultFormats = Buffer.alloc(2); // 0 = default
	const body = Buffer.concat([
		portalName,
		stmtName,
		numFormatCodes,
		numParams,
		...paramBufs,
		numResultFormats,
	]);
	const msgLen = Buffer.alloc(4);
	msgLen.writeInt32BE(4 + body.length, 0);
	return Buffer.concat([Buffer.from([0x42]), msgLen, body]);
}

function buildExecute(): Buffer {
	const portalName = Buffer.from("\0");
	const maxRows = Buffer.alloc(4); // 0 = unlimited
	const body = Buffer.concat([portalName, maxRows]);
	const msgLen = Buffer.alloc(4);
	msgLen.writeInt32BE(4 + body.length, 0);
	return Buffer.concat([Buffer.from([0x45]), msgLen, body]);
}

const SYNC = Buffer.from([0x53, 0x00, 0x00, 0x00, 0x04]);

async function pgConnect(port: number): Promise<net.Socket> {
	const socket = new net.Socket();
	await new Promise<void>((resolve, reject) => {
		socket.connect(port, "127.0.0.1", resolve);
		socket.once("error", reject);
	});
	const startup = Buffer.alloc(8);
	startup.writeInt32BE(8, 0);
	startup.writeInt32BE(196608, 4); // protocol v3.0
	socket.write(startup);
	// Wait for ReadyForQuery ('Z' = 0x5a, len field = 5)
	await new Promise<void>((resolve) => {
		let acc = Buffer.alloc(0);
		const onData = (chunk: Buffer) => {
			acc = Buffer.concat([acc, chunk]);
			for (let i = 0; i <= acc.length - 6; i++) {
				if (acc[i] === 0x5a && acc.readInt32BE(i + 1) === 5) {
					socket.removeListener("data", onData);
					resolve();
					return;
				}
			}
		};
		socket.on("data", onData);
	});
	return socket;
}

async function readUntilReady(
	socket: net.Socket,
	timeoutMs = 5_000,
): Promise<{ hasError: boolean; raw: Buffer }> {
	return new Promise((resolve, reject) => {
		let acc = Buffer.alloc(0);
		const timer = setTimeout(() => {
			cleanup();
			reject(
				new Error(
					`[readUntilReady] no ReadyForQuery within ${timeoutMs}ms; accumulated ${acc.length} bytes`,
				),
			);
		}, timeoutMs);
		const cleanup = () => {
			clearTimeout(timer);
			socket.removeListener("data", onData);
			socket.removeListener("close", onClose);
			socket.removeListener("error", onError);
		};
		const onData = (chunk: Buffer) => {
			acc = Buffer.concat([acc, chunk]);
			for (let i = 0; i <= acc.length - 6; i++) {
				if (acc[i] === 0x5a && acc.readInt32BE(i + 1) === 5) {
					cleanup();
					const hasError = acc.includes(Buffer.from("08P01")); // bind-param mismatch SQLSTATE
					resolve({ hasError, raw: acc });
					return;
				}
			}
		};
		const onClose = () => {
			cleanup();
			reject(
				new Error(
					`[readUntilReady] socket closed before ReadyForQuery; accumulated ${acc.length} bytes`,
				),
			);
		};
		const onError = (err: Error) => {
			cleanup();
			reject(new Error(`[readUntilReady] socket error: ${err.message}`));
		};
		socket.on("data", onData);
		socket.on("close", onClose);
		socket.on("error", onError);
	});
}

// ---- tests ----

describe("PGLite proxy: unnamed prepared statement isolation across connections", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();
	});

	afterAll(async () => {
		await testDb.close();
	});

	test("concurrent connections do not corrupt unnamed prepared statement state (08P01 regression)", async () => {
		const port = Number(new URL(testDb.connectionString).port);
		const sockA = await pgConnect(port);
		const sockB = await pgConnect(port);

		try {
			// Connection A sends only Parse (no Sync yet) — message stays buffered.
			sockA.write(buildParse("SELECT $1::text"));

			// Connection B sends a full pipeline with a 2-param query.
			// Without the fix, B's Parse overwrites the unnamed stmt slot; A's
			// subsequent Bind (1 param) then fails with 08P01.
			sockB.write(
				Buffer.concat([
					buildParse("SELECT $1::text || ' ' || $2::text"),
					buildBind(["hello", "world"]),
					buildExecute(),
					SYNC,
				]),
			);
			const bResult = await readUntilReady(sockB);
			expect(bResult.hasError).toBe(false);

			// Connection A flushes its buffered Parse + new Bind/Execute/Sync as
			// one atomic batch — must not observe B's 2-param unnamed stmt.
			sockA.write(Buffer.concat([buildBind(["test"]), buildExecute(), SYNC]));
			const aResult = await readUntilReady(sockA);
			expect(aResult.hasError).toBe(false);
		} finally {
			sockA.destroy();
			sockB.destroy();
		}
	});

	test("high concurrency: 4 connections with separate Parse/Bind pipelines do not produce 08P01", async () => {
		const port = Number(new URL(testDb.connectionString).port);

		// Different SQL shapes (different param counts) make cross-connection slot
		// corruption visible: if B's Parse(2 params) overwrites A's Parse(1 param)
		// before A's Bind(1 param) runs, A gets 08P01.
		const specs: { sql: string; params: string[] }[] = [
			{ sql: "SELECT $1::text", params: ["a"] },
			{ sql: "SELECT $1::text, $2::text", params: ["b", "c"] },
			{ sql: "SELECT $1::text", params: ["d"] },
			{ sql: "SELECT $1::text, $2::text", params: ["e", "f"] },
		];

		const sockets = await Promise.all(specs.map(() => pgConnect(port)));

		try {
			// All connections send Parse+Sync as a separate pipeline (no Bind yet).
			// This enqueues 4 Parse pipelines; without connection-level locking the
			// queue would be [P0, P1, P2, P3, B0, B1, B2, B3] and B0 (1-param Bind)
			// would run against "" which was last set to 2 params by P3 → 08P01.
			for (const [i, { sql, params }] of specs.entries()) {
				sockets[i]?.write(
					Buffer.concat([
						buildParse(sql, new Array(params.length).fill(0)),
						SYNC,
					]),
				);
			}

			// All connections immediately send Bind+Execute+Sync without waiting.
			for (const [i, { params }] of specs.entries()) {
				sockets[i]?.write(
					Buffer.concat([buildBind(params), buildExecute(), SYNC]),
				);
			}

			// Wait for all final ReadyForQuery responses; none should contain 08P01.
			const results = await Promise.all(
				sockets.map((s) => readUntilReady(s, 10_000)),
			);
			for (const r of results) {
				expect(r.hasError).toBe(false);
			}
		} finally {
			for (const s of sockets) s.destroy();
		}
	}, 15_000);

	test("error response includes ErrorResponse (0x45) before ReadyForQuery (0x5a) on Bind param mismatch", async () => {
		const port = Number(new URL(testDb.connectionString).port);
		const sock = await pgConnect(port);
		try {
			// Parse 1-param query, then Bind with 2 params → 08P01 mismatch.
			// Verifies that an ErrorResponse precedes ReadyForQuery in the wire response.
			sock.write(
				Buffer.concat([
					buildParse("SELECT $1::text"),
					buildBind(["hello", "world"]), // 2 params for 1-param query
					buildExecute(),
					SYNC,
				]),
			);
			const result = await readUntilReady(sock);
			expect(result.hasError).toBe(true);
			const errIdx = result.raw.indexOf(0x45); // 'E' = ErrorResponse
			const rfqIdx = result.raw.lastIndexOf(0x5a); // 'Z' = ReadyForQuery
			expect(errIdx).toBeGreaterThan(-1);
			expect(rfqIdx).toBeGreaterThan(-1);
			expect(errIdx).toBeLessThan(rfqIdx);
		} finally {
			sock.destroy();
		}
	});
});
