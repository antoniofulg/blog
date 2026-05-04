import { join } from "node:path";
import { startContentWatcher } from "#/lib/watcher.server";

startContentWatcher(join(process.cwd(), "content"));
