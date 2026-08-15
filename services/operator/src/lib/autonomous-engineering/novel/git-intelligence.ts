/**
 * Git / history intelligence. Uses .git when present; falls back to AE known-good.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type GitCommit = {
  hash: string;
  subject: string;
  date: string;
};

function git(
  appRoot: string,
  args: string[],
): { ok: boolean; out: string } {
  if (!existsSync(path.join(appRoot, ".git"))) {
    return { ok: false, out: "no_git" };
  }
  const r = spawnSync("git", ["-C", appRoot, ...args], {
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 2_000_000,
  });
  if (r.status !== 0) {
    return { ok: false, out: (r.stderr || r.stdout || "git_failed").slice(0, 400) };
  }
  return { ok: true, out: r.stdout || "" };
}

export function hasGit(appRoot: string): boolean {
  return existsSync(path.join(appRoot, ".git"));
}

export function recentCommits(appRoot: string, n = 15): GitCommit[] {
  const r = git(appRoot, ["log", `-${n}`, "--pretty=format:%h|%ad|%s", "--date=short"]);
  if (!r.ok) return [];
  return r.out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...rest] = line.split("|");
      return { hash: hash!, date: date!, subject: rest.join("|") };
    });
}

export function fileHistory(
  appRoot: string,
  relativePath: string,
  n = 8,
): GitCommit[] {
  const r = git(appRoot, [
    "log",
    `-${n}`,
    "--pretty=format:%h|%ad|%s",
    "--date=short",
    "--",
    relativePath,
  ]);
  if (!r.ok) return [];
  return r.out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...rest] = line.split("|");
      return { hash: hash!, date: date!, subject: rest.join("|") };
    });
}

export function diffStat(appRoot: string, sinceRef = "HEAD~5"): string {
  const r = git(appRoot, ["diff", "--stat", sinceRef, "HEAD"]);
  return r.ok ? r.out.slice(0, 2000) : r.out;
}

export function blameSnippet(
  appRoot: string,
  relativePath: string,
  line: number,
): string {
  const r = git(appRoot, [
    "blame",
    "-L",
    `${line},${line}`,
    "--",
    relativePath,
  ]);
  return r.ok ? r.out.trim().slice(0, 240) : r.out;
}

/** Fallback when Azure tree has no .git — scan AE known-good snapshots. */
export function knownGoodRevisions(appRoot: string): Array<{
  evolutionId: string;
  files: string[];
  path: string;
}> {
  const root = path.join(appRoot, ".data/revenueos/autonomous-engineering");
  if (!existsSync(root)) return [];
  const out: Array<{ evolutionId: string; files: string[]; path: string }> = [];
  for (const e of readdirSync(root)) {
    const man = path.join(root, e, "rollback.json");
    if (!existsSync(man)) continue;
    try {
      const doc = JSON.parse(readFileSync(man, "utf8")) as {
        evolutionId?: string;
        filesChanged?: string[];
        knownGoodDir?: string;
      };
      out.push({
        evolutionId: doc.evolutionId ?? e,
        files: doc.filesChanged ?? [],
        path: doc.knownGoodDir ?? path.join(root, e, "known-good"),
      });
    } catch {
      /* */
    }
  }
  return out.slice(-20);
}

export function gitIntelligenceSummary(appRoot: string): Record<string, unknown> {
  const commits = recentCommits(appRoot, 10);
  return {
    hasGit: hasGit(appRoot),
    recentCommits: commits,
    knownGoodRevisions: knownGoodRevisions(appRoot).map((k) => ({
      evolutionId: k.evolutionId,
      files: k.files.length,
    })),
    tip: commits[0] ?? null,
  };
}

export function ensureGitWorktreeHint(appRoot: string): string {
  if (hasGit(appRoot)) return "git_available";
  // Azure often lacks .git — novel mode still proceeds with known-good history
  try {
    const st = statSync(path.join(appRoot, "services/operator/src"));
    return `no_git_fallback_known_good mtime=${st.mtime.toISOString()}`;
  } catch {
    return "no_git";
  }
}
