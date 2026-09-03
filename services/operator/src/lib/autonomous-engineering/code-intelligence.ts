/**
 * Repository intelligence — search / symbol / env / test discovery over appRoot.
 * No external paid AI required.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type CodeHit = {
  file: string;
  line: number;
  text: string;
};

function walkFiles(root: string, maxFiles = 400): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (out.length >= maxFiles) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= maxFiles) break;
      if (
        e === "node_modules" ||
        e === ".git" ||
        e === ".data" ||
        e === "dist" ||
        e.startsWith(".")
      ) {
        continue;
      }
      const p = path.join(d, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|mjs|sql|md)$/.test(e)) out.push(p);
    }
  };
  walk(root);
  return out;
}

export function searchCode(
  appRoot: string,
  pattern: RegExp,
  opts?: { roots?: string[]; maxHits?: number },
): CodeHit[] {
  const roots = (opts?.roots ?? ["services/operator/src", "packages"]).map(
    (r) => path.join(appRoot, r),
  );
  const maxHits = opts?.maxHits ?? 40;
  const hits: CodeHit[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walkFiles(root, 300)) {
      let src = "";
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i]!)) {
          hits.push({
            file: path.relative(appRoot, file),
            line: i + 1,
            text: lines[i]!.slice(0, 200),
          });
          if (hits.length >= maxHits) return hits;
        }
        pattern.lastIndex = 0;
      }
    }
  }
  return hits;
}

export function findSymbol(appRoot: string, symbol: string): CodeHit[] {
  const re = new RegExp(
    `(export\\s+(async\\s+)?function\\s+${symbol}\\b|export\\s+(const|type|class)\\s+${symbol}\\b|function\\s+${symbol}\\b)`,
  );
  return searchCode(appRoot, re, { maxHits: 20 });
}

export function findEnvReferences(appRoot: string, envVar: string): CodeHit[] {
  return searchCode(appRoot, new RegExp(`process\\.env\\.${envVar}\\b`), {
    maxHits: 30,
  });
}

export function discoverTests(appRoot: string): string[] {
  const testRoot = path.join(appRoot, "services/operator/src/tests");
  if (!existsSync(testRoot)) return [];
  return readdirSync(testRoot)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join("services/operator/src/tests", f));
}

export function correlateLogEventToCode(
  appRoot: string,
  eventName: string,
): CodeHit[] {
  return searchCode(appRoot, new RegExp(`["']${eventName}["']`), {
    maxHits: 15,
  });
}

export function locateCommercialComms(appRoot: string): {
  compose: CodeHit[];
  newAudience: CodeHit[];
  lessons: CodeHit[];
} {
  return {
    compose: findSymbol(appRoot, "composeCommercialEmail"),
    newAudience: findSymbol(appRoot, "executeNewAudienceBet"),
    lessons: searchCode(appRoot, /commercial_comms_lessons/, { maxHits: 15 }),
  };
}
