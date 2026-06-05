import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  readLocalSourceLine,
  resolveLocalWorkingStoragePath,
  workingFileR2Key,
} from "../../src/sources/source-row-reconstruction";

const testDir = "data/.duanera-test-source-row-reconstruction";
const testFile = `${testDir}/sample_2026_04.txt`;

test.beforeEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(testDir, { recursive: true });
  await writeFile(testFile, "uno;dos\nCAMIÓN;dos\ntres;cuatro\n", "latin1");
});

test.afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

test("resolves local working paths only inside data", () => {
  assert.equal(resolveLocalWorkingStoragePath(testFile), path.resolve(testFile));
  assert.throws(
    () => resolveLocalWorkingStoragePath("scripts/not-data.txt"),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolveLocalWorkingStoragePath(path.resolve("..", "outside.txt")),
    /must stay inside the repository/,
  );
});

test("reads a one-based source line from a local working file", async () => {
  assert.equal(await readLocalSourceLine(testFile, 1), "uno;dos");
  assert.equal(await readLocalSourceLine(testFile, 2), "CAMIÓN;dos");
  assert.equal(await readLocalSourceLine(testFile, 99), null);
});

test("builds private R2 working-file keys without exposing local paths", () => {
  assert.equal(
    workingFileR2Key({
      rowNumber: 10,
      rowHashSha256: "hash",
      workingStorageKey:
        "data/sources/chile-aduana/datos-gob-cl/imports/working/cl_aduana_imports_2026_04.txt",
      sourceDomain: "datos.gob.cl",
      tradeFlow: "import",
      periodYear: 2026,
      periodMonth: 4,
    }),
    "sources/cl/aduana/datos-gob-cl/imports/2026/04/working/cl_aduana_imports_2026_04.txt",
  );

  assert.equal(
    workingFileR2Key({
      rowNumber: 10,
      rowHashSha256: "hash",
      workingStorageKey: null,
      sourceDomain: "datos.gob.cl",
      tradeFlow: "import",
      periodYear: 2026,
      periodMonth: 4,
    }),
    null,
  );
});
