import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "vendor/revenueos/package.json",
  "vendor/revenueos/src/index.ts",
  "vendor/revenueos/src/executive.ts",
  "vendor/revenueos/src/intelligence/planner-quota.ts",
  "vendor/revenueos/src/modules/action-registry.ts",
];

const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
if (missing.length) {
  console.error(
    [
      "Mendhaus build aborted: vendored @revenueos/core is incomplete.",
      "Vercel roots this app at apps/mendhaus, so it cannot import ../../packages/revenueos.",
      "From the repo root run: npm run sync:revenueos --workspace=@mendhaus/store",
      "Missing:",
      ...missing.map((rel) => `  - ${rel}`),
    ].join("\n"),
  );
  process.exit(1);
}

console.log("RevenueOS vendor package OK");
