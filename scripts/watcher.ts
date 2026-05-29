import { join } from "node:path";
import { startContentWatcher } from "#/lib/watcher.server";

startContentWatcher(join(process.cwd(), "app", "content", "posts"));

// Self-exit when the parent dev server dies.
//
// dev-boot.ts spawns this watcher with unref(), so without this it would
// become an immortal orphan holding a recursive fs.watch + a DB connection
// after the parent Vite process exits. When the parent dies this process is
// reparented (ppid becomes 1, or whatever the OS subreaper is), so poll ppid
// and exit once it changes from the launch-time parent. This is the backstop
// for SIGKILL/crash where dev-boot's pidfile reap never runs.
//
// The interval is unref'd so it never by itself keeps the process alive.
const initialPpid = process.ppid;
const PARENT_POLL_MS = 2000;
const parentPoll = setInterval(() => {
	if (process.ppid !== initialPpid) {
		clearInterval(parentPoll);
		process.exit(0);
	}
}, PARENT_POLL_MS);
parentPoll.unref?.();
