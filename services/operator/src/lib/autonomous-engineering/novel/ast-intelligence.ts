/**
 * Structural code intelligence — imports/exports/callers + lightweight graph.
 * Uses TypeScript compiler API when available; regex fallback otherwise.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

export type ModuleInfo = {
  file: string;
  imports: string[];
  exports: string[];
  envRefs: string[];
  tableRefs: string[];
};

export type ImpactReport = {
  file: string;
  symbol?: string;
  importers: string[];
  riskFiles: string[];
};

function walkTs(root: string, max = 250): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (out.length >= max) return;
    let ents: string[] = [];
    try {
      ents = readdirSync(d);
    } catch {
      return;
    }
    for (const e of ents) {
      if (out.length >= max) break;
      if (e === "node_modules" || e === ".data" || e.startsWith(".")) continue;
      const p = path.join(d, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (e.endsWith(".ts") && !e.endsWith(".d.ts")) out.push(p);
    }
  };
  walk(root);
  return out;
}

function analyzeRegex(file: string, appRoot: string): ModuleInfo {
  const src = readFileSync(file, "utf8");
  const imports = [
    ...src.matchAll(/from\s+["']([^"']+)["']/g),
  ].map((m) => m[1]!);
  const exports = [
    ...src.matchAll(
      /export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g,
    ),
  ].map((m) => m[1]!);
  const envRefs = [
    ...src.matchAll(/process\.env\.([A-Z0-9_]+)/g),
  ].map((m) => m[1]!);
  const tableRefs = [
    ...src.matchAll(
      /\b(from|into|update|join)\s+([a-z_][a-z0-9_]*)\b/gi,
    ),
  ]
    .map((m) => m[2]!)
    .filter((t) => /^(ros_|aq_|titan_)/.test(t));
  return {
    file: path.relative(appRoot, file),
    imports: [...new Set(imports)].slice(0, 40),
    exports: [...new Set(exports)].slice(0, 40),
    envRefs: [...new Set(envRefs)].slice(0, 30),
    tableRefs: [...new Set(tableRefs)].slice(0, 30),
  };
}

function tryTsAnalyze(file: string, appRoot: string): ModuleInfo | null {
  try {
    const req = createRequire(
      path.join(appRoot, "package.json"),
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = req("typescript") as typeof import("typescript");
    const src = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const imports: string[] = [];
    const exports: string[] = [];
    const visit = (node: import("typescript").Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
        if (ts.isStringLiteral(node.moduleSpecifier)) {
          imports.push(node.moduleSpecifier.text);
        }
      }
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        exports.push(node.name.text);
      }
      if (
        ts.isVariableStatement(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) exports.push(d.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    const base = analyzeRegex(file, appRoot);
    return {
      ...base,
      imports: [...new Set([...imports, ...base.imports])].slice(0, 40),
      exports: [...new Set([...exports, ...base.exports])].slice(0, 40),
    };
  } catch {
    return null;
  }
}

export function indexOperatorModules(appRoot: string): ModuleInfo[] {
  const root = path.join(appRoot, "services/operator/src/lib");
  if (!existsSync(root)) return [];
  const files = walkTs(root, 200);
  return files.map((f) => tryTsAnalyze(f, appRoot) ?? analyzeRegex(f, appRoot));
}

export function findImporters(
  appRoot: string,
  relativePath: string,
): string[] {
  const needle = relativePath
    .replace(/^services\/operator\/src\/lib\//, "")
    .replace(/\.ts$/, "");
  const infos = indexOperatorModules(appRoot);
  const importers: string[] = [];
  for (const m of infos) {
    if (m.file === relativePath) continue;
    if (
      m.imports.some(
        (i) =>
          i.includes(needle) ||
          i.includes(path.basename(relativePath, ".ts")),
      )
    ) {
      importers.push(m.file);
    }
  }
  return importers.slice(0, 40);
}

export function impactIfChanged(
  appRoot: string,
  relativePath: string,
): ImpactReport {
  const importers = findImporters(appRoot, relativePath);
  return {
    file: relativePath,
    importers,
    riskFiles: importers.slice(0, 20),
  };
}

export function buildDependencySummary(appRoot: string): Record<string, unknown> {
  const mods = indexOperatorModules(appRoot);
  const envCounts: Record<string, number> = {};
  const tableCounts: Record<string, number> = {};
  for (const m of mods) {
    for (const e of m.envRefs) envCounts[e] = (envCounts[e] ?? 0) + 1;
    for (const t of m.tableRefs) tableCounts[t] = (tableCounts[t] ?? 0) + 1;
  }
  return {
    moduleCount: mods.length,
    topEnv: Object.entries(envCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
    topTables: Object.entries(tableCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
    sampleExports: mods
      .filter((m) => m.exports.length)
      .slice(0, 12)
      .map((m) => ({ file: m.file, exports: m.exports.slice(0, 5) })),
    astEngine: "typescript_api_or_regex_fallback",
  };
}
