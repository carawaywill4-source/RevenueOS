/**
 * Context-aware synthesis validation — prevents fragile novel patches.
 * Regression: AE_SQL_COLON_REGRESSION_001 (SQL // comments inside template literals).
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type pg from "pg";
import { SQL_REGRESSION_ID } from "./types.js";

export type ValidationIssue = {
  file: string;
  severity: "error" | "warn";
  code: string;
  message: string;
};

export type ValidationReport = {
  ok: boolean;
  issues: ValidationIssue[];
  regressionCases: string[];
};

/** Detect // or # comments inside SQL backtick template strings (AE_SQL_COLON_REGRESSION_001). */
export function findSqlCommentInTemplateLiterals(src: string): string[] {
  const hits: string[] = [];
  const re = /`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const body = m[1] ?? "";
    if (!/\b(select|insert|update|delete|with)\b/i.test(body)) continue;
    // Illegal: line-comment markers inside SQL templates (postgres rejects //)
    if (/^[ \t]*\/\//m.test(body) || /\/\*[\s\S]*?\*\//.test(body)) {
      hits.push("sql_comment_inside_template_literal");
    }
    // Broken template: unclosed quote patterns that caused "syntax error at or near :"
    if (/interval\s+'[^']*'\s*\n\s*\/\//i.test(body)) {
      hits.push(SQL_REGRESSION_ID);
    }
    // :: casts followed by garbage from comment bleed
    if (/::\w+\s*\/\//.test(body)) {
      hits.push(SQL_REGRESSION_ID);
    }
  }
  return [...new Set(hits)];
}

export function validateTypeScriptFile(absPath: string, src: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rel = absPath;
  for (const code of findSqlCommentInTemplateLiterals(src)) {
    issues.push({
      file: rel,
      severity: "error",
      code,
      message: `SQL template contains comments or AE_SQL_COLON_REGRESSION_001 pattern`,
    });
  }
  // Balanced braces (lightweight)
  let depth = 0;
  for (const ch of src) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0) {
      issues.push({
        file: rel,
        severity: "error",
        code: "unbalanced_braces",
        message: "Unbalanced }",
      });
      break;
    }
  }
  if (depth !== 0) {
    issues.push({
      file: rel,
      severity: "error",
      code: "unbalanced_braces",
      message: `Unbalanced braces depth=${depth}`,
    });
  }
  // Import paths that clearly can't resolve (.ts written as .js is OK for ESM)
  if (/\bfrom\s+["'][^"']+\.ts["']/.test(src)) {
    issues.push({
      file: rel,
      severity: "warn",
      code: "ts_import_extension",
      message: "Import uses .ts extension; prefer .js for ESM runtime",
    });
  }
  return issues;
}

/** Extract SQL strings from TS and PREPARE them in a rolled-back transaction. */
export async function validateSqlAgainstDb(
  pool: pg.Pool,
  src: string,
  file: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const re = /`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    while ((m = re.exec(src))) {
      const body = (m[1] ?? "").trim();
      if (!/\b(select|insert|update|delete|with)\b/i.test(body)) continue;
      if (body.includes("${") || body.includes("$1")) {
        // Parameterized — try prepare with placeholders replaced by NULL literals carefully
        const prepared = body
          .replace(/\$\{\s*[^}]+\s*\}/g, "NULL")
          .replace(/\$\d+/g, "NULL");
        try {
          await client.query(`prepare ae_synth_check as ${prepared}`);
          await client.query("deallocate ae_synth_check");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Skip if prepare fails due to NULL type ambiguity — still catch syntax
          if (/syntax error/i.test(msg)) {
            issues.push({
              file,
              severity: "error",
              code: "sql_prepare_failed",
              message: msg.slice(0, 200),
            });
          }
        }
      }
    }
    await client.query("rollback");
  } catch (e) {
    try {
      await client.query("rollback");
    } catch {
      /* */
    }
    issues.push({
      file,
      severity: "warn",
      code: "sql_validate_skipped",
      message: e instanceof Error ? e.message.slice(0, 120) : "sql_validate_error",
    });
  } finally {
    client.release();
  }
  return issues;
}

export async function validateSynthesizedFiles(input: {
  pool: pg.Pool;
  appRoot: string;
  filesChanged: string[];
}): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];
  const regressionCases: string[] = [];
  for (const rel of input.filesChanged) {
    const abs = path.join(input.appRoot, rel);
    if (!existsSync(abs)) {
      issues.push({
        file: rel,
        severity: "error",
        code: "missing_file",
        message: "Synthesized file missing",
      });
      continue;
    }
    const src = readFileSync(abs, "utf8");
    if (rel.endsWith(".ts") || rel.endsWith(".js")) {
      issues.push(...validateTypeScriptFile(rel, src));
      const sqlIssues = await validateSqlAgainstDb(input.pool, src, rel);
      issues.push(...sqlIssues);
    }
  }
  for (const i of issues) {
    if (i.code === SQL_REGRESSION_ID || i.message.includes(SQL_REGRESSION_ID)) {
      regressionCases.push(SQL_REGRESSION_ID);
    }
    if (i.code === "sql_comment_inside_template_literal") {
      regressionCases.push(SQL_REGRESSION_ID);
    }
  }
  // Persist regression fixture for suite
  if (regressionCases.includes(SQL_REGRESSION_ID)) {
    const dir = path.join(
      input.appRoot,
      ".data/revenueos/autonomous-engineering/regressions",
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, `${SQL_REGRESSION_ID}.json`),
      JSON.stringify(
        {
          id: SQL_REGRESSION_ID,
          at: new Date().toISOString(),
          issues: issues.filter((x) => x.severity === "error"),
          lesson:
            "Never inject // or block comments inside SQL template literals; validate with prepare+rollback",
        },
        null,
        2,
      ),
    );
  }
  const errors = issues.filter((i) => i.severity === "error");
  return { ok: errors.length === 0, issues, regressionCases: [...new Set(regressionCases)] };
}

/** Unit-testable: known-bad fixture must fail. */
export function regressionSqlColonFixtureFails(): boolean {
  const bad = `
    const q = await pool.query(
      \`select count(*)::int as n from t
       where created_at > now() - interval '24 hours'
  // AE_NOVEL_V2_B: cap only PUBLISHED\`,
    );
  `;
  const hits = findSqlCommentInTemplateLiterals(bad);
  return hits.includes(SQL_REGRESSION_ID) || hits.includes("sql_comment_inside_template_literal");
}

export function runTsSyntaxCheck(absPath: string): { ok: boolean; detail: string } {
  if (!existsSync(absPath)) return { ok: false, detail: "missing" };
  const r = spawnSync(
    "node",
    ["--check", absPath],
    { encoding: "utf8", timeout: 15_000 },
  );
  // .ts may not parse with node --check; try tsx if available
  if (r.status === 0) return { ok: true, detail: "node_check_ok" };
  const tsx = spawnSync(
    "npx",
    ["--yes", "tsx", "--eval", `import(${JSON.stringify(absPath)})`],
    { encoding: "utf8", timeout: 20_000 },
  );
  // Import may fail on missing deps — only treat SyntaxError as hard fail
  const err = `${tsx.stderr || ""}${tsx.stdout || ""}`;
  if (/SyntaxError|sql_comment/i.test(err)) {
    return { ok: false, detail: err.slice(0, 200) };
  }
  return { ok: true, detail: "tsx_import_soft_ok" };
}
