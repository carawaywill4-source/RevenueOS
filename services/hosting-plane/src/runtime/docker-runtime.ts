/**
 * Docker runtime — preferred production isolation on VPS.
 * Soft-fails to unavailable when docker CLI is missing.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import type { RuntimeAdapter } from "./types.js";

function docker(...args: string[]) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

export function createDockerRuntime(repoRoot: string): RuntimeAdapter {
  return {
    kind: "docker",
    async available() {
      const r = docker("info");
      return r.status === 0;
    },
    async start(input) {
      const name = `ros-${input.siteId}-${input.deploymentId}`.slice(0, 63);
      // Remove stale
      docker("rm", "-f", name);

      const dockerfile = path.join(
        repoRoot,
        "services/hosting-plane/templates/Dockerfile.storefront",
      );
      const image = `revenueos-site:${input.siteId}-${input.deploymentId}`;
      const build = spawnSync(
        "docker",
        [
          "build",
          "-f",
          dockerfile,
          "--build-arg",
          `SITE_ID=${input.siteId}`,
          "-t",
          image,
          repoRoot,
        ],
        { encoding: "utf8" },
      );
      if (build.status !== 0) {
        return {
          ok: false,
          detail: `docker_build_failed:${(build.stderr || "").slice(0, 240)}`,
        };
      }

      const envArgs: string[] = [];
      for (const [k, v] of Object.entries(input.env)) {
        envArgs.push("-e", `${k}=${v}`);
      }
      const mem = `${input.limits.memoryMb}m`;
      const cpus = String(Math.max(0.1, input.limits.cpuMillicores / 1000));
      const run = docker(
        "run",
        "-d",
        "--name",
        name,
        "--restart",
        "unless-stopped",
        "--memory",
        mem,
        "--cpus",
        cpus,
        "-p",
        `127.0.0.1:${input.port}:3000`,
        ...envArgs,
        image,
      );
      if (run.status !== 0) {
        return {
          ok: false,
          detail: `docker_run_failed:${(run.stderr || "").slice(0, 240)}`,
        };
      }
      return {
        ok: true,
        detail: "container_started",
        containerId: (run.stdout || "").trim(),
      };
    },
    async stop(input) {
      const name = `ros-${input.siteId}-${input.deploymentId}`.slice(0, 63);
      docker("rm", "-f", name);
      if (input.containerId) docker("rm", "-f", input.containerId);
    },
  };
}
