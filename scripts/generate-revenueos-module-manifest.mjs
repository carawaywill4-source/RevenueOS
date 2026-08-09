#!/usr/bin/env node
/**
 * Generate an exhaustive inventory of packages/revenueos modules.
 * Does NOT delete or mark anything obsolete — preservation manifest only.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PKG = path.join(ROOT, "packages/revenueos/src");
const OUT_MD = path.join(ROOT, "docs/REVENUEOS_MODULE_MANIFEST.md");
const OUT_JSON = path.join(ROOT, "docs/REVENUEOS_MODULE_MANIFEST.json");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(PKG, p).replace(/\\/g, "/");
}

function parseImports(src) {
  const imports = [];
  const re =
    /(?:import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\))/g;
  let m;
  while ((m = re.exec(src))) {
    imports.push(m[1] || m[2] || m[3]);
  }
  return [...new Set(imports)];
}

function purposeFromFile(filename, src) {
  const block = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (block) {
    const lines = block[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter((l) => l && !l.startsWith("@"));
    if (lines[0]) return lines.slice(0, 2).join(" ");
  }
  const first = src
    .split("\n")
    .find((l) => l.startsWith("//") && l.length > 5);
  if (first) return first.replace(/^\/\/\s*/, "").slice(0, 160);
  return `(no docstring) ${filename}`;
}

function detectFlags(src, imports) {
  const joined = src + "\n" + imports.join("\n");
  const mutatesLearning = /upsert|insert|update|saveExperiment|writeLesson|bandit|posterior|learnedFit|recordOutcome|persist/i.test(
    src,
  );
  const assumesVercel =
    /process\.env\.VERCEL|\/tmp\/revenueos|maxDuration|waitUntil|@vercel\/|CRON_SECRET/i.test(
      src,
    );
  const persistence = [];
  if (/supabase|createClient|from\(['"]revenueos_/i.test(joined))
    persistence.push("supabase");
  if (/readFile|writeFile|\/tmp|mkdirSync|fs\./i.test(src)) persistence.push("filesystem");
  if (/localStorage|IndexedDB/i.test(src)) persistence.push("browser-storage");

  const external = [];
  for (const [name, pat] of [
    ["stripe", /stripe/i],
    ["openai", /openai|OPENAI_/i],
    ["resend", /resend|RESEND_/i],
    ["reddit", /reddit|devvit/i],
    ["google", /googleapis|searchconsole|GSC_/i],
    ["youtube", /youtube|YOUTUBE_/i],
    ["producthunt", /producthunt|PRODUCT_HUNT/i],
    ["gumroad", /gumroad/i],
  ]) {
    if (pat.test(joined)) external.push(name);
  }

  const execution = [];
  if (/fetch\(|axios/i.test(src)) execution.push("http");
  if (/playwright|sidecar/i.test(joined)) execution.push("browser-sidecar");
  if (/cron|scheduler|setInterval|runOperatorTick|runPursuit/i.test(src))
    execution.push("scheduler-loop");

  return {
    mutatesLearning,
    assumesVercelServerless: assumesVercel,
    persistenceDependencies: persistence,
    externalServiceDependencies: external,
    executionDependencies: execution,
  };
}

const files = walk(PKG).sort();
const byRel = new Map(files.map((f) => [rel(f), f]));
const contents = new Map(
  files.map((f) => [rel(f), readFileSync(f, "utf8")]),
);

// Build reverse import graph within package
const callers = new Map();
for (const [r] of contents) callers.set(r, []);
for (const [r, src] of contents) {
  for (const imp of parseImports(src)) {
    if (!imp.startsWith(".")) continue;
    const base = path.posix.normalize(
      path.posix.join(path.posix.dirname(r), imp),
    );
    const candidates = [
      base,
      `${base}.ts`,
      `${base}/index.ts`,
    ];
    for (const c of candidates) {
      const key = c.replace(/^\.\//, "");
      if (contents.has(key)) {
        callers.get(key).push(r);
        break;
      }
      // try without leading ./
      const k2 = key.startsWith("/") ? key.slice(1) : key;
      if (contents.has(k2)) {
        callers.get(k2).push(r);
        break;
      }
    }
  }
}

const modules = [];
for (const [r, src] of contents) {
  const imports = parseImports(src);
  const flags = detectFlags(src, imports);
  modules.push({
    filename: r,
    purpose: purposeFromFile(path.basename(r), src),
    imports,
    callers: [...new Set(callers.get(r) || [])].sort(),
    ...flags,
    doNotDelete: true,
  });
}

const moduleDir = modules.filter((m) => m.filename.startsWith("modules/"));
const intelligence = modules.filter((m) =>
  m.filename.startsWith("intelligence/"),
);
const memory = modules.filter((m) => m.filename.startsWith("memory/"));

const json = {
  generatedAt: new Date().toISOString(),
  package: "packages/revenueos",
  totalFiles: modules.length,
  modulesCount: moduleDir.length,
  intelligenceCount: intelligence.length,
  memoryCount: memory.length,
  rule: "No RevenueOS brain module may be deleted without explicit owner approval.",
  modules,
};

writeFileSync(OUT_JSON, JSON.stringify(json, null, 2));

const lines = [
  "# RevenueOS Module Manifest",
  "",
  `Generated: ${json.generatedAt}`,
  "",
  "**Rule:** Treat every module as preserved behavior. Do not delete without owner approval. Trace call paths before changing anything.",
  "",
  `Total TypeScript files under \`packages/revenueos/src\`: **${modules.length}**`,
  `- \`modules/\`: ${moduleDir.length}`,
  `- \`intelligence/\`: ${intelligence.length}`,
  `- \`memory/\`: ${memory.length}`,
  "",
  "## Modules (`modules/`)",
  "",
  "| File | Purpose | Mutates learning | Assumes Vercel | Persistence | External | Callers (in-pkg) |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];

for (const m of moduleDir) {
  lines.push(
    `| \`${m.filename}\` | ${m.purpose.replace(/\|/g, "/").slice(0, 120)} | ${m.mutatesLearning ? "yes" : "no"} | ${m.assumesVercelServerless ? "yes" : "no"} | ${(m.persistenceDependencies.join(", ") || "—")} | ${(m.externalServiceDependencies.join(", ") || "—")} | ${m.callers.length} |`,
  );
}

lines.push("", "## Intelligence", "");
for (const m of intelligence) {
  lines.push(`- \`${m.filename}\` — ${m.purpose.slice(0, 140)}`);
}
lines.push("", "## Memory", "");
for (const m of memory) {
  lines.push(`- \`${m.filename}\` — ${m.purpose.slice(0, 140)}`);
}
lines.push(
  "",
  "## Full machine-readable inventory",
  "",
  "See `docs/REVENUEOS_MODULE_MANIFEST.json` for imports, callers, and dependency flags for every file.",
  "",
);

writeFileSync(OUT_MD, lines.join("\n"));
console.log("Wrote", OUT_MD);
console.log("Wrote", OUT_JSON);
console.log(
  `modules/=${moduleDir.length} intelligence/=${intelligence.length} memory/=${memory.length} total=${modules.length}`,
);
