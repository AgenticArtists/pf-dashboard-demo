// Runs every web/scripts/*-checks.mjs suite in sequence and fails if any
// suite fails. Discovery-based: a new *-checks.mjs file joins the run
// automatically. Suites are invoked exactly as when run by hand
// (`node scripts/<name>-checks.mjs` from the web/ root) — several suites
// and lib modules read data/ relative to process.cwd(), so each child is
// spawned with cwd pinned to the web root regardless of where this runner
// itself was invoked from.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptsDir, "..");
const self = path.basename(fileURLToPath(import.meta.url));

const suites = readdirSync(scriptsDir)
  .filter((f) => f.endsWith("-checks.mjs") && f !== self)
  .sort();

if (suites.length === 0) {
  console.error("run-checks: no *-checks.mjs suites found in web/scripts/");
  process.exit(1);
}

const results = [];
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const r = spawnSync(process.execPath, [path.join(scriptsDir, suite)], {
    cwd: webRoot,
    stdio: "inherit",
  });
  const ok = r.status === 0;
  results.push({ suite, ok, status: r.status, error: r.error });
  console.log(`--- ${suite}: ${ok ? "PASS" : `FAIL (exit ${r.status})`}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n===== site checks: ${results.length - failed.length}/${results.length} suites passed =====`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.suite}`);
if (failed.length > 0) {
  console.error(`\nrun-checks: ${failed.length} suite(s) failed: ${failed.map((r) => r.suite).join(", ")}`);
  process.exit(1);
}
