import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { repoRelativePath, resolveArchiveDataDirPath } from "./r2-upload-plan";

test("resolves archive planner repository paths safely", () => {
  assert.equal(repoRelativePath(path.resolve("package.json")), "package.json");
  assert.throws(
    () => repoRelativePath(path.resolve("..", "outside.txt")),
    /archive planner path must stay inside the repository/,
  );
});

test("limits archive planner data directories to the ignored data archive", () => {
  assert.equal(resolveArchiveDataDirPath("data"), path.resolve("data"));
  assert.equal(resolveArchiveDataDirPath("data/sources"), path.resolve("data/sources"));
  assert.equal(resolveArchiveDataDirPath(path.resolve("data/research")), path.resolve("data/research"));

  assert.throws(
    () => resolveArchiveDataDirPath("."),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolveArchiveDataDirPath("scripts"),
    /must be inside the ignored data\/ archive/,
  );
  assert.throws(
    () => resolveArchiveDataDirPath(path.resolve("..", "data")),
    /archive planner path must stay inside the repository/,
  );
});
