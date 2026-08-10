/**
 * Process runtime — isolated Next.js child processes per business.
 * Used when Docker is unavailable (local/dev) or as a thin interim hosting plane.
 * Production VPS should prefer DockerRuntime for harder isolation.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { RuntimeAdapter } from "./types.js";

const children = new Map<string, ChildProcess>();

export function createProcessRuntime(repoRoot: string): RuntimeAdapter {
  return {
    kind: "process",
    async available() {
      return true;
    },
    async start(input) {
      const key = `${input.siteId}:${input.deploymentId}`;
      if (children.has(key)) {
        return { ok: true, detail: "already_running", pid: children.get(key)?.pid };
      }
      if (!existsSync(input.appDir)) {
        return { ok: false, detail: `appDir missing: ${input.appDir}` };
      }

      // Prefer already-built .next; otherwise next start may fail — build first.
      const nextBin = path.join(repoRoot, "node_modules", ".bin", "next");
      const localNext = path.join(input.appDir, "node_modules", ".bin", "next");
      const bin = existsSync(localNext) ? localNext : nextBin;
      if (!existsSync(bin) && !existsSync(path.join(input.appDir, "node_modules", "next"))) {
        // fall through to npx
      }

      const env = {
        ...process.env,
        ...input.env,
        PORT: String(input.port),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        // Soft memory hint — OS still enforces via process; hard cgroup needs Docker.
        NODE_OPTIONS: `--max-old-space-size=${Math.max(128, input.limits.memoryMb - 64)}`,
      };

      const child = spawn(
        "npx",
        ["next", "start", "-H", "127.0.0.1", "-p", String(input.port)],
        {
          cwd: input.appDir,
          env,
          stdio: ["ignore", "pipe", "pipe"],
          detached: false,
        },
      );
      children.set(key, child);
      let bootLog = "";
      child.stdout?.on("data", (d) => {
        bootLog += String(d).slice(0, 200);
      });
      child.stderr?.on("data", (d) => {
        bootLog += String(d).slice(0, 200);
      });
      child.on("exit", () => {
        children.delete(key);
      });

      // Poll until the port accepts connections (build→start can exceed 2.5s).
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        if (child.exitCode != null) {
          return {
            ok: false,
            detail: `process_exited:${child.exitCode}:${bootLog.slice(0, 180)}`,
          };
        }
        try {
          const res = await fetch(`http://127.0.0.1:${input.port}/`, {
            signal: AbortSignal.timeout(1500),
          });
          if (res.status > 0) {
            return {
              ok: true,
              detail: `process_started:ready_after_ms=${(i + 1) * 500}`,
              pid: child.pid,
            };
          }
        } catch {
          // still booting
        }
      }
      if (child.exitCode != null) {
        return {
          ok: false,
          detail: `process_exited:${child.exitCode}:${bootLog.slice(0, 180)}`,
        };
      }
      return {
        ok: true,
        detail: "process_started:listen_unconfirmed",
        pid: child.pid,
      };
    },
    async stop(input) {
      const key = `${input.siteId}:${input.deploymentId}`;
      const child = children.get(key);
      if (child && !child.killed) {
        child.kill("SIGTERM");
        await sleep(1500);
        if (!child.killed && child.exitCode == null) child.kill("SIGKILL");
      }
      children.delete(key);
      if (input.pid && (!child || child.pid !== input.pid)) {
        try {
          process.kill(input.pid, "SIGTERM");
        } catch {
          // already gone
        }
      }
    },
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
