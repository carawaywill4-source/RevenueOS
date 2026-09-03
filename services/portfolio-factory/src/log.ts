import { appendFileSync, mkdirSync } from "node:fs";
import { workerLogPath } from "./paths.js";

export function factoryLog(message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    message,
    ...meta,
  });
  console.log(line);
  try {
    mkdirSync(workerLogPath().replace(/\/[^/]+$/, ""), { recursive: true });
    appendFileSync(workerLogPath(), line + "\n");
  } catch {
    /* best effort */
  }
}
