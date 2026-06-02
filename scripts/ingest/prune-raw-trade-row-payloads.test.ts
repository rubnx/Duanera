import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePruneArgs,
  parsePruneFlow,
  resolvePruneMode,
} from "./prune-raw-trade-row-payloads";

test("defaults raw row payload pruning to dry-run", () => {
  const args = parsePruneArgs([]);

  assert.deepEqual(args, { mode: "dry-run" });
  assert.equal(resolvePruneMode(args, {}), "dry-run");
});

test("requires both --prune and RAW_ROW_PRUNE_CONFIRM=prune to prune", () => {
  const args = parsePruneArgs(["--prune"]);

  assert.throws(
    () => resolvePruneMode(args, {}),
    /RAW_ROW_PRUNE_CONFIRM=prune/,
  );
  assert.equal(resolvePruneMode(args, { RAW_ROW_PRUNE_CONFIRM: "prune" }), "prune");
});

test("rejects lingering prune confirmation without --prune", () => {
  assert.throws(
    () => resolvePruneMode(parsePruneArgs([]), { RAW_ROW_PRUNE_CONFIRM: "prune" }),
    /--prune was not passed/,
  );
});

test("rejects ambiguous raw row prune mode arguments", () => {
  assert.throws(
    () => parsePruneArgs(["--dry-run", "--prune"]),
    /either --dry-run or --prune/,
  );
  assert.throws(
    () => parsePruneArgs(["--prune", "--dry-run"]),
    /either --dry-run or --prune/,
  );
  assert.throws(() => parsePruneArgs(["--apply"]), /Unknown argument/);
});

test("parses optional raw row prune flow safely", () => {
  assert.equal(parsePruneFlow(undefined), null);
  assert.equal(parsePruneFlow("import"), "import");
  assert.equal(parsePruneFlow("export"), "export");
  assert.throws(() => parsePruneFlow("both"), /must be import or export/);
});
